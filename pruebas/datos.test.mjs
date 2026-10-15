import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const H = require("../poblacion/datos.js"), MUNDO = require("../poblacion/mundo.js");
const ascendente = t => t.every((f, k) => k === 0 || f[0] > t[k - 1][0]);

test("las tablas de tiempo están ordenadas y cubren toda la partida", () => {
  for (const t of [H.nivelMar, H.velocidades, H.pasos, H.poblacionReal]) {
    assert.ok(ascendente(t));
    assert.ok(t[0][0] <= H.inicio);
  }
  assert.ok(H.nivelMar.at(-1)[0] >= H.presente);
  assert.ok(H.poblacionReal.at(-1)[0] >= H.presente);
  for (const [a, b] of H.humedos.tramos) assert.ok(a < b);
});

test("cada hito tiene textos, fuente y una fecha real válida", () => {
  for (const h of H.hitos) {
    assert.ok(h.titulo && h.corto && h.texto, h.id);
    if (h.id === "extincion") { assert.equal(h.real, null); continue; }
    assert.ok(h.fuente, h.id);
    assert.ok(h.real[0] <= h.real[1], h.id);
  }
});

test("los hitos que nombran regiones, domesticables y continentes existen", () => {
  const ids = new Set(H.hitos.map(h => h.id));
  for (const r of H.regiones) if (r.hito) assert.ok(ids.has(r.hito), r.id);
  for (const d of H.domesticables) assert.ok(ids.has(`agricultura_${d.id}`), d.id);
  for (const id of ["salida_africa", "primera_ciudad", "escritura", "industria", "mil_millones", "ocho_mil_millones", "extincion"]) assert.ok(ids.has(id), id);
  for (const c of H.continentes) {
    c.hitos.forEach(id => assert.ok(ids.has(id), id));
    c.regiones.forEach(id => assert.ok(H.regiones.some(r => r.id === id), id));
  }
});

test("los orígenes están en tierra firme", () => {
  for (const o of H.origenes) {
    const i = Math.floor((90 - o.lat) / 2) * 180 + Math.floor((o.lon + 180) / 2);
    assert.notEqual(MUNDO.bioma[i], "0", o.nombre);
  }
});

test("todas las cajas tienen coordenadas válidas", () => {
  const cajas = [...H.regiones, ...H.domesticables, ...H.rios, ...H.puentes, ...H.hielo].flatMap(x => x.cajas).concat(H.humedos.cajas);
  for (const [a, b, c, d] of cajas) {
    assert.ok(a <= b && a >= -90 && b <= 90);
    assert.ok(c >= -180 && d <= 180);
  }
});
