// Calibración: corre partidas completas con el mapa real y compara sus hitos con las ventanas de la spec.
// Uso: node pruebas/calibrar.mjs [partidas=30]   (sale con código 1 si algo no cumple)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const MUNDO = require("../poblacion/mundo.js"), HISTORIA = require("../poblacion/datos.js"), Motor = require("../poblacion/motor.js");

const P = HISTORIA.presente, hace = a => P - a;
const VENTANAS = [
  ["salida_africa", hace(130000), hace(45000)],
  ["sahul", hace(80000), hace(35000)],
  ["europa", hace(60000), hace(30000)],
  ["norteamerica", hace(30000), hace(12000)],
  ["agricultura", hace(13000), hace(8000)],   // la primera, de cualquier región
  ["primera_ciudad", hace(8000), hace(4000)],
  ["industria", 1500, 1900]
];
const SIN_VENTANA = ["neandertales", "polinesia", "nueva_zelanda"];   // se muestran para comparar
const CONTINENTES = ["asia", "europa", "sahul", "norteamerica", "sudamerica"];
const n = Number(process.argv[2] || 30);
const años = Object.fromEntries([...VENTANAS.map(([id]) => id), ...SIN_VENTANA].map(id => [id, []]));
const poblaciones = [], tiempos = [];
let completas = 0;

for (let s = 1; s <= n; s++) {
  const t0 = performance.now();
  const m = Motor.crear(MUNDO, HISTORIA, { semilla: s });
  m.avanzar(HISTORIA.presente - HISTORIA.inicio);
  tiempos.push(performance.now() - t0);
  const h = new Map(m.hitos().map(x => [x.id, x.año]));
  const agri = [...h].filter(([id]) => id.startsWith("agricultura_")).map(([, a]) => a);
  if (agri.length) h.set("agricultura", Math.min(...agri));
  for (const id of Object.keys(años)) años[id].push(h.has(id) ? h.get(id) : Infinity);
  if (CONTINENTES.every(id => h.has(id))) completas++;
  poblaciones.push(m.poblacionTotal());
  process.stdout.write(".");
}

const pct = (arr, q) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
const fmt = a => a === Infinity ? "nunca" : a < -10000 ? `hace ${Math.round((P - a) / 1000)} mil` : a < 0 ? `${-Math.round(a)} a. C.` : `${Math.round(a)}`;
const fila = (marca, id, extra) => console.log(`${marca} ${id.padEnd(18)} ${fmt(pct(años[id], 0.1)).padEnd(14)} ${fmt(pct(años[id], 0.5)).padEnd(14)} ${fmt(pct(años[id], 0.9)).padEnd(14)} ${extra}`);
let ok = true;
console.log("\n\n  hito                p10            mediana        p90            ventana de la mediana");
for (const [id, a, b] of VENTANAS) {
  const med = pct(años[id], 0.5), bien = med >= a && med <= b;
  ok = ok && bien;
  fila(bien ? "✓" : "✗", id, `${fmt(a)} … ${fmt(b)}`);
}
for (const id of SIN_VENTANA) fila("·", id, "(solo para comparar)");
const medPob = pct(poblaciones, 0.5), pobBien = medPob >= 3e9 && medPob <= 15e9;
const contBien = completas / n >= 0.8, tMed = pct(tiempos, 0.5), tBien = tMed < 2000;
ok = ok && pobBien && contBien && tBien;
console.log(`${pobBien ? "✓" : "✗"} población en ${P}: mediana ${(medPob / 1e9).toFixed(2)} mil millones (ventana 3–15)`);
console.log(`${contBien ? "✓" : "✗"} llegan a todos los continentes habitados: ${completas}/${n} partidas (mínimo 80 %)`);
console.log(`${tBien ? "✓" : "✗"} tiempo por partida: mediana ${Math.round(tMed)} ms (máximo 2000)`);
process.exit(ok ? 0 : 1);
