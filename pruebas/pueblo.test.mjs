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
  const pb = Pueblo.crear(m, historia, catalogo(ids, reglas), { origen: 0, params: { ...SIN_AZAR, ...params } });
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
  let conVida = 0;
  for (let s = 0; s < 2000 && !m.terminado(); s++) {
    m.avanzar(10);
    const d = pb.revisar();
    if (pb.estado() === "vivo" && m.pueblo().total() > 0) conVida++;
    if (d) { vistas.push(d.id); pb.elegir(d.opciones[0].id); }
  }
  for (const id of vistas) assert.ok(["sequia", "frontera", "cuello"].includes(id), id);
  assert.ok(conVida >= 1000, `${conVida} pasos con tu pueblo vivo`);
  assert.equal(pb.estado(), "vivo");
});

test("perder celdas sin que baje su capacidad no es una sequía", () => {
  // Tu pueblo en una punta de la tira y muchos más en la otra, sin crecimiento: los otros entran en tus celdas y te quitan la
  // mayoría, pero la capacidad de la estepa no cambia
  const h = historiaDePrueba({ origenes: [origen(-4, 3000), origen(4, 30000)] });
  const params = { crecimiento: [0, 0, 0, 0, 0], exploracion: 0.01 };
  const { m, pb } = partida(mundoDePrueba(["0000000", "0444440", "0000000"], { lonOeste: -7 }), h, ["sequia"], { params });
  const pbm = m.pueblo(), mias = () => Array.from(pbm.celdas()).filter(i => pbm.mayoria(i)).length;
  let maximo = 0, perdidas = false;
  for (let s = 0; s < 300; s++) {
    m.avanzar(10);
    const n = mias();
    if (n > maximo) maximo = n; else if (n < maximo) perdidas = true;
    assert.equal(pb.revisar(), null, `sequía en el año ${m.año()}`);
  }
  assert.ok(perdidas, "tu pueblo nunca perdió celdas");
});

test("al terminar la partida se descarta la decisión pendiente", () => {
  const h = historiaDePrueba({ inicio: 1990, origenes: [origen(0)] });
  const { m, pb } = partida(conDesierto(), h, ["frontera"]);
  assert.ok(hastaDecision(m, pb, 20));
  while (!m.terminado()) m.avanzar(m.pasoMax());
  assert.equal(pb.revisar(), null);
  assert.equal(pb.pendiente(), null);
  assert.throws(() => pb.elegir("esperar"), Error);
  const r = pb.registro();
  assert.equal(r.length, 1);
  assert.ok(r[0].despues !== null);
  assert.equal(pb.resumen().hasta, 2026);
});

test("las defensas multiplican la epidemia sumada", () => {
  // Bosque agrícola (no seco ni frío): un cuello de botella ahí es por enfermedad y da defensas
  const h = historiaDePrueba({ inicio: -9600, domesticables: [{ id: "todo", nombre: "Todo", riqueza: 1, cajas: [[-90, 90, -180, 180]] }],
    origenes: [origen(0, 6000)] });
  const params = { agricultura: 1, exploracion: 0, presion: 0, densidadCiudad: 0.01 };
  const { m, pb } = partida(mundoDePrueba(["00000", "05550", "00000"]), h, ["agricultura", "cuello", "ciudades"], { params });
  const i = m.celdaDe(0, 0), elegida = { agricultura: "adoptar", ciudades: "fundar", cuello: "seguir" };
  // Tras 500 años de campos (la gente ya creció con ellos), se pierde casi todo
  let rasgo = null, cuello = false, campos = null;
  for (let s = 0; s < 500 && !(cuello && pb.registro().some(r => r.momento === "ciudades")); s++) {
    m.avanzar(10);
    if (campos === null && (m.celdas.innovaciones[i] & AGRICULTURA)) campos = m.año();
    if (!cuello && campos !== null && m.año() >= campos + 500) { m.perderPueblo(0.8); cuello = true; }
    const d = pb.revisar();
    if (d) { const r = pb.elegir(elegida[d.id]); if (d.id === "cuello") rasgo = r.rasgo; }
  }
  assert.equal(rasgo && rasgo.id, "defensas");
  assert.ok(pb.registro().some(r => r.momento === "ciudades"));
  assert.equal(m.ultimos.epidemia, 0.00015);
});

test("en la frontera, cada par de regiones cuenta una vez", () => {
  // Tu pueblo en el oeste, con un desierto al lado y la región este a dos celdas
  const h = historiaDePrueba({ origenes: [origen(-2)], regiones: [
    { id: "oeste", nombre: "Oeste", hito: null, cajas: [[-90, 90, -180, 1]] }, { id: "este", nombre: "Este", hito: null, cajas: [[-90, 90, 1, 180]] }] });
  const { m, pb } = partida(mundoDePrueba(["0000000", "0344440", "0000000"], { lonOeste: -7 }), h, ["frontera"]);
  let n = 0;
  for (let k = 0; k < 4; k++) { const d = hastaDecision(m, pb, 3000); if (d) { n++; pb.elegir("esperar"); } }
  assert.equal(n, 2);
  assert.ok(n < PUEBLO.momentos.find(x => x.id === "frontera").limite);
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

test("frío: en una glaciación, con buena parte de tu pueblo en tierras frías", () => {
  const glacial = [[-1e7, -125], [3000, -125]];
  // A 60° de latitud con la glaciación: frío enseguida
  {
    const h = historiaDePrueba({ nivelMar: glacial, origenes: [origen(0, 3000, 60)] });
    const { m, pb } = partida(mundoDePrueba(["0000000", "0444440", "0000000"], { latNorte: 63, lonOeste: -7 }), h, ["frio"]);
    const d = hastaDecision(m, pb, 100);
    assert.equal(d && d.id, "frio");
    assert.deepEqual(d.opciones.map(o => o.id), ["ropa", "sur"]);
    assert.equal(pb.elegir("ropa").rasgo.id, "adaptados_frio");
  }
  // La misma glaciación en el ecuador, o los 60° sin glaciación: nada
  {
    const h = historiaDePrueba({ nivelMar: glacial, origenes: [origen(0)] });
    const { m, pb } = partida(mundoDePrueba(["0000000", "0444440", "0000000"], { lonOeste: -7 }), h, ["frio"]);
    assert.equal(hastaDecision(m, pb, 500), null);
  }
  {
    const h = historiaDePrueba({ origenes: [origen(0, 3000, 60)] });
    const { m, pb } = partida(mundoDePrueba(["0000000", "0444440", "0000000"], { latNorte: 63, lonOeste: -7 }), h, ["frio"]);
    assert.equal(hastaDecision(m, pb, 500), null);
  }
});

test("ganado: tras unos años de campos en tus celdas", () => {
  const h = historiaDePrueba({ inicio: -9600, domesticables: [{ id: "todo", nombre: "Todo", riqueza: 1, cajas: [[-90, 90, -180, 180]] }],
    origenes: [origen(0, 6000)] });
  const { m, pb } = partida(mundoDePrueba(["00000", "04440", "00000"]), h, ["agricultura", "ganado"], { params: { agricultura: 1, exploracion: 0, presion: 0 } });
  assert.equal(hastaDecision(m, pb, 100).id, "agricultura");
  pb.elegir("adoptar");
  const pbm = m.pueblo(), v = m.celdas.innovaciones;
  let campos = null, d = null;
  for (let s = 0; s < 400 && !d; s++) {
    m.avanzar(10);
    if (campos === null && Array.from(pbm.celdas()).some(i => pbm.mayoria(i) && (v[i] & AGRICULTURA))) campos = m.año();
    d = pb.revisar();
  }
  assert.ok(campos !== null, "tu pueblo nunca tuvo campos");
  assert.equal(d && d.id, "ganado");
  const años = d.año - campos;
  assert.ok(años >= PUEBLO.reglas.ganadoAños && años <= PUEBLO.reglas.ganadoAños + 20, `${años} años después de los campos`);
  assert.equal(pb.elegir("leche").rasgo.id, "lactosa");
});

test("ciudades: solo con campos y mucha gente en una de tus celdas", () => {
  const h = historiaDePrueba({ inicio: -9600, domesticables: [{ id: "todo", nombre: "Todo", riqueza: 1, cajas: [[-90, 90, -180, 180]] }],
    origenes: [origen(0, 6000)] });
  const params = { agricultura: 1, exploracion: 0, presion: 0, densidadCiudad: 0.01 };
  const { m, pb } = partida(mundoDePrueba(["00000", "04440", "00000"]), h, ["agricultura", "ciudades"], { params });
  // Ya hay densidad de sobra, pero sin campos no hay ciudad
  assert.equal(hastaDecision(m, pb, 100).id, "agricultura");
  pb.elegir("adoptar");
  const d = hastaDecision(m, pb, 3000);
  assert.equal(d && d.id, "ciudades");
  const pbm = m.pueblo();
  assert.ok(Array.from(pbm.celdas()).some(i => pbm.mayoria(i) && (m.celdas.innovaciones[i] & AGRICULTURA)));
  pb.elegir("fundar");
  assert.equal(m.ultimos.bloqueo & Motor.INNOVACION.CIUDADES, 0);
});

test("industria: con escritura en tus celdas y máquinas en algún lugar del mundo", () => {
  const { ESCRITURA, INDUSTRIA } = Motor.INNOVACION;
  const h = historiaDePrueba({ origenes: [origen(0)] });
  const { m, pb } = partida(mundoDePrueba(["00000", "04440", "00000"]), h, ["industria"]);
  m.avanzar(10);
  assert.equal(pb.revisar(), null);
  const v = m.celdas.innovaciones, pbm = m.pueblo(), mias = Array.from(pbm.celdas()).filter(i => pbm.mayoria(i));
  // Industria sin escritura en tus celdas: nada
  v[mias[0]] |= INDUSTRIA;
  assert.equal(pb.revisar(), null);
  v[mias[0]] &= ~INDUSTRIA;
  // Escritura sin industria en ningún lado: nada
  for (const i of mias) v[i] |= ESCRITURA;
  assert.equal(pb.revisar(), null);
  v[mias[mias.length - 1]] |= INDUSTRIA;
  assert.equal(pb.revisar().id, "industria");
});

test("mar abierto: solo agricultores con navegación costera en una de tus costas", () => {
  const { COSTERA } = Motor.INNOVACION;
  const h = historiaDePrueba({ origenes: [origen(0)] });
  const { m, pb } = partida(mundoDePrueba(["00000", "04440", "00000"]), h, ["mar"]);
  m.avanzar(10);
  assert.equal(pb.revisar(), null);
  const v = m.celdas.innovaciones, pbm = m.pueblo(), mias = Array.from(pbm.celdas()).filter(i => pbm.mayoria(i) && m.celdas.costa[i]);
  assert.ok(mias.length > 0);
  // Navegación costera sola (recolectores que pescan en la costa): nada
  for (const i of mias) v[i] |= COSTERA;
  assert.equal(pb.revisar(), null);
  // Campos sin navegación: nada
  for (const i of mias) v[i] = (v[i] & ~COSTERA) | AGRICULTURA;
  assert.equal(pb.revisar(), null);
  // Las dos en la misma celda costera: sí
  v[mias[0]] |= COSTERA;
  const d = pb.revisar();
  assert.equal(d && d.id, "mar");
  assert.deepEqual(d.opciones.map(o => o.id), ["explorar", "quedarse"]);
});

test("si tu pueblo se disuelve y después se extingue su linaje, el resumen guarda los dos años", () => {
  const h = historiaDePrueba({ origenes: [origen(0, 3000), { ...origen(0, 2000), nombre: "otros" }] });
  const { m, pb } = partida(conDesierto(), h, ["frontera"]);
  assert.ok(hastaDecision(m, pb, 100));
  m.perderPueblo(0.9);
  m.avanzar(10);
  pb.revisar();
  assert.equal(pb.estado(), "disuelto");
  const disuelto = Math.round(m.año());
  assert.equal(pb.resumen().hasta, disuelto);
  assert.equal(pb.resumen().disueltoEn, disuelto);
  for (let s = 0; s < 10; s++) { m.avanzar(10); pb.revisar(); }
  // Muere todo el mundo: el linaje se extingue
  m.celdas.poblacion.fill(0);
  pb.revisar();
  const r = pb.resumen();
  assert.equal(r.estado, "extinto");
  assert.equal(r.disueltoEn, disuelto);
  assert.equal(r.hasta, Math.round(m.año()));
  assert.ok(r.hasta > r.disueltoEn);
});
