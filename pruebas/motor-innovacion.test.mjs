import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js");
const { AGRICULTURA, CIUDADES, ESCRITURA, INDUSTRIA } = Motor.INNOVACION;
const KM2 = (2 * 111.32) ** 2;
const QUIETO = { cruce: [0, 0, 0], costera: 0, exploracion: 0, presion: 0, industriaGlobal: 0,
  contagio: { 1: 0, 2: 0, 4: 0, 8: 0, 16: 0, 32: 0 } };
const tres = (fila = "04440") => mundoDePrueba(["00000", fila, "00000"]);
const llenos = [-2, 0, 2].map(lon => ({ nombre: `C${lon}`, lat: 0, lon, personas: 6000 }));
const enCentro = [{ id: "centro", nombre: "Centro", riqueza: 1, cajas: [[-1, 1, -1, 1]] }];
const enTodo = [{ id: "todo", nombre: "Todo", riqueza: 1, cajas: [[-90, 90, -180, 180]] }];
const tiene = (m, lon, bit) => (m.celdas.innovaciones[m.celdaDe(0, lon)] & bit) !== 0;

test("la agricultura solo nace en el Holoceno y en una región con domesticables", () => {
  const h = historiaDePrueba({ inicio: -12000, origenes: llenos, domesticables: enCentro });
  const m = Motor.crear(tres(), h, { params: { ...QUIETO, agricultura: 1 } });
  const vistos = [];
  m.alHito(x => vistos.push(x.id));
  m.avanzar(2300);   // −9.700: todavía antes del Holoceno (−9.674)
  assert.equal([-2, 0, 2].some(lon => tiene(m, lon, AGRICULTURA)), false);
  m.avanzar(700);    // −9.000
  assert.equal(tiene(m, 0, AGRICULTURA), true);
  assert.equal(tiene(m, -2, AGRICULTURA), false);
  assert.equal(tiene(m, 2, AGRICULTURA), false);
  assert.ok(vistos.includes("agricultura_centro"));
});

test("la agricultura se contagia a las vecinas aptas y no a la tundra", () => {
  const h = historiaDePrueba({ inicio: -9600, origenes: llenos, domesticables: enCentro });
  const m = Motor.crear(tres("04420"), h, { params: { ...QUIETO, agricultura: 1, contagio: { ...QUIETO.contagio, 2: 1 } } });
  m.avanzar(500);
  assert.equal(tiene(m, 0, AGRICULTURA), true);
  assert.equal(tiene(m, -2, AGRICULTURA), true);
  assert.equal(tiene(m, 2, AGRICULTURA), false);
});

test("las ciudades solo nacen donde la densidad de agricultores pasa el umbral", () => {
  const h = historiaDePrueba({ inicio: -9600, origenes: llenos, domesticables: enTodo });
  const base = { ...QUIETO, agricultura: 1, ciudades: 1 };
  const nunca = Motor.crear(tres(), h, { params: { ...base, densidadCiudad: 1e9 } });
  nunca.avanzar(3000);
  assert.equal(tiene(nunca, 0, CIUDADES), false);
  const pronto = Motor.crear(tres(), h, { params: { ...base, densidadCiudad: 1 } });
  const vistos = [];
  pronto.alHito(x => vistos.push(x.id));
  pronto.avanzar(3000);
  assert.equal(tiene(pronto, 0, CIUDADES), true);
  assert.ok(vistos.includes("primera_ciudad"));
});

test("el saber crece con la gente y sube la capacidad de los agricultores hasta su tope", () => {
  const h = historiaDePrueba({ inicio: -9600, origenes: llenos, domesticables: enTodo });
  const m = Motor.crear(tres(), h, { params: { ...QUIETO, agricultura: 1, ritmoSaber: 50, ciudades: 0 } });
  m.avanzar(100);
  const i = m.celdaDe(0, 0), antes = m.capacidad(i);
  m.avanzar(3000);
  assert.ok(m.capacidad(i) > antes * 1.5);
  assert.ok(m.capacidad(i) <= KM2 * 6 * (1 + Motor.PARAMS.saberMax) * 1.0001);
});

test("la industria necesita escritura y saber acumulado", () => {
  const h = historiaDePrueba({ inicio: -9600, origenes: llenos, domesticables: enTodo });
  const base = { ...QUIETO, agricultura: 1, ciudades: 1, densidadCiudad: 1, ritmoSaber: 50, saberIndustria: 10, industria: 1 };
  const sinEscritura = Motor.crear(tres(), h, { params: { ...base, escritura: 0 } });
  sinEscritura.avanzar(3000);
  assert.equal(tiene(sinEscritura, 0, INDUSTRIA), false);
  const con = Motor.crear(tres(), h, { params: { ...base, escritura: 1, vecinosEscritura: 1 } });
  const vistos = [];
  con.alHito(x => vistos.push(x.id));
  con.avanzar(3000);
  assert.equal(tiene(con, 0, ESCRITURA), true);
  assert.equal(tiene(con, 0, INDUSTRIA), true);
  assert.ok(vistos.includes("escritura") && vistos.includes("industria"));
});
