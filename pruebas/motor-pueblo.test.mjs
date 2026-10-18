import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba, huella } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js");
const SIN_AZAR = { cruce: [0, 0, 0], costera: 0 };
const isla = () => mundoDePrueba(["000", "040", "000"], { lonOeste: -3 });
const tira = () => mundoDePrueba(["0000000", "0444440", "0000000"], { lonOeste: -7 });
// Tu pueblo en una punta de la tira y otro origen, con mucha más gente, en la otra. Sin crecimiento, así los tuyos de una
// celda solo pueden subir si llegan.
const QUIETOS = { ...SIN_AZAR, crecimiento: [0, 0, 0, 0, 0], exploracion: 0.01 };
const enfrentados = () => Motor.crear(tira(), historiaDePrueba({ origenes: [
  { nombre: "A", lat: 0, lon: -4, personas: 3000 }, { nombre: "B", lat: 0, lon: 4, personas: 30000 }
] }), { params: QUIETOS, pueblo: { origen: 0 } });

test("tu pueblo empieza con la gente de su origen", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 1000 }, { nombre: "B", lat: 0, lon: 4, personas: 2500 }] });
  const m = Motor.crear(tira(), h, { params: SIN_AZAR, pueblo: { origen: 1 } });
  const pb = m.pueblo(), i = m.celdaDe(0, 4);
  for (let j = 0; j < pb.tuyos.length; j++) if (j !== i) { assert.equal(pb.tuyos[j], 0); assert.equal(pb.linaje[j], 0); }
  assert.equal(pb.tuyos[i], 2500);
  assert.equal(pb.linaje[i], 1);
  assert.equal(pb.total(), 2500);
  assert.equal(pb.mayoria(i), true);
  assert.deepEqual(Array.from(pb.celdas()), [i]);
});

test("0 ≤ tuyos ≤ pob y 0 ≤ linaje ≤ 1 en todo paso", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -8, personas: 3000 }, { nombre: "B", lat: 0, lon: 8, personas: 3000 }] });
  const m = Motor.crear(mundoDePrueba(["00000000000", "04444444440", "00000000000"], { lonOeste: -11 }), h,
    { params: { ...SIN_AZAR, exploracion: 0.01 }, pueblo: { origen: 0 } });
  const { tuyos, linaje } = m.pueblo(), pob = m.celdas.poblacion;
  for (let s = 0; s < 200; s++) {
    m.avanzar(10);
    for (let i = 0; i < pob.length; i++) {
      assert.ok(tuyos[i] >= 0 && tuyos[i] <= pob[i], `tuyos ${tuyos[i]} con pob ${pob[i]} en ${i}`);
      assert.ok(linaje[i] >= 0 && linaje[i] <= 1, `linaje ${linaje[i]} en ${i}`);
    }
  }
  assert.ok(m.pueblo().total() > 0);
});

test("tu pueblo solo emigra a celdas vacías o donde es mayoría", () => {
  const m = enfrentados(), pb = m.pueblo(), pob = m.celdas.poblacion, N = pob.length;
  const ajenas = new Uint8Array(N), antes = new Float64Array(N);
  let vistas = 0;
  for (let s = 0; s < 300; s++) {
    for (let i = 0; i < N; i++) { ajenas[i] = pob[i] > 0 && !pb.mayoria(i) ? 1 : 0; antes[i] = pb.tuyos[i]; }
    m.avanzar(10);
    for (let i = 0; i < N; i++) if (ajenas[i]) {
      vistas++;
      // Con r = 0 el crecimiento puede mover el último decimal; un grupo que llega trae al menos `minimo` personas
      assert.ok(pb.tuyos[i] <= antes[i] * (1 + 1e-12), `la celda ${i} recibió tuyos en el paso ${s}`);
    }
  }
  assert.ok(vistas > 0);
});

test("la herencia se mezcla con todos", () => {
  const m = enfrentados(), pb = m.pueblo(), pob = m.celdas.poblacion;
  m.avanzar(3000);
  let mezcladas = 0;
  for (let i = 0; i < pob.length; i++) if (pob[i] > 0 && pb.tuyos[i] === 0 && pb.linaje[i] > 0 && pb.linaje[i] < 1) mezcladas++;
  assert.ok(mezcladas > 0);
  assert.ok(pb.herencia() > 0);
  assert.ok(pb.conLinaje() > pb.total());
});

test("tus grupos chicos se asimilan", () => {
  // Las dos poblaciones en la misma celda: los tuyos son el 10 %, por debajo de `asimila`
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 100 }, { nombre: "B", lat: 0, lon: 0, personas: 900 }] });
  const m = Motor.crear(isla(), h, { params: SIN_AZAR, pueblo: { origen: 0 } });
  const pb = m.pueblo(), i = m.celdaDe(0, 0);
  assert.ok(pb.tuyos[i] > 0 && pb.tuyos[i] < Motor.PARAMS.asimila * m.celdas.poblacion[i]);
  const l = pb.linaje[i];
  m.avanzar(10);
  assert.equal(pb.tuyos[i], 0);
  assert.equal(pb.linaje[i], l);
  assert.ok(m.celdas.poblacion[i] > 0);
});

test("una celda vaciada pierde tuyos y linaje", () => {
  const h = historiaDePrueba({
    nivelMar: [[-1e7, 0], [-19000, 0], [-18000, -125], [3000, -125]],
    hielo: [{ nombre: "Todo", gMin: 0.5, cajas: [[-90, 90, -180, 180]] }],
    origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 500 }]
  });
  const m = Motor.crear(isla(), h, { params: SIN_AZAR, pueblo: { origen: 0 } });
  const pb = m.pueblo(), i = m.celdaDe(0, 0);
  m.avanzar(500);
  assert.ok(pb.tuyos[i] > 0 && pb.linaje[i] === 1);
  m.avanzar(2000);
  assert.equal(m.celdas.poblacion[i], 0);
  assert.equal(pb.tuyos[i], 0);
  assert.equal(pb.linaje[i], 0);
});

test("perderPueblo quita gente de tu pueblo y de la celda", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }, { nombre: "B", lat: 0, lon: 4, personas: 3000 }] });
  const m = Motor.crear(tira(), h, { params: { ...SIN_AZAR, exploracion: 0.01 }, pueblo: { origen: 0 } });
  m.avanzar(500);
  const pb = m.pueblo(), t0 = pb.total(), p0 = m.poblacionTotal();
  m.perderPueblo(0.3);
  const t1 = pb.total(), p1 = m.poblacionTotal();
  assert.ok(Math.abs((t0 - t1) - 0.3 * t0) < 1e-6 * t0);
  assert.ok(Math.abs((t0 - t1) - (p0 - p1)) < 1e-6 * p0);
});

test("el cruce de mar lleva tuyos y linaje en proporción", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -2, personas: 3000 }] });
  const m = Motor.crear(mundoDePrueba(["00000", "04040", "00000"]), h, { params: { costera: 0, cruce: [1, 1, 1], saberMar: 0 }, pueblo: { origen: 0 } });
  const pb = m.pueblo(), j = m.celdaDe(0, 2);
  m.avanzar(100);
  assert.ok(m.celdas.poblacion[j] > 0);
  assert.ok(pb.tuyos[j] > 0);
  assert.ok(Math.abs(pb.linaje[j] - 1) < 1e-6);
});

test("misma semilla y mismo origen, misma partida", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }, { nombre: "B", lat: 0, lon: 4, personas: 3000 }] });
  const jugar = () => {
    const m = Motor.crear(mundoDePrueba(["0000000", "0404040", "0000000"], { lonOeste: -7 }), h,
      { semilla: 7, params: { cruce: [0.01, 0.01, 0.01], saberMar: 0 }, pueblo: { origen: 1 } });
    m.avanzar(2000);
    return [huella(m), Array.from(m.pueblo().tuyos).join()];
  };
  assert.deepEqual(jugar(), jugar());
});
