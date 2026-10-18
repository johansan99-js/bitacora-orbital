// El modo Historia (sin pueblo) tiene que dar exactamente lo mismo que antes de agregar tu pueblo al motor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { require, huella } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js");
const MUNDO = require("../poblacion/mundo.js"), HISTORIA = require("../poblacion/datos.js");

test("el modo Historia no cambia (semilla 12345, 250.000 años)", () => {
  const m = Motor.crear(MUNDO, HISTORIA, { semilla: 12345 });
  m.avanzar(250000);
  assert.equal(huella(m), "9d9085d0");
});

test("el modo Historia no cambia (semilla 777, partida completa)", () => {
  const m = Motor.crear(MUNDO, HISTORIA, { semilla: 777 });
  m.avanzar(298026);
  assert.equal(huella(m), "942c07e7");
});

test("sin pueblo, m.pueblo() es null", () => {
  const m = Motor.crear(MUNDO, HISTORIA, { semilla: 1 });
  assert.equal(m.pueblo(), null);
});

// La huella de bytes no ve el orden ni el año de los hitos. Valores tomados del commit 874727e, antes de cualquier refactor.
test("el modo Historia no cambia (semilla 777, partida completa): hitos y población total", () => {
  const m = Motor.crear(MUNDO, HISTORIA, { semilla: 777 });
  m.avanzar(298026);
  assert.deepEqual(m.hitos().map(h => [h.id, h.año]), [
    ["salida_africa", -72200], ["asia", -71400], ["sahul", -58600], ["europa", -51600], ["neandertales", -32800],
    ["norteamerica", -25800], ["agricultura_creciente_fertil", -9660], ["agricultura_sahel", -9660], ["agricultura_china", -9620],
    ["agricultura_nueva_guinea", -9580], ["polinesia", -7160], ["agricultura_mesoamerica", -6880], ["agricultura_este_norteamerica", -6800],
    ["nueva_zelanda", -6200], ["sudamerica", -5760], ["primera_ciudad", -4760], ["escritura", -4520]
  ]);
  assert.equal(m.poblacionTotal(), 196179487.45223558);
});
