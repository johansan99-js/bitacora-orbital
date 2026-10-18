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

const Partida = require("../poblacion/partida.js");
const año = a => Partida.textoAño(a, 2026);

test("el registro de una decisión dice qué elegiste, cuándo y cómo cambió tu pueblo", () => {
  const e = { momento: "frontera", titulo: "Una tierra nueva", opcion: "Cruzar ahora", opcionId: "cruzar", texto: "", fuente: "",
    año: 2026 - 68000, antes: { pueblo: 12000, herencia: 12000 }, despues: { pueblo: 31000, herencia: 40000 } };
  assert.equal(PanelTierra.textoRegistro(e, año), "Elegiste «Cruzar ahora» (hace 68.000 años). Tu pueblo: 12.000 → 31.000 personas.");
  assert.equal(PanelTierra.textoRegistro({ ...e, despues: null }, año), "Elegiste «Cruzar ahora» (hace 68.000 años). Tu pueblo: 12.000 personas al elegir.");
  assert.equal(PanelTierra.textoRegistro({ ...e, antes: { pueblo: 9e5 }, despues: { pueblo: 2.1e6 } }, año),
    "Elegiste «Cruzar ahora» (hace 68.000 años). Tu pueblo: 900.000 → 2,1 millones de personas.");
});

test("el registro del Nacimiento no tiene un antes", () => {
  const e = { momento: "nacimiento", titulo: "¿Dónde nace tu pueblo?", opcion: "Este de África", opcionId: "este", texto: "", fuente: "",
    año: 2026 - 300000, antes: null, despues: null };
  assert.equal(PanelTierra.textoRegistro(e, año), "Elegiste «Este de África» (hace 300.000 años).");
  assert.equal(PanelTierra.textoRegistro({ ...e, despues: { pueblo: 9500, herencia: 9500 } }, año),
    "Elegiste «Este de África» (hace 300.000 años). Después, tu pueblo tenía 9500 personas.");
});

test("el resumen final cuenta cuánto vivió tu pueblo, adónde llegó, sus rasgos y su herencia", () => {
  const r = { estado: "vivo", desde: 2026 - 300000, hasta: 2026, regiones: ["África", "Asia occidental", "Europa"],
    rasgos: ["Adaptados al frío", "Herencia neandertal"], pueblo: 2.1e6, herencia: 3.4e8, conLinaje: 1.2e9, decisiones: 6 };
  assert.equal(PanelTierra.textoFinal(r, año),
    "Tu pueblo vivió desde hace 300.000 años hasta 2026. Tomaste 6 decisiones. Se estableció en África, Asia occidental y Europa. " +
    "Ganó estos rasgos: Adaptados al frío y Herencia neandertal. Al final eran 2,1 millones de personas. " +
    "Hoy, 1,2 mil millones de personas tienen algo de su linaje; su herencia equivale a 340 millones de personas.");
  assert.equal(PanelTierra.textoFinal({ ...r, estado: "disuelto", hasta: 2026 - 42000, regiones: ["África"], rasgos: ["Resistentes a la sed"], pueblo: 0 }, año),
    "Tu pueblo vivió desde hace 300.000 años hasta hace 42.000 años, cuando se mezcló del todo con sus vecinos. Tomaste 6 decisiones. " +
    "Se estableció en África. Ganó estos rasgos: Resistentes a la sed. " +
    "Hoy, 1,2 mil millones de personas tienen algo de su linaje; su herencia equivale a 340 millones de personas.");
  assert.equal(PanelTierra.textoFinal({ ...r, estado: "extinto", hasta: 2026 - 150000, regiones: [], rasgos: [], pueblo: 0, herencia: 0, conLinaje: 0, decisiones: 1 }, año),
    "Tu pueblo vivió desde hace 300.000 años hasta hace 150.000 años, cuando se extinguió. Tomaste 1 decisión. " +
    "No llegó a establecerse en ninguna región. No ganó rasgos. Nadie de hoy desciende de tu pueblo.");
});
