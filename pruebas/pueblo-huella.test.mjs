// Huella del modo Tu pueblo en el mapa real: guarda que migrarConPueblo (y repartirConPueblo) sigan dando lo mismo que el
// camino de migrar que copian. Si cambias la migración a propósito, actualiza estos valores (y las huellas de Historia).
import { test } from "node:test";
import assert from "node:assert/strict";
import { require, huella } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js"), Pueblo = require("../poblacion/pueblo.js");
const MUNDO = require("../poblacion/mundo.js"), HISTORIA = require("../poblacion/datos.js"), PUEBLO = require("../poblacion/pueblo-datos.js");

test("tu pueblo no cambia (semilla 4242, este de África, siempre la primera opción, hasta el año −12.000)", () => {
  const fin = -12000;
  const m = Motor.crear(MUNDO, HISTORIA, { semilla: 4242, pueblo: { origen: 1 } });
  const pb = Pueblo.crear(m, HISTORIA, PUEBLO, { origen: 1 });
  const decisiones = [];
  while (fin - m.año() > 1e-6) {
    m.avanzar(Math.min(m.pasoMax(), fin - m.año()));
    const d = pb.revisar();
    if (d) { decisiones.push(d.id); pb.elegir(d.opciones[0].id); }
  }
  assert.equal(decisiones.join(","), "frontera,frontera,cuello,cuello,frontera,encuentro,encuentro");
  assert.equal(huella(m), "08b562be");
  assert.equal(Math.round(m.pueblo().total()), 509924);
  assert.equal(Math.round(m.pueblo().herencia()), 3806508);
});
