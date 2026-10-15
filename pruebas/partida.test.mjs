import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba } from "./ayuda.mjs";
const Partida = require("../poblacion/partida.js");
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
