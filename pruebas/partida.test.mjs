import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba, huella } from "./ayuda.mjs";
const Partida = require("../poblacion/partida.js"), PUEBLO = require("../poblacion/pueblo-datos.js");
// Catálogo de prueba: el de verdad con solo algunos momentos (el Nacimiento siempre) y sin espera entre decisiones
const catalogo = ids => ({ reglas: { ...PUEBLO.reglas, intervalo: [[-1e9, 0]] }, rasgos: PUEBLO.rasgos,
  momentos: PUEBLO.momentos.filter(m => m.id === "nacimiento" || ids.includes(m.id)) });
// Estepa con un desierto al este: la frontera aparece enseguida
const conDesierto = () => mundoDePrueba(["0000", "0430", "0000"], { lonOeste: -3 });
const hPueblo = () => historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -1, personas: 3000 }] });
const pPueblo = (extra = {}) => {
  const p = Partida.crear(conDesierto(), hPueblo(), { params: QUIETO, presupuestoMs: Infinity, catalogo: catalogo(["frontera"]), ...extra });
  p.nueva(1, { modo: "pueblo", origen: 0 });
  return p;
};
const QUIETO = { cruce: [0, 0, 0], costera: 0 };
const isla = () => mundoDePrueba(["000", "040", "000"], { lonOeste: -3 });
const conGente = extra => historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 500 }], ...extra });

test("el año se escribe como 'hace N años', 'a. C.' o como año d. C.", () => {
  assert.equal(Partida.textoAño(-55974, 2026), "hace 58.000 años");
  assert.equal(Partida.textoAño(-10000, 2026), "10.000 a. C.");
  assert.equal(Partida.textoAño(-3000, 2026), "3000 a. C.");
  assert.equal(Partida.textoAño(1850, 2026), "1850");
});

test("la velocidad automática depende de la era y el multiplicador la escala", () => {
  const p = Partida.crear(isla(), conGente({ velocidades: [[-1e9, 1000], [-15000, 10]] }), { params: QUIETO, pausarEnHitos: false, presupuestoMs: Infinity });
  assert.equal(p.añosPorSegundo(), 1000);
  p.velocidad(4); assert.equal(p.añosPorSegundo(), 4000);
  p.velocidad(0); assert.equal(p.añosPorSegundo(), 250);
  p.velocidad(99); assert.equal(p.añosPorSegundo(), 4000);
  p.velocidad(2);
  p.paso(5.5);
  assert.equal(p.motor().año(), -14500);
  assert.equal(p.añosPorSegundo(), 10);
  assert.equal(p.textoVelocidad(), "10 años/s");
});

test("un cuadro avanza al menos un paso aunque se acabe el presupuesto de tiempo", () => {
  let t = 0;
  const p = Partida.crear(isla(), conGente(), { params: QUIETO, pausarEnHitos: false, presupuestoMs: 3, reloj: () => (t += 5) });
  p.paso(10);   // pediría 10.000 años
  assert.equal(p.motor().año(), -19990);
});

test("un hito pausa la partida y los hitos del mismo cuadro quedan en orden", () => {
  const h = conGente({
    regiones: [{ id: "b", nombre: "B", hito: "b", cajas: [[-90, 90, -180, 0]] }, { id: "c", nombre: "C", hito: "c", cajas: [[-90, 90, 0, 180]] }],
    origenes: [{ nombre: "B", lat: 0, lon: -2, personas: 500 }, { nombre: "C", lat: 0, lon: 2, personas: 500 }]
  });
  const p = Partida.crear(mundoDePrueba(["00000", "04040", "00000"]), h, { params: QUIETO, presupuestoMs: Infinity });
  const eventos = [];
  p.alEvento(e => eventos.push(e.tipo));
  p.paso(1);
  assert.equal(p.reproduciendo(), false);
  assert.equal(p.motor().año(), -19990);   // la pausa detiene el reloj en el paso del hito
  assert.equal(p.paso(1), 0);
  assert.equal(p.motor().año(), -19990);
  assert.deepEqual(p.pendientes().map(x => x.id), ["salida_africa", "b", "c"]);
  assert.equal(eventos.filter(t => t === "hito").length, 3);
  assert.equal(p.tomarHito().id, "salida_africa");
  assert.equal(p.tomarHito().id, "b");
  assert.equal(p.pendientes().length, 1);
});

test("la partida se detiene justo en el presente y no se puede reanudar", () => {
  const p = Partida.crear(isla(), conGente({ inicio: 1990, velocidades: [[-1e9, 10]] }), { params: QUIETO, pausarEnHitos: false, presupuestoMs: Infinity });
  const eventos = [];
  p.alEvento(e => eventos.push(e.tipo));
  p.paso(100);   // pediría 1.000 años
  assert.equal(p.motor().año(), 2026);
  assert.equal(p.terminada(), true);
  assert.equal(p.reproduciendo(), false);
  assert.equal(p.setReproduciendo(true), false);
  p.paso(1);
  assert.equal(eventos.filter(t => t === "fin").length, 1);
  assert.equal(p.textoAño(), "2026");
});

test("una partida nueva vuelve al inicio y vacía los avisos pendientes", () => {
  const p = Partida.crear(isla(), conGente(), { params: QUIETO, presupuestoMs: Infinity });
  p.paso(1);
  assert.ok(p.pendientes().length > 0);
  const eventos = [];
  p.alEvento(e => eventos.push(e.tipo));
  p.nueva(42);
  assert.equal(p.pendientes().length, 0);
  assert.equal(p.motor().año(), -20000);
  assert.equal(p.motor().semilla, 42);
  assert.equal(p.reproduciendo(), true);
  assert.deepEqual(eventos, ["nueva"]);
});

test("si la humanidad se extingue, la partida avisa y termina", () => {
  const h = conGente({ hielo: [{ nombre: "Todo", gMin: 0, cajas: [[-90, 90, -180, 180]] }] });
  const p = Partida.crear(isla(), h, { params: QUIETO, presupuestoMs: Infinity });
  const eventos = [];
  p.alEvento(e => eventos.push(e.tipo));
  p.paso(1);
  assert.ok(p.pendientes().some(x => x.id === "extincion"));
  assert.equal(p.terminada(), true);
  assert.ok(eventos.includes("fin"));
});

test("la historia no depende de los cuadros por segundo", () => {
  const h = conGente({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }] });
  const mundo = () => mundoDePrueba(["0000000", "0404040", "0000000"], { lonOeste: -7 });
  const op = { semilla: 5, params: { cruce: [0.01, 0.01, 0.01], saberMar: 0 }, pausarEnHitos: false, presupuestoMs: Infinity };
  const grande = Partida.crear(mundo(), h, op);
  grande.paso(0.5);                                    // 500 años en un solo cuadro
  const chicos = Partida.crear(mundo(), h, op);
  for (let k = 0; k < 500; k++) chicos.paso(0.001);   // los mismos 500 años en cuadros de 1 año
  assert.equal(chicos.motor().año(), grande.motor().año());
  assert.deepEqual(Array.from(chicos.motor().celdas.poblacion), Array.from(grande.motor().celdas.poblacion));
});

test("aplazar un cuadro tardío no cambia la historia, solo cuándo se dan los pasos", () => {
  const h = conGente({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }] });
  const mundo = () => mundoDePrueba(["0000000", "0404040", "0000000"], { lonOeste: -7 });
  const op = { semilla: 5, params: { cruce: [0.01, 0.01, 0.01], saberMar: 0 }, pausarEnHitos: false, presupuestoMs: Infinity };
  const todos = Partida.crear(mundo(), h, op);
  for (let k = 0; k < 500; k++) todos.paso(0.001);
  const aplazando = Partida.crear(mundo(), h, op);
  const año0 = aplazando.motor().año();
  aplazando.aplazar(0.001);
  assert.equal(aplazando.motor().año(), año0, "aplazar no da pasos");
  aplazando.paso(0.001);                               // los años aplazados se dan en el cuadro siguiente
  for (let k = 2; k < 500; k += 2) { aplazando.aplazar(0.001); aplazando.paso(0.001); }
  assert.equal(aplazando.motor().año(), todos.motor().año());
  assert.deepEqual(Array.from(aplazando.motor().celdas.poblacion), Array.from(todos.motor().celdas.poblacion));
  // En pausa no se acumula nada: tras reanudar, el mismo cuadro avanza lo mismo que en la partida que no aplazó
  aplazando.setReproduciendo(false); aplazando.aplazar(1); aplazando.setReproduciendo(true);
  todos.setReproduciendo(false); todos.setReproduciendo(true);
  aplazando.paso(0.004); todos.paso(0.004);
  assert.equal(aplazando.motor().año(), todos.motor().año());
});

test("en modo pueblo una decisión pausa la partida", () => {
  const p = pPueblo({ pausarEnHitos: false });
  const eventos = [];
  p.alEvento(e => eventos.push(e));
  assert.equal(p.modo(), "pueblo");
  p.paso(1);
  assert.equal(p.reproduciendo(), false);
  const d = p.decisionPendiente();
  assert.equal(d.id, "frontera");
  assert.equal(eventos.filter(e => e.tipo === "decision").length, 1);
  assert.equal(eventos.find(e => e.tipo === "decision").decision.id, "frontera");
  const año = p.motor().año();
  assert.equal(p.paso(1), 0);
  assert.equal(p.motor().año(), año);
});

test("elegir no reanuda; setReproduciendo(true) sí", () => {
  const p = pPueblo({ pausarEnHitos: false });
  p.paso(1);
  const r = p.elegir("esperar");
  assert.equal(r.opcion.id, "esperar");
  assert.equal(p.decisionPendiente(), null);
  assert.equal(p.reproduciendo(), false);
  assert.equal(p.paso(1), 0);
  assert.equal(p.setReproduciendo(true), true);
  assert.ok(p.paso(1) > 0);
});

test("misma semilla, mismo origen y mismas elecciones en los mismos años: misma partida", () => {
  const jugar = () => {
    const p = pPueblo({ pausarEnHitos: false, catalogo: catalogo(["frontera", "encuentro", "frio", "sequia"]) });
    for (let k = 0; k < 200 && !p.terminada(); k++) {
      const d = p.decisionPendiente();
      if (d) { p.elegir(d.opciones[0].id); p.setReproduciendo(true); }
      p.paso(0.5);
    }
    return p;
  };
  const a = jugar(), b = jugar();
  assert.ok(a.pueblo().registro().length > 1);
  assert.equal(huella(a.motor()), huella(b.motor()));
  assert.deepEqual(a.pueblo().registro(), b.pueblo().registro());
});

test("una decisión y un hito en el mismo paso: los dos quedan pendientes", () => {
  const p = pPueblo();   // la salida de África y la frontera del desierto llegan en el primer paso
  p.paso(1);
  assert.equal(p.decisionPendiente().id, "frontera");
  assert.deepEqual(p.pendientes().map(x => x.id), ["salida_africa"]);
  assert.equal(p.tomarHito().id, "salida_africa");
  assert.equal(p.decisionPendiente().id, "frontera");
});

test("una partida nueva descarta la decisión pendiente", () => {
  const p = pPueblo();
  p.paso(1);
  assert.ok(p.decisionPendiente());
  p.nueva(2);
  assert.equal(p.decisionPendiente(), null);
  assert.equal(p.modo(), "historia");
  assert.equal(p.pueblo(), null);
  p.nueva(3, { modo: "pueblo", origen: 0 });
  assert.equal(p.decisionPendiente(), null);
  assert.equal(p.motor().año(), -20000);
  assert.equal(p.reproduciendo(), true);
});

test("el modo historia sigue igual", () => {
  const p = Partida.crear(isla(), conGente(), { params: QUIETO, presupuestoMs: Infinity });
  const eventos = [];
  p.alEvento(e => eventos.push(e.tipo));
  p.nueva(7);
  for (let k = 0; k < 5; k++) { p.setReproduciendo(true); p.paso(1); }
  assert.equal(p.modo(), "historia");
  assert.equal(p.pueblo(), null);
  assert.equal(p.decisionPendiente(), null);
  assert.ok(!eventos.includes("decision") && !eventos.includes("pueblo"));
  assert.throws(() => p.elegir("x"));
});

// Los oyentes son la interfaz: corren después del paso del motor y uno que falla no toca la simulación
test("un oyente que lanza no cambia la huella", t => {
  const errores = t.mock.method(console, "error", () => {});
  const jugar = conOyenteRoto => {
    const p = pPueblo({ catalogo: catalogo(["frontera", "encuentro", "frio", "sequia"]) });
    if (conOyenteRoto) p.alEvento(() => { throw new Error("la interfaz falló"); });
    const tipos = [];
    p.alEvento(e => tipos.push(e.tipo));   // un oyente posterior al roto sigue recibiendo todo
    for (let k = 0; k < 200 && !p.terminada(); k++) {
      const d = p.decisionPendiente();
      if (d) p.elegir(d.opciones[0].id);
      while (p.tomarHito());
      p.setReproduciendo(true);
      p.paso(0.5);
    }
    return { p, tipos };
  };
  const sano = jugar(false), roto = jugar(true);
  assert.ok(sano.p.pueblo().registro().length > 1 && sano.p.motor().hitos().length > 0 && sano.tipos.includes("decision"));
  assert.equal(huella(roto.p.motor()), huella(sano.p.motor()));
  assert.deepEqual(roto.p.motor().hitos(), sano.p.motor().hitos());
  assert.deepEqual(roto.p.pueblo().registro(), sano.p.pueblo().registro());
  assert.deepEqual(roto.tipos, sano.tipos);
  assert.equal(errores.mock.callCount(), roto.tipos.length);   // cada fallo queda en la consola, una vez
});

test("los eventos llegan después del paso: hito antes que decisión, con la partida ya en pausa", () => {
  const p = pPueblo();   // la salida de África y la frontera del desierto llegan en el primer paso
  const vistos = [];
  p.alEvento(e => vistos.push({ tipo: e.tipo, año: p.motor().año(), jugando: p.reproduciendo(), pendientes: p.pendientes().length,
    decision: p.decisionPendiente() && p.decisionPendiente().id }));
  p.paso(1);
  const año = p.motor().año();
  assert.deepEqual(vistos.map(v => v.tipo), ["hito", "decision"]);
  // Cada oyente ve el estado del final del paso, no uno a medias
  for (const v of vistos) {
    assert.equal(v.año, año);
    assert.equal(v.jugando, false);
    assert.equal(v.pendientes, 1);
    assert.equal(v.decision, "frontera");
  }
  assert.equal(p.paso(1), 0);
  assert.equal(vistos.length, 2);
});

test("un oyente que lanza en un hito no deja la partida a medias ni corta a los demás", t => {
  t.mock.method(console, "error", () => {});
  const p = Partida.crear(isla(), conGente(), { params: QUIETO, presupuestoMs: Infinity });
  const q = Partida.crear(isla(), conGente(), { params: QUIETO, presupuestoMs: Infinity });
  let llegaron = 0;
  p.alEvento(e => { if (e.tipo === "hito") throw new Error("la interfaz falló"); });
  p.alEvento(() => { llegaron++; });
  assert.doesNotThrow(() => p.paso(1));
  q.paso(1);
  assert.equal(llegaron, p.pendientes().length);
  assert.equal(p.motor().año(), q.motor().año());
  assert.equal(huella(p.motor()), huella(q.motor()));
  assert.equal(p.reproduciendo(), false);
});
