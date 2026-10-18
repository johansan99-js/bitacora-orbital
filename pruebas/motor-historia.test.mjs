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
