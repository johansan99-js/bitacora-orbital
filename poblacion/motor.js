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
      [0, 0, 0, 0.3, 6, 4, 3],
      [0, 0, 0, 1, 18, 12, 9],
      [0, 0, 1, 8, 150, 100, 80]
    ],
    costa: 1.5,              // extra de la pesca para recolectores en celdas costeras
    frio: 0.5,               // pérdida máxima de capacidad en latitudes altas en plena glaciación
    crecimiento: [0, 0.003, 0.01, 0.01, 0.025],   // tasa r por año según la etapa
    minimo: 10,              // menos gente que esto en una celda = deshabitada; tampoco salen grupos más chicos
    establecida: 100,        // gente necesaria para que una llegada cuente como hito
    exploracion: 0.002,      // fracción que se va por año aunque haya espacio
    presion: 0.004,          // fracción extra por año cuando la celda está llena
    cruce: [0.00002, 0.0001, 0.0002],   // probabilidad por año de cruzar el mar desde una costa: sin navegación, costera, de altura
    alcance: [1, 2, 20],     // celdas de agua que se pueden cruzar en cada caso
    costera: 2e-7,           // aparición de la navegación costera, por año y por cada 1.000 personas en la costa
    agricultura: 0.0002,     // aparición de la agricultura por año en una celda llena de una región con domesticables
    llenaAgricultura: 0.7,   // fracción de la capacidad de recolectores desde la que empieza a aparecer
    ciudades: 0.0005,        // aparición de ciudades por año con densidad al doble del umbral y todas las vecinas agrícolas
    densidadCiudad: 8,       // personas por km² desde las que pueden aparecer ciudades
    escritura: 0.0005,       // aparición de la escritura por año y por cada vecina con ciudades más allá del mínimo
    vecinosEscritura: 2,     // vecinas con ciudades necesarias para que aparezca la escritura
    altura: 0.00005,         // aparición de la navegación de altura por año con saber suficiente
    saberAltura: 2000,       // saber con el que la navegación de altura llega a su probabilidad completa
    industria: 0.0005,       // aparición de la industria por año con saber al doble del umbral
    saberIndustria: 20000,   // saber desde el que puede aparecer la industria
    ritmoSaber: 1,           // saber ganado por año por cada millón de personas agrícolas
    escrituraSaber: 2,       // la escritura multiplica el saber ganado
    difusionSaber: 0.002,    // ritmo con el que el saber se iguala con el de las vecinas
    saberIntensifica: 5000,  // cada tantos puntos de saber, la capacidad agrícola y urbana sube un 100 %
    saberMax: 3,             // tope de esa subida (capacidad ×4)
    contagio: { 1: 0.002, 2: 0.004, 4: 0.002, 8: 0.003, 16: 0.002, 32: 0.02 },   // por año y por vecina, según el bit
    contagioEscritura: 3,    // la escritura acelera el contagio y la difusión del saber
    industriaGlobal: 0.05    // contagio mundial de la industria, multiplicado por la fracción de población industrial
  };

  function azar(semilla) {
    let s = semilla >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
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

  function crear(mundo, historia, opciones = {}) {
    const P = { ...PARAMS, ...opciones.params };
    const semilla = (opciones.semilla ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
    const rnd = azar(semilla);
    const natalidad = opciones.natalidad ?? 1, glacial = opciones.intensidadGlacial ?? 1;
    const conPuentes = opciones.puentesDeTierra ?? true, cruceMult = opciones.cruceDeMar ?? 1;
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

    // --- Estado ---
    const pob = new Float64Array(N), innov = new Uint16Array(N), etapa = new Uint8Array(N), saber = new Float32Array(N);
    const hielo = new Uint8Array(N), plataforma = new Uint8Array(N), bio = new Uint8Array(N), base = new Float32Array(N);
    let año = opciones.inicio ?? historia.inicio, total = 0, totalIndustrial = 0, fin = false;
    let clima = { nivelMar: 0, intensidadGlacial: 0, humedoSahara: false, puentesAbiertos: [] };
    const oyentes = [], logros = [], hechos = new Set();

    // --- Clima: nivel del mar, intensidad glacial, puentes, hielo y periodos húmedos ---
    function actualizarClima() {
      const nivel = interpolar(historia.nivelMar, año);
      const g = Math.min(1, Math.max(0, -nivel / 125 * glacial));
      const hum = entre(año, historia.humedos.tramos);
      const abiertos = historia.puentes.map(p => conPuentes && nivel <= p.umbral);
      clima = { nivelMar: nivel, intensidadGlacial: g, humedoSahara: hum, puentesAbiertos: abiertos };
      for (const i of tierra) {
        hielo[i] = g >= gHielo[i] ? 1 : 0;
        plataforma[i] = puente[i] >= 0 && abiertos[puente[i]] ? 1 : 0;
        let b = bioma0[i];
        if (b === MAR) b = plataforma[i] ? historia.puentes[puente[i]].bioma : MAR;
        else if (b === DESIERTO && (rio[i] || (hum && humedo[i]))) b = ESTEPA;
        if (hielo[i] && b !== MAR) b = HIELO;
        bio[i] = b;
        const frio = 1 - P.frio * g * Math.min(1, Math.max(0, (Math.abs(lat[i]) - 30) / 30));
        base[i] = (b === MAR ? 0 : bioma0[i] === MAR ? areaCompleta(i) : area0[i]) * frio;
      }
    }

    // --- Capacidad ---
    const aptaAgricultura = i => (bio[i] === ESTEPA || bio[i] === BOSQUE || bio[i] === SELVA) && Math.abs(lat[i]) <= 58;
    const etapaDe = bits => bits & INDUSTRIA ? INDUSTRIAL : bits & CIUDADES ? URBANA : bits & AGRICULTURA ? AGRICULTORES : RECOLECTORES;
    // Lo agrícola solo sirve donde se puede cultivar; la navegación se conserva en cualquier lado
    const aptas = (bits, j) => aptaAgricultura(j) ? bits : bits & (COSTERA | ALTURA);
    function capacidad(i, e) {
      if (base[i] <= 0) return 0;
      let k = base[i] * P.densidad[e][bio[i]];
      if (e === RECOLECTORES && costa[i]) k *= P.costa;
      if (e === AGRICULTORES || e === URBANA) k *= 1 + Math.min(saber[i] / P.saberIntensifica, P.saberMax);
      return k;
    }
    function contar() {
      total = 0; totalIndustrial = 0;
      for (const i of tierra) { total += pob[i]; if (innov[i] & INDUSTRIA) totalIndustrial += pob[i]; }
    }

    // --- Gente: crecer, migrar y cruzar el mar ---
    function vaciar(i) { pob[i] = 0; innov[i] = 0; saber[i] = 0; etapa[i] = VACIA; }
    function adoptar(i, bits) { innov[i] |= bits; }
    // Crecimiento logístico exacto hacia la capacidad (estable con pasos largos)
    function crecer(dt) {
      for (const i of tierra) {
        const p = pob[i];
        if (p <= 0) continue;
        const e = etapaDe(innov[i]), K = capacidad(i, e);
        if (K <= 0) { vaciar(i); continue; }
        const r = P.crecimiento[e] * natalidad;
        const q = K / (1 + ((K - p) / p) * Math.exp(-r * dt));   // con r = 0 da q = p
        if (q < P.minimo) vaciar(i); else pob[i] = q;
      }
    }
    const llegan = new Float64Array(N), salen = new Float64Array(N), aporte = new Float64Array(N), traen = new Uint16Array(N), pesos = new Float64Array(8);
    // Una parte de cada celda se muda a las vecinas, más cuanto más llena está y hacia donde hay más espacio.
    // Todo se calcula con la población del inicio del paso y se aplica al final, así el orden de las celdas no influye.
    function migrar(dt) {
      for (const i of tierra) { llegan[i] = 0; salen[i] = 0; aporte[i] = 0; }
      for (const i of tierra) {
        const p = pob[i];
        if (p <= 0) continue;
        const K = capacidad(i, etapaDe(innov[i]));
        const sale = p * (1 - Math.exp(-(P.exploracion + P.presion * Math.min(1, p / K)) * dt));
        if (sale < P.minimo) continue;
        let suma = 0;
        for (let k = 0; k < 8; k++) {
          const j = vecinas[i * 8 + k];
          pesos[k] = 0;
          if (j < 0 || base[j] <= 0) continue;
          const Kj = capacidad(j, etapaDe(aptas(innov[i] | innov[j], j)));
          if (Kj <= 0) continue;
          pesos[k] = Math.max(Kj - pob[j], 0) + 0.01 * Kj;
          suma += pesos[k];
        }
        // Grupos de menos de `minimo` personas no se van
        for (let k = 0; k < 8; k++) if (pesos[k] > 0 && sale * pesos[k] / suma < P.minimo) { suma -= pesos[k]; pesos[k] = 0; }
        if (suma <= 0) continue;
        salen[i] = sale;
        for (let k = 0; k < 8; k++) if (pesos[k] > 0) {
          const j = vecinas[i * 8 + k], v = sale * pesos[k] / suma;
          llegan[j] += v;
          if (v > aporte[j]) { aporte[j] = v; traen[j] = aptas(innov[i], j); }
        }
      }
      for (const i of tierra) {
        pob[i] -= salen[i];
        if (llegan[i] <= 0) continue;
        // Si los recién llegados son mayoría, traen su forma de vida (agricultores que desplazan a recolectores)
        if (llegan[i] > pob[i]) adoptar(i, traen[i]);
        pob[i] += llegan[i];
      }
    }
    const visita = new Int32Array(N), cola = new Int32Array(N), dist = new Uint8Array(N), candidatas = [];
    let sello = 0;
    // Tierra habitable alcanzable cruzando hasta `alcance` celdas de agua (sin contar la costa de partida)
    function destinoPorMar(i, alcance) {
      sello++; candidatas.length = 0;
      let a = 0, b = 0;
      cola[b++] = i; visita[i] = sello; dist[i] = 0;
      while (a < b) {
        const c = cola[a++];
        for (let k = 0; k < 8; k++) {
          const j = vecinas[c * 8 + k];
          if (j < 0 || visita[j] === sello) continue;
          visita[j] = sello;
          if (bio[j] === MAR) { if (dist[c] < alcance) { dist[j] = dist[c] + 1; cola[b++] = j; } }
          else if (c !== i && capacidad(j, RECOLECTORES) > 0) candidatas.push(j);
        }
      }
      return candidatas.length ? candidatas[Math.floor(rnd() * candidatas.length)] : -1;
    }
    function cruzarMar(dt) {
      for (const i of costeras) {
        if (pob[i] < P.establecida) continue;
        const nivel = innov[i] & ALTURA ? 2 : innov[i] & COSTERA ? 1 : 0;
        if (rnd() >= 1 - Math.exp(-P.cruce[nivel] * cruceMult * dt)) continue;
        const j = destinoPorMar(i, P.alcance[nivel]);
        if (j < 0) continue;
        const grupo = Math.min(Math.max(pob[i] * 0.05, 2 * P.minimo), 500, pob[i] / 2);
        pob[i] -= grupo;
        if (pob[j] <= 0) innov[j] = 0;
        adoptar(j, aptas(innov[i], j));   // el contacto también lleva las innovaciones
        pob[j] += grupo;
      }
    }

    // --- Hitos ---
    const regionHito = historia.regiones.map(r => r.hito || null);
    const africa = historia.regiones.findIndex(r => r.id === "africa");
    function hito(id, i) {
      if (hechos.has(id)) return;
      hechos.add(id);
      const h = { id, año: Math.round(año), celda: i };
      logros.push(h);
      oyentes.forEach(fn => fn(h));
    }
    let empezoConGente = false;
    function revisarHitos() {
      for (const i of tierra) {
        if (pob[i] < P.establecida || region[i] < 0) continue;
        if (region[i] !== africa) hito("salida_africa", i);
        if (regionHito[region[i]]) hito(regionHito[region[i]], i);
      }
      if (total >= 1e9) hito("mil_millones", -1);
      if (total >= 8e9) hito("ocho_mil_millones", -1);
      if (total <= 0 && empezoConGente) { hito("extincion", -1); fin = true; }
    }

    // --- Innovaciones: aparecen según densidad, conexiones y saber (nunca por un tiempo fijo) y se contagian ---
    const probPor = (tasa, dt) => 1 - Math.exp(-tasa * dt);
    // Las vecinas se leen como estaban al inicio del paso, así el orden de las celdas no influye
    const innov0 = new Uint16Array(N), saber0 = new Float32Array(N);
    function vecinasCon(i, bit) {
      let n = 0;
      for (let k = 0; k < 8; k++) { const j = vecinas[i * 8 + k]; if (j >= 0 && pob[j] > 0 && (innov0[j] & bit)) n++; }
      return n;
    }
    function puedeAdoptar(bit, v, i, apta) {
      if (bit === COSTERA) return costa[i] === 1;
      if (bit === ALTURA) return costa[i] === 1 && (v & COSTERA) !== 0;
      if (bit === AGRICULTURA) return apta;
      if (!apta || !(v & AGRICULTURA)) return false;
      return bit !== ESCRITURA || (v & CIUDADES) !== 0;
    }
    // Saber: crece con la gente (más personas, más ideas; Kremer 1993) y no se pierde al compartirlo: las celdas agrícolas que saben menos se acercan a la media de sus vecinas
    function acumularSaber(i, v, dt) {
      const escribe = (v & ESCRITURA) !== 0;
      let s = saber[i] + dt * P.ritmoSaber * (pob[i] / 1e6) * (escribe ? P.escrituraSaber : 1);
      let suma = 0, n = 0;
      for (let k = 0; k < 8; k++) {
        const j = vecinas[i * 8 + k];
        if (j >= 0 && pob[j] > 0 && (innov0[j] & AGRICULTURA)) { suma += saber0[j]; n++; }
      }
      if (n && suma / n > s) s += (suma / n - s) * probPor(P.difusionSaber * (escribe ? P.contagioEscritura : 1), dt);
      saber[i] = s;
    }
    function innovar(dt) {
      innov0.set(innov); saber0.set(saber);
      const fracInd = total > 0 ? totalIndustrial / total : 0;
      for (const i of tierra) {
        const p = pob[i];
        if (p <= 0) { etapa[i] = VACIA; continue; }
        let v = innov[i];
        const apta = aptaAgricultura(i);
        if (v & AGRICULTURA) acumularSaber(i, v, dt);
        if (!(v & COSTERA) && costa[i] && rnd() < probPor(P.costera * p / 1000, dt)) v |= COSTERA;
        if (!(v & AGRICULTURA) && apta && año >= historia.holoceno && domestica[i] >= 0) {
          const d = historia.domesticables[domestica[i]];
          const llena = Math.min(1, Math.max(0, (p / capacidad(i, RECOLECTORES) - P.llenaAgricultura) / (1 - P.llenaAgricultura)));
          if (llena > 0 && rnd() < probPor(P.agricultura * d.riqueza * llena, dt)) { v |= AGRICULTURA; hito(`agricultura_${d.id}`, i); }
        }
        if ((v & AGRICULTURA) && !(v & CIUDADES)) {
          const exceso = Math.min(1, Math.max(0, p / base[i] / P.densidadCiudad - 1));
          if (exceso > 0 && rnd() < probPor(P.ciudades * exceso * vecinasCon(i, AGRICULTURA) / 8, dt)) { v |= CIUDADES; hito("primera_ciudad", i); }
        }
        if ((v & CIUDADES) && !(v & ESCRITURA)) {
          const red = vecinasCon(i, CIUDADES) - P.vecinosEscritura + 1;
          if (red > 0 && rnd() < probPor(P.escritura * red, dt)) { v |= ESCRITURA; hito("escritura", i); }
        }
        if ((v & COSTERA) && (v & AGRICULTURA) && !(v & ALTURA) && costa[i]) {
          const s = Math.min(1, saber[i] / P.saberAltura);
          if (s > 0 && rnd() < probPor(P.altura * s, dt)) v |= ALTURA;
        }
        if ((v & ESCRITURA) && !(v & INDUSTRIA)) {
          const exceso = Math.min(1, Math.max(0, saber[i] / P.saberIndustria - 1));
          if (exceso > 0 && rnd() < probPor(P.industria * exceso, dt)) { v |= INDUSTRIA; hito("industria", i); }
        }
        // Contagio desde las vecinas (más rápido con escritura) y, para la industria, desde todo el mundo agrícola
        let union = 0;
        for (let k = 0; k < 8; k++) { const j = vecinas[i * 8 + k]; if (j >= 0 && pob[j] > 0) union |= innov0[j]; }
        const global = fracInd > 0 && apta && (v & AGRICULTURA) && !(v & INDUSTRIA);
        if ((union & ~v) || global) {
          const mult = (v | union) & ESCRITURA ? P.contagioEscritura : 1;   // la celda o alguna vecina escribe
          for (const bit of BITS) {
            if ((v & bit) || !puedeAdoptar(bit, v, i, apta)) continue;
            let tasa = union & bit ? P.contagio[bit] * vecinasCon(i, bit) * mult : 0;
            if (bit === INDUSTRIA) tasa += P.industriaGlobal * fracInd;
            if (tasa > 0 && rnd() < probPor(tasa, dt)) v |= bit;
          }
        }
        innov[i] = v;
        etapa[i] = etapaDe(v);
      }
    }

    // --- Paso del tiempo ---
    function paso(dt) {
      año += dt;
      actualizarClima();
      crecer(dt);
      migrar(dt);
      cruzarMar(dt);
      innovar(dt);
      contar();
      revisarHitos();
    }
    function avanzar(años) {
      let resto = Math.min(años, historia.presente - año);
      while (resto > 1e-6 && !fin) {
        const d = Math.min(resto, tramo(historia.pasos, año));
        paso(d);
        resto -= d;
      }
      if (año >= historia.presente - 1e-6) { año = historia.presente; fin = true; }
    }

    actualizarClima();
    for (const o of historia.origenes) pob[celdaDe(o.lat, o.lon)] += o.personas;
    for (const i of tierra) etapa[i] = pob[i] > 0 ? RECOLECTORES : VACIA;
    contar();
    empezoConGente = total > 0;

    return {
      semilla,
      avanzar,
      año: () => año,
      pasoMax: () => tramo(historia.pasos, año),
      poblacionTotal: () => total,
      terminado: () => fin,
      climaActual: () => clima,
      alHito(fn) { oyentes.push(fn); },
      hitos: () => logros.slice(),
      capacidad: i => capacidad(i, pob[i] > 0 ? etapaDe(innov[i]) : RECOLECTORES),
      celdaDe,
      celdas: { ancho: W, alto: H, grados: G, lat, lon, tierra, poblacion: pob, etapa, innovaciones: innov, region, hielo, plataforma },
      poblacionPorRegion() {
        const t = new Float64Array(historia.regiones.length);
        for (const i of tierra) if (region[i] >= 0) t[region[i]] += pob[i];
        return t;
      }
    };
  }

  return {
    crear, tramo, PARAMS,
    BIOMA: { MAR, HIELO, TUNDRA, DESIERTO, ESTEPA, BOSQUE, SELVA },
    INNOVACION: { COSTERA, AGRICULTURA, CIUDADES, ESCRITURA, ALTURA, INDUSTRIA },
    ETAPA: { VACIA, RECOLECTORES, AGRICULTORES, URBANA, INDUSTRIAL }
  };
})();
if (typeof module !== "undefined") module.exports = Motor;
