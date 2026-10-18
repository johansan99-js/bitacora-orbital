import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba, huella } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js");
const SIN_AZAR = { cruce: [0, 0, 0], costera: 0 };
const isla = () => mundoDePrueba(["000", "040", "000"], { lonOeste: -3 });
const tira = () => mundoDePrueba(["0000000", "0444440", "0000000"], { lonOeste: -7 });
// Tu pueblo en una punta de la tira y otro origen, con mucha más gente, en la otra. Sin crecimiento, así los tuyos de una
// celda solo pueden subir si llegan.
const QUIETOS = { ...SIN_AZAR, crecimiento: [0, 0, 0, 0, 0], exploracion: 0.01 };
const enfrentados = () => Motor.crear(tira(), historiaDePrueba({ origenes: [
  { nombre: "A", lat: 0, lon: -4, personas: 3000 }, { nombre: "B", lat: 0, lon: 4, personas: 30000 }
] }), { params: QUIETOS, pueblo: { origen: 0 } });

test("tu pueblo empieza con la gente de su origen", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 1000 }, { nombre: "B", lat: 0, lon: 4, personas: 2500 }] });
  const m = Motor.crear(tira(), h, { params: SIN_AZAR, pueblo: { origen: 1 } });
  const pb = m.pueblo(), i = m.celdaDe(0, 4);
  for (let j = 0; j < pb.tuyos.length; j++) if (j !== i) { assert.equal(pb.tuyos[j], 0); assert.equal(pb.linaje[j], 0); }
  assert.equal(pb.tuyos[i], 2500);
  assert.equal(pb.linaje[i], 1);
  assert.equal(pb.total(), 2500);
  assert.equal(pb.mayoria(i), true);
  assert.deepEqual(Array.from(pb.celdas()), [i]);
});

test("0 ≤ tuyos ≤ pob y 0 ≤ linaje ≤ 1 en todo paso", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -8, personas: 3000 }, { nombre: "B", lat: 0, lon: 8, personas: 3000 }] });
  const m = Motor.crear(mundoDePrueba(["00000000000", "04444444440", "00000000000"], { lonOeste: -11 }), h,
    { params: { ...SIN_AZAR, exploracion: 0.01 }, pueblo: { origen: 0 } });
  const { tuyos, linaje } = m.pueblo(), pob = m.celdas.poblacion;
  for (let s = 0; s < 200; s++) {
    m.avanzar(10);
    for (let i = 0; i < pob.length; i++) {
      assert.ok(tuyos[i] >= 0 && tuyos[i] <= pob[i], `tuyos ${tuyos[i]} con pob ${pob[i]} en ${i}`);
      assert.ok(linaje[i] >= 0 && linaje[i] <= 1, `linaje ${linaje[i]} en ${i}`);
    }
  }
  assert.ok(m.pueblo().total() > 0);
});

test("tu pueblo solo emigra a celdas vacías o donde es mayoría", () => {
  const m = enfrentados(), pb = m.pueblo(), pob = m.celdas.poblacion, N = pob.length;
  const ajenas = new Uint8Array(N), antes = new Float64Array(N);
  let vistas = 0;
  for (let s = 0; s < 300; s++) {
    for (let i = 0; i < N; i++) { ajenas[i] = pob[i] > 0 && !pb.mayoria(i) ? 1 : 0; antes[i] = pb.tuyos[i]; }
    m.avanzar(10);
    for (let i = 0; i < N; i++) if (ajenas[i]) {
      vistas++;
      // Con r = 0 el crecimiento puede mover el último decimal; un grupo que llega trae al menos `minimo` personas
      assert.ok(pb.tuyos[i] <= antes[i] * (1 + 1e-12), `la celda ${i} recibió tuyos en el paso ${s}`);
    }
  }
  assert.ok(vistas > 0);
});

test("la herencia se mezcla con todos", () => {
  const m = enfrentados(), pb = m.pueblo(), pob = m.celdas.poblacion;
  m.avanzar(3000);
  let mezcladas = 0;
  for (let i = 0; i < pob.length; i++) if (pob[i] > 0 && pb.tuyos[i] === 0 && pb.linaje[i] > 0 && pb.linaje[i] < 1) mezcladas++;
  assert.ok(mezcladas > 0);
  assert.ok(pb.herencia() > 0);
  assert.ok(pb.conLinaje() > pb.total());
});

test("tus grupos chicos se asimilan", () => {
  // Las dos poblaciones en la misma celda: los tuyos son el 10 %, por debajo de `asimila`
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 100 }, { nombre: "B", lat: 0, lon: 0, personas: 900 }] });
  const m = Motor.crear(isla(), h, { params: SIN_AZAR, pueblo: { origen: 0 } });
  const pb = m.pueblo(), i = m.celdaDe(0, 0);
  assert.ok(pb.tuyos[i] > 0 && pb.tuyos[i] < Motor.PARAMS.asimila * m.celdas.poblacion[i]);
  const l = pb.linaje[i];
  m.avanzar(10);
  assert.equal(pb.tuyos[i], 0);
  assert.equal(pb.linaje[i], l);
  assert.ok(m.celdas.poblacion[i] > 0);
});

test("una celda vaciada pierde tuyos y linaje", () => {
  const h = historiaDePrueba({
    nivelMar: [[-1e7, 0], [-19000, 0], [-18000, -125], [3000, -125]],
    hielo: [{ nombre: "Todo", gMin: 0.5, cajas: [[-90, 90, -180, 180]] }],
    origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 500 }]
  });
  const m = Motor.crear(isla(), h, { params: SIN_AZAR, pueblo: { origen: 0 } });
  const pb = m.pueblo(), i = m.celdaDe(0, 0);
  m.avanzar(500);
  assert.ok(pb.tuyos[i] > 0 && pb.linaje[i] === 1);
  m.avanzar(2000);
  assert.equal(m.celdas.poblacion[i], 0);
  assert.equal(pb.tuyos[i], 0);
  assert.equal(pb.linaje[i], 0);
});

test("perderPueblo quita gente de tu pueblo y de la celda", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }, { nombre: "B", lat: 0, lon: 4, personas: 3000 }] });
  const m = Motor.crear(tira(), h, { params: { ...SIN_AZAR, exploracion: 0.01 }, pueblo: { origen: 0 } });
  m.avanzar(500);
  const pb = m.pueblo(), t0 = pb.total(), p0 = m.poblacionTotal();
  m.perderPueblo(0.3);
  const t1 = pb.total(), p1 = m.poblacionTotal();
  assert.ok(Math.abs((t0 - t1) - 0.3 * t0) < 1e-6 * t0);
  assert.ok(Math.abs((t0 - t1) - (p0 - p1)) < 1e-6 * p0);
});

test("el cruce de mar lleva tuyos y linaje en proporción", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -2, personas: 3000 }] });
  const m = Motor.crear(mundoDePrueba(["00000", "04040", "00000"]), h, { params: { costera: 0, cruce: [1, 1, 1], saberMar: 0 }, pueblo: { origen: 0 } });
  const pb = m.pueblo(), j = m.celdaDe(0, 2);
  m.avanzar(100);
  assert.ok(m.celdas.poblacion[j] > 0);
  assert.ok(pb.tuyos[j] > 0);
  assert.ok(Math.abs(pb.linaje[j] - 1) < 1e-6);
});

test("misma semilla y mismo origen, misma partida", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }, { nombre: "B", lat: 0, lon: 4, personas: 3000 }] });
  const jugar = () => {
    const m = Motor.crear(mundoDePrueba(["0000000", "0404040", "0000000"], { lonOeste: -7 }), h,
      { semilla: 7, params: { cruce: [0.01, 0.01, 0.01], saberMar: 0 }, pueblo: { origen: 1 } });
    m.avanzar(2000);
    return [huella(m), Array.from(m.pueblo().tuyos).join()];
  };
  assert.deepEqual(jugar(), jugar());
});

// --- Modificadores de tu pueblo ---
const juntos = () => historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 500 }, { nombre: "B", lat: 0, lon: 0, personas: 500 }] });
const conMods = (mundo, h, mods, opciones = {}) => {
  const m = Motor.crear(mundo, h, { params: SIN_AZAR, ...opciones, pueblo: { origen: 0 } });
  m.setModificadores(mods);
  return m;
};
const ARCAICOS = [{ id: "n", nombre: "N", hito: null, cajas: [[-90, 90, 1, 180]], fuente: "prueba" }];
const larga = () => mundoDePrueba(["0000000000000", "0444444444440", "0000000000000"], { lonOeste: -13 });

test("la aptitud reparte sin cambiar el total", () => {
  const neutro = conMods(isla(), juntos(), Motor.MODS_NEUTROS);
  const apto = conMods(isla(), juntos(), { aptitud: [{ donde: {}, valor: 2 }] });
  neutro.avanzar(2000); apto.avanzar(2000);
  assert.equal(apto.poblacionTotal(), neutro.poblacionTotal());
  assert.ok(apto.pueblo().total() > neutro.pueblo().total() * 1.5);
});

test("la aptitud solo actúa donde se cumple", () => {
  const neutro = conMods(isla(), juntos(), Motor.MODS_NEUTROS);
  const desierto = conMods(isla(), juntos(), { aptitud: [{ donde: { biomas: [Motor.BIOMA.DESIERTO] }, valor: 2 }] });
  neutro.avanzar(2000); desierto.avanzar(2000);
  assert.deepEqual(Array.from(desierto.pueblo().tuyos), Array.from(neutro.pueblo().tuyos));
});

test("la capacidad cambia la gente de tus celdas", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 1000 }] });
  const neutro = conMods(isla(), h, Motor.MODS_NEUTROS), doble = conMods(isla(), h, { capacidad: [{ donde: {}, valor: 2 }] });
  neutro.avanzar(2000); doble.avanzar(2000);
  const i = neutro.celdaDe(0, 0);
  assert.ok(doble.celdas.poblacion[i] > 1.5 * neutro.celdas.poblacion[i]);
});

test("migración propia", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -10, personas: 3000 }] });
  const lenta = conMods(larga(), h, { migracion: 1 }), rapida = conMods(larga(), h, { migracion: 3 });
  lenta.avanzar(1000); rapida.avanzar(1000);
  assert.ok(rapida.pueblo().celdas().length > lenta.pueblo().celdas().length,
    `${rapida.pueblo().celdas().length} contra ${lenta.pueblo().celdas().length}`);
});

test("evitar a los arcaicos", () => {
  const h = historiaDePrueba({ arcaicos: ARCAICOS, origenes: [{ nombre: "A", lat: 0, lon: -10, personas: 3000 }] });
  const params = { ...SIN_AZAR, exploracion: 0.01, ritmoRec: 100, saberArcaico: 50, desplaza: 0.0005 };
  const contar = mods => {
    const m = conMods(larga(), h, mods, { params });
    const { tuyos } = m.pueblo(), arc = m.celdas.arcaicos;
    let entradas = 0;
    for (let s = 0; s < 300; s++) { m.avanzar(10); for (let i = 0; i < arc.length; i++) if (arc[i] > 0 && tuyos[i] > 0) entradas++; }
    return entradas;
  };
  assert.ok(contar(Motor.MODS_NEUTROS) > 0);   // sin evitarlos, sí entran
  assert.equal(contar({ evitaArcaicos: true }), 0);
});

test("competir desplaza más rápido y cuesta gente", () => {
  const h = historiaDePrueba({ arcaicos: ARCAICOS, origenes: [{ nombre: "A", lat: 0, lon: -10, personas: 3000 }] });
  const params = { ...SIN_AZAR, exploracion: 0.01, ritmoRec: 100, saberArcaico: 50, desplaza: 0.0005 };
  const neutro = conMods(larga(), h, Motor.MODS_NEUTROS, { params });
  const compite = conMods(larga(), h, { desplaza: 3, perdidaArcaicos: 0.001 }, { params });
  neutro.avanzar(2000); compite.avanzar(2000);
  const arcTotal = m => m.celdas.arcaicos.reduce((a, b) => a + b, 0);
  assert.ok(arcTotal(compite) < arcTotal(neutro), `${arcTotal(compite)} contra ${arcTotal(neutro)}`);
  assert.ok(compite.pueblo().total() < neutro.pueblo().total(), `${compite.pueblo().total()} contra ${neutro.pueblo().total()}`);
});

test("las epidemias cuestan gente en tus celdas urbanas", () => {
  // Tres celdas agrícolas llenas (las ciudades necesitan vecinas agrícolas); tu pueblo, en la del medio
  const h = historiaDePrueba({ inicio: -9600, domesticables: [{ id: "todo", nombre: "Todo", riqueza: 1, cajas: [[-90, 90, -180, 180]] }],
    origenes: [0, -2, 2].map(lon => ({ nombre: `C${lon}`, lat: 0, lon, personas: 6000 })) });
  const params = { ...SIN_AZAR, exploracion: 0, presion: 0, agricultura: 1, ciudades: 1, densidadCiudad: 1 };
  const tres = () => mundoDePrueba(["00000", "04440", "00000"]);
  const neutro = conMods(tres(), h, Motor.MODS_NEUTROS, { params }), enferma = conMods(tres(), h, { epidemia: 0.001 }, { params });
  neutro.avanzar(3000); enferma.avanzar(3000);
  const i = neutro.celdaDe(0, 0);
  assert.ok(neutro.celdas.innovaciones[i] & Motor.INNOVACION.CIUDADES);
  assert.ok(enferma.pueblo().total() < 0.9 * neutro.pueblo().total(), `${enferma.pueblo().total()} contra ${neutro.pueblo().total()}`);
});

test("una innovación bloqueada no aparece en tus celdas", () => {
  const { AGRICULTURA } = Motor.INNOVACION;
  // Tu pueblo a la izquierda; los demás, en las otras dos celdas, cultivan y la contagian
  const h = historiaDePrueba({ inicio: -9600, domesticables: [{ id: "todo", nombre: "Todo", riqueza: 1, cajas: [[-90, 90, -180, 180]] }],
    origenes: [-2, 0, 2].map(lon => ({ nombre: `C${lon}`, lat: 0, lon, personas: 6000 })) });
  const params = { ...SIN_AZAR, exploracion: 0, presion: 0, agricultura: 1, contagio: { 1: 0, 2: 0.01, 4: 0, 8: 0, 16: 0, 32: 0 } };
  const jugar = mods => {
    const m = conMods(mundoDePrueba(["00000", "04440", "00000"]), h, mods, { params });
    m.avanzar(5000);
    const pb = m.pueblo(), v = m.celdas.innovaciones;
    const mias = Array.from(pb.celdas()).filter(i => pb.mayoria(i));
    assert.ok(mias.length > 0);
    return { mias: mias.some(i => v[i] & AGRICULTURA), otras: (v[m.celdaDe(0, 2)] & AGRICULTURA) !== 0 };
  };
  assert.deepEqual(jugar({ bloqueo: AGRICULTURA }), { mias: false, otras: true });
  assert.deepEqual(jugar(Motor.MODS_NEUTROS), { mias: true, otras: true });
});

test("los cruces propios mueven solo a los tuyos, con su propio azar", () => {
  // Tus 2.000 con otros 1.000 en la costa: un cruce normal llevaría a ambos
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -2, personas: 2000 }, { nombre: "B", lat: 0, lon: -2, personas: 1000 }] });
  const params = { costera: 0, cruce: [1e-4, 1e-4, 1e-4], saberMar: 0 };
  const jugar = cruce => {
    const m = conMods(mundoDePrueba(["00000", "04040", "00000"]), h, { cruce }, { semilla: 5, params });
    const j = m.celdaDe(0, 2), pob = m.celdas.poblacion, { tuyos } = m.pueblo();
    let primero = null;
    for (let s = 0; s < 100; s++) {
      m.avanzar(10);
      if (primero === null && pob[j] > 0) primero = [pob[j], tuyos[j]];
    }
    return { m, primero };
  };
  assert.equal(jugar(1).primero, null);   // los cruces normales casi no ocurren
  const { primero } = jugar(1001);
  assert.ok(primero !== null, "nunca cruzaron");
  assert.ok(primero[1] > 0 && Math.abs(primero[0] - primero[1]) < 1e-9 * primero[0], `pob ${primero[0]}, tuyos ${primero[1]}`);
  const a = jugar(1001).m, b = jugar(1001).m;
  assert.equal(huella(a), huella(b));
  assert.deepEqual(Array.from(a.pueblo().tuyos), Array.from(b.pueblo().tuyos));
});

test("perderPueblo baja la herencia", () => {
  // Mitad tuyos y mitad otros en la misma celda (linaje 0,5): los muertos se llevan linaje 1
  const m = Motor.crear(isla(), juntos(), { params: SIN_AZAR, pueblo: { origen: 0 } });
  const pb = m.pueblo(), i = m.celdaDe(0, 0);
  assert.equal(pb.linaje[i], 0.5);
  const t0 = pb.total(), h0 = pb.herencia();
  m.perderPueblo(0.3);
  const perdidos = t0 - pb.total();
  assert.ok(Math.abs(perdidos - 150) < 1e-9);
  assert.ok(Math.abs((h0 - pb.herencia()) - perdidos) < 1e-4 * perdidos, `herencia ${h0 - pb.herencia()} contra ${perdidos}`);
});

test("sin pueblo, setModificadores no hace nada", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }] });
  const jugar = conMods => {
    const m = Motor.crear(tira(), h, { semilla: 3, params: { exploracion: 0.01 } });
    if (conMods) m.setModificadores({ aptitud: [{ donde: {}, valor: 5 }], capacidad: [{ donde: {}, valor: 3 }], migracion: 4, cruce: 9, bloqueo: 63 });
    m.avanzar(2000);
    return huella(m);
  };
  assert.equal(jugar(true), jugar(false));
});
