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
  // Tu pueblo al final: 0 si se disolvió o se extinguió
  return { decisiones: r.decisiones, vivo: r.estado === "vivo", herencia: r.estado === "extinto" ? 0 : r.herencia, estado: r.estado,
    pueblo: r.estado === "vivo" ? r.pueblo : 0 };
}
function historia(semilla) {
  const m = Motor.crear(MUNDO, HISTORIA, { semilla });
  m.avanzar(P - HISTORIA.inicio);
}

const res = Object.fromEntries(Object.keys(POLITICAS).map(k => [k, { decisiones: [], vivos: 0, herencias: [], pueblos: [], ms: [], estados: {} }]));
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
    x.pueblos.push(r.pueblo);
    if (r.vivo) x.vivos++;
    x.estados[r.estado] = (x.estados[r.estado] || 0) + 1;
  }
  process.stdout.write(".");
}

// Tiempo: el mejor de 3 pares medidos aparte (Historia y las tres políticas con las mismas semillas, intercaladas en la misma
// corrida); en cada ronda, la razón es la de la política más lenta (suma de sus partidas sobre la suma de Historia)
const semT = Array.from({ length: Math.min(n, 5) }, (_, k) => k + 1), rondas = [];
for (let r = 0; r < 3; r++) {
  let sH = 0; const sP = Object.fromEntries(Object.keys(POLITICAS).map(k => [k, 0]));
  for (const s of semT) {
    let t0 = performance.now(); historia(s); sH += performance.now() - t0;
    for (const [k, pol] of Object.entries(POLITICAS)) { t0 = performance.now(); jugar(s, (s - 1) % 3, pol(s)); sP[k] += performance.now() - t0; }
  }
  rondas.push(Math.max(...Object.values(sP)) / sH);
  process.stdout.write("·");
}

const pct = (arr, q) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
const mill = x => x >= 1e9 ? `${(x / 1e9).toFixed(2)} mil mill.` : x >= 1e6 ? `${(x / 1e6).toFixed(1)} mill.` : `${Math.round(x)}`;
const tH = pct(msHistoria, 0.5);
const decBien = x => { const d = pct(x.decisiones, 0.5); return d >= 8 && d <= 14; };
let ok = true;
console.log(`

  política   decisiones p10/med/p90   vivos en ${P}   tu pueblo final (mediana)   herencia final (mediana, informativa)   ms por partida (mediana)   finales`);
for (const [k, x] of Object.entries(res)) {
  const vBien = k !== "azar" || (x.vivos / n >= 0.3 && x.vivos / n <= 0.85);
  const bien = decBien(x) && vBien;
  const fin = Object.entries(x.estados).map(([e, c]) => `${e} ${c}`).join(", ");
  console.log(`${bien ? "✓" : "✗"} ${k.padEnd(9)} ${`${pct(x.decisiones, 0.1)} / ${pct(x.decisiones, 0.5)} / ${pct(x.decisiones, 0.9)}`.padEnd(26)} ${`${x.vivos}/${n}`.padEnd(15)} ${mill(pct(x.pueblos, 0.5)).padEnd(27)} ${mill(pct(x.herencias, 0.5)).padEnd(39)} ${String(Math.round(pct(x.ms, 0.5))).padEnd(26)} ${fin}`);
}
// Las decisiones importan: por semilla (mismo origen), tu pueblo final de la política que más tiene sobre la que menos (al menos 1),
// mediana entre semillas; o la fracción de partidas vivas en ${P} difiere en 20 puntos o más entre dos políticas
const pols = Object.values(res);
const razones = Array.from({ length: n }, (_, s) => { const v = pols.map(x => x.pueblos[s]); return Math.max(...v) / Math.max(Math.min(...v), 1); });
const rMed = pct(razones, 0.5), vivos = pols.map(x => x.vivos / n), dVivos = Math.max(...vivos) - Math.min(...vivos);
const importan = rMed >= 1.5 || dVivos >= 0.2;
const az = res.azar.vivos / n, azBien = az >= 0.3 && az <= 0.85;
const tMejor = Math.min(...rondas), tBien = tMejor <= 1.15;
ok = ok && pols.every(decBien) && azBien && importan && tBien;
console.log(`${pols.every(decBien) ? "✓" : "✗"} decisiones por partida (con el Nacimiento): mediana entre 8 y 14 en cada política`);
console.log(`${azBien ? "✓" : "✗"} jugador al azar: tu pueblo llega a ${P} en ${res.azar.vivos}/${n} partidas (ventana 30 %–85 %)`);
console.log(`${importan ? "✓" : "✗"} las decisiones importan: por semilla, tu pueblo final de la mejor política sobre la peor (mín. 1) tiene mediana ${rMed >= 1e6 ? rMed.toExponential(1) : rMed.toFixed(2)} (mínimo 1,5); vivos en ${P}: ${pols.map(x => `${Math.round(100 * x.vivos / n)} %`).join(" / ")} (diferencia ${Math.round(100 * dVivos)} puntos; o al menos 20)`);
console.log(`${tBien ? "✓" : "✗"} tiempo por partida: mejor de 3 rondas pareadas (semillas ${semT[0]}–${semT[semT.length - 1]}, Historia y las tres políticas en la misma corrida): ${tMejor.toFixed(2)}× (rondas ${rondas.map(r => r.toFixed(2)).join(", ")}; máximo 1,15). Medianas de las ${n} partidas, informativas: Historia ${Math.round(tH)} ms`);
process.exit(ok ? 0 : 1);
