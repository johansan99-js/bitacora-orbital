import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const P = require("../poblacion/pueblo-datos.js"), Motor = require("../poblacion/motor.js");

test("cada momento tiene título, texto, real con fuente y al menos una opción", () => {
  for (const m of P.momentos) {
    assert.ok(m.titulo && m.texto, m.id);
    assert.ok(m.real && m.real.texto && m.real.fuente, m.id);
    if (m.id === "cuello") assert.equal(m.opciones.length, 1, m.id);
    else assert.ok(m.opciones.length >= 2 && m.opciones.length <= 3, m.id);
  }
});

test("los ids de momentos, opciones y rasgos son únicos", () => {
  const unico = ids => assert.equal(new Set(ids).size, ids.length);
  unico(P.momentos.map(m => m.id));
  unico(P.rasgos.map(r => r.id));
  for (const m of P.momentos) unico(m.opciones.map(o => o.id));
});

test("todo rasgo nombrado existe", () => {
  const ids = new Set(P.rasgos.map(r => r.id));
  for (const id of Object.values(P.reglas.rasgoPorEspecie)) assert.ok(ids.has(id), id);
  for (const m of P.momentos) for (const o of m.opciones) {
    const r = o.efecto && o.efecto.rasgo;
    if (r && r !== "segun_especie" && r !== "segun_causa") assert.ok(ids.has(r), `${m.id}/${o.id}: ${r}`);
  }
});

test("los nombres de biomas, etapas e innovaciones existen en el motor", () => {
  const revisar = (obj, donde) => {
    if (Array.isArray(obj)) return obj.forEach(x => revisar(x, donde));
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (k === "biomas") for (const b of v) assert.ok(b in Motor.BIOMA, `${donde}: ${b}`);
      else if (k === "etapas") for (const e of v) assert.ok(e in Motor.ETAPA, `${donde}: ${e}`);
      else if (k === "desbloquea") for (const i of v) assert.ok(i in Motor.INNOVACION, `${donde}: ${i}`);
      else if (k === "bits") for (const i of v) assert.ok(i in Motor.INNOVACION, `${donde}: ${i}`);
      else revisar(v, donde);
    }
  };
  for (const i of P.reglas.bloqueoInicial) assert.ok(i in Motor.INNOVACION, i);
  for (const r of P.rasgos) revisar(r.mods, r.id);
  for (const m of P.momentos) for (const o of m.opciones) revisar(o.efecto, `${m.id}/${o.id}`);
});

test("los textos de opción caben en un botón", () => {
  for (const m of P.momentos) for (const o of m.opciones) {
    assert.ok(o.texto.length <= 24, `${m.id}/${o.id} texto: ${o.texto.length}`);
    assert.ok(o.detalle.length <= 90, `${m.id}/${o.id} detalle: ${o.detalle.length}`);
  }
});

test("cada opción tiene costo y beneficio", () => {
  for (const m of P.momentos) {
    if (m.opciones.length < 2 || m.id === "nacimiento") continue;   // el origen se aplica al crear la partida
    for (const o of m.opciones) assert.ok(Object.keys(o.efecto).length > 0, `${m.id}/${o.id}`);
  }
});

test("los rasgos tienen nombre, texto y fuente", () => {
  for (const r of P.rasgos) assert.ok(r.nombre && r.texto && r.fuente, r.id);
});
