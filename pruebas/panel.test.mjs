import { test } from "node:test";
import assert from "node:assert/strict";
import { require } from "./ayuda.mjs";
const PanelTierra = require("../poblacion/panel.js");
const hace = (a, b) => [2026 - a, 2026 - b];

test("las cantidades de personas se escriben en español", () => {
  assert.equal(PanelTierra.personas(2100), "2100");
  assert.equal(PanelTierra.personas(1e6), "1 millón");
  assert.equal(PanelTierra.personas(2.1e6), "2,1 millones");
  assert.equal(PanelTierra.personas(8.1e9), "8,1 mil millones");
});

test("la población real se interpola en escala logarítmica", () => {
  const [a, b] = PanelTierra.realEn([[0, 1e6, 4e6], [100, 4e6, 16e6]], 50);
  assert.ok(Math.abs(a - 2e6) < 1 && Math.abs(b - 8e6) < 1);
  assert.equal(PanelTierra.textoReal([1e6, 1e7]), "1 millón – 10 millones");
  assert.equal(PanelTierra.textoReal([2.5e9, 2.6e9]), "~2,5 mil millones");
});

test("los rangos reales usan el mismo formato que el reloj", () => {
  assert.equal(PanelTierra.rango(hace(65000, 50000), 2026), "hace 65.000–50.000 años");
  assert.equal(PanelTierra.rango([-4000, -3500], 2026), "4000–3500 a. C.");
  assert.equal(PanelTierra.rango([1250, 1300], 2026), "1250–1300");
  assert.equal(PanelTierra.rango([1804, 1804], 2026), "1804");
  assert.equal(PanelTierra.rango(null, 2026), "no ocurrió");
});

test("la comparación dice si cayó dentro del rango o cuánto antes o después", () => {
  assert.equal(PanelTierra.comparar(-3700, [-4000, -3500]), "dentro del rango real");
  assert.equal(PanelTierra.comparar(-4500, [-4000, -3500]), "500 años antes");
  assert.equal(PanelTierra.comparar(1900, [1760, 1830]), "70 años después");
  assert.equal(PanelTierra.comparar(1759.6, [1760, 1830]), "dentro del rango real");
  assert.equal(PanelTierra.comparar(1831, [1760, 1830]), "1 año después");
});
