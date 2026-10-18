// Calibración: corre partidas completas con el mapa real y compara sus hitos con las ventanas de la spec.
// Uso: node pruebas/calibrar.mjs [partidas=30] [--sin-tiempo] [--comparar]   (sale con código 1 si algo no cumple)
//   --sin-tiempo  no muestra ni exige el tiempo por partida (en un runner compartido daría rojos falsos)
//   --comparar    además exige que el informe sea idéntico a pruebas/referencias/calibrar.txt (implica --sin-tiempo).
//                 Esa referencia se regenera, solo cuando Historia cambia a propósito, con:
//                 node pruebas/calibrar.mjs --sin-tiempo > pruebas/referencias/calibrar.txt
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
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
  ["industria", 1500, 1900],
  ["mil_millones", 1500, 1950]
];
const SIN_VENTANA = ["neandertales", "polinesia", "nueva_zelanda"];   // se muestran para comparar
const CONTINENTES = ["asia", "europa", "sahul", "norteamerica", "sudamerica"];
const args = process.argv.slice(2), opciones = new Set(args.filter(a => a.startsWith("--")));
const comparar = opciones.has("--comparar"), sinTiempo = comparar || opciones.has("--sin-tiempo");
const n = Number(args.find(a => !a.startsWith("--")) || 30);
const años = Object.fromEntries([...VENTANAS.map(([id]) => id), ...SIN_VENTANA].map(id => [id, []]));
const poblaciones = [], tiempos = [];
let completas = 0, industriales = 0;

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
  if (h.has("industria")) industriales++;
  poblaciones.push(m.poblacionTotal());
  process.stderr.write(".");   // el progreso va aparte: la salida estándar es solo el informe
}

const pct = (arr, q) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
const fmt = a => a === Infinity ? "nunca" : a < -10000 ? `hace ${Math.round((P - a) / 1000)} mil` : a < 0 ? `${-Math.round(a)} a. C.` : `${Math.round(a)}`;
const informe = [], escribir = linea => { informe.push(linea); console.log(linea); };
const fila = (marca, id, extra) => escribir(`${marca} ${id.padEnd(18)} ${fmt(pct(años[id], 0.1)).padEnd(14)} ${fmt(pct(años[id], 0.5)).padEnd(14)} ${fmt(pct(años[id], 0.9)).padEnd(14)} ${extra}`);
let ok = true;
process.stderr.write("\n");
escribir("  hito                p10            mediana        p90            ventana de la mediana");
for (const [id, a, b] of VENTANAS) {
  const med = pct(años[id], 0.5), bien = med >= a && med <= b;
  ok = ok && bien;
  fila(bien ? "✓" : "✗", id, `${fmt(a)} … ${fmt(b)}`);
}
for (const id of SIN_VENTANA) fila("·", id, "(solo para comparar)");
const medPob = pct(poblaciones, 0.5), pobBien = medPob >= 3e9 && medPob <= 15e9;
const contBien = completas / n >= 0.8, indBien = industriales / n >= 0.8, tMed = pct(tiempos, 0.5), tBien = tMed < 2000;
ok = ok && pobBien && contBien && indBien && (sinTiempo || tBien);
escribir(`${pobBien ? "✓" : "✗"} población en ${P}: mediana ${(medPob / 1e9).toFixed(2)} mil millones (ventana 3–15)`);
escribir(`${contBien ? "✓" : "✗"} llegan a todos los continentes habitados: ${completas}/${n} partidas (mínimo 80 %)`);
escribir(`${indBien ? "✓" : "✗"} llegan a la industria: ${industriales}/${n} partidas (mínimo 80 %)`);
// El tiempo depende de la máquina: queda fuera del informe que se compara con la referencia
if (!sinTiempo) console.log(`${tBien ? "✓" : "✗"} tiempo por partida: mediana ${Math.round(tMed)} ms (máximo 2000)`);
if (comparar) {
  const esperado = readFileSync(new URL("./referencias/calibrar.txt", import.meta.url), "utf8").replace(/\r\n/g, "\n").trimEnd().split("\n");
  const i = Array.from({ length: Math.max(esperado.length, informe.length) }, (_, k) => k).find(k => esperado[k] !== informe[k]);
  if (i === undefined) console.log("✓ informe idéntico a pruebas/referencias/calibrar.txt");
  else {
    ok = false;
    console.log(`✗ el informe no coincide con pruebas/referencias/calibrar.txt en la línea ${i + 1}`);
    console.log(`  esperada: ${esperado[i] ?? "(nada)"}`);
    console.log(`  obtenida: ${informe[i] ?? "(nada)"}`);
  }
}
process.exit(ok ? 0 : 1);
