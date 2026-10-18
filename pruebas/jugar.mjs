// Prueba de juego de "Tu pueblo": partidas completas con el mapa real y jugadores automáticos (siempre la primera opción,
// siempre la segunda, al azar), comparadas con los criterios del plan. Mide además, con las mismas semillas y en la misma
// corrida, partidas del modo Historia para comparar el tiempo.
// Uso: node pruebas/jugar.mjs [partidas=30]   (sale con código 1 si algo no cumple)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const MUNDO = require("../poblacion/mundo.js"), HISTORIA = require("../poblacion/datos.js"), Motor = require("../poblacion/motor.js");
const Pueblo = require("../poblacion/pueblo.js"), PUEBLO = require("../poblacion/pueblo-datos.js");

const n = Number(process.argv[2] || 30);
const P = HISTORIA.presente;

// Generador sembrado del jugador al azar (mulberry32, el mismo que el del motor; no toca el azar de la partida)
function generador(semilla) {
  let st = semilla >>> 0;
  return () => {
    let t = st = (st + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const POLITICAS = {
  primera: () => () => 0,
  segunda: () => d => Math.min(1, d.opciones.length - 1),
  azar: s => { const r = generador(s * 7919 + 17); return d => Math.floor(r() * d.opciones.length); }
};

// Una partida de tu pueblo, paso a paso como Partida (los mismos pasos que la calibración), decidiendo en cada pausa
function jugar(semilla, origen, decide) {
  const m = Motor.crear(MUNDO, HISTORIA, { semilla, pueblo: { origen } });
  const pb = Pueblo.crear(m, HISTORIA, PUEBLO, { origen });
  while (!m.terminado()) {
    m.avanzar(Math.min(m.pasoMax(), P - m.año()));
    const d = pb.revisar();
    if (d) pb.elegir(d.opciones[decide(d)].id);
  }
  const r = pb.resumen();
  return { decisiones: r.decisiones, vivo: r.estado === "vivo", herencia: r.estado === "extinto" ? 0 : r.herencia, estado: r.estado };
}
function historia(semilla) {
  const m = Motor.crear(MUNDO, HISTORIA, { semilla });
  m.avanzar(P - HISTORIA.inicio);
}

const res = Object.fromEntries(Object.keys(POLITICAS).map(k => [k, { decisiones: [], vivos: 0, herencias: [], ms: [], estados: {} }]));
const msHistoria = [];
for (let s = 1; s <= n; s++) {
  const origen = (s - 1) % 3;   // partida % 3, contando desde 0
  // Historia con la misma semilla, intercalada para que el ruido de la máquina afecte igual a ambos modos
  let t0 = performance.now();
  historia(s);
  msHistoria.push(performance.now() - t0);
  for (const [k, pol] of Object.entries(POLITICAS)) {
    t0 = performance.now();
    const r = jugar(s, origen, pol(s));
    const x = res[k];
    x.ms.push(performance.now() - t0);
    x.decisiones.push(r.decisiones);
    x.herencias.push(r.herencia);
    if (r.vivo) x.vivos++;
    x.estados[r.estado] = (x.estados[r.estado] || 0) + 1;
  }
  process.stdout.write(".");
}

const pct = (arr, q) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
const mill = x => x >= 1e9 ? `${(x / 1e9).toFixed(2)} mil mill.` : x >= 1e6 ? `${(x / 1e6).toFixed(1)} mill.` : `${Math.round(x)}`;
const tH = pct(msHistoria, 0.5), tope = 1.15 * tH;
let ok = true;
console.log(`\n\n  política   decisiones p10/med/p90   vivos en ${P}   herencia final (mediana)   ms por partida (mediana)   finales`);
for (const [k, x] of Object.entries(res)) {
  const dMed = pct(x.decisiones, 0.5), tMed = pct(x.ms, 0.5);
  const dBien = dMed >= 8 && dMed <= 14, tBien = tMed <= tope;
  const vBien = k !== "azar" || (x.vivos / n >= 0.3 && x.vivos / n <= 0.85);
  const bien = dBien && tBien && vBien;
  ok = ok && bien;
  const fin = Object.entries(x.estados).map(([e, c]) => `${e} ${c}`).join(", ");
  console.log(`${bien ? "✓" : "✗"} ${k.padEnd(9)} ${`${pct(x.decisiones, 0.1)} / ${dMed} / ${pct(x.decisiones, 0.9)}`.padEnd(26)} ${`${x.vivos}/${n}`.padEnd(15)} ${mill(pct(x.herencias, 0.5)).padEnd(26)} ${String(Math.round(tMed)).padEnd(26)} ${fin}`);
}
const meds = Object.values(res).map(x => pct(x.herencias, 0.5)), mayor = Math.max(...meds), menor = Math.min(...meds);
const distintas = new Set(meds).size === meds.length && mayor >= 1.5 * menor && mayor > 0;
const az = res.azar.vivos / n, azBien = az >= 0.3 && az <= 0.85;
const tMax = Math.max(...Object.values(res).map(x => pct(x.ms, 0.5)));
ok = ok && distintas && azBien;
console.log(`${Object.values(res).every(x => { const d = pct(x.decisiones, 0.5); return d >= 8 && d <= 14; }) ? "✓" : "✗"} decisiones por partida (con el Nacimiento): mediana entre 8 y 14 en cada política`);
console.log(`${azBien ? "✓" : "✗"} jugador al azar: tu pueblo llega a ${P} en ${res.azar.vivos}/${n} partidas (ventana 30 %–85 %)`);
console.log(`${distintas ? "✓" : "✗"} herencia final: las medianas son distintas y la mayor es ${menor > 0 ? (mayor / menor).toFixed(2) : "∞"} veces la menor (mínimo 1,5)`);
console.log(`${tMax <= tope ? "✓" : "✗"} tiempo por partida: mediana de la política más lenta ${Math.round(tMax)} ms; modo Historia, mismas semillas y misma corrida: ${Math.round(tH)} ms (máximo ×1,15 = ${Math.round(tope)} ms; ${(tMax / tH).toFixed(2)}×)`);
process.exit(ok ? 0 : 1);
