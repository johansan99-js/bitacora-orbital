import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js");
const SIN_AZAR = { cruce: [0, 0, 0], costera: 0 };
const tira = () => mundoDePrueba(["0000000", "0444440", "0000000"], { lonOeste: -7 });

test("el saber de recolectores crece con la gente y viaja con los que migran", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }] });
  const m = Motor.crear(tira(), h, { params: { ...SIN_AZAR, ritmoRec: 100, exploracion: 0.01 } });
  m.avanzar(500);
  const sr = m.celdas.saberRecolector;
  assert.ok(sr[m.celdaDe(0, -4)] > 0);
  assert.ok(m.celdas.poblacion[m.celdaDe(0, -2)] > 0);
  assert.ok(sr[m.celdaDe(0, -2)] > 0);
});

test("el desierto no se habita hasta que el saber de recolectores pasa su umbral", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -2, personas: 6000 }] });
  const mundo = () => mundoDePrueba(["00000", "04300", "00000"]);   // estepa | desierto
  const cerrado = Motor.crear(mundo(), h, { params: { ...SIN_AZAR, exploracion: 0.01, ritmoRec: 1, saberDesierto: 1e6 } });
  const desierto = cerrado.celdaDe(0, 0);
  assert.equal(cerrado.capacidad(desierto), 0);
  cerrado.avanzar(3000);
  assert.equal(cerrado.celdas.poblacion[desierto], 0);
  const abierto = Motor.crear(mundo(), h, { params: { ...SIN_AZAR, exploracion: 0.01, ritmoRec: 100, saberDesierto: 50 } });
  abierto.avanzar(3000);
  assert.ok(abierto.celdas.poblacion[abierto.celdaDe(0, 0)] > 0);
});

test("sin navegación de altura, cruzar el mar espera al saber de recolectores", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }] });
  const islas = () => mundoDePrueba(["0000000", "0404040", "0000000"], { lonOeste: -7 });
  const params = { costera: 0, exploracion: 0, presion: 0, cruce: [0.01, 0.01, 0.01], ritmoRec: 0 };
  const sinSaber = Motor.crear(islas(), h, { semilla: 3, params: { ...params, saberMar: 1e6 } });
  sinSaber.avanzar(2000);
  assert.equal(sinSaber.celdas.poblacion[sinSaber.celdaDe(0, 0)], 0);
  const sinCompuerta = Motor.crear(islas(), h, { semilla: 3, params: { ...params, saberMar: 0 } });
  sinCompuerta.avanzar(2000);
  assert.ok(sinCompuerta.celdas.poblacion[sinCompuerta.celdaDe(0, 0)] > 0);
});

test("los arcaicos ocupan su territorio hasta que el saber de nuestra especie los desplaza", () => {
  const arcaicos = [{ id: "neandertales", nombre: "N", hito: "neandertales", cajas: [[-1, 1, -1, 5]], fuente: "prueba" }];
  const h = historiaDePrueba({ arcaicos, origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 6000 }] });
  const base = { ...SIN_AZAR, exploracion: 0.01, ritmoRec: 100 };
  const fuertes = Motor.crear(tira(), h, { params: { ...base, saberArcaico: 1e6 } });
  const b = fuertes.celdaDe(0, 0), libre = fuertes.capacidad(fuertes.celdaDe(0, -2));
  assert.ok(Math.abs(fuertes.capacidad(b) - libre * 0.01) < 1e-4 * libre);   // nuestra especie solo dispone del 1 %
  fuertes.avanzar(3000);
  assert.equal(fuertes.celdas.arcaicos[b], 1);
  const debiles = Motor.crear(tira(), h, { params: { ...base, saberArcaico: 50, desplaza: 0.02 } });
  const vistos = [];
  debiles.alHito(x => vistos.push(x.id));
  debiles.avanzar(6000);
  assert.equal(debiles.celdas.arcaicos[debiles.celdaDe(0, 0)], 0);
  assert.ok(vistos.includes("neandertales"));
});

test("Arabia cuenta como África para la salida", () => {
  const regiones = [
    { id: "africa", nombre: "África", hito: null, origen: true, cajas: [[-90, 90, -180, -3]] },
    { id: "arabia", nombre: "Arabia", hito: null, origen: true, cajas: [[-90, 90, -3, 1]] },
    { id: "asia", nombre: "Asia", hito: "asia", cajas: [[-90, 90, 1, 180]] }
  ];
  const h = historiaDePrueba({ regiones, origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }] });
  const m = Motor.crear(tira(), h, { params: { ...SIN_AZAR, exploracion: 0.01 } });
  const salida = [];
  m.alHito(x => { if (x.id === "salida_africa") salida.push(m.celdas.lon[x.celda]); });
  m.avanzar(5000);
  assert.equal(salida.length, 1);
  assert.ok(salida[0] > 1);   // cuenta recién al llegar a Asia (lon 2 o 4), no en Arabia (lon −2 y 0)
});

test("un desembarco cuenta como llegada solo si la celda puede sostener a la población establecida", () => {
  const regiones = [{ id: "a", nombre: "A", hito: null, origen: true, cajas: [[-90, 90, -180, -1]] }, { id: "b", nombre: "B", hito: "b", cajas: [[-90, 90, -1, 180]] }];
  const islas = [{ nombre: "Islote", lat: 0, lon: 0, km2: 50, bioma: 4 }];   // capacidad 50 × 0,08 × 1,5 = 6 personas
  const h = historiaDePrueba({ regiones, islas, origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }] });
  const m = Motor.crear(mundoDePrueba(["0000000", "0400000", "0000000"], { lonOeste: -7 }), h,
    { semilla: 1, params: { costera: 0, exploracion: 0, presion: 0, saberMar: 0, cruce: [1, 1, 1] } });
  const vistos = [];
  m.alHito(x => vistos.push(x.id));
  m.avanzar(500);
  assert.ok(m.celdas.poblacion[m.celdaDe(0, 0)] > 0);   // sí desembarcaron
  assert.ok(!vistos.includes("b"));
});

test("el desierto sigue cerrado en los periodos húmedos y los valles de río no tienen compuerta", () => {
  const h = historiaDePrueba({
    humedos: { cajas: [[-1, 1, -3, -1]], tramos: [[-25000, 3000]] },   // húmedo toda la partida
    rios: [{ nombre: "Río", cajas: [[-1, 1, 1, 3]] }]
  });
  const m = Motor.crear(mundoDePrueba(["00000", "03330", "00000"]), h, { params: { saberDesierto: 1e6 } });
  m.avanzar(10);
  assert.equal(m.capacidad(m.celdaDe(0, -2)), 0);    // desierto en periodo húmedo: sigue cerrado sin saber
  assert.ok(m.capacidad(m.celdaDe(0, 2)) > 0);        // valle de río: sin compuerta
});

test("un desembarco lleva el saber de quienes cruzan", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }] });
  const islas = mundoDePrueba(["0000000", "0404000", "0000000"], { lonOeste: -7 });
  const m = Motor.crear(islas, h, { semilla: 2, params: { costera: 0, exploracion: 0, presion: 0, ritmoRec: 100, saberMar: 200, cruce: [1, 1, 1] } });
  const j = m.celdaDe(0, 0);
  for (let k = 0; k < 400 && m.celdas.poblacion[j] <= 0; k++) m.avanzar(10);
  assert.ok(m.celdas.poblacion[j] > 0, "nunca desembarcaron");
  assert.ok(m.celdas.saberRecolector[j] >= 200, `saber del desembarco: ${m.celdas.saberRecolector[j]}`);   // su propio crecimiento en un paso sería < 1
});

test("la celda de desierto que se abre recibe el saber de los migrantes", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -2, personas: 6000 }] });
  const m = Motor.crear(mundoDePrueba(["00000", "04300", "00000"]), h, { params: { cruce: [0, 0, 0], costera: 0, exploracion: 0.01, ritmoRec: 100, saberDesierto: 200 } });
  const d = m.celdaDe(0, 0);
  for (let k = 0; k < 400 && m.celdas.poblacion[d] <= 0; k++) m.avanzar(10);
  assert.ok(m.celdas.poblacion[d] > 0, "nadie llegó al desierto");
  assert.ok(m.celdas.saberRecolector[d] >= 200, `saber en el desierto: ${m.celdas.saberRecolector[d]}`);
});

test("los arcaicos no ocupan una región de origen", () => {
  const regiones = [{ id: "africa", nombre: "África", hito: null, origen: true, cajas: [[-90, 90, -180, -1]] }, { id: "b", nombre: "B", hito: null, cajas: [[-90, 90, -1, 180]] }];
  const arcaicos = [{ id: "x", nombre: "X", hito: null, cajas: [[-90, 90, -180, 180]], fuente: "prueba" }];
  const m = Motor.crear(tira(), historiaDePrueba({ regiones, arcaicos }));
  assert.equal(m.celdas.arcaicos[m.celdaDe(0, -2)], 0);
  assert.equal(m.celdas.arcaicos[m.celdaDe(0, 2)], 1);
});
