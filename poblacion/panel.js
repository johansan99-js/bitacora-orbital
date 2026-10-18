// Interfaz de la escala "La Tierra": elegir modo, tarjeta comparativa, avisos de hitos, decisiones de tu pueblo, Bitácora de tu
// humanidad y fichas de continentes.
const PanelTierra = (() => {
  const PartidaRef = typeof Partida !== "undefined" ? Partida : require("./partida.js");
  const CATALOGO = typeof PUEBLO !== "undefined" ? PUEBLO : require("./pueblo-datos.js");
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const num = (n, d = 1) => n.toLocaleString("es", { maximumFractionDigits: d });

  function personas(n) {
    if (n >= 1e9) return `${num(n / 1e9)} mil millones`;
    if (n >= 1e6) { const v = num(n / 1e6); return `${v} ${v === "1" ? "millón" : "millones"}`; }
    return num(n, 0);
  }
  // "2100 personas", "2,1 millones de personas"
  const gente = n => { const t = personas(n); return /(millón|millones)$/.test(t) ? `${t} de personas` : `${t} personas`; };
  // "A", "A y B", "A, B y C"
  const lista = xs => xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
  // Población real estimada en un año: [mínimo, máximo], interpolada en escala logarítmica
  function realEn(tabla, año) {
    const k = tabla.findIndex(f => f[0] >= año);
    if (k === 0) return [tabla[0][1], tabla[0][2]];
    if (k < 0) { const f = tabla[tabla.length - 1]; return [f[1], f[2]]; }
    const [a0, mn0, mx0] = tabla[k - 1], [a1, mn1, mx1] = tabla[k], t = (año - a0) / (a1 - a0);
    const lg = (x, y) => Math.exp(Math.log(x) + (Math.log(y) - Math.log(x)) * t);
    return [lg(mn0, mn1), lg(mx0, mx1)];
  }
  const textoReal = ([a, b]) => b / a > 1.5 ? `${personas(a)} – ${personas(b)}` : `~${personas(Math.sqrt(a * b))}`;
  // Rango de fechas reales en el mismo formato que el reloj
  function rango(real, presente) {
    if (!real) return "no ocurrió";
    const [a, b] = real, t = x => PartidaRef.textoAño(x, presente);
    if (a === b) return t(a);
    if (b < -10000) return `${t(a).replace(/ años$/, "")}–${t(b).replace(/^hace /, "")}`;
    if (b < 0) return `${t(a).replace(/ a\. C\.$/, "")}–${t(b)}`;
    if (a < 0) return `${t(a)}–${t(b)} d. C.`;
    return `${t(a)}–${t(b)}`;
  }
  function comparar(año, real) {
    if (!real) return "";
    const [a, b] = real;
    const d = Math.round(año < a ? a - año : año > b ? año - b : 0);
    if (d === 0) return "dentro del rango real";
    return `${num(d, 0)} ${d === 1 ? "año" : "años"} ${año < a ? "antes" : "después"}`;
  }

  // Una entrada del registro de tu pueblo (ver Pueblo.registro): qué elegiste, cuándo y cómo cambió tu pueblo hasta lo siguiente
  function textoRegistro(e, textoAño) {
    let t = `Elegiste «${e.opcion}» (${textoAño(e.año)}).`;
    if (e.antes && e.despues) t += ` Tu pueblo: ${personas(e.antes.pueblo)} → ${gente(e.despues.pueblo)}.`;
    else if (e.antes) t += ` Tu pueblo: ${gente(e.antes.pueblo)} al elegir.`;
    else if (e.despues) t += ` Después, tu pueblo tenía ${gente(e.despues.pueblo)}.`;
    return t;
  }
  // Resumen del final (ver Pueblo.resumen, con `regiones` ya convertidas a nombres)
  // (si se disolvió y después se extinguió su linaje, `disueltoEn` es el año de la disolución y `hasta` el de la extinción)
  function textoFinal(r, textoAño) {
    const fin = { disuelto: ", cuando se mezcló del todo con sus vecinos", extinto: ", cuando se extinguió" }[r.estado] || "";
    const enAño = a => { const t = textoAño(a); return /^hace /.test(t) ? t : `en ${t}`; };
    const vivio = r.estado === "extinto" && r.disueltoEn != null
      ? `Tu pueblo vivió desde ${textoAño(r.desde)} hasta ${textoAño(r.disueltoEn)}, cuando se mezcló del todo con sus vecinos. Su linaje se extinguió ${enAño(r.hasta).replace(/\.$/, "")}.`
      : `Tu pueblo vivió desde ${textoAño(r.desde)} hasta ${textoAño(r.hasta)}${fin}.`;
    const partes = [
      vivio,
      `Tomaste ${r.decisiones} ${r.decisiones === 1 ? "decisión" : "decisiones"}.`,
      r.regiones.length ? `Se estableció en ${lista(r.regiones)}.` : "No llegó a establecerse en ninguna región.",
      r.rasgos.length ? `Ganó estos rasgos: ${lista(r.rasgos)}.` : "No ganó rasgos."
    ];
    if (r.estado === "vivo") partes.push(`Al final eran ${gente(r.pueblo)}.`);
    partes.push(r.estado === "extinto" ? "Nadie de hoy desciende de tu pueblo."
      : `Hoy, ${gente(r.conLinaje)} tienen algo de su linaje; su herencia equivale a ${gente(r.herencia)}.`);
    return partes.join(" ");
  }
  // Tarjeta de tu pueblo al disolverse o extinguirse: título, qué pasó en tu partida y, si hay con qué compararlo, lo que pasó en
  // la realidad con su fuente (la de Skhul, la misma que cita el momento "frontera" de pueblo-datos.js). La disolución es lo que
  // muestra el juego, sin comparación real: no se presenta como un dato con fuente.
  const ESTADOS = {
    disuelto: { titulo: "Tu pueblo se mezcló con los demás",
      texto: "Ya no queda ningún grupo de tu pueblo: los últimos se integraron a sus vecinos. En tu partida, sus descendientes siguen vivos mezclados con los demás: esa es la herencia que ves en la tarjeta. La partida sigue con el resto de la humanidad.",
      real: null },
    extinto: { titulo: "Tu pueblo se extinguió",
      texto: "No queda nadie de tu pueblo ni de su linaje. La partida sigue: puedes mirar cómo continúa el resto de la humanidad.",
      real: { texto: "Les pasó también a los primeros que salieron de África hacia Levante, hace más de 100.000 años: aquella salida no dejó una población duradera.",
        fuente: "Grün et al. (2005), Journal of Human Evolution 49" } }
  };

  function iniciar({ partida, historia, normal, irA, abrirModal, centroPueblo }) {
    const presente = historia.presente;
    const porId = Object.fromEntries(historia.hitos.map(h => [h.id, h]));
    const reg = Object.fromEntries(historia.regiones.map((r, k) => [r.id, k]));
    const nombreRegion = Object.fromEntries(historia.regiones.map(r => [r.id, r.nombre]));
    const card = $("t-card"), aviso = $("t-hito"), tarjeta = $("t-decision"), boton = $("btn-bitacora"), play = $("btn-play");
    let visible = false;
    const logrados = () => new Map(partida.motor().hitos().map(h => [h.id, h]));
    const hayModal = () => !!document.querySelector(".modal:not([hidden])");
    // Oculta una tarjeta sin perder el foco que tenía
    function ocultar(t) { if (t.contains(document.activeElement)) play.focus(); t.hidden = true; }

    // Fichas de continente con datos de la partida en curso
    historia.continentes.forEach(c => Object.defineProperty(c, "stats", { configurable: true, get() {
      const pr = partida.motor().poblacionPorRegion(), hechos = logrados();
      const pob = c.regiones.reduce((s, id) => s + (pr[reg[id]] || 0), 0);
      return [["Tu humanidad aquí", personas(pob)], ...c.hitos.map(id => {
        const h = porId[id], l = hechos.get(id);
        return [h.corto, `${l ? partida.textoAño(l.año) : "Aún no"} · real: ${rango(h.real, presente)}`];
      })];
    } }));

    // La tarjeta se repinta cada 250 ms, pero solo se toca lo que cambió: escribir el mismo texto o rehacer la lista
    // de continentes obligaría al navegador a recalcular el diseño varias veces por segundo (R8)
    const texto = (id, t) => { const e = $(id); if (e.textContent !== t) e.textContent = t; };
    const oculto = (e, h) => { if (e.hidden !== h) e.hidden = h; };
    const conts = historia.continentes.map(c => el("li", null, c.nombre));
    let contsDe = null, contsHitos = -1;
    function pintarTarjeta() {
      if (!visible) return;
      const m = partida.motor(), año = m.año(), pb = partida.pueblo();
      texto("t-pob", personas(m.poblacionTotal()));
      texto("t-real", textoReal(realEn(historia.poblacionReal, año)));
      oculto($("t-nota"), año >= -10000);
      for (const id of ["t-row-pueblo", "t-row-herencia", "t-rasgos", "t-ver-pueblo"]) oculto($(id), !pb);
      document.body.classList.toggle("t-con-pueblo", !!pb);   // la tarjeta es más alta: la escalera de escalas se acomoda (index.html)
      if (pb) {
        texto("t-pueblo", personas(m.pueblo().total()));
        texto("t-herencia", personas(m.pueblo().herencia()));
        const nombres = pb.rasgos().map(r => r.nombre), lista = $("t-rasgos");
        if (lista.dataset.rasgos !== nombres.join("|") || !lista.firstChild) {
          lista.dataset.rasgos = nombres.join("|");
          lista.replaceChildren(...(nombres.length ? nombres.map(n => el("li", "si", n)) : [el("li", null, "Sin rasgos todavía")]));
        }
        const cerrado = pb.estado() !== "vivo", ver = $("t-ver-pueblo");
        if (ver.disabled !== cerrado) ver.disabled = cerrado;
      }
      // Los continentes alcanzados solo cambian con un hito nuevo o una partida nueva
      const listaConts = $("t-cont"), nHitos = m.hitos().length;
      if (listaConts.children.length !== conts.length) listaConts.replaceChildren(...conts);
      if (contsDe !== m || contsHitos !== nHitos) {
        contsDe = m; contsHitos = nHitos;
        const hechos = logrados();
        historia.continentes.forEach((c, k) => {
          const li = conts[k], si = c.hitos.length === 0 || c.hitos.some(id => hechos.has(id));
          li.classList.toggle("si", si);
          li.setAttribute("aria-label", `${c.nombre}: ${si ? "alcanzado" : "aún no"}`);
        });
      }
    }

    // Avisos: primero la tarjeta de tu pueblo (una decisión o un cambio de estado), después los hitos pendientes.
    // actual: { decision, resultado } (resultado = lo que devolvió elegir, null hasta elegir) o { estado, año }. En `estados`
    // esperan los cambios de estado y la tarjeta del Nacimiento (una decisión ya elegida)
    let actual = null, estados = [];

    function mostrarHito() {
      const h = partida.pendientes()[0];
      if (!visible || !h) { aviso.hidden = true; return false; }
      const d = porId[h.id] || { titulo: h.id, real: null, texto: "", fuente: "" };
      $("t-hito-titulo").textContent = d.titulo;
      $("t-hito-tuyo").textContent = partida.textoAño(h.año);
      $("t-hito-real").textContent = rango(d.real, presente);
      $("t-hito-texto").textContent = d.texto;
      $("t-hito-fuente").textContent = d.fuente ? `Fuente: ${d.fuente}` : "";
      $("t-hito-ir").hidden = h.celda < 0;
      aviso.hidden = false;
      // Con un modal abierto (la Bitácora, el cuestionario) el foco se queda en él; el aviso espera detrás
      if (!hayModal()) $("t-hito-seguir").focus();
      return true;
    }
    function pintarDecision() {
      const dec = actual.decision, est = actual.estado && ESTADOS[actual.estado], r = actual.resultado;
      $("t-dec-kind").textContent = dec ? "Decisión" : "Tu pueblo";
      $("t-dec-titulo").textContent = dec ? dec.titulo : est.titulo;
      // En una tarjeta de estado, el año en que tu pueblo se disolvió o se extinguió (anotado al llegar el evento)
      $("t-dec-año").textContent = partida.textoAño(dec ? dec.año : actual.año);
      $("t-dec-texto").textContent = dec ? dec.texto : est.texto;
      $("t-dec-opciones").replaceChildren(...(dec ? dec.opciones.map(o => {
        const div = el("div", "t-opcion"), b = el("button", "chip", o.texto), det = el("span", null, o.detalle);
        b.type = "button"; b.dataset.opcion = o.id; b.title = o.detalle;
        det.id = `t-dec-det-${o.id}`; b.setAttribute("aria-describedby", det.id);
        b.addEventListener("click", () => elegir(o.id));
        div.append(b, det);
        return div;
      }) : []));
      $("t-dec-opciones").hidden = !dec || !!r;
      $("t-dec-real").hidden = !!dec && !r;
      $("t-dec-eleccion").hidden = !r;
      $("t-dec-eleccion").textContent = r
        ? `Elegiste «${r.opcion.texto}».` + (r.rasgo ? ` Tu pueblo ganó un rasgo: ${r.rasgo.nombre}. ${r.rasgo.texto}`
          : dec.id === "cuello" ? (r.causa ? " No quedó un rasgo nuevo: tu pueblo ya tenía esa adaptación." : " No quedó un rasgo: la causa no fue clara.") : "")
        : "";
      const real = r ? r.real : est ? est.real : null;
      $("t-dec-real-titulo").hidden = $("t-dec-real-texto").hidden = !real;
      $("t-dec-real-texto").textContent = real ? real.texto : "";
      const fuente = [real && real.fuente && `Fuente: ${real.fuente}`, r && r.rasgo && r.rasgo.fuente && `Sobre el rasgo: ${r.rasgo.fuente}`]
        .filter(Boolean).join(" · ");
      $("t-dec-fuente").textContent = fuente;
      $("t-dec-fuente").hidden = !fuente;
      // Al extinguirse, el resumen de tu pueblo está en la Bitácora
      $("t-dec-bitacora").hidden = actual.estado !== "extinto";
    }
    // Muestra el aviso que toca, si no hay uno a la vista. Devuelve si quedó alguno abierto.
    function mostrarAvisos() {
      if (!visible) { aviso.hidden = true; tarjeta.hidden = true; return false; }
      if (!actual) {
        const dec = partida.decisionPendiente();
        if (decisionViva()) actual = { decision: dec, resultado: null };
        else if (estados.length) actual = estados.shift();
      }
      if (!actual) return mostrarHito();
      ocultar(aviso);
      if (!tarjeta.hidden) return true;   // ya está a la vista: no se repinta ni se mueve el foco
      pintarDecision();
      tarjeta.hidden = false;
      if (!hayModal()) (actual.decision && !actual.resultado ? $("t-dec-opciones").querySelector("button") : $("t-dec-seguir")).focus();
      return true;
    }
    function elegir(id) {
      if (!actual || !actual.decision || actual.resultado) return;
      try { actual.resultado = partida.elegir(id); }
      catch (e) { console.error(e); actual = null; ocultar(tarjeta); return; }
      pintarDecision();
      $("t-dec-seguir").focus();
    }
    // Una decisión que se puede tomar todavía (al terminar la partida ya no)
    const decisionViva = () => !!partida.decisionPendiente() && !partida.terminada();
    const reanudar = () => { if (!partida.terminada() && !partida.decisionPendiente()) partida.setReproduciendo(true); };
    // Seguir (o ▶ con un aviso abierto): cierra el aviso, muestra el siguiente o reanuda
    function seguir() {
      if (actual || decisionViva()) {
        // La tarjeta de decisión no se cierra sin elegir
        if (!actual || (actual.decision && !actual.resultado)) {
          mostrarAvisos();
          // Si el foco quedó en otro lado (por ejemplo, al cerrar un modal), vuelve a las opciones
          const b = !tarjeta.hidden && !$("t-dec-opciones").hidden && $("t-dec-opciones").querySelector("button");
          if (b && !hayModal()) b.focus();
          return;
        }
        actual = null;
        const tenia = tarjeta.contains(document.activeElement);
        tarjeta.hidden = true;
        if (mostrarAvisos()) return;
        if (tenia) play.focus();
        return reanudar();
      }
      partida.tomarHito();
      if (mostrarAvisos()) return;
      ocultar(aviso);   // el foco no se pierde al cerrar el aviso
      reanudar();
    }
    $("t-hito-seguir").addEventListener("click", seguir);
    $("t-dec-seguir").addEventListener("click", seguir);
    $("t-hito-ir").addEventListener("click", () => {
      const h = partida.pendientes()[0];
      if (!h || h.celda < 0) return;
      const c = partida.motor().celdas;
      irA(normal(c.lat[h.celda], c.lon[h.celda]));
    });
    $("t-ver-pueblo").addEventListener("click", () => {
      const c = centroPueblo && centroPueblo();
      if (c) irA(normal(c.lat, c.lon));
    });

    function pintarBitacora() {
      const hechos = logrados(), fin = partida.terminada(), pb = partida.pueblo();
      $("bitacora-intro").textContent = fin
        ? `Tu partida terminó en ${partida.textoAño()}. Así se compara tu humanidad con la real.`
        : `Hitos de tu partida hasta ${partida.textoAño()}, junto a lo que pasó en la realidad.`;
      $("bitacora-pueblo").hidden = !pb;
      if (pb) {
        const r = pb.resumen();
        if (fin || r.estado === "extinto") $("bitacora-intro").textContent = textoFinal({ ...r, regiones: r.regiones.map(id => nombreRegion[id] || id) }, partida.textoAño);
        else $("bitacora-intro").textContent = `Tus decisiones y los hitos de la humanidad hasta ${partida.textoAño()}, junto a lo que pasó en la realidad.`;
        $("bitacora-pueblo").replaceChildren(...pb.registro().map(e => {
          const li = el("li");
          li.append(el("b", null, e.titulo), el("p", null, textoRegistro(e, partida.textoAño)), el("p", null, `En la realidad: ${e.texto}`));
          if (e.fuente) li.append(el("p", "t-fuente", `Fuente: ${e.fuente}`));
          return li;
        }));
      }
      const lista = historia.hitos.filter(h => hechos.has(h.id) || (fin && h.real))
        .sort((x, y) => (hechos.get(x.id)?.año ?? Infinity) - (hechos.get(y.id)?.año ?? Infinity));
      $("bitacora-lista").replaceChildren(...(lista.length ? lista.map(h => {
        const l = hechos.get(h.id), li = el("li");
        li.append(el("b", null, h.corto),
          el("span", "t-comp", `${l ? `Tu humanidad: ${partida.textoAño(l.año)}` : "No ocurrió en tu partida"} · Real: ${rango(h.real, presente)}`));
        if (l && h.real) li.append(el("span", "t-comp no", comparar(l.año, h.real)));
        return li;
      }) : [el("li", "no", "Todavía no hay hitos en esta partida.")]));
    }
    // Al cerrar la Bitácora, el foco vuelve a quien la abrió (si sigue a la vista y no queda otro modal abierto)
    let abridorBitacora = null;
    function abrirBitacora() {
      const a = document.activeElement;
      abridorBitacora = a && a !== document.body ? a : null;
      pintarBitacora(); abrirModal("bitacora");
    }
    boton.addEventListener("click", abrirBitacora);
    $("t-dec-bitacora").addEventListener("click", abrirBitacora);
    new MutationObserver(() => {
      if (!$("bitacora").hidden || hayModal()) return;
      // (el foco puede seguir en el botón de cerrar ya oculto hasta que el navegador lo corrija)
      const a = document.activeElement;
      if (a && a !== document.body && !$("bitacora").contains(a)) return;
      if (abridorBitacora && abridorBitacora.isConnected && abridorBitacora.offsetParent !== null) abridorBitacora.focus();
    }).observe($("bitacora"), { attributes: true, attributeFilter: ["hidden"] });

    partida.alEvento(e => {
      if (e.tipo === "hito" || e.tipo === "decision") mostrarAvisos();
      if (e.tipo === "pueblo") { estados.push({ estado: e.estado, año: partida.motor().año() }); mostrarAvisos(); }
      if (e.tipo === "nueva") { actual = null; estados = []; ocultar(tarjeta); ocultar(aviso); pintarTarjeta(); }
      if (e.tipo === "fin") {
        // Una decisión sin elegir ya no se puede tomar: la tarjeta se descarta (la de un estado o una ya elegida se queda)
        // y se muestra lo que esperaba detrás (un cambio de estado o un hito del mismo paso), antes de abrir la Bitácora
        if (actual && actual.decision && !actual.resultado) { actual = null; ocultar(tarjeta); mostrarAvisos(); }
        // (se abre sola: nadie la abrió, así que al cerrarla el foco va a ▶ y no a quien abrió una Bitácora anterior)
        if (visible) { abridorBitacora = play; pintarBitacora(); abrirModal("bitacora"); }
      }
    });
    setInterval(pintarTarjeta, 250);

    // Elegir modo: Historia o Tu pueblo (y entonces su cuna). Cerrar sin elegir deja la partida que había.
    const modo = $("t-modo"), origenes = $("t-modo-origenes"), btnPueblo = $("t-modo-pueblo");
    const nacimiento = CATALOGO.momentos.find(m => m.id === "nacimiento");
    $("t-modo-origenes-titulo").textContent = nacimiento.titulo;
    $("t-modo-origenes-texto").textContent = nacimiento.texto;
    origenes.append(...nacimiento.opciones.map((o, k) => {
      const b = el("button", "level");
      b.type = "button"; b.dataset.origen = String(k);
      b.append(el("b", null, o.texto), el("span", null, o.detalle));
      b.addEventListener("click", () => empezar("pueblo", k));
      return b;
    }));
    function empezar(m, origen) {
      eligio = true;
      modo.hidden = true;
      partida.nueva(undefined, { modo: m, origen });
      if (m === "pueblo") {
        // Lo que se sabe de la cuna, como tras cualquier decisión; la partida espera en pausa hasta "Seguir"
        const o = nacimiento.opciones[origen];
        partida.setReproduciendo(false);
        estados.push({ decision: { id: nacimiento.id, titulo: nacimiento.titulo, texto: nacimiento.texto, año: Math.round(partida.motor().año()), opciones: [] },
          resultado: { opcion: { id: o.id, texto: o.texto }, real: { ...nacimiento.real }, rasgo: null } });
        mostrarAvisos();
      }
      // El foco va al modal que quedó abierto detrás (nunca detrás de un modal), o a la tarjeta del Nacimiento, o a ▶
      const otro = document.querySelector(".modal:not([hidden]) .sheet-close");
      if (otro) otro.focus(); else if (!tarjeta.contains(document.activeElement)) play.focus();
    }
    $("t-modo-historia").addEventListener("click", () => empezar("historia"));
    btnPueblo.addEventListener("click", () => {
      origenes.hidden = false; btnPueblo.setAttribute("aria-expanded", "true");
      origenes.querySelector("button").focus();
    });
    // Al cerrar sin elegir (botón, Escape o clic afuera), el foco vuelve a quien lo abrió o a ▶, salvo que quede otro modal abierto
    // Mientras se elige, la partida se pausa; si se cierra sin elegir, sigue como estaba
    let abridor = null, eligio = false, jugabaAntes = false;
    function elegirModo() {
      eligio = false;
      jugabaAntes = partida.reproduciendo();
      partida.setReproduciendo(false);
      const a = document.activeElement;
      abridor = a && a !== document.body && !modo.contains(a) ? a : null;
      origenes.hidden = true; btnPueblo.setAttribute("aria-expanded", "false");
      abrirModal("t-modo");
      $("t-modo-historia").focus();
    }
    new MutationObserver(() => {
      if (!modo.hidden) return;
      if (!eligio && jugabaAntes) reanudar();
      jugabaAntes = false;
      const a = document.activeElement;
      if (a && a !== document.body && !modo.contains(a)) return;   // ya tiene adónde ir (por ejemplo, ▶ al empezar)
      const otro = document.querySelector(".modal:not([hidden]) .sheet-close");
      const destino = otro || (abridor && abridor.isConnected && abridor.offsetParent !== null ? abridor : play);
      destino.focus();
    }).observe(modo, { attributes: true, attributeFilter: ["hidden"] });

    function mostrar(on) {
      visible = on; card.hidden = !on; boton.hidden = !on;
      if (on) { pintarTarjeta(); mostrarAvisos(); } else { ocultar(tarjeta); ocultar(aviso); document.body.classList.remove("t-con-pueblo"); }
    }
    return {
      mostrar, seguir, elegirModo,
      avisoAbierto: () => !aviso.hidden,
      decisionAbierta: () => !tarjeta.hidden || decisionViva()
    };
  }

  return { iniciar, personas, realEn, textoReal, rango, comparar, textoRegistro, textoFinal };
})();
if (typeof module !== "undefined") module.exports = PanelTierra;
