// Tu pueblo en "La Tierra": detecta los momentos de decisión, aplica sus efectos y rasgos, y lleva el estado y el registro.
// No usa three.js ni el DOM. Los momentos y los rasgos vienen del catálogo (PUEBLO, en pueblo-datos.js); `revisar` se llama
// después de cada paso del motor, así que solo recorre las celdas una vez y no arma nada nuevo salvo cuando algo cambia.
const Pueblo = (() => {
  const MotorRef = typeof Motor !== "undefined" ? Motor : require("./motor.js");
  const { BIOMA, ETAPA, INNOVACION, tramo } = MotorRef;
  const { MAR, HIELO, TUNDRA, DESIERTO, ESTEPA, BOSQUE, SELVA } = BIOMA;
  const { AGRICULTORES } = ETAPA;
  const { COSTERA, AGRICULTURA, ESCRITURA, INDUSTRIA } = INNOVACION;
  // Rasgo que deja un cuello de botella según su causa
  const RASGO_CAUSA = { sed: "resistentes_sed", frio: "adaptados_frio", enfermedad: "defensas" };

  // --- Los nombres del catálogo ("DESIERTO", "AGRICULTORES", "AGRICULTURA") pasan a los códigos del motor ---
  function codigo(tabla, nombre, que) {
    if (!(nombre in tabla)) throw new Error(`${que} desconocido en el catálogo de tu pueblo: ${nombre}`);
    return tabla[nombre];
  }
  const bitsDe = nombres => (nombres || []).reduce((b, n) => b | codigo(INNOVACION, n, "Innovación"), 0);
  function traducirDonde(d) {
    const t = { ...d };
    if (d.biomas) t.biomas = d.biomas.map(n => codigo(BIOMA, n, "Bioma"));
    if (d.etapas) t.etapas = d.etapas.map(n => codigo(ETAPA, n, "Etapa"));
    return t;
  }
  function traducirMods(mods) {
    if (!mods) return null;
    const t = { ...mods };
    for (const k of ["aptitud", "capacidad"]) if (mods[k]) t[k] = mods[k].map(({ donde, valor }) => ({ donde: traducirDonde(donde), valor }));
    return t;
  }
  // Suma de varios modificadores: migración, rumbo al ecuador, cruce, desplazamiento y defensas se multiplican; pérdidas y epidemias se suman (la
  // epidemia final, por las defensas); las listas se juntan. Siempre un objeto completo, como lo espera setModificadores.
  function combinar(fuentes, bloqueo) {
    const m = { aptitud: [], capacidad: [], migracion: 1, ecuador: 1, cruce: 1, evitaArcaicos: false, desplaza: 1, perdidaArcaicos: 0, epidemia: 0, bloqueo };
    let defensas = 1;
    for (const f of fuentes) {
      if (f.aptitud) m.aptitud.push(...f.aptitud);
      if (f.capacidad) m.capacidad.push(...f.capacidad);
      m.migracion *= f.migracion ?? 1;
      m.ecuador *= f.ecuador ?? 1;
      m.cruce *= f.cruce ?? 1;
      m.desplaza *= f.desplaza ?? 1;
      defensas *= f.defensas ?? 1;
      m.perdidaArcaicos += f.perdidaArcaicos ?? 0;
      m.epidemia += f.epidemia ?? 0;
      if (f.evitaArcaicos) m.evitaArcaicos = true;
    }
    m.epidemia *= defensas;
    return m;
  }

  // motor: una partida de Motor.crear con pueblo; catalogo: como PUEBLO; opciones.origen: la opción elegida del Nacimiento
  // (0, 1, 2: el mismo índice que historia.origenes); opciones.params: los mismos que se pasaron al motor, si se cambiaron
  function crear(motor, historia, catalogo, opciones = {}) {
    const pb = motor.pueblo();
    if (!pb) throw new Error("La partida no tiene pueblo");
    const P = { ...MotorRef.PARAMS, ...opciones.params }, reglas = catalogo.reglas;
    const c = motor.celdas, { habitadas: hab, lat, poblacion: pob, etapa, innovaciones: innov, region, arcaicos: arc, especie, domestica, area, bioma: bio, costa } = c;
    const { tuyos, linaje } = pb;
    const W = c.ancho, H = c.alto, N = W * H, R = historia.regiones.length;
    // 8 vecinas por celda, como en el motor (la longitud da la vuelta) pero sin las barreras: un estrecho también es una frontera
    const vecinas = new Int32Array(N * 8).fill(-1);
    for (let i = 0; i < N; i++) {
      const f = Math.floor(i / W), col = i % W;
      let k = 0;
      for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) {
        if (!df && !dc) continue;
        if (f + df >= 0 && f + df < H) vecinas[i * 8 + k] = (f + df) * W + ((col + dc + W) % W);
        k++;
      }
    }
    // Fría, como `donde.frio`: latitud de 45° o más (fijo por celda, se calcula una vez), tundra o hielo
    const latFria = Uint8Array.from({ length: N }, (_, i) => Math.abs(lat[i]) >= 45 ? 1 : 0);
    const cultivable = i => (bio[i] === ESTEPA || bio[i] === BOSQUE || bio[i] === SELVA) && Math.abs(lat[i]) <= 58;

    // El catálogo, traducido una vez
    const momentos = catalogo.momentos;
    const porId = new Map(momentos.map(m => [m.id, m]));
    const efectos = new Map();
    for (const m of momentos) for (const o of m.opciones) {
      const e = o.efecto || {};
      efectos.set(o, { ...e, mods: traducirMods(e.mods), desbloquea: bitsDe(e.desbloquea), bloquea: e.bloquea ? { bits: bitsDe(e.bloquea.bits), años: e.bloquea.años } : null });
    }
    const catRasgos = new Map(catalogo.rasgos.map(r => [r.id, { ...r, mods: traducirMods(r.mods) || {} }]));
    for (const id of Object.values(reglas.rasgoPorEspecie || {})) if (!catRasgos.has(id)) throw new Error(`No hay rasgo ${id}`);
    const bloqueoInicial = bitsDe(reglas.bloqueoInicial);

    // --- Estado ---
    const año0 = motor.año(), oyentes = [], registro = [], tengo = [];
    // hasta: el año en que tu pueblo dejó de estar vivo (el de la extinción si se extinguió); disueltoEn: el de la disolución
    let estado = "vivo", hasta = null, disueltoEn = null, pendiente = null, ultima = año0;
    const veces = new Map(), espera = new Map(), rechazos = new Map(), cerrados = new Set();
    // Efectos activos: { mods, bloqueo, hasta } (hasta = Infinity si es para siempre)
    const activos = [];
    let desbloqueado = 0;
    const especiesVistas = new Set(), pares = new Uint8Array((R + 1) * (R + 1));
    const pisadas = new Uint8Array(R), llegadas = new Uint8Array(R);
    // Medidas de cada paso: las celdas donde tu pueblo es mayoría ("tus celdas"), totales y lo que siguen los detectores
    const mias = new Int32Array(N);
    let nMias = 0, total = 0, herencia = 0, tSed = 0, tFrio = 0, tEnf = 0;
    let totMax = 0, sedMax = 0, frioMax = 0, enfMax = 0, agriDesde = null;
    // Sequía: la capacidad de cada celda en su máximo desde la última sequía, y las sumas de ahora y de esos máximos sobre las
    // mismas celdas (tus celdas de este paso), así perder celdas no parece una sequía
    const capMax = new Float64Array(N), capAhora = new Float64Array(N);
    let cap = 0, capTope = 0;

    // Las sumas se llevan en variables locales (más rápido que las de afuera) y se guardan al final
    function medir() {
      if (estado === "extinto") return;
      const n = motor.nHabitadas();
      let her = 0;
      if (estado !== "vivo") {
        // Disuelto: ya no hay tuyos; solo se sigue la herencia para avisar si se extingue, y para eso basta saber si llega a
        // `minimo` (la suma se corta ahí: no se usa para nada más)
        for (let k = 0; k < n && her < P.minimo; k++) { const i = hab[k]; if (pob[i] > 0) her += linaje[i] * pob[i]; }
        herencia = her;
        return;
      }
      let nM = 0, tot = 0, sed = 0, fr = 0, enf = 0;
      const minimo = P.minimo, establecida = P.establecida;
      // Solo las celdas habitadas (en el orden de `tierra`, así las sumas dan lo mismo que recorriéndola entera). La herencia
      // también se corta al llegar a `minimo`: solo se usa para saber si tu linaje se extinguió
      for (let k = 0; k < n; k++) {
        const i = hab[k], p = pob[i];
        if (p <= 0) continue;
        if (her < minimo) her += linaje[i] * p;
        const t = tuyos[i];
        if (t <= 0) continue;
        tot += t;
        const b = bio[i];
        if (b === DESIERTO || b === ESTEPA) sed += t;
        if (latFria[i] || b === TUNDRA || b === HIELO) fr += t;
        if (etapa[i] >= AGRICULTORES) enf += t;
        const r = region[i];
        if (r >= 0) { pisadas[r] = 1; if (t >= establecida) llegadas[r] = 1; }
        if (t > 0.5 * p) mias[nM++] = i;
      }
      herencia = her; nMias = nM; total = tot; tSed = sed; tFrio = fr; tEnf = enf;
      cap = 0; capTope = 0;
      if (nMias > 0 && disponible("sequia")) {
        motor.capacidades(mias, nMias, capAhora);   // las de todas tus celdas en una llamada (lo mismo que motor.capacidad)
        for (let h = 0; h < nMias; h++) {
          const i = mias[h], k = capAhora[h];
          if (k > capMax[i]) capMax[i] = k;
          cap += k; capTope += capMax[i];
        }
      }
    }
    const foto = () => ({ pueblo: pb.total(), herencia: pb.herencia() });
    function cerrarRegistro(f) {
      const ult = registro[registro.length - 1];
      if (ult && ult.despues === null) ult.despues = f || foto();
    }
    // Pasa a los modificadores del motor la suma de los efectos activos y los rasgos
    function aplicar() {
      let bloqueo = bloqueoInicial & ~desbloqueado;
      const fuentes = [];
      for (const a of activos) { if (a.mods) fuentes.push(a.mods); bloqueo |= a.bloqueo; }
      for (const r of tengo) fuentes.push(r.mods);
      motor.setModificadores(combinar(fuentes, bloqueo));
    }
    function revisarEstado() {
      const antes = estado;
      if (estado !== "extinto" && herencia < P.minimo) estado = "extinto";
      else if (estado === "vivo" && total <= 0) estado = "disuelto";
      if (estado === antes) return;
      hasta = motor.año();
      if (estado === "disuelto") disueltoEn = hasta;
      pendiente = null;
      cerrarRegistro();
      oyentes.forEach(fn => fn({ tipo: "estado", estado }));
    }
    // Un momento se puede ofrecer si está en el catálogo, no llegó a su límite, no se cerró (se adoptó lo que ofrecía) y no
    // espera a que venza un rechazo
    function disponible(id) {
      const m = porId.get(id);
      return !!m && (veces.get(id) || 0) < m.limite && !cerrados.has(id) && !(motor.año() < (espera.get(id) ?? -Infinity));
    }

    // --- Detectores: devuelven null o lo que la decisión necesita recordar ---
    const DETECTORES = {
      sequia: () => nMias > 0 && cap < (1 - reglas.sequiaCaida) * capTope ? {} : null,
      frontera() {
        for (let h = 0; h < nMias; h++) {
          const i = mias[h];
          for (let k = 0; k < 8; k++) {
            const j = vecinas[i * 8 + k];
            if (j < 0 || bio[j] === MAR) continue;
            const rj = region[j];
            if (!(rj >= 0 && !pisadas[rj]) && !(bio[j] === DESIERTO && motor.capacidad(j) <= 0)) continue;
            const par = (region[i] + 1) * (R + 1) + rj + 1;
            if (!pares[par]) return { par };
          }
        }
        return null;
      },
      encuentro() {
        for (let h = 0; h < nMias; h++) {
          const i = mias[h];
          for (let k = -1; k < 8; k++) {
            const j = k < 0 ? i : vecinas[i * 8 + k];
            if (j < 0 || !(arc[j] > 0) || especie[j] < 0) continue;
            const id = historia.arcaicos[especie[j]].id;
            if (!especiesVistas.has(id)) return { especie: id };
          }
        }
        return null;
      },
      frio: () => motor.climaActual().intensidadGlacial >= reglas.frioGlacial && total > 0 && tFrio >= reglas.frioParte * total ? {} : null,
      agricultura() {
        if (motor.año() < historia.holoceno) return null;
        for (let h = 0; h < nMias; h++) {
          const i = mias[h];
          if (!cultivable(i)) continue;
          if (domestica[i] >= 0) return {};
          for (let k = 0; k < 8; k++) { const j = vecinas[i * 8 + k]; if (j >= 0 && pob[j] > 0 && etapa[j] >= AGRICULTORES) return {}; }
        }
        return null;
      },
      ganado: () => agriDesde !== null && motor.año() - agriDesde >= reglas.ganadoAños ? {} : null,
      ciudades() {
        for (let h = 0; h < nMias; h++) {
          const i = mias[h];
          if ((innov[i] & AGRICULTURA) && area[i] > 0 && pob[i] / area[i] > P.densidadCiudad) return {};
        }
        return null;
      },
      industria() {
        let escribe = false;
        for (let h = 0; h < nMias && !escribe; h++) escribe = (innov[mias[h]] & ESCRITURA) !== 0;
        if (!escribe) return null;
        for (let k = 0, n = motor.nHabitadas(); k < n; k++) { const i = hab[k]; if (pob[i] > 0 && (innov[i] & INDUSTRIA)) return {}; }
        return null;
      },
      // Agricultores que navegan la costa (como los austronesios): pueden lanzarse a mar abierto
      mar() {
        for (let h = 0; h < nMias; h++) { const i = mias[h]; if (costa[i] && (innov[i] & COSTERA) && (innov[i] & AGRICULTURA)) return {}; }
        return null;
      }
    };
    // Causa de un cuello de botella: la que se llevó más de la mitad de la caída desde el máximo (null si ninguna)
    function causaCuello() {
      const caida = totMax - total;
      let causa = null, mayor = 0.5 * caida;
      for (const [c, d] of [["sed", sedMax - tSed], ["frio", frioMax - tFrio], ["enfermedad", enfMax - tEnf]]) if (d > mayor) { causa = c; mayor = d; }
      return causa;
    }

    function ofrecer(m, extra) {
      const año = motor.año();
      veces.set(m.id, (veces.get(m.id) || 0) + 1);
      ultima = año;
      if (extra.par !== undefined) pares[extra.par] = 1;
      if (extra.especie) especiesVistas.add(extra.especie);
      if (m.id === "sequia") capMax.fill(0);   // los máximos vuelven a contar desde ahora
      const decision = { id: m.id, titulo: m.titulo, texto: m.texto, año: Math.round(año),
        opciones: m.opciones.map(o => ({ id: o.id, texto: o.texto, detalle: o.detalle })) };
      pendiente = { momento: m, decision, especie: extra.especie || null, causa: extra.causa || null };
      return decision;
    }

    function revisar() {
      medir();
      revisarEstado();
      if (motor.terminado()) {
        // Al final, una decisión que quedó abierta se descarta
        pendiente = null;
        cerrarRegistro();
        return null;
      }
      if (estado !== "vivo" || pendiente) return null;
      const año = motor.año();
      // Vencen los efectos
      let cambio = false;
      for (let k = activos.length - 1; k >= 0; k--) if (activos[k].hasta <= año) { activos.splice(k, 1); cambio = true; }
      if (cambio) aplicar();
      // Máximos y plazos que siguen los detectores
      if (total > totMax) { totMax = total; sedMax = tSed; frioMax = tFrio; enfMax = tEnf; }
      let agri = false;
      for (let h = 0; h < nMias && !agri; h++) agri = (innov[mias[h]] & AGRICULTURA) !== 0;
      agriDesde = agri ? (agriDesde ?? año) : null;
      // El cuello de botella no espera el intervalo
      if (disponible("cuello") && total < reglas.cuelloFraccion * totMax) {
        const causa = causaCuello();
        totMax = total; sedMax = tSed; frioMax = tFrio; enfMax = tEnf;
        return ofrecer(porId.get("cuello"), { causa });
      }
      if (año - ultima < tramo(reglas.intervalo, año)) return null;
      for (const m of momentos) {
        const detector = DETECTORES[m.id];
        if (!detector || !disponible(m.id)) continue;
        const extra = detector();
        if (extra) return ofrecer(m, extra);
      }
      return null;
    }

    function elegir(opcionId) {
      if (!pendiente) throw new Error("No hay ninguna decisión pendiente");
      if (motor.terminado()) { pendiente = null; throw new Error("La partida ya terminó"); }
      const m = pendiente.momento, o = m.opciones.find(x => x.id === opcionId);
      if (!o) throw new Error(`La decisión "${m.id}" no tiene la opción "${opcionId}"`);
      const año = motor.año(), e = efectos.get(o), antes = foto(), causa = pendiente.causa ?? null;
      cerrarRegistro(antes);
      let rasgo = null, cambio = false;
      if (e.perder) motor.perderPueblo(e.perder);
      const idRasgo = e.rasgo === "segun_especie" ? (reglas.rasgoPorEspecie || {})[pendiente.especie]
        : e.rasgo === "segun_causa" ? RASGO_CAUSA[pendiente.causa] : e.rasgo;
      if (idRasgo && !tengo.some(r => r.id === idRasgo)) {
        const r = catRasgos.get(idRasgo);
        if (!r) throw new Error(`No hay rasgo ${idRasgo}`);
        tengo.push({ ...r, año: Math.round(año) });
        rasgo = publico(tengo[tengo.length - 1]);
        cambio = true;
      }
      if (e.mods) { activos.push({ mods: e.mods, bloqueo: 0, hasta: e.duracion ? año + e.duracion : Infinity }); cambio = true; }
      if (e.bloquea) {
        // El primer rechazo bloquea por un plazo y el momento vuelve a ofrecerse al vencer; el segundo bloquea para siempre
        const n = (rechazos.get(m.id) || 0) + 1;
        rechazos.set(m.id, n);
        activos.push({ mods: null, bloqueo: e.bloquea.bits, hasta: n > 1 ? Infinity : año + e.bloquea.años });
        espera.set(m.id, año + e.bloquea.años);
        cambio = true;
      }
      if (e.desbloquea) { desbloqueado |= e.desbloquea; cerrados.add(m.id); cambio = true; }
      if (cambio) aplicar();
      registro.push({ momento: m.id, titulo: m.titulo, opcion: o.texto, opcionId: o.id, texto: m.real.texto, fuente: m.real.fuente,
        año: Math.round(año), antes, despues: null });
      pendiente = null;
      // causa: la de un cuello de botella ("sed", "frio", "enfermedad" o null si no fue clara); null en los demás momentos
      return { opcion: { id: o.id, texto: o.texto }, real: { texto: m.real.texto, fuente: m.real.fuente }, rasgo, causa };
    }
    const publico = r => ({ id: r.id, nombre: r.nombre, texto: r.texto, fuente: r.fuente, año: r.año });

    // --- Al empezar: el Nacimiento, los modificadores iniciales (bloqueos) y las primeras medidas ---
    const nacimiento = porId.get("nacimiento");
    if (nacimiento) {
      const o = nacimiento.opciones[opciones.origen ?? 0];
      if (!o) throw new Error(`El Nacimiento no tiene la opción ${opciones.origen}`);
      veces.set("nacimiento", 1);
      registro.push({ momento: "nacimiento", titulo: nacimiento.titulo, opcion: o.texto, opcionId: o.id, texto: nacimiento.real.texto,
        fuente: nacimiento.real.fuente, año: Math.round(año0), antes: null, despues: null });
    }
    aplicar();
    medir();
    totMax = total; sedMax = tSed; frioMax = tFrio; enfMax = tEnf;

    return {
      revisar,
      elegir,
      pendiente: () => pendiente ? pendiente.decision : null,
      estado: () => estado,
      rasgos: () => tengo.map(publico),
      registro: () => registro.map(r => ({ ...r })),
      resumen: () => ({
        estado, desde: Math.round(año0), hasta: Math.round(hasta ?? motor.año()),
        disueltoEn: disueltoEn === null ? null : Math.round(disueltoEn),
        regiones: historia.regiones.filter((r, k) => llegadas[k]).map(r => r.id),
        rasgos: tengo.map(r => r.nombre),
        pueblo: pb.total(), herencia: pb.herencia(), conLinaje: pb.conLinaje(), decisiones: registro.length
      }),
      alEvento(fn) { oyentes.push(fn); }
    };
  }

  return { crear };
})();
if (typeof module !== "undefined") module.exports = Pueblo;
