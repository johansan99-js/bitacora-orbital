// Interfaz de la escala "La Tierra": tarjeta comparativa, avisos de hitos, Bitácora de tu humanidad y fichas de continentes.
const PanelTierra = (() => {
  const PartidaRef = typeof Partida !== "undefined" ? Partida : require("./partida.js");
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const num = (n, d = 1) => n.toLocaleString("es", { maximumFractionDigits: d });

  function personas(n) {
    if (n >= 1e9) return `${num(n / 1e9)} mil millones`;
    if (n >= 1e6) { const v = num(n / 1e6); return `${v} ${v === "1" ? "millón" : "millones"}`; }
    return num(n, 0);
  }
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

  function iniciar({ partida, historia, normal, irA, abrirModal }) {
    const presente = historia.presente;
    const porId = Object.fromEntries(historia.hitos.map(h => [h.id, h]));
    const reg = Object.fromEntries(historia.regiones.map((r, k) => [r.id, k]));
    const card = $("t-card"), aviso = $("t-hito"), boton = $("btn-bitacora");
    let visible = false;
    const logrados = () => new Map(partida.motor().hitos().map(h => [h.id, h]));

    // Fichas de continente con datos de la partida en curso
    historia.continentes.forEach(c => Object.defineProperty(c, "stats", { configurable: true, get() {
      const pr = partida.motor().poblacionPorRegion(), hechos = logrados();
      const pob = c.regiones.reduce((s, id) => s + (pr[reg[id]] || 0), 0);
      return [["Tu humanidad aquí", personas(pob)], ...c.hitos.map(id => {
        const h = porId[id], l = hechos.get(id);
        return [h.corto, `${l ? partida.textoAño(l.año) : "Aún no"} · real: ${rango(h.real, presente)}`];
      })];
    } }));

    function pintarTarjeta() {
      if (!visible) return;
      const m = partida.motor(), año = m.año();
      $("t-pob").textContent = personas(m.poblacionTotal());
      $("t-real").textContent = textoReal(realEn(historia.poblacionReal, año));
      $("t-nota").hidden = año >= -10000;
      const hechos = logrados();
      $("t-cont").replaceChildren(...historia.continentes.map(c => {
        const li = el("li", null, c.nombre), si = c.hitos.length === 0 || c.hitos.some(id => hechos.has(id));
        li.classList.toggle("si", si);
        li.setAttribute("aria-label", `${c.nombre}: ${si ? "alcanzado" : "aún no"}`);
        return li;
      }));
    }

    function mostrarHito() {
      const h = partida.pendientes()[0];
      if (!visible || !h) { aviso.hidden = true; return; }
      const d = porId[h.id] || { titulo: h.id, real: null, texto: "", fuente: "" };
      $("t-hito-titulo").textContent = d.titulo;
      $("t-hito-tuyo").textContent = partida.textoAño(h.año);
      $("t-hito-real").textContent = rango(d.real, presente);
      $("t-hito-texto").textContent = d.texto;
      $("t-hito-fuente").textContent = d.fuente ? `Fuente: ${d.fuente}` : "";
      $("t-hito-ir").hidden = h.celda < 0;
      aviso.hidden = false;
      // Con un modal abierto (la Bitácora, el cuestionario) el foco se queda en él; el aviso espera detrás
      if (!document.querySelector(".modal:not([hidden])")) $("t-hito-seguir").focus();
    }
    function seguir() {
      partida.tomarHito();
      if (partida.pendientes().length) return mostrarHito();
      if (aviso.contains(document.activeElement)) $("btn-play").focus();   // el foco no se pierde al cerrar el aviso
      aviso.hidden = true;
      if (!partida.terminada()) partida.setReproduciendo(true);
    }
    $("t-hito-seguir").addEventListener("click", seguir);
    $("t-hito-ir").addEventListener("click", () => {
      const h = partida.pendientes()[0];
      if (!h || h.celda < 0) return;
      const c = partida.motor().celdas;
      irA(normal(c.lat[h.celda], c.lon[h.celda]));
    });

    function pintarBitacora() {
      const hechos = logrados(), fin = partida.terminada();
      $("bitacora-intro").textContent = fin
        ? `Tu partida terminó en ${partida.textoAño()}. Así se compara tu humanidad con la real.`
        : `Hitos de tu partida hasta ${partida.textoAño()}, junto a lo que pasó en la realidad.`;
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
    boton.addEventListener("click", () => { pintarBitacora(); abrirModal("bitacora"); });

    partida.alEvento(e => {
      if (e.tipo === "hito") mostrarHito();
      if (e.tipo === "nueva") { aviso.hidden = true; pintarTarjeta(); }
      if (e.tipo === "fin" && visible) { pintarBitacora(); abrirModal("bitacora"); }
    });
    setInterval(pintarTarjeta, 250);

    function mostrar(on) {
      visible = on; card.hidden = !on; boton.hidden = !on;
      if (on) { pintarTarjeta(); mostrarHito(); } else aviso.hidden = true;
    }
    return { mostrar, seguir, avisoAbierto: () => !aviso.hidden };
  }

  return { iniciar, personas, realEn, textoReal, rango, comparar };
})();
if (typeof module !== "undefined") module.exports = PanelTierra;
