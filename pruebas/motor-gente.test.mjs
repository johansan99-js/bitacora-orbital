import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js");
const SIN_AZAR = { cruce: [0, 0, 0], costera: 0 };
const isla = () => mundoDePrueba(["000", "040", "000"], { lonOeste: -3 });
const tira = () => mundoDePrueba(["0000000", "0444440", "0000000"], { lonOeste: -7 });

test("la población crece hasta la capacidad y no la pasa", () => {
  const m = Motor.crear(isla(), historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 50 }] }));
  const i = m.celdaDe(0, 0), K = m.capacidad(i);
  m.avanzar(15000);
  assert.ok(m.celdas.poblacion[i] <= K * 1.0001);
  assert.ok(m.celdas.poblacion[i] >= K * 0.99);
});

test("migrar no crea ni destruye personas", () => {
  const params = { ...SIN_AZAR, crecimiento: [0, 0, 0, 0, 0], exploracion: 0.01,
    densidad: [null, [0, 0, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]] };
  const m = Motor.crear(tira(), historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 50000 }] }), { params });
  m.avanzar(300);
  assert.ok(Math.abs(m.poblacionTotal() - 50000) < 1e-6);
  assert.ok(m.celdas.poblacion[m.celdaDe(0, -2)] > 0);
});

test("solo se pasa a la otra orilla cuando el puente de tierra está abierto", () => {
  const puentes = [{ id: "p", nombre: "Puente", umbral: -50, bioma: 4, cajas: [[-1, 1, -1, 1]] }];
  const origenes = [{ nombre: "A", lat: 0, lon: -2, personas: 3000 }];
  const params = { ...SIN_AZAR, exploracion: 0.01 };
  const mundo = () => mundoDePrueba(["00000", "04040", "00000"]);
  const cerrado = Motor.crear(mundo(), historiaDePrueba({ puentes, origenes }), { params });
  cerrado.avanzar(5000);
  assert.equal(cerrado.celdas.poblacion[cerrado.celdaDe(0, 2)], 0);
  const abierto = Motor.crear(mundo(), historiaDePrueba({ puentes, origenes, nivelMar: [[-1e7, -100], [3000, -100]] }), { params });
  abierto.avanzar(5000);
  assert.ok(abierto.celdas.poblacion[abierto.celdaDe(0, 2)] > 0);
});

test("si el hielo cubre a toda la humanidad, la partida termina con el hito de extinción", () => {
  const h = historiaDePrueba({
    nivelMar: [[-1e7, 0], [-19000, 0], [-18000, -125], [3000, -125]],
    hielo: [{ nombre: "Todo", gMin: 0.5, cajas: [[-90, 90, -180, 180]] }],
    origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 500 }]
  });
  const m = Motor.crear(isla(), h, { params: SIN_AZAR });
  const vistos = [];
  m.alHito(x => vistos.push(x.id));
  m.avanzar(500);
  assert.ok(m.poblacionTotal() > 0);
  m.avanzar(2000);
  assert.equal(m.poblacionTotal(), 0);
  assert.equal(m.terminado(), true);
  assert.ok(vistos.includes("extincion"));
  assert.ok(m.año() < 2026);
});

test("la misma semilla repite la partida y otra semilla la cambia", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }] });
  const jugar = semilla => {
    const m = Motor.crear(mundoDePrueba(["0000000", "0404040", "0000000"], { lonOeste: -7 }), h, { semilla, params: { cruce: [0.01, 0.01, 0.01] } });
    m.avanzar(400);
    return Array.from(m.celdas.poblacion).join();
  };
  assert.equal(jugar(7), jugar(7));
  assert.ok(new Set([1, 2, 3, 4, 5].map(jugar)).size > 1);
});

test("cada hito de llegada se avisa una sola vez", () => {
  const h = historiaDePrueba({
    regiones: [{ id: "a", nombre: "A", hito: null, cajas: [[-90, 90, -180, -1]] }, { id: "b", nombre: "B", hito: "b", cajas: [[-90, 90, -1, 180]] }],
    origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }]
  });
  const m = Motor.crear(tira(), h, { params: { ...SIN_AZAR, exploracion: 0.01 } });
  const vistos = [];
  m.alHito(x => vistos.push(x.id));
  m.avanzar(5000);
  assert.equal(vistos.filter(id => id === "b").length, 1);
  assert.equal(m.hitos().filter(x => x.id === "b").length, 1);
});

test("un estrecho que nunca se secó solo se cruza por mar", () => {
  const h = historiaDePrueba({
    regiones: [{ id: "a", nombre: "A", hito: null, cajas: [[-90, 90, -180, -1]] }, { id: "b", nombre: "B", hito: null, cajas: [[-90, 90, -1, 180]] }],
    barreras: [{ entre: ["a", "b"] }],
    origenes: [{ nombre: "A", lat: 0, lon: -2, personas: 3000 }]
  });
  const mundo = () => mundoDePrueba(["00000", "04440", "00000"]);
  const caminando = Motor.crear(mundo(), h, { params: { ...SIN_AZAR, exploracion: 0.01 } });
  caminando.avanzar(5000);
  assert.equal(caminando.celdas.poblacion[caminando.celdaDe(0, 0)], 0);
  const navegando = Motor.crear(mundo(), h, { semilla: 3, params: { costera: 0, exploracion: 0.01, cruce: [0.01, 0.01, 0.01] } });
  navegando.avanzar(5000);
  assert.ok(navegando.celdas.poblacion[navegando.celdaDe(0, 0)] > 0);
});
