import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js");
const KM2 = (2 * 111.32) ** 2;   // superficie de una celda de 2° × 2° en el ecuador
const cerca = (a, b) => Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(b));
const tres = filaCentral => mundoDePrueba(["00000", filaCentral, "00000"]);

test("cada celda conoce su centro y celdaDe la encuentra", () => {
  const m = Motor.crear(tres("04440"), historiaDePrueba());
  const i = m.celdaDe(0, 0);
  assert.equal(i, 7);   // fila 1, columna 2
  assert.equal(m.celdas.lat[i], 0);
  assert.equal(m.celdas.lon[i], 0);
});

test("la capacidad de recolectores sale de la superficie, el bioma y la costa", () => {
  const m = Motor.crear(tres("04440"), historiaDePrueba());
  assert.ok(cerca(m.capacidad(m.celdaDe(0, 0)), KM2 * 0.08 * 1.5));   // estepa con mar arriba y abajo
});

test("una isla convierte una celda de mar en tierra con su superficie real", () => {
  const h = historiaDePrueba({ islas: [{ nombre: "Prueba", lat: 0, lon: 0, km2: 1000, bioma: 6 }] });
  const m = Motor.crear(tres("00000"), h);
  assert.ok(cerca(m.capacidad(m.celdaDe(0, 0)), 1000 * 0.1 * 1.5));
});

test("un puente de tierra se abre cuando el mar baja de su umbral y se cierra al subir", () => {
  const h = historiaDePrueba({
    nivelMar: [[-1e7, 0], [-15000, 0], [-14000, -100], [-12000, -100], [-11000, 0], [3000, 0]],
    puentes: [{ id: "p", nombre: "Puente", umbral: -50, bioma: 4, cajas: [[-1, 1, -1, 1]] }]
  });
  const m = Motor.crear(tres("04040"), h);
  const p = m.celdaDe(0, 0);
  assert.equal(m.celdas.plataforma[p], 0);
  assert.equal(m.capacidad(p), 0);
  m.avanzar(7000);   // −13.000: mar a −100 m
  assert.equal(m.celdas.plataforma[p], 1);
  assert.ok(m.capacidad(p) > 0);
  assert.equal(m.climaActual().puentesAbiertos[0], true);
  m.avanzar(3000);   // −10.000: mar en 0
  assert.equal(m.celdas.plataforma[p], 0);
  assert.equal(m.capacidad(p), 0);
});

test("el hielo de una glaciación deja la celda sin capacidad", () => {
  const h = historiaDePrueba({
    nivelMar: [[-1e7, 0], [-15000, 0], [-14000, -125], [3000, -125]],
    hielo: [{ nombre: "Prueba", gMin: 0.6, cajas: [[-1, 1, -3, -1]] }]
  });
  const m = Motor.crear(tres("04440"), h);
  const i = m.celdaDe(0, -2), j = m.celdaDe(0, 0);
  assert.ok(m.capacidad(i) > 0);
  m.avanzar(6000);   // −14.000: intensidad glacial 1
  assert.equal(m.climaActual().intensidadGlacial, 1);
  assert.equal(m.celdas.hielo[i], 1);
  assert.equal(m.capacidad(i), 0);
  assert.equal(m.celdas.hielo[j], 0);
});

test("los desiertos reverdecen en los periodos húmedos y junto a los ríos", () => {
  const h = historiaDePrueba({
    humedos: { cajas: [[-1, 1, -3, -1]], tramos: [[-15000, -12000]] },
    rios: [{ nombre: "Río", cajas: [[-1, 1, 1, 3]] }]
  });
  const m = Motor.crear(tres("03330"), h);
  const seco = m.celdaDe(0, -2), rio = m.celdaDe(0, 2);
  const estepa = KM2 * 0.08 * 1.5, desierto = KM2 * 0.005 * 1.5;
  assert.ok(cerca(m.capacidad(seco), desierto));
  assert.ok(cerca(m.capacidad(rio), estepa));
  m.avanzar(7000);   // −13.000: periodo húmedo
  assert.ok(cerca(m.capacidad(seco), estepa));
  m.avanzar(2000);   // −11.000: vuelve a secarse
  assert.ok(cerca(m.capacidad(seco), desierto));
});

test("la partida empieza con la gente de los orígenes", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -2, personas: 2000 }, { nombre: "B", lat: 0, lon: 2, personas: 1500 }] });
  const m = Motor.crear(tres("04440"), h);
  assert.equal(m.poblacionTotal(), 3500);
  assert.equal(m.celdas.etapa[m.celdaDe(0, -2)], Motor.ETAPA.RECOLECTORES);
  assert.equal(m.año(), -20000);
});

test("avanzar nunca pasa del presente", () => {
  const m = Motor.crear(tres("04440"), historiaDePrueba({ inicio: 1990 }));
  m.avanzar(1e6);
  assert.equal(m.año(), 2026);
  assert.equal(m.terminado(), true);
});
