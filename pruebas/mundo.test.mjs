import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const MUNDO = require("../poblacion/mundo.js");
const celda = (lat, lon) => Math.floor((90 - lat) / 2) * 180 + Math.floor((lon + 180) / 2);

test("la cuadrícula tiene 180 × 90 celdas de dígitos válidos", () => {
  assert.equal(MUNDO.ancho * MUNDO.alto, 16200);
  assert.equal(MUNDO.bioma.length, 16200);
  assert.equal(MUNDO.tierra.length, 16200);
  assert.match(MUNDO.bioma, /^[0-6]+$/);
  assert.match(MUNDO.tierra, /^[0-9]+$/);
});

test("lugares conocidos tienen el bioma esperado", () => {
  assert.equal(MUNDO.bioma[celda(0, -150)], "0");   // océano Pacífico
  assert.equal(MUNDO.bioma[celda(23, 10)], "3");    // Sahara
  assert.equal(MUNDO.bioma[celda(-5, -62)], "6");   // Amazonas
  assert.equal(MUNDO.bioma[celda(75, -40)], "1");   // Groenlandia
  assert.equal(MUNDO.bioma[celda(60, 100)], "5");   // taiga de Siberia
});

test("una celda es mar si y solo si no tiene tierra", () => {
  for (let i = 0; i < 16200; i++) assert.equal(MUNDO.bioma[i] === "0", MUNDO.tierra[i] === "0", `celda ${i}`);
});
