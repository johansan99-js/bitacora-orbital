// Motor de la simulación de población de "La Tierra": mundo, clima, gente, innovaciones e hitos.
// No usa three.js ni el DOM, así que corre igual en el navegador y en Node (pruebas y calibración).
const Motor = (() => {
  // Biomas: los mismos códigos que MUNDO.bioma
  const MAR = 0, HIELO = 1, TUNDRA = 2, DESIERTO = 3, ESTEPA = 4, BOSQUE = 5, SELVA = 6;
  // Innovaciones (bits)
  const COSTERA = 1, AGRICULTURA = 2, CIUDADES = 4, ESCRITURA = 8, ALTURA = 16, INDUSTRIA = 32;
  const BITS = [COSTERA, AGRICULTURA, CIUDADES, ESCRITURA, ALTURA, INDUSTRIA];
  // Etapas de una celda
  const VACIA = 0, RECOLECTORES = 1, AGRICULTORES = 2, URBANA = 3, INDUSTRIAL = 4;
  const D2R = Math.PI / 180, KM_GRADO = 111.32;

  // Parámetros de las reglas. Los valores finales salen de la calibración (pruebas/calibrar.mjs).
  const PARAMS = {
    // Personas por km² según etapa (1–4) y bioma (0 mar, 1 hielo, 2 tundra, 3 desierto, 4 estepa, 5 bosque, 6 selva).
    // Recolectores: densidades etnográficas (Binford 2001, "Constructing Frames of Reference").
    densidad: [
      null,
      [0, 0, 0.02, 0.005, 0.08, 0.06, 0.1],
      [0, 0, 0, 0.045, 0.9, 0.6, 0.45],
      [0, 0, 0, 0.07, 1.35, 0.9, 0.7],
      [0, 0, 1, 8, 150, 100, 80]
    ],
    costa: 1.5,              // extra de la pesca para recolectores en celdas costeras
    frio: 0.5,               // pérdida máxima de capacidad en latitudes altas en plena glaciación
    crecimiento: [0, 0.003, 0.01, 0.01, 0.025],   // tasa r por año según la etapa
    minimo: 10,              // menos gente que esto en una celda = deshabitada; tampoco salen grupos más chicos
    establecida: 100,        // gente necesaria para que una llegada cuente como hito
    exploracion: 0.002,      // fracción que se va por año aunque haya espacio
    presion: 0.004,          // fracción extra por año cuando la celda está llena
    cruce: [0.0002, 0.0005, 0.0005],   // probabilidad por año de cruzar el mar desde una costa: sin navegación, costera, de altura
    alcance: [1, 2, 20],     // celdas de agua que se pueden cruzar en cada caso
    costera: 2e-7,           // aparición de la navegación costera, por año y por cada 1.000 personas en la costa
    agricultura: 0.002,      // aparición de la agricultura por año en una celda llena de una región con domesticables
    llenaAgricultura: 0.7,   // fracción de la capacidad de recolectores desde la que empieza a aparecer
    ciudades: 0.5,           // aparición de ciudades por año con densidad al doble del umbral y todas las vecinas agrícolas
    densidadCiudad: 1.8,     // personas por km² desde las que pueden aparecer ciudades
    escritura: 0.0005,       // aparición de la escritura por año y por cada vecina con ciudades más allá del mínimo
    vecinosEscritura: 2,     // vecinas con ciudades necesarias para que aparezca la escritura
    altura: 0.00005,         // aparición de la navegación de altura por año con saber suficiente
    saberAltura: 2000,       // saber con el que la navegación de altura llega a su probabilidad completa
    industria: 0.5,          // aparición de la industria por año con saber al doble del umbral
    saberIndustria: 19500,   // saber desde el que puede aparecer la industria
    ritmoSaber: 13.3,        // saber ganado por año por cada millón de personas agrícolas
    escrituraSaber: 1,       // multiplicador del saber ganado con escritura (1 = sin efecto; la escritura actúa por contagioEscritura)
    difusionSaber: 0.002,    // ritmo con el que el saber se iguala con el de las vecinas
    saberIntensifica: 5000,  // cada tantos puntos de saber, la capacidad agrícola y urbana sube un 100 %
    saberMax: 3,             // tope de esa subida (capacidad ×4)
    contagio: { 1: 0.002, 2: 0.004, 4: 0.002, 8: 0.003, 16: 0.002, 32: 0.02 },   // por año y por vecina, según el bit
    contagioEscritura: 3,    // la escritura acelera el contagio y la difusión del saber
    industriaGlobal: 0.05,   // contagio mundial de la industria, multiplicado por la fracción de población industrial
    // Saber de recolectores (cambio del 2026-10-15): crece con la gente y abre el desierto, el mar y el territorio de
    // los humanos arcaicos. Valores del estudio de factibilidad: con ellos las llegadas ya caen en sus ventanas de calibración.
    ritmoRec: 1,             // saber de recolectores ganado por año por cada millón de personas
    difRec: 0.002,           // ritmo con el que sube hacia la media de las vecinas
    ancho: 0.25,             // una compuerta se abre entre el umbral S y S × (1 + ancho)
    saberDesierto: 1400,     // umbral para vivir en el desierto fuera de los valles de río (0 = sin compuerta)
    saberMar: 1350,          // umbral para cruzar el mar sin navegación de altura (0 = sin compuerta)
    saberArcaico: 1550,      // umbral para desplazar a los humanos arcaicos (0 = se retiran enseguida)
    ocupaArcaico: 0.99,      // parte de la capacidad que ocupan los arcaicos en su territorio
    desplaza: 0.005,         // ritmo por año con que se retiran los arcaicos ante un saber mayor
    asimila: 0.2,            // tu pueblo: por debajo de esta fracción de una celda, los tuyos se integran a los demás
    seleccion: 0.002         // tu pueblo: ritmo por año con que la aptitud cambia la parte de los tuyos en una celda
  };
  // Modificadores de tu pueblo que no cambian nada (los que falten en setModificadores toman estos valores)
  const MODS_NEUTROS = Object.freeze({ aptitud: [], capacidad: [], migracion: 1, cruce: 1, evitaArcaicos: false, desplaza: 1, perdidaArcaicos: 0, epidemia: 0, bloqueo: 0 });

  const enCaja = (la, lo, [a, b, c, d]) => la >= a && la <= b && (c <= d ? lo >= c && lo <= d : lo >= c || lo <= d);
  const enCajas = (la, lo, cajas) => cajas.some(k => enCaja(la, lo, k));
  const entre = (año, tramos) => tramos.some(([a, b]) => año >= a && año <= b);
  function interpolar(tabla, x) {
    if (x <= tabla[0][0]) return tabla[0][1];
    for (let k = 1; k < tabla.length; k++) if (x <= tabla[k][0]) {
      const [x0, y0] = tabla[k - 1], [x1, y1] = tabla[k];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
    return tabla[tabla.length - 1][1];
  }
  // Valor de una tabla por tramos [[desde, valor], ...]: el del último tramo que ya empezó
  function tramo(tabla, x) {
    let v = tabla[0][1];
    for (const [desde, val] of tabla) if (x >= desde) v = val;
    return v;
  }

  // Las reglas de cada paso son funciones de este módulo que reciben el estado `E` de la partida (las arma `crear`).
  // Así el navegador y Node las optimizan una sola vez para todas las partidas, que es mucho más rápido que repetirlas
  // como funciones internas de cada partida.

  // Generador pseudoaleatorio con semilla (mulberry32); su estado vive en E.azar[0] (E.azarP[0] para lo propio de tu pueblo)
  const azar = E => sortear(E.azar);
  function sortear(st) {
    let t = st[0] = (st[0] + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const probPor = (tasa, dt) => 1 - Math.exp(-tasa * dt);
  const etapaDe = bits => bits & INDUSTRIA ? INDUSTRIAL : bits & CIUDADES ? URBANA : bits & AGRICULTURA ? AGRICULTORES : RECOLECTORES;
  const ETAPAS = AGRICULTURA | CIUDADES | INDUSTRIA;   // los bits que deciden la etapa
  // Lo agrícola solo sirve donde se puede cultivar; la navegación se conserva en cualquier lado
  const aptas = (apta, bits, j) => apta[j] ? bits : bits & (COSTERA | ALTURA);
  // Compuerta en rampa: cerrada bajo el umbral S, abierta del todo en S × (1 + ancho); un umbral 0 la deja abierta
  const rampa = (s, S, ancho) => S > 0 ? Math.min(1, Math.max(0, (s - S) / (ancho * S))) : 1;

  // --- Clima: nivel del mar, intensidad glacial, puentes, hielo y periodos húmedos ---
  // Las celdas solo cambian si cambió la intensidad glacial, el periodo húmedo o algún puente, y solo las que dependen de eso
  function actualizarClima(E) {
    const { P, historia } = E, año = E.año;
    const nivel = interpolar(historia.nivelMar, año);
    const g = Math.min(1, Math.max(0, -nivel / 125 * E.glacial));
    const hum = entre(año, historia.humedos.tramos);
    const abiertos = historia.puentes.map(p => E.conPuentes && nivel <= p.umbral);
    E.clima = { nivelMar: nivel, intensidadGlacial: g, humedoSahara: hum, puentesAbiertos: abiertos };
    const clave = `${g}|${hum}|${abiertos}`;
    if (clave === E.climaCeldas) return;
    const primera = E.climaCeldas === "";
    E.climaCeldas = clave;
    // Con otro estado de los puentes cambian los caminos por mar
    const clavePuentes = `${abiertos}`;
    if (clavePuentes !== E.clavePuentes) { E.clavePuentes = clavePuentes; E.caminosMar.clear(); }
    const { hielo, plataforma, bio, base, apta, kRec, gHielo, puente, bioma0, rio, humedo, fracFrio, areaT, latApta, costa } = E;
    const pg = P.frio * g, d1 = P.densidad[RECOLECTORES], extraCosta = P.costa, puentes = historia.puentes;
    if (!primera) {
      // A las celdas que solo sienten el frío únicamente les cambia la superficie útil (su tipo de tierra queda fijo)
      const soloFrio = E.soloFrio;
      for (let t = 0; t < soloFrio.length; t++) {
        const i = soloFrio[t], b = bio[i];
        base[i] = areaT[i] * (1 - pg * fracFrio[i]);
        let k = base[i] * d1[b];
        if (costa[i]) k *= extraCosta;
        kRec[i] = k;
      }
    }
    const lista = primera ? E.tierraL : E.estructurales;   // la primera vez, todas
    // Con tu pueblo, las celdas que cambian de tipo de tierra (de eso dependen sus modificadores por celda)
    const cambiados = E.pb !== null && E.pb.conDonde ? E.pb.cambiados : null;
    let nCambiados = 0;
    for (let t = 0; t < lista.length; t++) {
      const i = lista[t];
      hielo[i] = g >= gHielo[i] ? 1 : 0;
      plataforma[i] = puente[i] >= 0 && abiertos[puente[i]] ? 1 : 0;
      let b = bioma0[i];
      if (b === MAR) b = plataforma[i] ? puentes[puente[i]].bioma : MAR;
      else if (b === DESIERTO && (rio[i] || (hum && humedo[i]))) b = ESTEPA;
      if (hielo[i] && b !== MAR) b = HIELO;
      if (cambiados !== null && b !== bio[i]) cambiados[nCambiados++] = i;
      bio[i] = b;
      const frio = 1 - pg * fracFrio[i];
      base[i] = (b === MAR ? 0 : areaT[i]) * frio;
      // Estepa, bosque o selva a menos de 58° de latitud
      apta[i] = (b === ESTEPA || b === BOSQUE || b === SELVA) && latApta[i] ? 1 : 0;
      // Capacidad base de los recolectores, con el extra de la pesca en la costa
      let k = base[i] * d1[b];
      if (costa[i]) k *= extraCosta;
      kRec[i] = k;
    }
    // La aptitud y la capacidad de tu pueblo pueden depender del tipo de tierra (lo demás de una celda no cambia con el clima)
    if (nCambiados > 0) precalcularMods(E, cambiados.subarray(0, nCambiados));
  }

  // --- Capacidad: personas que puede alimentar la celda i en la etapa e (s = saber de recolectores de quien la habita) ---
  function capacidad(E, i, e, s) {
    const P = E.P;
    if (E.base[i] <= 0) return 0;
    // Recolectores: el desierto fuera de los valles de río solo los alimenta con saber suficiente (también en los periodos
    // húmedos), y en el territorio arcaico solo disponen de una parte
    if (e === RECOLECTORES) return E.kRec[i] * ((E.cerrada[i] ? rampa(s, P.saberDesierto, P.ancho) : 1) * (1 - P.ocupaArcaico * E.arc[i]));
    let k = E.base[i] * P.densidad[e][E.bio[i]];
    if (e === AGRICULTORES || e === URBANA) k *= 1 + Math.min(E.saber[i] / P.saberIntensifica, P.saberMax);
    return k;
  }
  function contar(E) {
    const { pob, innov, hab } = E, n = E.nHab;
    let total = 0, industrial = 0;
    for (let h = 0; h < n; h++) { const i = hab[h]; total += pob[i]; if (innov[i] & INDUSTRIA) industrial += pob[i]; }
    E.total = total; E.totalIndustrial = industrial;
  }
  // Rehace la lista de celdas habitadas (en el orden de `tierra`) si alguna se llenó o se vació; las vacías quedan como VACIA
  function listarHabitadas(E) {
    if (!E.cambioHab) return;
    E.cambioHab = false;
    const { pob, hab, etapa, tierraL } = E;
    let n = 0;
    for (let t = 0; t < tierraL.length; t++) { const i = tierraL[t]; if (pob[i] > 0) hab[n++] = i; else etapa[i] = VACIA; }
    E.nHab = n;
  }

  // --- Gente: crecer, migrar y cruzar el mar ---
  function vaciar(E, i) {
    E.pob[i] = 0; E.innov[i] = 0; E.saber[i] = 0; E.sr[i] = 0; E.etapa[i] = VACIA; E.cambioHab = true;
    if (E.pb) { E.pb.tuyos[i] = 0; E.pb.linaje[i] = 0; }
  }
  // Crecimiento logístico exacto hacia la capacidad (estable con pasos largos). La capacidad queda en capHab para migrar.
  // Con pueblo, la capacidad de las celdas donde es mayoría se multiplica por la suya, y el crecimiento de la celda se reparte
  // entre los tuyos y los demás según su aptitud (con aptitud 1, en la misma proporción).
  function crecer(E, dt) {
    const { P, pob, innov, sr, hab, capHab, expEtapa, base, kRec, cerrada, arc } = E, n = E.nHab, minimo = P.minimo;
    const pb = E.pb, tuyos = pb ? pb.tuyos : null, apt = pb ? pb.apt : null, capM = pb ? pb.cap : null, sel = P.seleccion * dt;
    const saberDesierto = P.saberDesierto, ancho = P.ancho, ocupaArcaico = P.ocupaArcaico;
    for (let e = 0; e < 5; e++) { const r = P.crecimiento[e] * E.natalidad; expEtapa[e] = Math.exp(-r * dt); }
    let ultA = NaN, ultPow = 1;
    for (let h = 0; h < n; h++) {
      const i = hab[h], p = pob[i];
      if (p <= 0) continue;
      const e = etapaDe(innov[i]);
      // La capacidad de recolectores (el caso más común) se calcula acá mismo; es la misma cuenta que en capacidad()
      let K = e !== RECOLECTORES ? capacidad(E, i, e, sr[i]) : base[i] <= 0 ? 0 :
        kRec[i] * ((cerrada[i] ? rampa(sr[i], saberDesierto, ancho) : 1) * (1 - ocupaArcaico * arc[i]));
      if (tuyos !== null && tuyos[i] > 0.5 * p) K *= capM[i * 5 + e];
      if (K <= 0) { vaciar(E, i); continue; }
      const q = K / (1 + ((K - p) / p) * expEtapa[e]);   // con r = 0 da q = p
      if (q < minimo) vaciar(E, i);
      else {
        if (tuyos !== null && tuyos[i] > 0) {
          const a = apt[i * 5 + e];
          if (a === 1) tuyos[i] = Math.min(q, tuyos[i] * (q / p));
          else {
            if (a !== ultA) { ultA = a; ultPow = Math.pow(a, sel); }   // pocas aptitudes distintas: se repite casi siempre
            const t = Math.min(1, tuyos[i] / p), tw = t * ultPow; tuyos[i] = q * tw / (tw + 1 - t);
          }
        }
        pob[i] = q; capHab[i] = K;
      }
    }
  }
  const pesoDe = (pob, K, j) => K <= 0 ? 0 : Math.max(K - pob[j], 0) + 0.01 * K;   // espacio libre más un poco (> 0 si K > 0)
  // Cómo ve la celda j a quien llega con su misma forma de vida y sin más saber: etapa y atractivo. Es el caso común, así que
  // se calcula una vez por paso y celda (`marca` dice en qué paso) en vez de una vez por cada vecina que la mira. Además:
  // `masc`, los bits de etapa que la celda no tiene (si quien llega trae alguno, su etapa puede subir; solo donde se cultiva), y
  // `limite`, el saber desde el cual quien llega abre más el desierto (Infinity si la compuerta ya está abierta del todo).
  function propia(E, j, pasoN) {
    const { P, pob, apta, sr } = E;
    E.marca[j] = pasoN;
    const v = E.innov[j], e = apta[j] ? etapaDe(v) : RECOLECTORES;
    // Una celda habitada ya calculó su capacidad al crecer (es la misma si su etapa no depende de poder cultivar)
    const K = pob[j] > 0 && (apta[j] || !(v & ETAPAS)) ? E.capHab[j] : capacidad(E, j, e, sr[j]);
    E.etapaPropia[j] = e;
    E.masc[j] = apta[j] ? ~v & ETAPAS : 0;
    E.limite[j] = e === RECOLECTORES && E.cerrada[j] && E.base[j] > 0 && rampa(sr[j], P.saberDesierto, P.ancho) < 1 ? sr[j] : Infinity;
    E.atractivo[j] = pesoDe(pob, K, j);
  }
  // Una parte de cada celda se muda a las vecinas, más cuanto más llena está y hacia donde hay más espacio.
  // Todo se calcula con la población del inicio del paso y se aplica al final, así el orden de las celdas no influye.
  // Con tu pueblo se usa migrarConPueblo, una copia con lo suyo en línea (este es el camino del modo Historia, y separarlos
  // los deja a los dos chicos para que el navegador los optimice bien).
  function migrar(E, dt) {
    const { P, pob, innov, sr, kRec, arc, apta, vecinas, hab, capHab, marca, etapaPropia, masc, limite, atractivo, pesos, salen, llegan, llegaS, aporte, traen, destinos } = E;
    const exploracion = P.exploracion, presion = P.presion, minimo = P.minimo, saberDesierto = P.saberDesierto, ancho = P.ancho, ocupaArcaico = P.ocupaArcaico;
    const { marcaEtapa, atractivoEtapa } = E, N = marca.length;
    const n = E.nHab, pasoN = ++E.pasoN;
    let nDest = 0, ultX = NaN, ultE = 0;
    for (let h = 0; h < n; h++) {
      const i = hab[h], p = pob[i];
      if (p <= 0) continue;
      const vi = innov[i], si = sr[i], K = capHab[i];   // la misma capacidad que al crecer
      const x = -(exploracion + presion * Math.min(1, p / K)) * dt;
      if (x !== ultX) { ultX = x; ultE = Math.exp(x); }   // las celdas llenas repiten el mismo valor
      const sale = p * (1 - ultE);
      if (sale < minimo) continue;
      let suma = 0, wMin = Infinity;
      for (let k = 0; k < 8; k++) {
        const j = vecinas[i * 8 + k];
        pesos[k] = 0;
        if (j < 0) continue;
        if (marca[j] !== pasoN) propia(E, j, pasoN);
        // Capacidad de la vecina con la forma de vida de ambas y el saber del que más sabe; casi siempre es la propia
        let w = atractivo[j];
        if (vi & masc[j]) {
          const e = etapaDe(vi | innov[j]);
          if (e !== etapaPropia[j]) {
            // Quien llega trae otra etapa (agrícola o más): su capacidad no depende del saber, así que también se guarda por paso
            const q = e * N + j;
            if (marcaEtapa[q] !== pasoN) { marcaEtapa[q] = pasoN; atractivoEtapa[q] = pesoDe(pob, capacidad(E, j, e, Math.max(sr[j], si)), j); }
            w = atractivoEtapa[q];
          }
        } else if (si > limite[j]) {
          // Desierto con la compuerta a medio abrir: quien llega sabe más (capacidad de recolectores con su saber)
          w = pesoDe(pob, kRec[j] * (rampa(Math.max(sr[j], si), saberDesierto, ancho) * (1 - ocupaArcaico * arc[j])), j);
        }
        if (w <= 0) continue;
        pesos[k] = w;
        suma += w;
        if (w < wMin) wMin = w;
      }
      // Grupos de menos de `minimo` personas no se van (si el más chico no lo es, ninguno lo es)
      if (sale * wMin / suma < minimo) for (let k = 0; k < 8; k++) if (pesos[k] > 0 && sale * pesos[k] / suma < minimo) { suma -= pesos[k]; pesos[k] = 0; }
      if (suma <= 0) continue;
      salen[i] = sale;
      for (let k = 0; k < 8; k++) if (pesos[k] > 0) {
        const j = vecinas[i * 8 + k], v = sale * pesos[k] / suma;
        if (llegan[j] === 0) destinos[nDest++] = j;
        llegan[j] += v;
        llegaS[j] += v * si;
        if (v > aporte[j]) { aporte[j] = v; traen[j] = aptas(apta, vi, j); }
      }
    }
    // Primero se van, después llegan (cada celda solo mira lo suyo, así el orden no influye)
    for (let h = 0; h < n; h++) {
      const i = hab[h];
      if (salen[i] !== 0) {
        pob[i] -= salen[i]; salen[i] = 0; if (pob[i] <= 0) E.cambioHab = true;
      }
    }
    for (let d = 0; d < nDest; d++) {
      const i = destinos[d], l = llegan[i];
      if (pob[i] <= 0) E.cambioHab = true;   // una celda nueva
      const traido = llegaS[i] / l;   // saber medio de los que llegan
      sr[i] = pob[i] <= 0 ? traido : Math.max(sr[i], traido);
      // Si los recién llegados son mayoría, traen su forma de vida (agricultores que desplazan a recolectores)
      if (l > pob[i]) innov[i] |= traen[i];
      pob[i] += l;
      llegan[i] = 0; llegaS[i] = 0; aporte[i] = 0;
    }
  }
  // Como migrar, con tu pueblo: de las celdas con tuyos reparte repartirConPueblo; en las demás (casi todas) es lo mismo que
  // repartirConPueblo con t = 0, en línea (allí la poda vuelve a sumar los pesos, que sin poda da la misma suma): los que salen
  // llevan el linaje de su celda. Al final, el linaje de cada destino es el promedio de los que estaban y los que llegan, y cada
  // celda se asimila (asimilarCelda) apenas queda como termina el paso de migrar.
  function migrarConPueblo(E, dt) {
    const { P, pob, innov, sr, kRec, arc, apta, vecinas, hab, capHab, marca, etapaPropia, masc, limite, atractivo, pesos, salen, llegan, llegaS, aporte, traen, destinos, llegaL } = E;
    const exploracion = P.exploracion, presion = P.presion, minimo = P.minimo, saberDesierto = P.saberDesierto, ancho = P.ancho, ocupaArcaico = P.ocupaArcaico;
    const { marcaEtapa, atractivoEtapa } = E, N = marca.length;
    const n = E.nHab, pasoN = ++E.pasoN, { tuyos, linaje } = E.pb;
    let nDest = 0, ultX = NaN, ultE = 0;
    for (let h = 0; h < n; h++) {
      const i = hab[h], p = pob[i];
      if (p <= 0) continue;
      const vi = innov[i], si = sr[i], K = capHab[i];   // la misma capacidad que al crecer
      const x = -(exploracion + presion * Math.min(1, p / K)) * dt;
      if (x !== ultX) { ultX = x; ultE = Math.exp(x); }   // las celdas llenas repiten el mismo valor
      const sale = p * (1 - ultE);
      if (sale < minimo) continue;
      let suma = 0, wMin = Infinity;
      for (let k = 0; k < 8; k++) {
        const j = vecinas[i * 8 + k];
        pesos[k] = 0;
        if (j < 0) continue;
        if (marca[j] !== pasoN) propia(E, j, pasoN);
        // Capacidad de la vecina con la forma de vida de ambas y el saber del que más sabe; casi siempre es la propia
        let w = atractivo[j];
        if (vi & masc[j]) {
          const e = etapaDe(vi | innov[j]);
          if (e !== etapaPropia[j]) {
            // Quien llega trae otra etapa (agrícola o más): su capacidad no depende del saber, así que también se guarda por paso
            const q = e * N + j;
            if (marcaEtapa[q] !== pasoN) { marcaEtapa[q] = pasoN; atractivoEtapa[q] = pesoDe(pob, capacidad(E, j, e, Math.max(sr[j], si)), j); }
            w = atractivoEtapa[q];
          }
        } else if (si > limite[j]) {
          // Desierto con la compuerta a medio abrir: quien llega sabe más (capacidad de recolectores con su saber)
          w = pesoDe(pob, kRec[j] * (rampa(Math.max(sr[j], si), saberDesierto, ancho) * (1 - ocupaArcaico * arc[j])), j);
        }
        if (w <= 0) continue;
        pesos[k] = w;
        suma += w;
        if (w < wMin) wMin = w;
      }
      if (tuyos[i] > 0) { nDest = repartirConPueblo(E, i, p, sale, suma, wMin, nDest); continue; }
      // La misma poda que podar (escrita aquí: llamarla deja sin optimizar `propia` dentro de esta función)
      if (sale * wMin / suma < minimo) {
        for (let k = 0; k < 8; k++) if (pesos[k] > 0 && sale * pesos[k] / suma < minimo) { suma -= pesos[k]; pesos[k] = 0; }
        suma = 0;
        for (let k = 0; k < 8; k++) suma += pesos[k];
      }
      if (suma <= 0) continue;
      const li = linaje[i];
      salen[i] = sale;
      for (let k = 0; k < 8; k++) if (pesos[k] > 0) {
        const j = vecinas[i * 8 + k], v = sale * pesos[k] / suma;
        if (llegan[j] === 0) destinos[nDest++] = j;
        llegan[j] += v;
        llegaS[j] += v * si;
        llegaL[j] += v * li;
        if (v > aporte[j]) { aporte[j] = v; traen[j] = aptas(apta, vi, j); }
      }
    }
    llegarConPueblo(E, n, nDest);
  }
  // Segunda mitad de migrarConPueblo (aparte, para que las dos queden chicas y el navegador las optimice bien)
  function llegarConPueblo(E, n, nDest) {
    const { P, pob, innov, sr, hab, salen, llegan, llegaS, aporte, destinos, salenT, llegaT, llegaL } = E, traen = E.traen;
    const { tuyos, linaje } = E.pb, minimo = P.minimo, asimila = P.asimila;
    // Primero se van, después llegan (cada celda solo mira lo suyo, así el orden no influye)
    for (let h = 0; h < n; h++) {
      const i = hab[h];
      if (salen[i] !== 0) {
        pob[i] -= salen[i]; salen[i] = 0; if (pob[i] <= 0) E.cambioHab = true;
        if (salenT[i] !== 0) { tuyos[i] -= salenT[i]; salenT[i] = 0; }
      }
      if (tuyos[i] !== 0 && llegan[i] === 0) asimilarCelda(tuyos, pob, i, minimo, asimila);   // a los destinos, al llegar
    }
    for (let d = 0; d < nDest; d++) {
      const i = destinos[d], l = llegan[i];
      if (pob[i] <= 0) E.cambioHab = true;   // una celda nueva
      const traido = llegaS[i] / l;   // saber medio de los que llegan
      sr[i] = pob[i] <= 0 ? traido : Math.max(sr[i], traido);
      // El linaje de la celda pasa a ser el promedio, por personas, de los que estaban y los que llegan
      const ant = Math.max(pob[i], 0), lL = llegaL[i];
      if (lL !== 0 || linaje[i] !== 0) { linaje[i] = Math.min(1, (linaje[i] * ant + lL) / (ant + l)); llegaL[i] = 0; }   // 0 y 0 da 0
      if (llegaT[i] !== 0) { tuyos[i] += llegaT[i]; llegaT[i] = 0; }
      // Si los recién llegados son mayoría, traen su forma de vida (agricultores que desplazan a recolectores)
      if (l > pob[i]) innov[i] |= sinBloqueo(E, i, traen[i], ant + l);
      pob[i] += l;
      llegan[i] = 0; llegaS[i] = 0; aporte[i] = 0;
      if (tuyos[i] !== 0) asimilarCelda(tuyos, pob, i, minimo, asimila);
    }
    E.pb.nTocadas = 0; E.pb.pasoT++;   // desde aquí, asimilar solo revisa las celdas que cambien (cruces y pérdidas)
  }
  // Grupos de menos de `minimo` personas no se van: poda (en orden, como en migrar) las vecinas que recibirían menos.
  // Devuelve la suma de los pesos que quedan, sumada de nuevo para que dé 0 exacto si no queda ninguno (restando puede
  // sobrar un residuo, y esa gente saldría sin llegar a ningún lado).
  function podar(pesos, sale, suma, minimo) {
    for (let k = 0; k < 8; k++) if (pesos[k] > 0 && sale * pesos[k] / suma < minimo) { suma -= pesos[k]; pesos[k] = 0; }
    let queda = 0;
    for (let k = 0; k < 8; k++) queda += pesos[k];
    return queda;
  }
  // Emigración de una celda con tu pueblo en juego: de los que salen, la parte de los tuyos (la fracción t del inicio del paso)
  // solo va a vecinas vacías o donde tu pueblo es mayoría (y, si los evita, sin arcaicos); los demás van como siempre. Todos
  // llevan el linaje de su celda. Los tuyos que salen se multiplican por `migracion` (sin pasar de los que hay).
  // Usa los pesos que migrar ya calculó en E.pesos (wMin, el menor); devuelve el nuevo largo de la lista de destinos.
  // La poda solo se hace si el grupo más chico no llega a `minimo` (si no, podar no quitaría nada y daría la misma suma).
  function repartirConPueblo(E, i, p, sale, suma, wMin, nDest) {
    const { P, pob, innov, sr, apta, arc, vecinas, pesos, pesosT, salen, salenT, llegan, llegaS, llegaT, llegaL, aporte, traen, destinos } = E;
    const { tuyos, linaje, mods } = E.pb, minimo = P.minimo, vi = innov[i], si = sr[i], li = linaje[i], evita = mods.evitaArcaicos;
    const t = Math.min(1, tuyos[i] / p), saleO = sale * (1 - t), saleT = Math.min(tuyos[i], sale * t * mods.migracion);
    let sumaT = 0, wMinT = Infinity;
    for (let k = 0; k < 8; k++) {
      pesosT[k] = 0;
      if (pesos[k] <= 0 || saleT <= 0) continue;
      const j = vecinas[i * 8 + k];
      if ((pob[j] <= 0 || tuyos[j] > 0.5 * pob[j]) && !(evita && arc[j] > 0)) { pesosT[k] = pesos[k]; sumaT += pesos[k]; if (pesos[k] < wMinT) wMinT = pesos[k]; }
    }
    // Cada parte por su lado: si no le queda adónde ir, se queda
    let sumaO = suma > 0 ? (saleO * wMin / suma < minimo ? podar(pesos, saleO, suma, minimo) : suma) : 0;
    if (sumaT > 0 && saleT * wMinT / sumaT < minimo) sumaT = podar(pesosT, saleT, sumaT, minimo);
    const vaO = sumaO > 0 ? saleO : 0, vaT = sumaT > 0 ? saleT : 0;
    if (vaO + vaT <= 0) return nDest;
    salen[i] = vaO + vaT; salenT[i] = vaT;
    for (let k = 0; k < 8; k++) {
      const vO = vaO > 0 && pesos[k] > 0 ? vaO * pesos[k] / sumaO : 0, vT = vaT > 0 && pesosT[k] > 0 ? vaT * pesosT[k] / sumaT : 0;
      const v = vO + vT;
      if (v <= 0) continue;
      const j = vecinas[i * 8 + k];
      if (llegan[j] === 0) destinos[nDest++] = j;
      llegan[j] += v;
      llegaS[j] += v * si;
      llegaT[j] += vT;
      llegaL[j] += v * li;
      if (v > aporte[j]) { aporte[j] = v; traen[j] = aptas(apta, vi, j); }
    }
    return nDest;
  }
  // Donde los tuyos son muy pocos (menos de `minimo` o de la fracción `asimila` de la celda), se integran a los demás; su
  // herencia sigue en `linaje`. De paso se corrige el redondeo para que nunca haya más tuyos que gente.
  function asimilarCelda(tuyos, pob, i, minimo, asimila) {
    let tu = tuyos[i];
    if (tu <= 0) { tuyos[i] = 0; return; }
    if (tu > pob[i]) tuyos[i] = tu = Math.max(pob[i], 0);
    if (tu < Math.max(minimo, asimila * pob[i])) tuyos[i] = 0;
  }
  // migrarConPueblo deja todas las celdas asimiladas; después solo cambian los tuyos o la gente de las celdas de los cruces por
  // mar y de las pérdidas de tu pueblo, que se anotan con `tocar` y se revisan al final del paso
  function tocar(pb, i) {
    if (pb.sello[i] === pb.pasoT) return;
    pb.sello[i] = pb.pasoT;
    pb.tocadas[pb.nTocadas++] = i;
  }
  function asimilar(E) {
    const pb = E.pb, { tuyos, tocadas } = pb, minimo = E.P.minimo, asimila = E.P.asimila;
    for (let t = 0; t < pb.nTocadas; t++) asimilarCelda(tuyos, E.pob, tocadas[t], minimo, asimila);
    pb.nTocadas = 0;
    pb.pasoT++;
  }
  // Tierra habitable alcanzable cruzando hasta `alcance` celdas de agua (sin contar la costa de partida)
  // (st: el estado del generador con que se sortea la candidata)
  function destinoPorMar(E, i, alcance, st) {
    // Qué tierra se alcanza, y en qué orden, solo depende del mapa y de los puentes: se recorre una vez y se guarda
    const clave = alcance * 1e6 + i;
    let alcanzable = E.caminosMar.get(clave);
    if (!alcanzable) { alcanzable = recorrerMar(E, i, alcance); E.caminosMar.set(clave, alcanzable); }
    const { candidatas } = E, si = E.sr[i];
    candidatas.length = 0;
    for (let t = 0; t < alcanzable.length; t++) { const j = alcanzable[t]; if (capacidad(E, j, RECOLECTORES, si) > 0) candidatas.push(j); }
    return candidatas.length ? candidatas[Math.floor(sortear(st) * candidatas.length)] : -1;
  }
  // Recorrido por el agua desde la costa i: la tierra que encuentra, en orden (la vecina de la costa de partida no cuenta)
  function recorrerMar(E, i, alcance) {
    const { vecinas, visita, cola, dist, bio } = E;
    const sello = ++E.sello, tierraVista = [];
    let a = 0, b = 0;
    cola[b++] = i; visita[i] = sello; dist[i] = 0;
    while (a < b) {
      const c = cola[a++];
      for (let k = 0; k < 8; k++) {
        const j = vecinas[c * 8 + k];
        if (j < 0 || visita[j] === sello) continue;
        visita[j] = sello;
        if (bio[j] === MAR) { if (dist[c] < alcance) { dist[j] = dist[c] + 1; cola[b++] = j; } }
        else if (c !== i) tierraVista.push(j);
      }
    }
    return Int32Array.from(tierraVista);
  }
  function cruzarMar(E, dt) {
    const { P, pob, innov, sr, costerasL } = E, cruceMult = E.cruceMult, pb = E.pb;
    // Cruces propios de tu pueblo: la tasa extra sobre la de cada costa (0 = ninguno)
    const extra = pb !== null && pb.mods.cruce > 1 ? pb.mods.cruce - 1 : 0;
    let ultX = NaN, ultP = 0;
    for (let c = 0; c < costerasL.length; c++) {
      const i = costerasL[c];
      if (pob[i] < P.establecida) continue;
      const nivel = innov[i] & ALTURA ? 2 : innov[i] & COSTERA ? 1 : 0;
      const compuerta = nivel < 2 ? rampa(sr[i], P.saberMar, P.ancho) : 1;   // sin navegación de altura, el mar espera al saber
      const x = -P.cruce[nivel] * compuerta * cruceMult * dt;
      if (x !== ultX) { ultX = x; ultP = 1 - Math.exp(x); }   // casi siempre se repite
      if (azar(E) < ultP) {
        const j = destinoPorMar(E, i, P.alcance[nivel], E.azar);
        if (j >= 0) {
          const grupo = Math.min(Math.max(pob[i] * 0.05, 2 * P.minimo), 500, pob[i] / 2);
          if (pb) { llevarPorMar(E, i, j, grupo, grupo * Math.min(1, pb.tuyos[i] / pob[i])); tocar(pb, i); tocar(pb, j); }
          desembarcar(E, i, j, grupo);
        }
      }
      // Con su propio azar, así el del resto del mundo no cambia
      if (extra > 0 && pb.tuyos[i] > 0.5 * pob[i] && sortear(E.azarP) < probPor(P.cruce[nivel] * compuerta * cruceMult * extra, dt)) {
        const j = destinoPorMar(E, i, P.alcance[nivel], E.azarP);
        if (j < 0) continue;
        const tu = pb.tuyos[i], grupo = Math.min(Math.max(tu * 0.05, 2 * P.minimo), 500, tu / 2);   // solo tuyos
        llevarPorMar(E, i, j, grupo, grupo); tocar(pb, i); tocar(pb, j);
        desembarcar(E, i, j, grupo);
      }
    }
  }
  // El grupo deja la costa i y llega a j con su saber y sus innovaciones
  function desembarcar(E, i, j, grupo) {
    const { pob, innov, sr, apta } = E;
    pob[i] -= grupo;
    if (pob[j] <= 0) { innov[j] = 0; sr[j] = sr[i]; E.cambioHab = true; } else sr[j] = Math.max(sr[j], sr[i]);
    const bits = aptas(apta, innov[i], j);   // el contacto también lleva las innovaciones
    innov[j] |= E.pb ? sinBloqueo(E, j, bits, Math.max(pob[j], 0) + grupo) : bits;
    pob[j] += grupo;
  }

  // El grupo que cruza el mar lleva gT tuyos y el linaje de su celda (antes de mover a la gente)
  function llevarPorMar(E, i, j, grupo, gT) {
    const { pob } = E, { tuyos, linaje } = E.pb, ant = Math.max(pob[j], 0);
    linaje[j] = Math.min(1, (linaje[j] * ant + grupo * linaje[i]) / (ant + grupo));
    tuyos[i] -= gT;
    tuyos[j] += gT;
  }

  // --- Tu pueblo: modificadores de sus decisiones y rasgos ---
  // Una celda cumple un `donde` si cumple todas sus claves (e: la etapa con la que se la mira)
  function cumple(E, d, i, e) {
    const b = E.bio[i];
    if (d.biomas && !d.biomas.includes(b)) return false;
    if (d.etapas && !d.etapas.includes(e)) return false;
    if (d.cajas && !enCajas(E.lat[i], E.lon[i], d.cajas)) return false;
    if (d.frio && !(Math.abs(E.lat[i]) >= 45 || b === TUNDRA || b === HIELO)) return false;
    if (d.costa && !E.costa[i]) return false;
    return true;
  }
  function producto(E, entradas, i, e) {
    let a = 1;
    for (const { donde, valor } of entradas) if (cumple(E, donde, i, e)) a *= valor;
    return a;
  }
  // Producto de la aptitud y de la capacidad de cada celda de `lista` en cada etapa (posición i·5 + etapa), para no evaluar
  // los `donde` en cada paso
  // Una lista vacía da 1 en todas partes, y una sin `etapas` da lo mismo en las cuatro etapas: se calcula una sola vez
  function precalcularMods(E, lista) {
    const { apt, cap, mods } = E.pb;
    for (const [tabla, entradas] of [[apt, mods.aptitud], [cap, mods.capacidad]]) {
      const porEtapa = entradas.some(x => x.donde.etapas);
      for (let t = 0; t < lista.length; t++) {
        const i = lista[t];
        if (porEtapa) for (let e = RECOLECTORES; e <= INDUSTRIAL; e++) tabla[i * 5 + e] = producto(E, entradas, i, e);
        else tabla.fill(entradas.length ? producto(E, entradas, i, RECOLECTORES) : 1, i * 5 + RECOLECTORES, i * 5 + INDUSTRIAL + 1);
      }
    }
  }
  // Mueren d de los tuyos de la celda i; los muertos se llevan su linaje completo. Una celda que queda con menos de
  // `minimo` personas se vacía.
  function morir(E, i, d) {
    const { pob } = E, { tuyos, linaje } = E.pb, p = pob[i];
    tocar(E.pb, i);
    tuyos[i] -= d; pob[i] -= d;
    if (pob[i] < E.P.minimo) { vaciar(E, i); return; }
    linaje[i] = Math.max(0, (linaje[i] * p - d) / pob[i]);
  }
  // Pérdidas propias de tu pueblo en las celdas donde es mayoría: la competencia con arcaicos vecinos y las epidemias urbanas
  function pueblo(E, dt) {
    const { pob, innov, arc, vecinas, hab } = E, { tuyos, mods } = E.pb, n = E.nHab;
    const fA = probPor(mods.perdidaArcaicos, dt), fE = probPor(mods.epidemia, dt);
    if (fA <= 0 && fE <= 0) return;
    for (let h = 0; h < n; h++) {
      const i = hab[h], p = pob[i];
      if (p <= 0 || !(tuyos[i] > 0.5 * p)) continue;
      let queda = 1;
      if (fE > 0 && etapaDe(innov[i]) >= URBANA) queda *= 1 - fE;
      if (fA > 0) for (let k = 0; k < 8; k++) { const j = vecinas[i * 8 + k]; if (j >= 0 && arc[j] > 0) { queda *= 1 - fA; break; } }
      if (queda < 1) morir(E, i, tuyos[i] * (1 - queda));
    }
  }
  // Los bits de `bloqueo` no entran en una celda donde tu pueblo es mayoría (p: la gente de la celda con los que llegan)
  const sinBloqueo = (E, i, bits, p) => E.pb.tuyos[i] > 0.5 * p ? bits & ~E.pb.mods.bloqueo : bits;

  // --- Hitos ---
  function hito(E, id, i) {
    if (E.hechos.has(id)) return;
    E.hechos.add(id);
    const h = { id, año: Math.round(E.año), celda: i };
    E.logros.push(h);
    E.oyentes.forEach(fn => fn(h));
  }
  function revisarHitos(E) {
    const { P, pob, innov, sr, hab, region, pendiente, origen, regionHito, hechos } = E, n = E.nHab;
    // Regiones donde todavía hay una llegada por avisar
    const sinSalida = !hechos.has("salida_africa");
    let alguna = 0;
    for (let r = 0; r < pendiente.length; r++) {
      pendiente[r] = (sinSalida && !origen[r]) || (regionHito[r] && !hechos.has(regionHito[r])) ? 1 : 0;
      alguna |= pendiente[r];
    }
    if (alguna) for (let h = 0; h < n; h++) {
      const i = hab[h];
      if (pob[i] < P.establecida || region[i] < 0 || !pendiente[region[i]]) continue;
      if (capacidad(E, i, etapaDe(innov[i]), sr[i]) < P.establecida) continue;   // un desembarco que la celda no sostiene no cuenta
      if (!origen[region[i]]) hito(E, "salida_africa", i);
      if (regionHito[region[i]]) hito(E, regionHito[region[i]], i);
    }
    const total = E.total;
    if (total >= 1e9) hito(E, "mil_millones", -1);
    if (total >= 8e9) hito(E, "ocho_mil_millones", -1);
    if (total <= 0 && E.empezoConGente) { hito(E, "extincion", -1); E.fin = true; }
  }

  // --- Innovaciones: aparecen según densidad, conexiones y saber (nunca por un tiempo fijo) y se contagian ---
  // Las vecinas se leen como estaban al inicio del paso (innov0, saber0, sr0), así el orden de las celdas no influye
  function vecinasCon(E, i, bit) {
    const { vecinas, pob, innov0 } = E;
    let n = 0;
    for (let k = 0; k < 8; k++) { const j = vecinas[i * 8 + k]; if (j >= 0 && pob[j] > 0 && (innov0[j] & bit)) n++; }
    return n;
  }
  function puedeAdoptar(bit, v, i, apta, costa) {
    if (bit === COSTERA) return costa[i] === 1;
    if (bit === ALTURA) return costa[i] === 1 && (v & COSTERA) !== 0;
    if (bit === AGRICULTURA) return apta;
    if (!apta || !(v & AGRICULTURA)) return false;
    return bit !== ESCRITURA || (v & CIUDADES) !== 0;
  }
  function innovar(E, dt) {
    const { P, historia, pob, innov, innov0, saber, saber0, sr, sr0, hab, vecinas, costa, domestica, base, etapa } = E;
    innov0.set(innov); saber0.set(saber); sr0.set(sr);
    const fracInd = E.total > 0 ? E.totalIndustrial / E.total : 0;
    const dtRec = dt * P.ritmoRec, difRec = probPor(P.difRec, dt), holoceno = E.año >= historia.holoceno;
    const difSaber = probPor(P.difusionSaber * 1, dt), difSaberEscrito = probPor(P.difusionSaber * P.contagioEscritura, dt);
    const tuyos = E.pb !== null && E.pb.mods.bloqueo ? E.pb.tuyos : null, bloqueo = tuyos !== null ? E.pb.mods.bloqueo : 0;
    // Solo las celdas habitadas (las vacías ya quedaron como VACIA al listarlas)
    const n = E.nHab;
    for (let h = 0; h < n; h++) {
      const i = hab[h], p = pob[i];
      let v = innov[i];
      const apta = E.apta[i] === 1;
      // Donde tu pueblo es mayoría, los bits bloqueados que la celda no tiene cuentan como si ya los tuviera para no ganarlos
      // (pero no para lo que depende de ellos)
      const bloq = tuyos !== null && tuyos[i] > 0.5 * p ? bloqueo & ~v : 0;
      // Saber de recolectores: crece con la gente y sube hacia el de las vecinas cuando es mayor.
      // De paso se juntan las innovaciones de las vecinas habitadas (para el contagio) y el saber de las agrícolas.
      let s = sr[i] + dtRec * (p / 1e6), sumaR = 0, nR = 0, union = 0, sumaS = 0, nS = 0;
      for (let k = 0; k < 8; k++) {
        const j = vecinas[i * 8 + k];
        if (j >= 0 && pob[j] > 0) {
          const b = innov0[j];
          sumaR += sr0[j]; nR++; union |= b;
          if (b & AGRICULTURA) { sumaS += saber0[j]; nS++; }
        }
      }
      if (nR && sumaR / nR > s) s += (sumaR / nR - s) * difRec;
      sr[i] = s;
      // Saber: crece con la gente (más personas, más ideas; Kremer 1993) y no se pierde al compartirlo: las celdas agrícolas
      // que saben menos se acercan a la media de sus vecinas agrícolas
      if (v & AGRICULTURA) {
        const escribe = (v & ESCRITURA) !== 0;
        let sa = saber[i] + dt * P.ritmoSaber * (p / 1e6) * (escribe ? P.escrituraSaber : 1);
        if (nS && sumaS / nS > sa) sa += (sumaS / nS - sa) * (escribe ? difSaberEscrito : difSaber);
        saber[i] = sa;
      }
      if (!((v | bloq) & COSTERA) && costa[i] && azar(E) < probPor(P.costera * p / 1000, dt)) v |= COSTERA;
      if (!((v | bloq) & AGRICULTURA) && apta && holoceno && domestica[i] >= 0) {
        const d = historia.domesticables[domestica[i]];
        const llena = Math.min(1, Math.max(0, (p / capacidad(E, i, RECOLECTORES, sr[i]) - P.llenaAgricultura) / (1 - P.llenaAgricultura)));
        if (llena > 0 && azar(E) < probPor(P.agricultura * d.riqueza * llena, dt)) { v |= AGRICULTURA; hito(E, `agricultura_${d.id}`, i); }
      }
      if ((v & AGRICULTURA) && !((v | bloq) & CIUDADES)) {
        const exceso = Math.min(1, Math.max(0, p / base[i] / P.densidadCiudad - 1));
        if (exceso > 0 && azar(E) < probPor(P.ciudades * exceso * vecinasCon(E, i, AGRICULTURA) / 8, dt)) { v |= CIUDADES; hito(E, "primera_ciudad", i); }
      }
      if ((v & CIUDADES) && !((v | bloq) & ESCRITURA)) {
        const red = vecinasCon(E, i, CIUDADES) - P.vecinosEscritura + 1;
        if (red > 0 && azar(E) < probPor(P.escritura * red, dt)) { v |= ESCRITURA; hito(E, "escritura", i); }
      }
      if ((v & COSTERA) && (v & AGRICULTURA) && !((v | bloq) & ALTURA) && costa[i]) {
        const s = Math.min(1, saber[i] / P.saberAltura);
        if (s > 0 && azar(E) < probPor(P.altura * s, dt)) v |= ALTURA;
      }
      if ((v & ESCRITURA) && !((v | bloq) & INDUSTRIA)) {
        const exceso = Math.min(1, Math.max(0, saber[i] / P.saberIndustria - 1));
        if (exceso > 0 && azar(E) < probPor(P.industria * exceso, dt)) { v |= INDUSTRIA; hito(E, "industria", i); }
      }
      // Contagio desde las vecinas (más rápido con escritura) y, para la industria, desde todo el mundo agrícola.
      // Lo que la celda nunca podría adoptar (navegación tierra adentro, lo agrícola donde no se cultiva) no cuenta.
      const global = fracInd > 0 && apta && (v & AGRICULTURA) && !((v | bloq) & INDUSTRIA);
      let nuevas = union & ~(v | bloq);
      if (!costa[i]) nuevas &= ~(COSTERA | ALTURA);
      if (!apta) nuevas &= COSTERA | ALTURA;
      if (nuevas || global) {
        const mult = (v | union) & ESCRITURA ? P.contagioEscritura : 1;   // la celda o alguna vecina escribe
        for (const bit of BITS) {
          if (((v | bloq) & bit) || !puedeAdoptar(bit, v, i, apta, costa)) continue;
          let tasa = union & bit ? P.contagio[bit] * vecinasCon(E, i, bit) * mult : 0;
          if (bit === INDUSTRIA) tasa += P.industriaGlobal * fracInd;
          if (tasa > 0 && azar(E) < probPor(tasa, dt)) v |= bit;
        }
      }
      innov[i] = v;
      etapa[i] = etapaDe(v);
    }
  }

  // --- Humanos arcaicos: se retiran donde el saber de recolectores de nuestra especie (en la celda o sus vecinas) supera el suyo ---
  function desplazar(E, dt) {
    const { P, historia, pob, sr, arc, vecinas, especie, ocupadas, arcInicial } = E;
    // Tu pueblo puede desplazarlos más rápido (o más lento) donde la celda o una vecina es mayoría suya
    const tuyos = E.pb !== null && E.pb.mods.desplaza !== 1 ? E.pb.tuyos : null, multT = tuyos !== null ? E.pb.mods.desplaza : 1;
    // `ocupadas`: las celdas que todavía ocupan, en su orden (una celda que se libera no vuelve)
    let n = 0;
    for (let t = 0; t < E.nOcupadas; t++) {
      const i = ocupadas[t];
      if (arc[i] <= 0) continue;
      let s = pob[i] > 0 ? sr[i] : 0;
      for (let k = 0; k < 8; k++) { const j = vecinas[i * 8 + k]; if (j >= 0 && pob[j] > 0 && sr[j] > s) s = sr[j]; }
      const ventaja = rampa(s, P.saberArcaico, P.ancho);
      if (ventaja > 0) {
        let mult = 1;
        if (tuyos !== null) {
          if (tuyos[i] > 0.5 * pob[i]) mult = multT;
          else for (let k = 0; k < 8; k++) { const j = vecinas[i * 8 + k]; if (j >= 0 && tuyos[j] > 0.5 * pob[j]) { mult = multT; break; } }
        }
        arc[i] *= Math.exp(-P.desplaza * ventaja * dt * mult); if (arc[i] < 0.01) arc[i] = 0;
      }
      if (arc[i] > 0) ocupadas[n++] = i;
    }
    E.nOcupadas = n;
    // Hito de desaparición: el territorio ocupado baja del 1 % del inicial
    historia.arcaicos.forEach((a, k) => {
      if (!a.hito || !arcInicial[k] || E.hechos.has(a.hito)) return;
      let resto = 0;
      for (let t = 0; t < n; t++) { const i = ocupadas[t]; if (especie[i] === k) resto += arc[i]; }
      if (resto < 0.01 * arcInicial[k]) hito(E, a.hito, -1);
    });
  }

  // --- Paso del tiempo ---
  function paso(E, dt) {
    E.año += dt;
    actualizarClima(E);
    crecer(E, dt);
    if (E.pb !== null) migrarConPueblo(E, dt); else migrar(E, dt);
    cruzarMar(E, dt);
    listarHabitadas(E);
    innovar(E, dt);
    desplazar(E, dt);
    if (E.pb !== null) { pueblo(E, dt); asimilar(E); }
    contar(E);
    revisarHitos(E);
  }

  function crear(mundo, historia, opciones = {}) {
    const P = { ...PARAMS, ...opciones.params };
    const semilla = (opciones.semilla ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
    const W = mundo.ancho, H = mundo.alto, N = W * H, G = mundo.grados;
    const latN = mundo.latNorte ?? 90, lonO = mundo.lonOeste ?? -180;

    // --- Mundo: geometría, islas, vecinas, puentes y regiones ---
    const lat = new Float32Array(N), lon = new Float32Array(N), bioma0 = new Uint8Array(N), area0 = new Float32Array(N);
    const areaCompleta = i => (G * KM_GRADO) ** 2 * Math.cos(lat[i] * D2R);
    for (let i = 0; i < N; i++) {
      lat[i] = latN - (Math.floor(i / W) + 0.5) * G;
      lon[i] = lonO + ((i % W) + 0.5) * G;
      bioma0[i] = mundo.bioma.charCodeAt(i) - 48;
      const t = mundo.tierra.charCodeAt(i) - 48;
      area0[i] = bioma0[i] === MAR ? 0 : areaCompleta(i) * (t >= 9 ? 1 : t / 10);
    }
    function celdaDe(la, lo) {
      const f = Math.min(H - 1, Math.max(0, Math.floor((latN - la) / G)));
      const c = ((Math.floor((lo - lonO) / G) % W) + W) % W;
      return f * W + c;
    }
    for (const isla of historia.islas) {
      const i = celdaDe(isla.lat, isla.lon);
      if (bioma0[i] === MAR) { bioma0[i] = isla.bioma; area0[i] = isla.km2; }
    }
    // 8 vecinas por celda (−1 fuera del mapa); la longitud da la vuelta al mundo
    const vecinas = new Int32Array(N * 8).fill(-1);
    for (let i = 0; i < N; i++) {
      const f = Math.floor(i / W), c = i % W;
      let k = 0;
      for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) {
        if (!df && !dc) continue;
        if (f + df >= 0 && f + df < H) vecinas[i * 8 + k] = (f + df) * W + ((c + dc + W) % W);
        k++;
      }
    }
    const puente = new Int8Array(N).fill(-1);
    historia.puentes.forEach((p, k) => {
      for (let i = 0; i < N; i++) if (bioma0[i] === MAR && puente[i] < 0 && enCajas(lat[i], lon[i], p.cajas)) puente[i] = k;
    });
    // Celdas que pueden ser tierra en algún momento: las de hoy y las de los puentes
    const tierra = [];
    for (let i = 0; i < N; i++) if (bioma0[i] !== MAR || puente[i] >= 0) tierra.push(i);
    const costa = new Uint8Array(N);
    for (const i of tierra) if (bioma0[i] !== MAR) for (let k = 0; k < 8; k++) {
      const j = vecinas[i * 8 + k];
      if (j >= 0 && bioma0[j] === MAR) costa[i] = 1;
    }
    const costeras = tierra.filter(i => costa[i]);
    const region = new Int8Array(N).fill(-1), domestica = new Int8Array(N).fill(-1);
    const rio = new Uint8Array(N), humedo = new Uint8Array(N), gHielo = new Float32Array(N).fill(Infinity);
    for (const i of tierra) {
      const la = lat[i], lo = lon[i];
      region[i] = historia.regiones.findIndex(r => enCajas(la, lo, r.cajas));
      domestica[i] = historia.domesticables.findIndex(d => enCajas(la, lo, d.cajas));
      rio[i] = historia.rios.some(r => enCajas(la, lo, r.cajas)) ? 1 : 0;
      humedo[i] = enCajas(la, lo, historia.humedos.cajas) ? 1 : 0;
      for (const h of historia.hielo) if (h.gMin < gHielo[i] && enCajas(la, lo, h.cajas)) gHielo[i] = h.gMin;
    }
    // Barreras: celdas de tierra firme vecinas a través de un estrecho que nunca se secó; solo se cruzan por mar
    const ids = historia.regiones.map(r => r.id);
    for (const b of historia.barreras) {
      const A = ids.indexOf(b.entre[0]), B = ids.indexOf(b.entre[1]), tope = b.latMax ?? 90;
      for (const i of tierra) {
        if (bioma0[i] === MAR || (region[i] !== A && region[i] !== B)) continue;
        for (let k = 0; k < 8; k++) {
          const j = vecinas[i * 8 + k];
          if (j < 0 || bioma0[j] === MAR) continue;
          const cruza = (region[i] === A && region[j] === B) || (region[i] === B && region[j] === A);
          if (cruza && lat[i] <= tope && lat[j] <= tope) vecinas[i * 8 + k] = -1;
        }
      }
    }
    // Datos fijos que el clima y la capacidad usan en cada paso
    const areaT = new Float64Array(N), fracFrio = new Float64Array(N), latApta = new Uint8Array(N), cerrada = new Uint8Array(N);
    for (const i of tierra) {
      areaT[i] = bioma0[i] === MAR ? areaCompleta(i) : area0[i];
      fracFrio[i] = Math.min(1, Math.max(0, (Math.abs(lat[i]) - 30) / 30));
      latApta[i] = Math.abs(lat[i]) <= 58 ? 1 : 0;
      cerrada[i] = bioma0[i] === DESIERTO && !rio[i] ? 1 : 0;   // desierto fuera de los valles de río
    }
    // Celdas a las que el clima les puede cambiar el tipo de tierra (hielo, puente o desierto que reverdece) y celdas a las que
    // solo les cambia el frío; las demás quedan fijas
    const estructural = i => gHielo[i] < Infinity || puente[i] >= 0 || (cerrada[i] && humedo[i]);
    const estructurales = Int32Array.from(tierra.filter(estructural));
    const soloFrio = Int32Array.from(tierra.filter(i => !estructural(i) && fracFrio[i] > 0));
    // Humanos arcaicos: ocupación (0–1) y especie de cada celda
    const arc = new Float32Array(N), especie = new Int8Array(N).fill(-1);
    historia.arcaicos.forEach((a, k) => { for (const i of tierra) if (especie[i] < 0 && !(region[i] >= 0 && historia.regiones[region[i]].origen) && enCajas(lat[i], lon[i], a.cajas)) { arc[i] = 1; especie[i] = k; } });
    const conArcaicos = tierra.filter(i => arc[i] > 0);

    // --- Estado de la partida (lo que usan las reglas de cada paso) ---
    const E = {
      P, historia, natalidad: opciones.natalidad ?? 1, glacial: opciones.intensidadGlacial ?? 1,
      conPuentes: opciones.puentesDeTierra ?? true, cruceMult: opciones.cruceDeMar ?? 1,
      azar: new Uint32Array([semilla]),
      // Tu pueblo (null en el modo Historia): tuyos y linaje por celda, y su propio azar para no tocar el de la partida
      pb: null, azarP: null, salenT: null, llegaT: null, llegaL: null, pesosT: new Float64Array(8),
      // Mundo
      lat, lon, tierraL: Int32Array.from(tierra), costerasL: Int32Array.from(costeras), estructurales, soloFrio, vecinas, costa, bioma0, rio, humedo, gHielo,
      puente, region, domestica, areaT, fracFrio, latApta, cerrada, especie,
      // Clima y capacidad base (según el clima: tipo de tierra, si se puede cultivar, capacidad base de recolectores)
      clima: { nivelMar: 0, intensidadGlacial: 0, humedoSahara: false, puentesAbiertos: [] }, climaCeldas: "",
      hielo: new Uint8Array(N), plataforma: new Uint8Array(N), bio: new Uint8Array(N), base: new Float32Array(N),
      apta: new Uint8Array(N), kRec: new Float64Array(N),
      // Gente: población, innovaciones (bits), etapa, saber agrícola y saber de recolectores, con sus copias del inicio del paso
      pob: new Float64Array(N), innov: new Uint16Array(N), etapa: new Uint8Array(N), saber: new Float32Array(N), sr: new Float32Array(N),
      innov0: new Uint16Array(N), saber0: new Float32Array(N), sr0: new Float32Array(N), arc,
      // Celdas habitadas, en el orden de `tierra`
      hab: new Int32Array(N), nHab: 0, cambioHab: true,
      // Para crecer, migrar y cruzar el mar
      capHab: new Float64Array(N), expEtapa: new Float64Array(5),
      llegan: new Float64Array(N), llegaS: new Float64Array(N), salen: new Float64Array(N), aporte: new Float64Array(N),
      traen: new Uint16Array(N), pesos: new Float64Array(8), destinos: new Int32Array(N),
      marca: new Int32Array(N), etapaPropia: new Uint8Array(N), masc: new Uint16Array(N), limite: new Float64Array(N), atractivo: new Float64Array(N), pasoN: 0,
      marcaEtapa: new Int32Array(5 * N), atractivoEtapa: new Float64Array(5 * N),
      visita: new Int32Array(N), cola: new Int32Array(N), dist: new Uint8Array(N), candidatas: [], sello: 0,
      caminosMar: new Map(), clavePuentes: "",
      ocupadas: Int32Array.from(conArcaicos), nOcupadas: conArcaicos.length,
      arcInicial: historia.arcaicos.map((a, k) => conArcaicos.filter(i => especie[i] === k).length),
      // Hitos y totales
      regionHito: historia.regiones.map(r => r.hito || null), origen: historia.regiones.map(r => !!r.origen),
      pendiente: new Uint8Array(historia.regiones.length),
      oyentes: [], logros: [], hechos: new Set(),
      año: opciones.inicio ?? historia.inicio, total: 0, totalIndustrial: 0, fin: false, empezoConGente: false
    };
    const { pob, innov, etapa, sr, hielo, plataforma } = E;

    function avanzar(años) {
      let resto = Math.min(años, historia.presente - E.año);
      while (resto > 1e-6 && !E.fin) {
        const d = Math.min(resto, tramo(historia.pasos, E.año));
        paso(E, d);
        resto -= d;
      }
      if (E.año >= historia.presente - 1e-6) { E.año = historia.presente; E.fin = true; }
    }

    actualizarClima(E);
    for (const o of historia.origenes) pob[celdaDe(o.lat, o.lon)] += o.personas;
    if (opciones.pueblo) {
      const o = historia.origenes[opciones.pueblo.origen];
      if (!o) throw new Error(`No hay origen ${opciones.pueblo.origen} para tu pueblo`);
      // mods: los modificadores de tus decisiones y rasgos; apt y cap, sus productos por celda y etapa (ver precalcularMods);
      // conDonde: si alguno depende de la celda
      E.pb = { tuyos: new Float64Array(N), linaje: new Float32Array(N), mods: MODS_NEUTROS, apt: new Float32Array(5 * N).fill(1), cap: new Float32Array(5 * N).fill(1), conDonde: false, cambiados: new Int32Array(N),
        tocadas: new Int32Array(N), nTocadas: 0, sello: new Int32Array(N).fill(-1), pasoT: 0 };
      E.azarP = new Uint32Array([(semilla ^ 0x9e3779b9) >>> 0]);
      E.salenT = new Float64Array(N); E.llegaT = new Float64Array(N); E.llegaL = new Float64Array(N);
      const i = celdaDe(o.lat, o.lon);
      E.pb.tuyos[i] = o.personas;
      E.pb.linaje[i] = o.personas / pob[i];   // 1, salvo que otro origen empiece en la misma celda
    }
    for (const i of tierra) etapa[i] = pob[i] > 0 ? RECOLECTORES : VACIA;
    listarHabitadas(E);
    contar(E);
    E.empezoConGente = E.total > 0;

    // Tu pueblo visto desde afuera: los arreglos por celda y sus cuentas
    const pueblo = E.pb && {
      tuyos: E.pb.tuyos, linaje: E.pb.linaje,
      total() { let t = 0; const tu = E.pb.tuyos; for (let k = 0; k < tierra.length; k++) t += tu[tierra[k]]; return t; },
      // Personas "equivalentes" que descienden de tu pueblo
      herencia() { let t = 0; const l = E.pb.linaje; for (let k = 0; k < tierra.length; k++) { const i = tierra[k]; t += l[i] * pob[i]; } return t; },
      // Gente que vive en celdas con algo de tu linaje (más de 0,1 %)
      conLinaje() { let t = 0; const l = E.pb.linaje; for (let k = 0; k < tierra.length; k++) { const i = tierra[k]; if (l[i] > 0.001) t += pob[i]; } return t; },
      mayoria: i => E.pb.tuyos[i] > 0.5 * pob[i],
      celdas: () => Int32Array.from(tierra.filter(i => E.pb.tuyos[i] > 0))
    };
    // Tu pueblo pierde esa fracción de su gente en cada celda (mueren); las celdas que quedan con menos de `minimo` se vacían
    function perderPueblo(fraccion) {
      if (!E.pb) return;
      const tu = E.pb.tuyos;
      for (const i of tierra) if (tu[i] > 0) morir(E, i, tu[i] * fraccion);
      listarHabitadas(E);
      contar(E);
    }
    // Reemplaza los modificadores de tu pueblo (los que falten, neutros)
    function setModificadores(mods) {
      if (!E.pb) return;
      const m = E.pb.mods = { ...MODS_NEUTROS, ...mods };
      E.pb.conDonde = m.aptitud.length > 0 || m.capacidad.length > 0;
      precalcularMods(E, E.tierraL);
    }

    return {
      semilla,
      avanzar,
      pueblo: () => pueblo || null,
      perderPueblo,
      setModificadores,
      año: () => E.año,
      pasoMax: () => tramo(historia.pasos, E.año),
      poblacionTotal: () => E.total,
      // Las celdas habitadas, en el orden de `tierra`, son las primeras nHabitadas() de celdas.habitadas (una que se vació en
      // este paso puede seguir en la lista, con población 0)
      nHabitadas: () => E.nHab,
      terminado: () => E.fin,
      climaActual: () => E.clima,
      alHito(fn) { E.oyentes.push(fn); },
      hitos: () => E.logros.slice(),
      capacidad: i => capacidad(E, i, pob[i] > 0 ? etapaDe(innov[i]) : RECOLECTORES, sr[i]),
      celdaDe,
      // Solo lectura. `bioma` es el tipo de tierra según el clima de ahora; `area`, la superficie de cada celda en km²; `especie`, el
      // índice de historia.arcaicos (−1 sin arcaicos); `domestica`, el de historia.domesticables (−1 si no hay); `costa`, 1 en la costa
      celdas: { ancho: W, alto: H, grados: G, lat, lon, tierra, poblacion: pob, etapa, innovaciones: innov, region, hielo, plataforma, saberRecolector: sr, arcaicos: arc,
        especie, domestica, area: areaT, bioma: E.bio, costa, habitadas: E.hab },
      poblacionPorRegion() {
        const t = new Float64Array(historia.regiones.length);
        for (const i of tierra) if (region[i] >= 0) t[region[i]] += pob[i];
        return t;
      }
    };
  }

  return {
    crear, tramo, PARAMS, MODS_NEUTROS,
    BIOMA: { MAR, HIELO, TUNDRA, DESIERTO, ESTEPA, BOSQUE, SELVA },
    INNOVACION: { COSTERA, AGRICULTURA, CIUDADES, ESCRITURA, ALTURA, INDUSTRIA },
    ETAPA: { VACIA, RECOLECTORES, AGRICULTORES, URBANA, INDUSTRIAL }
  };
})();
if (typeof module !== "undefined") module.exports = Motor;
