import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js"), PUEBLO = require("../poblacion/pueblo-datos.js"), Pueblo = require("../poblacion/pueblo.js");
const SIN_AZAR = { cruce: [0, 0, 0], costera: 0 };
const { AGRICULTURA } = Motor.INNOVACION;

// Catálogo de prueba: el de verdad, con solo algunos momentos (el Nacimiento siempre) y reglas cambiadas
const catalogo = (ids, reglas = {}) => ({
  reglas: { ...PUEBLO.reglas, intervalo: [[-1e9, 0]], ...reglas },
  rasgos: PUEBLO.rasgos,
  momentos: PUEBLO.momentos.filter(m => m.id === "nacimiento" || ids.includes(m.id))
});
const origen = (lon, personas = 3000, lat = 0) => ({ nombre: `O${lon}`, lat, lon, personas });
// Un motor envuelto que guarda los últimos modificadores que recibió
function espiar(m) {
  const espia = { ...m, ultimos: null };
  espia.setModificadores = mods => { espia.ultimos = mods; m.setModificadores(mods); };
  return espia;
}
function partida(mundo, historia, ids, { reglas, params, semilla = 1 } = {}) {
  const m = espiar(Motor.crear(mundo, historia, { semilla, params: { ...SIN_AZAR, ...params }, pueblo: { origen: 0 } }));
  const pb = Pueblo.crear(m, historia, catalogo(ids, reglas), { origen: 0 });
  return { m, pb };
}
// Avanza paso a paso (revisando después de cada uno) hasta que salga una decisión o pasen `años`
function hastaDecision(m, pb, años) {
  const fin = m.año() + años;
  while (m.año() < fin - 1e-6 && !m.terminado()) {
    m.avanzar(m.pasoMax());
    const d = pb.revisar();
    if (d) return d;
  }
  return null;
}

// Estepa con un desierto al este: la frontera del desierto se ve enseguida
const conDesierto = () => mundoDePrueba(["0000", "0430", "0000"], { lonOeste: -3 });
// Una tira de estepa con neandertales al este (y denisovanos al oeste si se piden)
function conArcaicos(dos) {
  const arcaicos = [{ id: "neandertales", nombre: "N", hito: null, cajas: [[-90, 90, 1, 180]], fuente: "prueba" }];
  if (dos) arcaicos.push({ id: "denisovanos", nombre: "D", hito: null, cajas: [[-90, 90, -180, -1]], fuente: "prueba" });
  return { mundo: mundoDePrueba(["0000000", "0444440", "0000000"], { lonOeste: -7 }), historia: historiaDePrueba({ arcaicos, origenes: [origen(0)] }) };
}

// Tira de estepa con un desierto al este de tu pueblo y neandertales al oeste: desde el principio tiene a la vista una frontera
// de desierto y un encuentro
const conLasDos = () => mundoDePrueba(["0000000", "0444340", "0000000"], { lonOeste: -7 });
const conNeandertales = () => historiaDePrueba({ arcaicos: [{ id: "neandertales", nombre: "N", hito: null, cajas: [[-90, 90, -3, -1]], fuente: "prueba" }],
  origenes: [origen(0)] });

test("el Nacimiento queda primero en el registro", () => {
  const h = historiaDePrueba({ origenes: [origen(0)] });
  const { m, pb } = partida(conDesierto(), h, ["frontera"]);
  const r0 = pb.registro();
  assert.equal(r0.length, 1);
  assert.equal(r0[0].momento, "nacimiento");
  assert.equal(r0[0].opcion, PUEBLO.momentos[0].opciones[0].texto);
  assert.equal(r0[0].año, -20000);
  assert.equal(r0[0].antes, null);
  assert.equal(r0[0].despues, null);
  const d = hastaDecision(m, pb, 100);
  assert.equal(d.id, "frontera");
  pb.elegir("esperar");
  const r1 = pb.registro();
  assert.equal(r1.length, 2);
  assert.equal(r1[0].momento, "nacimiento");
  assert.ok(r1[0].despues.pueblo > 0 && r1[0].despues.herencia > 0);
  assert.deepEqual(r1[1].antes, r1[0].despues);
  assert.equal(r1[1].momento, "frontera");
  assert.equal(r1[1].opcion, "Esperar en África");
  assert.equal(pb.resumen().decisiones, 2);
});

test("con una decisión pendiente, revisar no ofrece otra", () => {
  // La frontera del desierto y los neandertales están ahí desde el principio
  const { m, pb } = partida(conLasDos(), conNeandertales(), ["frontera", "encuentro"]);
  const d = hastaDecision(m, pb, 100);
  assert.ok(d);
  for (let s = 0; s < 20; s++) { m.avanzar(10); assert.equal(pb.revisar(), null); }
  assert.equal(pb.pendiente(), d);
  pb.elegir(d.opciones[0].id);
  assert.equal(pb.pendiente(), null);
  const otra = hastaDecision(m, pb, 100);
  assert.ok(otra && otra.id !== d.id, `${otra && otra.id} después de ${d.id}`);
});

test("respeta el intervalo mínimo", () => {
  const { m, pb } = partida(conLasDos(), conNeandertales(), ["frontera", "encuentro"], { reglas: { intervalo: [[-1e9, 500]] } });
  const a = hastaDecision(m, pb, 1000);
  assert.ok(a);
  assert.ok(a.año - -20000 >= 500, `la primera a los ${a.año + 20000} años del Nacimiento`);
  pb.elegir(a.opciones[0].id);
  const b = hastaDecision(m, pb, 1000);
  assert.ok(b && b.id !== a.id);
  assert.ok(b.año - a.año >= 500 && b.año - a.año <= 510, `${b.año - a.año} años entre las dos`);
});

test("un momento no se ofrece más veces que su límite", () => {
  const h = historiaDePrueba({ origenes: [origen(0, 5000)] });
  const { m, pb } = partida(mundoDePrueba(["000", "040", "000"], { lonOeste: -3 }), h, ["cuello"]);
  const limite = PUEBLO.momentos.find(x => x.id === "cuello").limite;
  let cuellos = 0;
  for (let k = 0; k < limite + 2; k++) {
    m.perderPueblo(0.75);
    const d = hastaDecision(m, pb, 20);
    if (d) { assert.equal(d.id, "cuello"); cuellos++; pb.elegir("seguir"); }
  }
  assert.equal(pb.estado(), "vivo");
  assert.equal(cuellos, limite);
});

test("sequía", () => {
  // Estepa a 60° de latitud: con el mar 125 m más bajo llega la glaciación y la capacidad baja a la mitad
  const h = historiaDePrueba({ nivelMar: [[-1e7, 0], [-19000, 0], [-18500, -125], [3000, -125]], origenes: [origen(0, 3000, 60)] });
  const mundo = mundoDePrueba(["0000000", "0444440", "0000000"], { latNorte: 63, lonOeste: -7 });
  const { m, pb } = partida(mundo, h, ["sequia"]);
  assert.equal(hastaDecision(m, pb, 990), null);   // sin cambio de clima, nada
  const d = hastaDecision(m, pb, 1000);
  assert.ok(d, "no hubo sequía");
  assert.equal(d.id, "sequia");
  assert.ok(d.año > -19000 && d.año <= -18500, `año ${d.año}`);
  assert.deepEqual(d.opciones.map(o => o.id), ["resistir", "costa", "dispersarse"]);
});

test("encuentro, una vez por especie, con el rasgo de esa especie", () => {
  // Una sola especie: un solo encuentro aunque sigan ahí
  {
    const { mundo, historia } = conArcaicos(false);
    const { m, pb } = partida(mundo, historia, ["encuentro"]);
    const d = hastaDecision(m, pb, 100);
    assert.equal(d.id, "encuentro");
    const r = pb.elegir("mezclarse");
    assert.equal(r.rasgo.id, "herencia_neandertal");
    assert.equal(hastaDecision(m, pb, 3000), null);
  }
  // Dos especies: un encuentro con cada una y su rasgo
  {
    const { mundo, historia } = conArcaicos(true);
    const { m, pb } = partida(mundo, historia, ["encuentro"]);
    const ganados = [];
    for (let k = 0; k < 2; k++) {
      const d = hastaDecision(m, pb, 100);
      assert.equal(d && d.id, "encuentro");
      ganados.push(pb.elegir("mezclarse").rasgo.id);
    }
    assert.deepEqual(ganados.sort(), ["herencia_denisovana", "herencia_neandertal"]);
    assert.deepEqual(pb.rasgos().map(r => r.id).sort(), ["herencia_denisovana", "herencia_neandertal"]);
    assert.equal(hastaDecision(m, pb, 3000), null);
  }
});

// La sequía de la prueba de arriba, ya pendiente
function conSequia() {
  const h = historiaDePrueba({ nivelMar: [[-1e7, 0], [-19000, 0], [-18500, -125], [3000, -125]], origenes: [origen(0, 3000, 60)] });
  const mundo = mundoDePrueba(["0000000", "0444440", "0000000"], { latNorte: 63, lonOeste: -7 });
  const p = partida(mundo, h, ["sequia"]);
  assert.equal(hastaDecision(p.m, p.pb, 2000).id, "sequia");
  return p;
}

test("los efectos vencen", () => {
  const { m, pb } = conSequia();
  assert.equal(m.ultimos.migracion, 1);
  pb.elegir("dispersarse");
  const desde = m.año();
  assert.equal(m.ultimos.migracion, 3);
  // Si vuelve a haber sequía, se resiste (no cambia la migración)
  const paso = () => { m.avanzar(10); if (pb.revisar()) pb.elegir("resistir"); };
  while (m.año() < desde + 2990 - 1e-6) paso();
  assert.equal(m.ultimos.migracion, 3);
  paso();
  assert.equal(m.ultimos.migracion, 1);
});

test("los modificadores llegan completos y con los códigos del motor", () => {
  const { m, pb } = conSequia();
  pb.elegir("costa");
  const u = m.ultimos;
  for (const k of Object.keys(Motor.MODS_NEUTROS)) assert.ok(k in u, k);
  assert.deepEqual(u.aptitud, [{ donde: { costa: true }, valor: 1.5 }]);
  assert.equal(u.bloqueo, Motor.INNOVACION.AGRICULTURA | Motor.INNOVACION.CIUDADES | Motor.INNOVACION.INDUSTRIA);
});

// Estepa en el Holoceno, en una región con domesticables: la agricultura se puede ofrecer enseguida
function conCampos() {
  const h = historiaDePrueba({ inicio: -9600, domesticables: [{ id: "todo", nombre: "Todo", riqueza: 1, cajas: [[-90, 90, -180, 180]] }],
    origenes: [origen(0, 6000)] });
  return partida(mundoDePrueba(["00000", "04440", "00000"]), h, ["agricultura"], { params: { agricultura: 1, exploracion: 0, presion: 0 } });
}

test("rechazar la agricultura la bloquea y se vuelve a ofrecer una vez; el segundo rechazo es para siempre", () => {
  const { m, pb } = conCampos();
  const pbm = m.pueblo(), v = m.celdas.innovaciones;
  const d = hastaDecision(m, pb, 100);
  assert.equal(d.id, "agricultura");
  pb.elegir("recolectar");
  const desde = m.año();
  assert.ok(m.ultimos.bloqueo & AGRICULTURA);
  assert.equal(hastaDecision(m, pb, 1990), null);
  const otra = hastaDecision(m, pb, 100);
  assert.equal(otra && otra.id, "agricultura");
  assert.ok(otra.año >= desde + 2000);
  pb.elegir("recolectar");
  assert.equal(hastaDecision(m, pb, 6000), null);
  assert.ok(m.ultimos.bloqueo & AGRICULTURA);
  const mias = Array.from(pbm.celdas()).filter(i => pbm.mayoria(i));
  assert.ok(mias.length > 0);
  for (const i of mias) assert.equal(v[i] & AGRICULTURA, 0);
});

test("adoptar la agricultura la desbloquea y no se vuelve a ofrecer", () => {
  const { m, pb } = conCampos();
  assert.equal(hastaDecision(m, pb, 100).id, "agricultura");
  pb.elegir("adoptar");
  assert.equal(m.ultimos.bloqueo & AGRICULTURA, 0);
  assert.deepEqual(m.ultimos.aptitud, [{ donde: { etapas: [Motor.ETAPA.AGRICULTORES, Motor.ETAPA.URBANA, Motor.ETAPA.INDUSTRIAL] }, valor: 0.9 }]);
  assert.equal(hastaDecision(m, pb, 5000), null);
  const pbm = m.pueblo();
  assert.ok(Array.from(pbm.celdas()).some(i => pbm.mayoria(i) && (m.celdas.innovaciones[i] & AGRICULTURA)));
});

test("cuello de botella con causa sed da resistentes_sed", () => {
  const h = historiaDePrueba({ origenes: [origen(0, 5000)] });
  const { m, pb } = partida(mundoDePrueba(["000", "040", "000"], { lonOeste: -3 }), h, ["cuello"]);
  m.avanzar(10); assert.equal(pb.revisar(), null);
  m.perderPueblo(0.8);
  const d = hastaDecision(m, pb, 10);
  assert.equal(d.id, "cuello");
  const r = pb.elegir("seguir");
  assert.equal(r.rasgo.id, "resistentes_sed");
  assert.equal(r.rasgo.nombre, "Resistentes a la sed");
  assert.deepEqual(pb.rasgos().map(x => x.id), ["resistentes_sed"]);
  assert.deepEqual(m.ultimos.aptitud, [{ donde: { biomas: [Motor.BIOMA.DESIERTO, Motor.BIOMA.ESTEPA] }, valor: 1.3 }]);
});

test("cuello de botella sin causa clara no da rasgo", () => {
  // Bosque en el ecuador: ni seco, ni frío, ni agrícola
  const h = historiaDePrueba({ origenes: [origen(0, 5000)] });
  const { m, pb } = partida(mundoDePrueba(["000", "050", "000"], { lonOeste: -3 }), h, ["cuello"]);
  m.perderPueblo(0.8);
  assert.equal(hastaDecision(m, pb, 10).id, "cuello");
  assert.equal(pb.elegir("seguir").rasgo, null);
  assert.deepEqual(pb.rasgos(), []);
});

test("un rasgo repetido no se duplica", () => {
  const h = historiaDePrueba({ origenes: [origen(0, 5000)] });
  const { m, pb } = partida(mundoDePrueba(["000", "040", "000"], { lonOeste: -3 }), h, ["cuello"]);
  m.perderPueblo(0.8);
  assert.equal(hastaDecision(m, pb, 10).id, "cuello");
  assert.equal(pb.elegir("seguir").rasgo.id, "resistentes_sed");
  m.perderPueblo(0.8);
  assert.equal(hastaDecision(m, pb, 10).id, "cuello");
  assert.equal(pb.elegir("seguir").rasgo, null);
  assert.equal(pb.rasgos().length, 1);
  assert.equal(m.ultimos.aptitud.length, 1);
});

test("al disolverse o extinguirse se descarta la pendiente y se avisa una vez", () => {
  // Extinción: todos los tuyos mueren con una decisión abierta
  {
    const h = historiaDePrueba({ origenes: [origen(0)] });
    const { m, pb } = partida(conDesierto(), h, ["frontera"]);
    const avisos = [];
    pb.alEvento(e => avisos.push(e));
    assert.ok(hastaDecision(m, pb, 100));
    m.perderPueblo(1);
    m.avanzar(10);
    assert.equal(pb.revisar(), null);
    assert.equal(pb.pendiente(), null);
    assert.equal(pb.estado(), "extinto");
    for (let s = 0; s < 10; s++) { m.avanzar(10); pb.revisar(); }
    assert.deepEqual(avisos, [{ tipo: "estado", estado: "extinto" }]);
    assert.throws(() => pb.elegir("esperar"));
    assert.equal(pb.resumen().estado, "extinto");
  }
  // Disolución: tus pocos que quedan se asimilan, pero tu herencia sigue
  {
    const h = historiaDePrueba({ origenes: [origen(0, 3000), { ...origen(0, 2000), nombre: "otros" }] });
    const { m, pb } = partida(conDesierto(), h, ["frontera"]);
    const avisos = [];
    pb.alEvento(e => avisos.push(e));
    assert.ok(hastaDecision(m, pb, 100));
    m.perderPueblo(0.9);
    m.avanzar(10);
    assert.equal(pb.revisar(), null);
    assert.equal(pb.pendiente(), null);
    assert.equal(pb.estado(), "disuelto");
    for (let s = 0; s < 10; s++) { m.avanzar(10); assert.equal(pb.revisar(), null); }
    assert.deepEqual(avisos, [{ tipo: "estado", estado: "disuelto" }]);
    const r = pb.resumen();
    assert.equal(r.pueblo, 0);
    assert.ok(r.herencia >= Motor.PARAMS.minimo);
    assert.ok(pb.registro()[0].despues !== null);
  }
});

test("sin arcaicos, sin costa ni domesticables, los detectores no se disparan ni fallan", () => {
  // Una tira de estepa sin mar alrededor (la longitud da la vuelta)
  const h = historiaDePrueba({ origenes: [origen(0)] });
  const mundo = mundoDePrueba(["44444444", "44444444", "44444444"], { lonOeste: -8 });
  const m = Motor.crear(mundo, h, { semilla: 3, pueblo: { origen: 0 } });
  const pb = Pueblo.crear(m, h, { ...PUEBLO, reglas: { ...PUEBLO.reglas, intervalo: [[-1e9, 0]] } }, { origen: 0 });
  const vistas = [];
  for (let s = 0; s < 2000 && !m.terminado(); s++) {
    m.avanzar(10);
    const d = pb.revisar();
    if (d) { vistas.push(d.id); pb.elegir(d.opciones[0].id); }
  }
  for (const id of vistas) assert.ok(["sequia", "frontera", "cuello"].includes(id), id);
  assert.equal(pb.estado(), "vivo");
});

test("elegir sin pendiente o con una opción inexistente lanza un error", () => {
  const h = historiaDePrueba({ origenes: [origen(0)] });
  const { m, pb } = partida(conDesierto(), h, ["frontera"]);
  assert.throws(() => pb.elegir("esperar"), Error);
  assert.ok(hastaDecision(m, pb, 100));
  assert.throws(() => pb.elegir("volar"), Error);
  assert.ok(pb.pendiente());   // sigue pendiente
  assert.equal(pb.elegir("esperar").opcion.id, "esperar");
});
