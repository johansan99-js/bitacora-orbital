# La Tierra habitada: motor de población y modo Historia — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a la Bitácora Orbital la escala "La Tierra", donde la humanidad nace hace 300.000 años en África y evoluciona sola por el planeta real, comparando cada hito con la historia real.

**Architecture:** Seis scripts clásicos nuevos en `poblacion/` (cada uno define un global): `mundo.js` (mapa generado), `datos.js` (datos reales), `motor.js` (simulación pura, sin DOM ni three.js), `partida.js` (reloj y pausas), `vista.js` (escena three.js) y `panel.js` (interfaz). `index.html` registra la escala como `LV.tierra` dentro de `Space` y conecta el reloj, el muelle y las capas existentes. El motor y la partida se prueban en Node con `node --test` y se calibran contra la historia real con `node pruebas/calibrar.mjs`.

**Tech Stack:** HTML + JavaScript sin compilación, three.js r128 (ya cargado desde cdnjs), Node 24 (pruebas), Python 3 + Pillow (solo para generar el mapa).

**Spec:** [docs/superpowers/specs/2026-10-14-poblacion-historia-design.md](../specs/2026-10-14-poblacion-historia-design.md)

**Ajustes respecto a la spec** (decididos al planificar):
- El reloj, las pausas y el fin de partida viven en un archivo propio, `poblacion/partida.js` (`Partida`), para probarlos en Node sin DOM. La spec ya lo lista.
- `MUNDO` acepta `latNorte` y `lonOeste` opcionales (por defecto 90 y −180) para que las pruebas usen mundos pequeños en el ecuador.
- Los continentes del muelle (`HISTORIA.continentes`) y sus fichas se definen en `datos.js`.

## Global Constraints

- La app no gana dependencias: solo three.js r128 (ya está), sin módulos ES ni compilación. Cada archivo de `poblacion/` es un script clásico que define **un** global y termina con `if (typeof module !== "undefined") module.exports = <Global>;`.
- Pruebas con Node 24 (`node --test "pruebas/*.test.mjs"`); Python 3 + Pillow solo para `herramientas/generar_mundo.py`.
- Todo texto visible en español; los números se formatean con `toLocaleString("es")`.
- Años en calendario: negativo = antes de Cristo. "hace N años" = 2026 − año. Presente = 2026; inicio = −298000.
- Modo Historia realista: ningún resultado se fuerza por fecha. La única condición de fecha es el Holoceno (−9674) para la agricultura, porque es clima real. Las probabilidades de innovar crecen con densidad, conexiones y saber, nunca con un tiempo de espera.
- Rendimiento: la simulación usa ~3 ms por cuadro como máximo; una partida completa sin dibujo tarda menos de 2 s.
- Si algo de `poblacion/` falla, el resto de la Bitácora funciona igual.
- A ancho de celular (375 px): margen lateral de 16 px y sin scroll horizontal.
- Todo el trabajo va en la rama `feat/poblacion-historia`. Cada mensaje de commit termina con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Cada dato real de `datos.js` lleva su fuente en un comentario o en el campo `fuente`.

## Review Focus

1. **Extinción:** si la población total llega a 0, la partida avisa "Tu humanidad se extinguió" y termina, en lugar de quedarse congelada. Pruebas en la Tarea 4 (motor) y la Tarea 6 (partida).
2. **Varios hitos en el mismo cuadro:** todos se muestran, en el orden en que ocurrieron, uno tras otro. Prueba en la Tarea 6.
3. **Llegar al presente:** el reloj se detiene exactamente en 2026, "reanudar" no hace nada y se abre la Bitácora. Prueba en la Tarea 6 y comprobación en el navegador en la Tarea 9.
4. **Nueva partida con un aviso abierto:** el aviso se cierra y la cola de hitos queda vacía. Prueba en la Tarea 6 y comprobación en el navegador en la Tarea 9.
5. **Salir de la escala y volver:** la partida no avanza mientras no se ve; al volver sigue donde estaba, con su aviso pendiente. Garantizado porque `update` solo corre en la escala activa (Tarea 8); comprobación en el navegador en la Tarea 9.

---

### Task 1: Mapa del mundo

**Files:**
- Create: `herramientas/generar_mundo.py`
- Create (generado): `poblacion/mundo.js`
- Test: `pruebas/mundo.test.mjs`

**Interfaces:**
- Consumes: `tex/earth_spec.jpg` (1024 × 512, océano claro) y `tex/earth_day.jpg` (2048 × 1024).
- Produces: global `MUNDO = { ancho: 180, alto: 90, grados: 2, bioma: string(16200), tierra: string(16200) }`. `bioma[i]` es un dígito: 0 mar, 1 hielo, 2 tundra, 3 desierto, 4 estepa, 5 bosque, 6 selva. `tierra[i]` es la fracción de tierra en décimos (0 = mar, 3–9; 9 significa 90 % o más). Celda `i = fila * 180 + columna`; fila 0 = latitud 90°–88° N, columna 0 = longitud 180°–178° O.

- [ ] **Step 1: Escribir la prueba que falla**

`pruebas/mundo.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const MUNDO = require("../poblacion/mundo.js");
const celda = (lat, lon) => Math.floor((90 - lat) / 2) * 180 + Math.floor((lon + 180) / 2);

test("la cuadrícula tiene 180 × 90 celdas de dígitos válidos", () => {
  assert.equal(MUNDO.ancho * MUNDO.alto, 16200);
  assert.equal(MUNDO.bioma.length, 16200);
  assert.equal(MUNDO.tierra.length, 16200);
  assert.match(MUNDO.bioma, /^[0-6]+$/);
  assert.match(MUNDO.tierra, /^[0-9]+$/);
});

test("lugares conocidos tienen el bioma esperado", () => {
  assert.equal(MUNDO.bioma[celda(0, -150)], "0");   // océano Pacífico
  assert.equal(MUNDO.bioma[celda(23, 10)], "3");    // Sahara
  assert.equal(MUNDO.bioma[celda(-5, -62)], "6");   // Amazonas
  assert.equal(MUNDO.bioma[celda(75, -40)], "1");   // Groenlandia
  assert.equal(MUNDO.bioma[celda(60, 100)], "5");   // taiga de Siberia
});

test("una celda es mar si y solo si no tiene tierra", () => {
  for (let i = 0; i < 16200; i++) assert.equal(MUNDO.bioma[i] === "0", MUNDO.tierra[i] === "0", `celda ${i}`);
});
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Run: `node --test pruebas/mundo.test.mjs`
Expected: FAIL con `Cannot find module '../poblacion/mundo.js'`.

- [ ] **Step 3: Escribir el generador**

`herramientas/generar_mundo.py`:

```python
"""Genera poblacion/mundo.js: el mapa de celdas de 2° × 2° que usa la simulación de población.

Lee dos texturas de la Tierra que ya usa la app:
  - tex/earth_spec.jpg: el océano es claro y la tierra oscura → qué parte de cada celda es tierra firme
  - tex/earth_day.jpg: el color de la superficie → el bioma de cada celda

Uso, desde la raíz del repositorio (requiere Pillow: pip install pillow):
    python herramientas/generar_mundo.py
"""
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ANCHO, ALTO, MUESTRAS = 180, 90, 4  # celdas y muestras por lado de cada celda
MAR, HIELO, TUNDRA, DESIERTO, ESTEPA, BOSQUE, SELVA = range(7)


def bioma(r, g, b, lat):
    """Clasifica el color medio de la tierra de una celda. Umbrales elegidos mirando la textura:
    hielo blanco, desierto arena, sabana y estepa pardas (más rojo que azul), bosque y selva oscuros."""
    luz = (r + g + b) / 3
    if luz >= 200 and b >= 190:
        return HIELO
    if r >= 170 and r > b + 40:
        return DESIERTO
    if abs(lat) >= 64:
        return TUNDRA
    if r > b + 10:
        return ESTEPA
    return SELVA if abs(lat) < 15 else BOSQUE


def generar():
    n = MUESTRAS
    spec = Image.open(RAIZ / "tex/earth_spec.jpg").convert("L").resize((ANCHO * n, ALTO * n), Image.BOX)
    dia = Image.open(RAIZ / "tex/earth_day.jpg").convert("RGB").resize((ANCHO * n, ALTO * n), Image.BOX)
    biomas, fracciones = [], []
    for fila in range(ALTO):
        lat = 90 - (fila + 0.5) * 2
        fb, ff = [], []
        for col in range(ANCHO):
            tierra = r = g = b = 0
            for dy in range(n):
                for dx in range(n):
                    x, y = col * n + dx, fila * n + dy
                    if spec.getpixel((x, y)) < 128:
                        pr, pg, pb = dia.getpixel((x, y))
                        tierra += 1
                        r += pr
                        g += pg
                        b += pb
            frac = tierra / (n * n)
            if frac < 0.3:
                fb.append(MAR)
                ff.append(0)
            else:
                fb.append(bioma(r / tierra, g / tierra, b / tierra, lat))
                ff.append(min(9, round(frac * 10)))
        biomas.append("".join(map(str, fb)))
        fracciones.append("".join(map(str, ff)))
    return biomas, fracciones


def escribir(biomas, fracciones):
    def filas(lista):
        return ",\n".join(f'    "{f}"' for f in lista)

    js = f"""// Generado por herramientas/generar_mundo.py a partir de tex/earth_spec.jpg y tex/earth_day.jpg. No editar a mano.
// Cuadrícula de {ANCHO} × {ALTO} celdas de 2° × 2°. Fila 0 = latitud 90° a 88° N; columna 0 = longitud 180° a 178° O.
const MUNDO = {{
  ancho: {ANCHO}, alto: {ALTO}, grados: 2,
  // Un carácter por celda: 0 mar, 1 hielo, 2 tundra, 3 desierto, 4 estepa, 5 bosque, 6 selva
  bioma: [
{filas(biomas)}
  ].join(""),
  // Fracción de tierra firme de cada celda en décimos (0 = mar; 9 = 90 % o más)
  tierra: [
{filas(fracciones)}
  ].join("")
}};
if (typeof module !== "undefined") module.exports = MUNDO;
"""
    (RAIZ / "poblacion").mkdir(exist_ok=True)
    (RAIZ / "poblacion/mundo.js").write_text(js, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    escribir(*generar())
    print("poblacion/mundo.js listo")
```

- [ ] **Step 4: Generar el mapa**

Run: `python herramientas/generar_mundo.py`
Expected: imprime `poblacion/mundo.js listo` y el archivo pesa unos 33 KB.

- [ ] **Step 5: Correr la prueba y ver que pasa**

Run: `node --test pruebas/mundo.test.mjs`
Expected: PASS (3 pruebas).

- [ ] **Step 6: Commit**

```bash
git add herramientas/generar_mundo.py poblacion/mundo.js pruebas/mundo.test.mjs
git commit -m "Mapa del mundo en celdas de 2° para la simulación de población" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Datos reales

**Files:**
- Create: `poblacion/datos.js`
- Test: `pruebas/datos.test.mjs`

**Interfaces:**
- Consumes: nada (solo datos). La prueba usa `MUNDO` (Tarea 1).
- Produces: global `HISTORIA` con estos campos (el motor, la partida, la vista y el panel los leen):
  - `presente: 2026`, `inicio: -298000`, `holoceno: -9674`
  - `nivelMar: [[año, metros], ...]` ascendente por año
  - `velocidades: [[desde, añosPorSegundo], ...]`, `pasos: [[desde, años], ...]`
  - `puentes: [{ id, nombre, umbral, bioma, cajas }]`, `hielo: [{ nombre, gMin, cajas }]`, `humedos: { cajas, tramos: [[a, b], ...] }`, `rios: [{ nombre, cajas }]`
  - `domesticables: [{ id, nombre, riqueza, cajas }]`, `islas: [{ nombre, lat, lon, km2, bioma }]`
  - `regiones: [{ id, nombre, hito, cajas }]` (orden = prioridad: gana la primera caja que contiene la celda)
  - `origenes: [{ nombre, lat, lon, personas }]`
  - `hitos: [{ id, titulo, corto, real: [a, b] | null, texto, fuente }]`
  - `poblacionReal: [[año, mínimo, máximo], ...]`
  - `continentes: [{ id, nombre, tipo, lat, lon, color, regiones, hitos, lede, facts, stats }]`
  - Una caja es `[latMín, latMáx, lonMín, lonMáx]` sobre el **centro** de la celda.

- [ ] **Step 1: Escribir la prueba que falla**

`pruebas/datos.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const H = require("../poblacion/datos.js"), MUNDO = require("../poblacion/mundo.js");
const ascendente = t => t.every((f, k) => k === 0 || f[0] > t[k - 1][0]);

test("las tablas de tiempo están ordenadas y cubren toda la partida", () => {
  for (const t of [H.nivelMar, H.velocidades, H.pasos, H.poblacionReal]) {
    assert.ok(ascendente(t));
    assert.ok(t[0][0] <= H.inicio);
  }
  assert.ok(H.nivelMar.at(-1)[0] >= H.presente);
  assert.ok(H.poblacionReal.at(-1)[0] >= H.presente);
  for (const [a, b] of H.humedos.tramos) assert.ok(a < b);
});

test("cada hito tiene textos, fuente y una fecha real válida", () => {
  for (const h of H.hitos) {
    assert.ok(h.titulo && h.corto && h.texto, h.id);
    if (h.id === "extincion") { assert.equal(h.real, null); continue; }
    assert.ok(h.fuente, h.id);
    assert.ok(h.real[0] <= h.real[1], h.id);
  }
});

test("los hitos que nombran regiones, domesticables y continentes existen", () => {
  const ids = new Set(H.hitos.map(h => h.id));
  for (const r of H.regiones) if (r.hito) assert.ok(ids.has(r.hito), r.id);
  for (const d of H.domesticables) assert.ok(ids.has(`agricultura_${d.id}`), d.id);
  for (const id of ["salida_africa", "primera_ciudad", "escritura", "industria", "mil_millones", "ocho_mil_millones", "extincion"]) assert.ok(ids.has(id), id);
  for (const c of H.continentes) {
    c.hitos.forEach(id => assert.ok(ids.has(id), id));
    c.regiones.forEach(id => assert.ok(H.regiones.some(r => r.id === id), id));
  }
});

test("los orígenes están en tierra firme", () => {
  for (const o of H.origenes) {
    const i = Math.floor((90 - o.lat) / 2) * 180 + Math.floor((o.lon + 180) / 2);
    assert.notEqual(MUNDO.bioma[i], "0", o.nombre);
  }
});

test("todas las cajas tienen coordenadas válidas", () => {
  const cajas = [...H.regiones, ...H.domesticables, ...H.rios, ...H.puentes, ...H.hielo].flatMap(x => x.cajas).concat(H.humedos.cajas);
  for (const [a, b, c, d] of cajas) {
    assert.ok(a <= b && a >= -90 && b <= 90);
    assert.ok(c >= -180 && d <= 180);
  }
});
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Run: `node --test pruebas/datos.test.mjs`
Expected: FAIL con `Cannot find module '../poblacion/datos.js'`.

- [ ] **Step 3: Escribir los datos**

`poblacion/datos.js`:

```js
// Datos reales para la simulación de población de "La Tierra". Solo datos, sin lógica.
// Años en calendario: negativo = antes de Cristo. "hace N años" se cuenta desde el presente (2026).
// Una caja es [latMín, latMáx, lonMín, lonMáx] y se compara con el centro de cada celda de 2°.
const HISTORIA = (() => {
  const PRESENTE = 2026;
  const hace = (a, b = a) => [PRESENTE - a, PRESENTE - b];
  return {
    presente: PRESENTE,
    inicio: -298000,
    // Inicio del Holoceno, hace 11.700 años (Walker et al. 2009, Journal of Quaternary Science)
    holoceno: PRESENTE - 11700,

    // Nivel del mar (m respecto del actual) cada 5.000 años aprox. Valores aproximados leídos de la curva de
    // Spratt y Lisiecki (2016), "A Late Pleistocene sea level stack", Climate of the Past 12: 1079–1092.
    nivelMar: [
      [305000, -40], [300000, -40], [290000, -50], [280000, -70], [270000, -90], [260000, -80], [250000, -40], [240000, -10],
      [235000, -40], [230000, -80], [225000, -40], [220000, -15], [215000, -60], [210000, -45], [205000, -25],
      [200000, -15], [195000, -40], [190000, -65], [180000, -75], [170000, -80], [160000, -90], [150000, -95],
      [145000, -100], [140000, -110], [135000, -60], [130000, -10], [125000, 5], [120000, 5], [115000, -20],
      [110000, -50], [105000, -40], [100000, -25], [95000, -35], [90000, -55], [85000, -40], [80000, -25],
      [75000, -60], [70000, -80], [65000, -85], [60000, -75], [55000, -70], [50000, -65], [45000, -70],
      [40000, -70], [35000, -75], [30000, -80], [25000, -120], [20000, -125], [18000, -120], [16000, -100],
      [14000, -80], [12000, -60], [10000, -40], [8000, -15], [6000, -3], [4000, 0], [0, 0]
    ].map(([h, m]) => [PRESENTE - h, m]).concat([[PRESENTE + 1000, 0]]),

    // Velocidad automática del reloj (años por segundo) desde cada año
    velocidades: [[-298000, 10000], [-78000, 2000], [-10000, 200], [-3000, 50], [1500, 5], [1900, 2]],
    // Tamaño máximo de cada paso de la simulación (años) desde cada año
    pasos: [[-298000, 200], [-10000, 20], [-3000, 10], [1500, 2], [1900, 1]],

    // Puentes de tierra: celdas de mar que quedan secas cuando el mar baja de `umbral` (m).
    // Umbral ≈ profundidad del estrecho según la batimetría GEBCO; valores aproximados.
    puentes: [
      { id: "beringia", nombre: "Beringia", umbral: -50, bioma: 2, cajas: [[60, 72, 165, 180], [60, 72, -180, -158]] },
      { id: "sunda", nombre: "Sunda", umbral: -40, bioma: 6, cajas: [[-8, 10, 95, 120]] },
      { id: "torres", nombre: "Estrecho de Torres", umbral: -12, bioma: 4, cajas: [[-12, -8, 132, 145]] },
      { id: "bass", nombre: "Estrecho de Bass", umbral: -50, bioma: 5, cajas: [[-41, -38, 144, 149]] },
      { id: "doggerland", nombre: "Doggerland", umbral: -25, bioma: 4, cajas: [[51, 56, -2, 8], [49, 51, -5, 2]] },
      { id: "golfo_persico", nombre: "Golfo Pérsico", umbral: -40, bioma: 4, cajas: [[24, 30, 48, 56]] },
      { id: "adan", nombre: "Puente de Adán", umbral: -10, bioma: 6, cajas: [[8, 11, 78, 81]] }
    ],

    // Capas de hielo: la celda se cubre cuando la intensidad glacial (0–1, según el nivel del mar) llega a gMin.
    // El orden de gMin sigue la secuencia de la última desglaciación: Dalton et al. (2020), Quaternary Science
    // Reviews 234, para Norteamérica; Hughes et al. (2016), Boreas 45, para Eurasia. Extensiones aproximadas.
    hielo: [
      { nombre: "Laurentino (sur)", gMin: 0.75, cajas: [[40, 50, -110, -60]] },
      { nombre: "Laurentino (centro)", gMin: 0.55, cajas: [[50, 60, -120, -60]] },
      { nombre: "Laurentino (norte)", gMin: 0.35, cajas: [[60, 76, -125, -60]] },
      { nombre: "Cordillerano", gMin: 0.75, cajas: [[48, 62, -140, -115]] },
      { nombre: "Fenoscandia", gMin: 0.6, cajas: [[54, 72, -10, 40]] },
      { nombre: "Fenoscandia (norte)", gMin: 0.4, cajas: [[62, 72, 0, 60]] },
      { nombre: "Islas Británicas", gMin: 0.75, cajas: [[52, 60, -11, 2]] },
      { nombre: "Patagonia", gMin: 0.7, cajas: [[-56, -40, -76, -70]] }
    ],

    // Sahara y Arabia verdes: en estos tramos sus desiertos tienen capacidad de estepa.
    // Larrasoaña, Roberts y Rohling (2013), PLoS ONE 8: e76514; deMenocal et al. (2000), Quaternary Science Reviews 19.
    humedos: {
      cajas: [[15, 32, -17, 35], [13, 32, 35, 60]],
      tramos: [hace(245000, 235000), hace(220000, 195000), hace(130000, 115000), hace(105000, 95000), hace(85000, 75000), hace(14500, 5000)]
    },

    // Valles de ríos en el desierto: siempre cuentan como estepa (riego natural)
    rios: [
      { nombre: "Nilo", cajas: [[22, 32, 30, 34]] },
      { nombre: "Tigris y Éufrates", cajas: [[29, 38, 38, 49]] },
      { nombre: "Indo", cajas: [[23, 32, 66, 74]] }
    ],

    // Regiones con especies domesticables. `riqueza` (0–1) ordena lo rico de cada "paquete" de plantas y animales
    // según Diamond (1997), "Armas, gérmenes y acero", y Larson et al. (2014), PNAS 111: 6139–6146.
    domesticables: [
      { id: "creciente_fertil", nombre: "Creciente Fértil", riqueza: 1, cajas: [[30, 38, 34, 48]] },
      { id: "china", nombre: "China", riqueza: 0.9, cajas: [[28, 40, 105, 122]] },
      { id: "nueva_guinea", nombre: "Nueva Guinea", riqueza: 0.5, cajas: [[-8, -3, 138, 148]] },
      { id: "mesoamerica", nombre: "Mesoamérica", riqueza: 0.7, cajas: [[14, 22, -105, -88]] },
      { id: "andes", nombre: "Andes", riqueza: 0.6, cajas: [[-18, -5, -80, -68]] },
      { id: "sahel", nombre: "Sahel y Etiopía", riqueza: 0.5, cajas: [[10, 17, -10, 35], [6, 14, 35, 42]] },
      { id: "este_norteamerica", nombre: "Este de Norteamérica", riqueza: 0.4, cajas: [[33, 42, -92, -80]] }
    ],

    // Islas demasiado chicas para el mapa de 2°: se agregan con su superficie real (km²)
    islas: [
      { nombre: "Hawái", lat: 19.6, lon: -155.5, km2: 16600, bioma: 6 },
      { nombre: "Islas de la Sociedad", lat: -17.6, lon: -149.4, km2: 1600, bioma: 6 },
      { nombre: "Marquesas", lat: -9.0, lon: -139.5, km2: 1050, bioma: 6 },
      { nombre: "Rapa Nui", lat: -27.1, lon: -109.4, km2: 164, bioma: 4 },
      { nombre: "Islas Cook", lat: -21.2, lon: -159.8, km2: 240, bioma: 6 },
      { nombre: "Samoa", lat: -13.8, lon: -172.1, km2: 2840, bioma: 6 },
      { nombre: "Tonga", lat: -21.2, lon: -175.2, km2: 750, bioma: 6 },
      { nombre: "Fiyi", lat: -17.7, lon: 178.0, km2: 18300, bioma: 6 },
      { nombre: "Vanuatu", lat: -15.4, lon: 167.0, km2: 12200, bioma: 6 },
      { nombre: "Nueva Caledonia", lat: -21.3, lon: 165.5, km2: 18600, bioma: 5 },
      { nombre: "Islas Salomón", lat: -9.6, lon: 160.2, km2: 28400, bioma: 6 }
    ],

    // Regiones para los hitos de llegada. Gana la primera caja que contiene el centro de la celda.
    regiones: [
      { id: "asia_occ", nombre: "Asia occidental", hito: null, cajas: [[36, 42, 26, 50], [29, 36, 34.5, 63], [21, 29, 37, 63], [15, 21, 41, 63], [12, 15, 43, 63]] },
      { id: "africa", nombre: "África", hito: null, cajas: [[-36, 35, -20, 52], [35, 38, -2, 11.5]] },
      { id: "europa", nombre: "Europa", hito: "europa", cajas: [[35, 52, -25, 50], [52, 72, -25, 60]] },
      { id: "sahul", nombre: "Australia y Nueva Guinea", hito: "sahul", cajas: [[-45, -10, 112, 155], [-11, -1, 130, 152]] },
      { id: "nueva_zelanda", nombre: "Nueva Zelanda", hito: "nueva_zelanda", cajas: [[-48, -34, 165, 179]] },
      { id: "asia", nombre: "Asia", hito: "asia", cajas: [[-11, 80, 60, 180], [36, 52, 50, 60], [55, 80, -180, -168]] },
      { id: "norteamerica", nombre: "Norteamérica", hito: "norteamerica", cajas: [[13, 84, -168, -50], [7, 13, -92, -77]] },
      { id: "sudamerica", nombre: "Sudamérica", hito: "sudamerica", cajas: [[-56, 13, -82, -34]] },
      { id: "polinesia", nombre: "Polinesia", hito: "polinesia", cajas: [[-30, 25, -180, -105]] }
    ],

    // Origen panafricano: varios grupos en distintos puntos de África
    origenes: [
      { nombre: "Jebel Irhoud (Marruecos)", lat: 31.9, lon: -8.9, personas: 2000 },   // Hublin et al. (2017), Nature 546
      { nombre: "Omo Kibish (Etiopía)", lat: 5.4, lon: 35.9, personas: 2000 },        // Vidal et al. (2022), Nature 601
      { nombre: "Florisbad (Sudáfrica)", lat: -28.8, lon: 26.1, personas: 2000 }      // Grün et al. (1996), Nature 382
    ],

    // Hitos, en orden cronológico real. `real` = [año más antiguo, año más reciente] de la evidencia.
    hitos: [
      { id: "salida_africa", titulo: "Tu humanidad salió de África", corto: "Salida de África", real: hace(70000, 50000),
        texto: "La gran dispersión de la que desciende casi toda la humanidad no africana ocurrió hace unos 70.000–50.000 años. Hubo salidas anteriores, como la de Misliya (Israel) hace unos 180.000 años, que dejaron poca o ninguna huella en la población actual.",
        fuente: "Bergström et al. (2021), Nature 590; Hershkovitz et al. (2018), Science 359" },
      { id: "asia", titulo: "Tu humanidad llegó al sur y este de Asia", corto: "Sur y este de Asia", real: hace(73000, 45000),
        texto: "Los dientes de Lida Ajer (Sumatra) indican Homo sapiens en el sudeste asiático hace unos 73.000–63.000 años; la mayoría de los sitios de la región tienen menos de 50.000.",
        fuente: "Westaway et al. (2017), Nature 548" },
      { id: "sahul", titulo: "Tu humanidad llegó a Australia y Nueva Guinea", corto: "Australia y Nueva Guinea", real: hace(65000, 50000),
        texto: "Nunca hubo un puente de tierra completo desde Asia: hubo que cruzar el mar. Madjedbebe, en el norte de Australia, se ha fechado en unos 65.000 años, aunque otros investigadores proponen unos 50.000.",
        fuente: "Clarkson et al. (2017), Nature 547; O'Connell et al. (2018), PNAS 115" },
      { id: "europa", titulo: "Tu humanidad llegó a Europa", corto: "Llegada a Europa", real: hace(54000, 45000),
        texto: "Grotte Mandrin (Francia) muestra Homo sapiens hace unos 54.000 años y Bacho Kiro (Bulgaria), hace unos 45.000. Allí convivieron miles de años con los neandertales.",
        fuente: "Slimak et al. (2022), Science Advances 8; Hublin et al. (2020), Nature 581" },
      { id: "norteamerica", titulo: "Tu humanidad llegó a Norteamérica", corto: "Llegada a Norteamérica", real: hace(23000, 15000),
        texto: "Las huellas humanas de White Sands (Nuevo México) tienen unos 23.000–21.000 años; muchos sitios de Norteamérica tienen entre 16.000 y 14.000.",
        fuente: "Bennett et al. (2021), Science 373" },
      { id: "sudamerica", titulo: "Tu humanidad llegó a Sudamérica", corto: "Llegada a Sudamérica", real: hace(18500, 14500),
        texto: "Monte Verde, en el sur de Chile, estaba habitado hace unos 14.500 años, y quizá desde antes.",
        fuente: "Dillehay et al. (2015), PLoS ONE 10: e0141923" },
      { id: "agricultura_creciente_fertil", titulo: "Nació la agricultura en el Creciente Fértil", corto: "Agricultura: Creciente Fértil", real: [-9500, -8000],
        texto: "Entre Israel e Irán se domesticaron el trigo, la cebada, las lentejas, las cabras y las ovejas.",
        fuente: "Larson et al. (2014), PNAS 111" },
      { id: "agricultura_china", titulo: "Nació la agricultura en China", corto: "Agricultura: China", real: [-8000, -6000],
        texto: "En los valles de los ríos Amarillo y Yangtsé se domesticaron el mijo y el arroz.",
        fuente: "Larson et al. (2014), PNAS 111" },
      { id: "agricultura_mesoamerica", titulo: "Nació la agricultura en Mesoamérica", corto: "Agricultura: Mesoamérica", real: [-8000, -7000],
        texto: "En el sur de México se domesticaron la calabaza y el maíz.",
        fuente: "Piperno et al. (2009), PNAS 106" },
      { id: "agricultura_nueva_guinea", titulo: "Nació la agricultura en Nueva Guinea", corto: "Agricultura: Nueva Guinea", real: [-8000, -5000],
        texto: "En las tierras altas de Nueva Guinea, en el sitio de Kuk, se cultivaron el taro y el plátano.",
        fuente: "Denham et al. (2003), Science 301" },
      { id: "agricultura_andes", titulo: "Nació la agricultura en los Andes", corto: "Agricultura: Andes", real: [-8000, -5000],
        texto: "En los Andes y la costa del Perú se domesticaron calabazas, la papa y la quinua; más tarde, la llama y la alpaca.",
        fuente: "Larson et al. (2014), PNAS 111" },
      { id: "agricultura_sahel", titulo: "Nació la agricultura en el Sahel y Etiopía", corto: "Agricultura: Sahel y Etiopía", real: [-3000, -2000],
        texto: "Al sur del Sahara se domesticaron el sorgo y el mijo perla.",
        fuente: "Manning et al. (2011), Journal of Archaeological Science 38; Larson et al. (2014), PNAS 111" },
      { id: "agricultura_este_norteamerica", titulo: "Nació la agricultura en el este de Norteamérica", corto: "Agricultura: este de Norteamérica", real: [-3000, -1800],
        texto: "En el este de Norteamérica se domesticaron el girasol, una calabaza y otras plantas de semilla.",
        fuente: "Smith (2006), PNAS 103" },
      { id: "primera_ciudad", titulo: "Nació la primera ciudad", corto: "Primera ciudad", real: [-4000, -3500],
        texto: "Uruk, en Mesopotamia, llegó a tener decenas de miles de habitantes: suele considerarse la primera ciudad.",
        fuente: "Algaze (2008), Ancient Mesopotamia at the Dawn of Civilization" },
      { id: "escritura", titulo: "Nació la escritura", corto: "Escritura", real: [-3300, -3200],
        texto: "Las tablillas protocuneiformes de Uruk son la escritura más antigua conocida; en Egipto apareció casi al mismo tiempo.",
        fuente: "Woods, ed. (2010), Visible Language, Oriental Institute de Chicago" },
      { id: "polinesia", titulo: "Tu humanidad llegó a la Polinesia", corto: "Llegada a la Polinesia", real: [-900, -800],
        texto: "La cultura Lapita llegó a Tonga y Samoa hacia 900–800 a. C. La Polinesia oriental (Tahití, Hawái, Rapa Nui) se pobló mucho después, hacia 1000–1200 d. C.",
        fuente: "Burley et al. (2012), PLoS ONE 7: e48769; Wilmshurst et al. (2011), PNAS 108" },
      { id: "nueva_zelanda", titulo: "Tu humanidad llegó a Nueva Zelanda", corto: "Llegada a Nueva Zelanda", real: [1250, 1300],
        texto: "Fue la última gran tierra habitada: los antepasados de los maoríes llegaron desde la Polinesia oriental hacia 1250–1300 d. C.",
        fuente: "Wilmshurst et al. (2011), PNAS 108; Bunbury et al. (2022), Science 378" },
      { id: "industria", titulo: "Empezó la Revolución Industrial", corto: "Revolución Industrial", real: [1760, 1830],
        texto: "Empezó en Gran Bretaña hacia 1760, con la máquina de vapor y las fábricas textiles, y desde allí se extendió por el mundo.",
        fuente: "Allen (2009), The British Industrial Revolution in Global Perspective" },
      { id: "mil_millones", titulo: "Tu humanidad llegó a 1.000 millones de personas", corto: "1.000 millones de personas", real: [1804, 1804],
        texto: "La humanidad tardó unos 300.000 años en llegar a sus primeros 1.000 millones de personas, hacia 1804.",
        fuente: "Naciones Unidas, División de Población" },
      { id: "ocho_mil_millones", titulo: "Tu humanidad llegó a 8.000 millones de personas", corto: "8.000 millones de personas", real: [2022, 2022],
        texto: "Naciones Unidas fijó el 15 de noviembre de 2022 como el día en que la humanidad llegó a 8.000 millones.",
        fuente: "Naciones Unidas (2022), World Population Prospects" },
      { id: "extincion", titulo: "Tu humanidad se extinguió", corto: "Extinción", real: null,
        texto: "En la realidad no pasó: aunque hubo momentos difíciles, la humanidad siguió creciendo.", fuente: "" }
    ],

    // Población real estimada [año, mínimo, máximo]. Desde 10.000 a. C.: rango de las estimaciones de HYDE 3.2
    // (Klein Goldewijk et al. 2017), McEvedy y Jones (1978) y Naciones Unidas. Antes no hay censos: son rangos
    // amplios a partir de estudios genéticos y arqueológicos.
    poblacionReal: [
      [-298000, 2e4, 2e5], [-100000, 5e4, 5e5], [-50000, 1e5, 1e6], [-20000, 5e5, 2e6],
      [-10000, 1e6, 1e7], [-5000, 5e6, 2e7], [-3000, 1.4e7, 4.5e7], [-1000, 5e7, 1.15e8],
      [1, 1.7e8, 3e8], [1000, 2.54e8, 3.45e8], [1500, 4.25e8, 5.4e8], [1700, 6e8, 6.79e8],
      [1800, 8.13e8, 1.125e9], [1900, 1.55e9, 1.762e9], [1950, 2.5e9, 2.6e9], [2000, 6.1e9, 6.2e9], [2026, 8.2e9, 8.3e9]
    ],

    // Continentes del muelle de la escala "La Tierra". `stats` lo reemplaza el panel con datos de la partida.
    continentes: [
      { id: "c-africa", nombre: "África", tipo: "Continente", lat: 3, lon: 20, color: "#f3c56b", regiones: ["africa"], hitos: [], stats: [],
        lede: "Aquí nace la humanidad: los fósiles más antiguos de Homo sapiens son africanos.",
        facts: ["Los fósiles de Jebel Irhoud (Marruecos) tienen unos 300.000 años: son los Homo sapiens más antiguos conocidos.",
          "Durante la mayor parte de nuestra historia, casi toda la humanidad vivió en África."] },
      { id: "c-europa", nombre: "Europa", tipo: "Continente", lat: 50, lon: 15, color: "#8fb8ff", regiones: ["europa"], hitos: ["europa"], stats: [],
        lede: "Llegaron desde Asia occidental y encontraron a los neandertales, que vivían allí desde hacía cientos de miles de años.",
        facts: ["Los Homo sapiens más antiguos de Europa tienen entre 54.000 y 45.000 años.",
          "Allí convivieron miles de años con los neandertales."] },
      { id: "c-asia", nombre: "Asia", tipo: "Continente", lat: 40, lon: 95, color: "#ff9f6b", regiones: ["asia_occ", "asia"], hitos: ["salida_africa", "asia"], stats: [],
        lede: "El continente más grande fue el primer paso fuera de África y la ruta hacia Oceanía y América.",
        facts: ["La salida principal de África ocurrió hace unos 70.000–50.000 años, aunque hubo salidas anteriores.",
          "En China surgió la agricultura del mijo y del arroz hace unos 10.000–8.000 años."] },
      { id: "c-oceania", nombre: "Oceanía", tipo: "Continente", lat: -22, lon: 140, color: "#7fd8a4", regiones: ["sahul", "nueva_zelanda", "polinesia"], hitos: ["sahul", "polinesia", "nueva_zelanda"], stats: [],
        lede: "Australia, Nueva Guinea y miles de islas que solo se alcanzaron navegando.",
        facts: ["Para llegar a Australia hubo que cruzar el mar: ni en las glaciaciones existió un puente de tierra completo desde Asia.",
          "Nueva Zelanda fue la última gran tierra habitada, hacia 1250–1300 d. C."] },
      { id: "c-america", nombre: "América", tipo: "Continente", lat: 10, lon: -80, color: "#d79bff", regiones: ["norteamerica", "sudamerica"], hitos: ["norteamerica", "sudamerica"], stats: [],
        lede: "El último continente poblado, al que se llegó desde Siberia por Beringia.",
        facts: ["En la glaciación, Beringia unía Siberia con Alaska.",
          "Las huellas de White Sands (Nuevo México) tienen entre 23.000 y 21.000 años."] }
    ]
  };
})();
if (typeof module !== "undefined") module.exports = HISTORIA;
```

- [ ] **Step 4: Correr la prueba y ver que pasa**

Run: `node --test pruebas/datos.test.mjs`
Expected: PASS (5 pruebas).

- [ ] **Step 5: Commit**

```bash
git add poblacion/datos.js pruebas/datos.test.mjs
git commit -m "Datos reales de clima, regiones e hitos para la simulación de población" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Motor — mundo y clima

**Files:**
- Create: `poblacion/motor.js`
- Create: `pruebas/ayuda.mjs`
- Test: `pruebas/motor-mundo.test.mjs`

**Interfaces:**
- Consumes: la forma de `MUNDO` (Tarea 1; acepta además `latNorte` y `lonOeste` opcionales) y la de `HISTORIA` (Tarea 2).
- Produces:
  - `Motor.crear(mundo, historia, opciones?)` → objeto `m`. `opciones = { semilla, params, inicio, natalidad, intensidadGlacial, puentesDeTierra, cruceDeMar }` (todas opcionales).
  - `m.avanzar(años)`, `m.año()`, `m.pasoMax()`, `m.poblacionTotal()`, `m.terminado()`, `m.climaActual()` → `{ nivelMar, intensidadGlacial, humedoSahara, puentesAbiertos: boolean[] }`, `m.alHito(fn)`, `m.hitos()` → `[{ id, año, celda }]`, `m.capacidad(i)` → personas, `m.celdaDe(lat, lon)` → índice, `m.semilla`, `m.poblacionPorRegion()` → `Float64Array` por índice de `historia.regiones`.
  - `m.celdas = { ancho, alto, grados, lat, lon, tierra (índices de celdas que pueden ser tierra), poblacion (Float64Array), etapa (Uint8Array), innovaciones (Uint16Array), region (Int8Array), hielo (Uint8Array), plataforma (Uint8Array) }`.
  - `Motor.tramo(tabla, x)`, `Motor.PARAMS`, `Motor.BIOMA`, `Motor.INNOVACION`, `Motor.ETAPA`.
  - `pruebas/ayuda.mjs`: `require`, `mundoDePrueba(filas, { latNorte = 3, lonOeste = -5, grados = 2 })`, `historiaDePrueba(extra)`.

- [ ] **Step 1: Escribir la ayuda de pruebas**

`pruebas/ayuda.mjs`:

```js
// Mundos e historias de mentira para probar el motor y la partida sin el mapa real.
import { createRequire } from "node:module";
export const require = createRequire(import.meta.url);

// filas: cadenas de dígitos de bioma (0 mar, 1 hielo, 2 tundra, 3 desierto, 4 estepa, 5 bosque, 6 selva).
// Con los valores por defecto, un mundo de 3 filas queda centrado en el ecuador (latitudes 2, 0, −2).
export function mundoDePrueba(filas, { latNorte = 3, lonOeste = -5, grados = 2 } = {}) {
  const bioma = filas.join("");
  return { ancho: filas[0].length, alto: filas.length, grados, latNorte, lonOeste, bioma, tierra: bioma.replace(/[1-9]/g, "9") };
}

export function historiaDePrueba(extra = {}) {
  return {
    presente: 2026, inicio: -20000, holoceno: -9674,
    nivelMar: [[-1e7, 0], [3000, 0]],
    pasos: [[-1e9, 10]],
    velocidades: [[-1e9, 1000]],
    puentes: [], hielo: [], humedos: { cajas: [], tramos: [] }, rios: [], domesticables: [], islas: [],
    regiones: [{ id: "todo", nombre: "Todo", hito: null, cajas: [[-90, 90, -180, 180]] }],
    origenes: [], hitos: [],
    ...extra
  };
}
```

- [ ] **Step 2: Escribir las pruebas que fallan**

`pruebas/motor-mundo.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js");
const KM2 = (2 * 111.32) ** 2;   // superficie de una celda de 2° × 2° en el ecuador
const cerca = (a, b) => Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(b));
const tres = filaCentral => mundoDePrueba(["00000", filaCentral, "00000"]);

test("cada celda conoce su centro y celdaDe la encuentra", () => {
  const m = Motor.crear(tres("04440"), historiaDePrueba());
  const i = m.celdaDe(0, 0);
  assert.equal(i, 7);   // fila 1, columna 2
  assert.equal(m.celdas.lat[i], 0);
  assert.equal(m.celdas.lon[i], 0);
});

test("la capacidad de recolectores sale de la superficie, el bioma y la costa", () => {
  const m = Motor.crear(tres("04440"), historiaDePrueba());
  assert.ok(cerca(m.capacidad(m.celdaDe(0, 0)), KM2 * 0.08 * 1.5));   // estepa con mar arriba y abajo
});

test("una isla convierte una celda de mar en tierra con su superficie real", () => {
  const h = historiaDePrueba({ islas: [{ nombre: "Prueba", lat: 0, lon: 0, km2: 1000, bioma: 6 }] });
  const m = Motor.crear(tres("00000"), h);
  assert.ok(cerca(m.capacidad(m.celdaDe(0, 0)), 1000 * 0.1 * 1.5));
});

test("un puente de tierra se abre cuando el mar baja de su umbral y se cierra al subir", () => {
  const h = historiaDePrueba({
    nivelMar: [[-1e7, 0], [-15000, 0], [-14000, -100], [-12000, -100], [-11000, 0], [3000, 0]],
    puentes: [{ id: "p", nombre: "Puente", umbral: -50, bioma: 4, cajas: [[-1, 1, -1, 1]] }]
  });
  const m = Motor.crear(tres("04040"), h);
  const p = m.celdaDe(0, 0);
  assert.equal(m.celdas.plataforma[p], 0);
  assert.equal(m.capacidad(p), 0);
  m.avanzar(7000);   // −13.000: mar a −100 m
  assert.equal(m.celdas.plataforma[p], 1);
  assert.ok(m.capacidad(p) > 0);
  assert.equal(m.climaActual().puentesAbiertos[0], true);
  m.avanzar(3000);   // −10.000: mar en 0
  assert.equal(m.celdas.plataforma[p], 0);
  assert.equal(m.capacidad(p), 0);
});

test("el hielo de una glaciación deja la celda sin capacidad", () => {
  const h = historiaDePrueba({
    nivelMar: [[-1e7, 0], [-15000, 0], [-14000, -125], [3000, -125]],
    hielo: [{ nombre: "Prueba", gMin: 0.6, cajas: [[-1, 1, -3, -1]] }]
  });
  const m = Motor.crear(tres("04440"), h);
  const i = m.celdaDe(0, -2), j = m.celdaDe(0, 0);
  assert.ok(m.capacidad(i) > 0);
  m.avanzar(6000);   // −14.000: intensidad glacial 1
  assert.equal(m.climaActual().intensidadGlacial, 1);
  assert.equal(m.celdas.hielo[i], 1);
  assert.equal(m.capacidad(i), 0);
  assert.equal(m.celdas.hielo[j], 0);
});

test("los desiertos reverdecen en los periodos húmedos y junto a los ríos", () => {
  const h = historiaDePrueba({
    humedos: { cajas: [[-1, 1, -3, -1]], tramos: [[-15000, -12000]] },
    rios: [{ nombre: "Río", cajas: [[-1, 1, 1, 3]] }]
  });
  const m = Motor.crear(tres("03330"), h);
  const seco = m.celdaDe(0, -2), rio = m.celdaDe(0, 2);
  const estepa = KM2 * 0.08 * 1.5, desierto = KM2 * 0.005 * 1.5;
  assert.ok(cerca(m.capacidad(seco), desierto));
  assert.ok(cerca(m.capacidad(rio), estepa));
  m.avanzar(7000);   // −13.000: periodo húmedo
  assert.ok(cerca(m.capacidad(seco), estepa));
  m.avanzar(2000);   // −11.000: vuelve a secarse
  assert.ok(cerca(m.capacidad(seco), desierto));
});

test("la partida empieza con la gente de los orígenes", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -2, personas: 2000 }, { nombre: "B", lat: 0, lon: 2, personas: 1500 }] });
  const m = Motor.crear(tres("04440"), h);
  assert.equal(m.poblacionTotal(), 3500);
  assert.equal(m.celdas.etapa[m.celdaDe(0, -2)], Motor.ETAPA.RECOLECTORES);
  assert.equal(m.año(), -20000);
});

test("avanzar nunca pasa del presente", () => {
  const m = Motor.crear(tres("04440"), historiaDePrueba({ inicio: 1990 }));
  m.avanzar(1e6);
  assert.equal(m.año(), 2026);
  assert.equal(m.terminado(), true);
});
```

- [ ] **Step 3: Correr las pruebas y ver que fallan**

Run: `node --test pruebas/motor-mundo.test.mjs`
Expected: FAIL con `Cannot find module '../poblacion/motor.js'`.

- [ ] **Step 4: Escribir el motor (mundo y clima)**

`poblacion/motor.js`:

```js
// Motor de la simulación de población de "La Tierra": mundo, clima, gente, innovaciones e hitos.
// No usa three.js ni el DOM, así que corre igual en el navegador y en Node (pruebas y calibración).
const Motor = (() => {
  // Biomas: los mismos códigos que MUNDO.bioma
  const MAR = 0, HIELO = 1, TUNDRA = 2, DESIERTO = 3, ESTEPA = 4, BOSQUE = 5, SELVA = 6;
  // Innovaciones (bits)
  const COSTERA = 1, AGRICULTURA = 2, CIUDADES = 4, ESCRITURA = 8, ALTURA = 16, INDUSTRIA = 32;
  const BITS = [COSTERA, AGRICULTURA, CIUDADES, ESCRITURA, ALTURA, INDUSTRIA];
  // Etapas de una celda
  const VACIA = 0, RECOLECTORES = 1, AGRICULTORES = 2, URBANA = 3, INDUSTRIAL = 4;
  const D2R = Math.PI / 180, KM_GRADO = 111.32;

  // Parámetros de las reglas. Los valores finales salen de la calibración (pruebas/calibrar.mjs).
  const PARAMS = {
    // Personas por km² según etapa (1–4) y bioma (0 mar, 1 hielo, 2 tundra, 3 desierto, 4 estepa, 5 bosque, 6 selva).
    // Recolectores: densidades etnográficas (Binford 2001, "Constructing Frames of Reference").
    densidad: [
      null,
      [0, 0, 0.02, 0.005, 0.08, 0.06, 0.1],
      [0, 0, 0, 0.3, 6, 4, 3],
      [0, 0, 0, 1, 18, 12, 9],
      [0, 0, 1, 8, 150, 100, 80]
    ],
    costa: 1.5,              // extra de la pesca para recolectores en celdas costeras
    frio: 0.5,               // pérdida máxima de capacidad en latitudes altas en plena glaciación
    crecimiento: [0, 0.003, 0.01, 0.01, 0.025],   // tasa r por año según la etapa
    minimo: 10,              // menos gente que esto en una celda = deshabitada; tampoco salen grupos más chicos
    establecida: 100,        // gente necesaria para que una llegada cuente como hito
    exploracion: 0.002,      // fracción que se va por año aunque haya espacio
    presion: 0.004,          // fracción extra por año cuando la celda está llena
    cruce: [0.00002, 0.0001, 0.0002],   // probabilidad por año de cruzar el mar desde una costa: sin navegación, costera, de altura
    alcance: [1, 2, 20],     // celdas de agua que se pueden cruzar en cada caso
    costera: 2e-7,           // aparición de la navegación costera, por año y por cada 1.000 personas en la costa
    agricultura: 0.0002,     // aparición de la agricultura por año en una celda llena de una región con domesticables
    llenaAgricultura: 0.7,   // fracción de la capacidad de recolectores desde la que empieza a aparecer
    ciudades: 0.0005,        // aparición de ciudades por año con densidad al doble del umbral y todas las vecinas agrícolas
    densidadCiudad: 8,       // personas por km² desde las que pueden aparecer ciudades
    escritura: 0.0005,       // aparición de la escritura por año y por cada vecina con ciudades más allá del mínimo
    vecinosEscritura: 2,     // vecinas con ciudades necesarias para que aparezca la escritura
    altura: 0.00005,         // aparición de la navegación de altura por año con saber suficiente
    saberAltura: 2000,       // saber con el que la navegación de altura llega a su probabilidad completa
    industria: 0.0005,       // aparición de la industria por año con saber al doble del umbral
    saberIndustria: 20000,   // saber desde el que puede aparecer la industria
    ritmoSaber: 1,           // saber ganado por año por cada millón de personas agrícolas
    escrituraSaber: 2,       // la escritura multiplica el saber ganado
    difusionSaber: 0.002,    // ritmo con el que el saber se iguala con el de las vecinas
    saberIntensifica: 5000,  // cada tantos puntos de saber, la capacidad agrícola y urbana sube un 100 %
    saberMax: 3,             // tope de esa subida (capacidad ×4)
    contagio: { 1: 0.002, 2: 0.004, 4: 0.002, 8: 0.003, 16: 0.002, 32: 0.02 },   // por año y por vecina, según el bit
    contagioEscritura: 3,    // la escritura acelera el contagio y la difusión del saber
    industriaGlobal: 0.05    // contagio mundial de la industria, multiplicado por la fracción de población industrial
  };

  function azar(semilla) {
    let s = semilla >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const enCaja = (la, lo, [a, b, c, d]) => la >= a && la <= b && (c <= d ? lo >= c && lo <= d : lo >= c || lo <= d);
  const enCajas = (la, lo, cajas) => cajas.some(k => enCaja(la, lo, k));
  const entre = (año, tramos) => tramos.some(([a, b]) => año >= a && año <= b);
  function interpolar(tabla, x) {
    if (x <= tabla[0][0]) return tabla[0][1];
    for (let k = 1; k < tabla.length; k++) if (x <= tabla[k][0]) {
      const [x0, y0] = tabla[k - 1], [x1, y1] = tabla[k];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
    return tabla[tabla.length - 1][1];
  }
  // Valor de una tabla por tramos [[desde, valor], ...]: el del último tramo que ya empezó
  function tramo(tabla, x) {
    let v = tabla[0][1];
    for (const [desde, val] of tabla) if (x >= desde) v = val;
    return v;
  }

  function crear(mundo, historia, opciones = {}) {
    const P = { ...PARAMS, ...opciones.params };
    const semilla = (opciones.semilla ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
    const rnd = azar(semilla);
    const natalidad = opciones.natalidad ?? 1, glacial = opciones.intensidadGlacial ?? 1;
    const conPuentes = opciones.puentesDeTierra ?? true, cruceMult = opciones.cruceDeMar ?? 1;
    const W = mundo.ancho, H = mundo.alto, N = W * H, G = mundo.grados;
    const latN = mundo.latNorte ?? 90, lonO = mundo.lonOeste ?? -180;

    // --- Mundo: geometría, islas, vecinas, puentes y regiones ---
    const lat = new Float32Array(N), lon = new Float32Array(N), bioma0 = new Uint8Array(N), area0 = new Float32Array(N);
    const areaCompleta = i => (G * KM_GRADO) ** 2 * Math.cos(lat[i] * D2R);
    for (let i = 0; i < N; i++) {
      lat[i] = latN - (Math.floor(i / W) + 0.5) * G;
      lon[i] = lonO + ((i % W) + 0.5) * G;
      bioma0[i] = mundo.bioma.charCodeAt(i) - 48;
      const t = mundo.tierra.charCodeAt(i) - 48;
      area0[i] = bioma0[i] === MAR ? 0 : areaCompleta(i) * (t >= 9 ? 1 : t / 10);
    }
    function celdaDe(la, lo) {
      const f = Math.min(H - 1, Math.max(0, Math.floor((latN - la) / G)));
      const c = ((Math.floor((lo - lonO) / G) % W) + W) % W;
      return f * W + c;
    }
    for (const isla of historia.islas) {
      const i = celdaDe(isla.lat, isla.lon);
      if (bioma0[i] === MAR) { bioma0[i] = isla.bioma; area0[i] = isla.km2; }
    }
    // 8 vecinas por celda (−1 fuera del mapa); la longitud da la vuelta al mundo
    const vecinas = new Int32Array(N * 8).fill(-1);
    for (let i = 0; i < N; i++) {
      const f = Math.floor(i / W), c = i % W;
      let k = 0;
      for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) {
        if (!df && !dc) continue;
        if (f + df >= 0 && f + df < H) vecinas[i * 8 + k] = (f + df) * W + ((c + dc + W) % W);
        k++;
      }
    }
    const puente = new Int8Array(N).fill(-1);
    historia.puentes.forEach((p, k) => {
      for (let i = 0; i < N; i++) if (bioma0[i] === MAR && puente[i] < 0 && enCajas(lat[i], lon[i], p.cajas)) puente[i] = k;
    });
    // Celdas que pueden ser tierra en algún momento: las de hoy y las de los puentes
    const tierra = [];
    for (let i = 0; i < N; i++) if (bioma0[i] !== MAR || puente[i] >= 0) tierra.push(i);
    const costa = new Uint8Array(N);
    for (const i of tierra) if (bioma0[i] !== MAR) for (let k = 0; k < 8; k++) {
      const j = vecinas[i * 8 + k];
      if (j >= 0 && bioma0[j] === MAR) costa[i] = 1;
    }
    const costeras = tierra.filter(i => costa[i]);
    const region = new Int8Array(N).fill(-1), domestica = new Int8Array(N).fill(-1);
    const rio = new Uint8Array(N), humedo = new Uint8Array(N), gHielo = new Float32Array(N).fill(Infinity);
    for (const i of tierra) {
      const la = lat[i], lo = lon[i];
      region[i] = historia.regiones.findIndex(r => enCajas(la, lo, r.cajas));
      domestica[i] = historia.domesticables.findIndex(d => enCajas(la, lo, d.cajas));
      rio[i] = historia.rios.some(r => enCajas(la, lo, r.cajas)) ? 1 : 0;
      humedo[i] = enCajas(la, lo, historia.humedos.cajas) ? 1 : 0;
      for (const h of historia.hielo) if (h.gMin < gHielo[i] && enCajas(la, lo, h.cajas)) gHielo[i] = h.gMin;
    }

    // --- Estado ---
    const pob = new Float64Array(N), innov = new Uint16Array(N), etapa = new Uint8Array(N), saber = new Float32Array(N);
    const hielo = new Uint8Array(N), plataforma = new Uint8Array(N), bio = new Uint8Array(N), base = new Float32Array(N);
    let año = opciones.inicio ?? historia.inicio, total = 0, totalIndustrial = 0, fin = false;
    let clima = { nivelMar: 0, intensidadGlacial: 0, humedoSahara: false, puentesAbiertos: [] };
    const oyentes = [], logros = [], hechos = new Set();

    // --- Clima: nivel del mar, intensidad glacial, puentes, hielo y periodos húmedos ---
    function actualizarClima() {
      const nivel = interpolar(historia.nivelMar, año);
      const g = Math.min(1, Math.max(0, -nivel / 125 * glacial));
      const hum = entre(año, historia.humedos.tramos);
      const abiertos = historia.puentes.map(p => conPuentes && nivel <= p.umbral);
      clima = { nivelMar: nivel, intensidadGlacial: g, humedoSahara: hum, puentesAbiertos: abiertos };
      for (const i of tierra) {
        hielo[i] = g >= gHielo[i] ? 1 : 0;
        plataforma[i] = puente[i] >= 0 && abiertos[puente[i]] ? 1 : 0;
        let b = bioma0[i];
        if (b === MAR) b = plataforma[i] ? historia.puentes[puente[i]].bioma : MAR;
        else if (b === DESIERTO && (rio[i] || (hum && humedo[i]))) b = ESTEPA;
        if (hielo[i] && b !== MAR) b = HIELO;
        bio[i] = b;
        const frio = 1 - P.frio * g * Math.min(1, Math.max(0, (Math.abs(lat[i]) - 30) / 30));
        base[i] = (b === MAR ? 0 : bioma0[i] === MAR ? areaCompleta(i) : area0[i]) * frio;
      }
    }

    // --- Capacidad ---
    const aptaAgricultura = i => (bio[i] === ESTEPA || bio[i] === BOSQUE || bio[i] === SELVA) && Math.abs(lat[i]) <= 58;
    const etapaDe = bits => bits & INDUSTRIA ? INDUSTRIAL : bits & CIUDADES ? URBANA : bits & AGRICULTURA ? AGRICULTORES : RECOLECTORES;
    // Lo agrícola solo sirve donde se puede cultivar; la navegación se conserva en cualquier lado
    const aptas = (bits, j) => aptaAgricultura(j) ? bits : bits & (COSTERA | ALTURA);
    function capacidad(i, e) {
      if (base[i] <= 0) return 0;
      let k = base[i] * P.densidad[e][bio[i]];
      if (e === RECOLECTORES && costa[i]) k *= P.costa;
      if (e === AGRICULTORES || e === URBANA) k *= 1 + Math.min(saber[i] / P.saberIntensifica, P.saberMax);
      return k;
    }
    function contar() {
      total = 0; totalIndustrial = 0;
      for (const i of tierra) { total += pob[i]; if (innov[i] & INDUSTRIA) totalIndustrial += pob[i]; }
    }

    // --- Paso del tiempo ---
    function paso(dt) {
      año += dt;
      actualizarClima();
      contar();
    }
    function avanzar(años) {
      let resto = Math.min(años, historia.presente - año);
      while (resto > 1e-6 && !fin) {
        const d = Math.min(resto, tramo(historia.pasos, año));
        paso(d);
        resto -= d;
      }
      if (año >= historia.presente - 1e-6) { año = historia.presente; fin = true; }
    }

    actualizarClima();
    for (const o of historia.origenes) pob[celdaDe(o.lat, o.lon)] += o.personas;
    for (const i of tierra) etapa[i] = pob[i] > 0 ? RECOLECTORES : VACIA;
    contar();

    return {
      semilla,
      avanzar,
      año: () => año,
      pasoMax: () => tramo(historia.pasos, año),
      poblacionTotal: () => total,
      terminado: () => fin,
      climaActual: () => clima,
      alHito(fn) { oyentes.push(fn); },
      hitos: () => logros.slice(),
      capacidad: i => capacidad(i, pob[i] > 0 ? etapaDe(innov[i]) : RECOLECTORES),
      celdaDe,
      celdas: { ancho: W, alto: H, grados: G, lat, lon, tierra, poblacion: pob, etapa, innovaciones: innov, region, hielo, plataforma },
      poblacionPorRegion() {
        const t = new Float64Array(historia.regiones.length);
        for (const i of tierra) if (region[i] >= 0) t[region[i]] += pob[i];
        return t;
      }
    };
  }

  return {
    crear, tramo, PARAMS,
    BIOMA: { MAR, HIELO, TUNDRA, DESIERTO, ESTEPA, BOSQUE, SELVA },
    INNOVACION: { COSTERA, AGRICULTURA, CIUDADES, ESCRITURA, ALTURA, INDUSTRIA },
    ETAPA: { VACIA, RECOLECTORES, AGRICULTORES, URBANA, INDUSTRIAL }
  };
})();
if (typeof module !== "undefined") module.exports = Motor;
```

Las variables `rnd`, `natalidad`, `cruceMult`, `costeras`, `domestica`, `BITS`, `aptas`, `oyentes`, `logros`, `hechos` y `totalIndustrial` todavía no se usan: las usan las Tareas 4 y 5.

- [ ] **Step 5: Correr las pruebas y ver que pasan**

Run: `node --test pruebas/motor-mundo.test.mjs`
Expected: PASS (8 pruebas).

- [ ] **Step 6: Commit**

```bash
git add poblacion/motor.js pruebas/ayuda.mjs pruebas/motor-mundo.test.mjs
git commit -m "Motor de población: celdas, puentes de tierra, hielo y periodos húmedos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Motor — la gente y los hitos de llegada

**Files:**
- Modify: `poblacion/motor.js` (reemplazar la sección `// --- Paso del tiempo ---` hasta antes de `function avanzar`)
- Test: `pruebas/motor-gente.test.mjs`

**Interfaces:**
- Consumes: todo lo interno de `crear` de la Tarea 3 (`P`, `rnd`, `pob`, `innov`, `etapa`, `saber`, `vecinas`, `tierra`, `costeras`, `bio`, `base`, `region`, `capacidad`, `etapaDe`, `aptas`, `contar`, `oyentes`, `logros`, `hechos`, `fin`, `total`).
- Produces (internos de `crear`, que usa la Tarea 5): `vaciar(i)`, `adoptar(i, bits)`, `hito(id, i)`; hitos emitidos: `salida_africa`, el `hito` de cada región, `mil_millones`, `ocho_mil_millones`, `extincion` (este último también termina la partida).

- [ ] **Step 1: Escribir las pruebas que fallan**

`pruebas/motor-gente.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js");
const SIN_AZAR = { cruce: [0, 0, 0], costera: 0 };
const isla = () => mundoDePrueba(["000", "040", "000"], { lonOeste: -3 });
const tira = () => mundoDePrueba(["0000000", "0444440", "0000000"], { lonOeste: -7 });

test("la población crece hasta la capacidad y no la pasa", () => {
  const m = Motor.crear(isla(), historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 50 }] }));
  const i = m.celdaDe(0, 0), K = m.capacidad(i);
  m.avanzar(15000);
  assert.ok(m.celdas.poblacion[i] <= K * 1.0001);
  assert.ok(m.celdas.poblacion[i] >= K * 0.99);
});

test("migrar no crea ni destruye personas", () => {
  const params = { ...SIN_AZAR, crecimiento: [0, 0, 0, 0, 0], exploracion: 0.01,
    densidad: [null, [0, 0, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]] };
  const m = Motor.crear(tira(), historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 50000 }] }), { params });
  m.avanzar(300);
  assert.ok(Math.abs(m.poblacionTotal() - 50000) < 1e-6);
  assert.ok(m.celdas.poblacion[m.celdaDe(0, -2)] > 0);
});

test("solo se pasa a la otra orilla cuando el puente de tierra está abierto", () => {
  const puentes = [{ id: "p", nombre: "Puente", umbral: -50, bioma: 4, cajas: [[-1, 1, -1, 1]] }];
  const origenes = [{ nombre: "A", lat: 0, lon: -2, personas: 3000 }];
  const params = { ...SIN_AZAR, exploracion: 0.01 };
  const mundo = () => mundoDePrueba(["00000", "04040", "00000"]);
  const cerrado = Motor.crear(mundo(), historiaDePrueba({ puentes, origenes }), { params });
  cerrado.avanzar(5000);
  assert.equal(cerrado.celdas.poblacion[cerrado.celdaDe(0, 2)], 0);
  const abierto = Motor.crear(mundo(), historiaDePrueba({ puentes, origenes, nivelMar: [[-1e7, -100], [3000, -100]] }), { params });
  abierto.avanzar(5000);
  assert.ok(abierto.celdas.poblacion[abierto.celdaDe(0, 2)] > 0);
});

test("si el hielo cubre a toda la humanidad, la partida termina con el hito de extinción", () => {
  const h = historiaDePrueba({
    nivelMar: [[-1e7, 0], [-19000, 0], [-18000, -125], [3000, -125]],
    hielo: [{ nombre: "Todo", gMin: 0.5, cajas: [[-90, 90, -180, 180]] }],
    origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 500 }]
  });
  const m = Motor.crear(isla(), h, { params: SIN_AZAR });
  const vistos = [];
  m.alHito(x => vistos.push(x.id));
  m.avanzar(500);
  assert.ok(m.poblacionTotal() > 0);
  m.avanzar(2000);
  assert.equal(m.poblacionTotal(), 0);
  assert.equal(m.terminado(), true);
  assert.ok(vistos.includes("extincion"));
  assert.ok(m.año() < 2026);
});

test("la misma semilla repite la partida y otra semilla la cambia", () => {
  const h = historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }] });
  const jugar = semilla => {
    const m = Motor.crear(mundoDePrueba(["0000000", "0404040", "0000000"], { lonOeste: -7 }), h, { semilla, params: { cruce: [0.01, 0.01, 0.01] } });
    m.avanzar(400);
    return Array.from(m.celdas.poblacion).join();
  };
  assert.equal(jugar(7), jugar(7));
  assert.ok(new Set([1, 2, 3, 4, 5].map(jugar)).size > 1);
});

test("cada hito de llegada se avisa una sola vez", () => {
  const h = historiaDePrueba({
    regiones: [{ id: "a", nombre: "A", hito: null, cajas: [[-90, 90, -180, -1]] }, { id: "b", nombre: "B", hito: "b", cajas: [[-90, 90, -1, 180]] }],
    origenes: [{ nombre: "A", lat: 0, lon: -4, personas: 3000 }]
  });
  const m = Motor.crear(tira(), h, { params: { ...SIN_AZAR, exploracion: 0.01 } });
  const vistos = [];
  m.alHito(x => vistos.push(x.id));
  m.avanzar(5000);
  assert.equal(vistos.filter(id => id === "b").length, 1);
  assert.equal(m.hitos().filter(x => x.id === "b").length, 1);
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `node --test pruebas/motor-gente.test.mjs`
Expected: FAIL: la población no cambia (`la población crece…` falla en `>= K * 0.99`) y no hay hito de extinción.

- [ ] **Step 3: Agregar la gente, los cruces de mar y los hitos**

En `poblacion/motor.js`, reemplazar este bloque:

```js
    // --- Paso del tiempo ---
    function paso(dt) {
      año += dt;
      actualizarClima();
      contar();
    }
```

por:

```js
    // --- Gente: crecer, migrar y cruzar el mar ---
    function vaciar(i) { pob[i] = 0; innov[i] = 0; saber[i] = 0; etapa[i] = VACIA; }
    function adoptar(i, bits) { innov[i] |= bits; }
    // Crecimiento logístico exacto hacia la capacidad (estable con pasos largos)
    function crecer(dt) {
      for (const i of tierra) {
        const p = pob[i];
        if (p <= 0) continue;
        const e = etapaDe(innov[i]), K = capacidad(i, e);
        if (K <= 0) { vaciar(i); continue; }
        const r = P.crecimiento[e] * natalidad;
        const q = r > 0 ? K / (1 + ((K - p) / p) * Math.exp(-r * dt)) : Math.min(p, K);
        if (q < P.minimo) vaciar(i); else pob[i] = q;
      }
    }
    const llegan = new Float64Array(N), aporte = new Float64Array(N), origen = new Int32Array(N), pesos = new Float64Array(8);
    // Una parte de cada celda se muda a las vecinas, más cuanto más llena está y hacia donde hay más espacio
    function migrar(dt) {
      for (const i of tierra) { llegan[i] = 0; aporte[i] = 0; }
      for (const i of tierra) {
        const p = pob[i];
        if (p <= 0) continue;
        const K = capacidad(i, etapaDe(innov[i]));
        const sale = p * (1 - Math.exp(-(P.exploracion + P.presion * Math.min(1, p / K)) * dt));
        if (sale < P.minimo) continue;
        let suma = 0;
        for (let k = 0; k < 8; k++) {
          const j = vecinas[i * 8 + k];
          pesos[k] = 0;
          if (j < 0 || base[j] <= 0) continue;
          const Kj = capacidad(j, etapaDe(aptas(innov[i] | innov[j], j)));
          if (Kj <= 0) continue;
          pesos[k] = Math.max(Kj - pob[j], 0) + 0.01 * Kj;
          suma += pesos[k];
        }
        // Grupos de menos de `minimo` personas no se van
        for (let k = 0; k < 8; k++) if (pesos[k] > 0 && sale * pesos[k] / suma < P.minimo) { suma -= pesos[k]; pesos[k] = 0; }
        if (suma <= 0) continue;
        pob[i] -= sale;
        for (let k = 0; k < 8; k++) if (pesos[k] > 0) {
          const j = vecinas[i * 8 + k], v = sale * pesos[k] / suma;
          llegan[j] += v;
          if (v > aporte[j]) { aporte[j] = v; origen[j] = i; }
        }
      }
      for (const i of tierra) {
        if (llegan[i] <= 0) continue;
        // Si los recién llegados son mayoría, traen su forma de vida (agricultores que desplazan a recolectores)
        if (llegan[i] > pob[i]) adoptar(i, aptas(innov[origen[i]], i));
        pob[i] += llegan[i];
      }
    }
    const visita = new Int32Array(N), cola = new Int32Array(N), dist = new Uint8Array(N), candidatas = [];
    let sello = 0;
    // Tierra habitable alcanzable cruzando hasta `alcance` celdas de agua (sin contar la costa de partida)
    function destinoPorMar(i, alcance) {
      sello++; candidatas.length = 0;
      let a = 0, b = 0;
      cola[b++] = i; visita[i] = sello; dist[i] = 0;
      while (a < b) {
        const c = cola[a++];
        for (let k = 0; k < 8; k++) {
          const j = vecinas[c * 8 + k];
          if (j < 0 || visita[j] === sello) continue;
          visita[j] = sello;
          if (bio[j] === MAR) { if (dist[c] < alcance) { dist[j] = dist[c] + 1; cola[b++] = j; } }
          else if (c !== i && capacidad(j, RECOLECTORES) > 0) candidatas.push(j);
        }
      }
      return candidatas.length ? candidatas[Math.floor(rnd() * candidatas.length)] : -1;
    }
    function cruzarMar(dt) {
      for (const i of costeras) {
        if (pob[i] < P.establecida) continue;
        const nivel = innov[i] & ALTURA ? 2 : innov[i] & COSTERA ? 1 : 0;
        if (rnd() >= 1 - Math.exp(-P.cruce[nivel] * cruceMult * dt)) continue;
        const j = destinoPorMar(i, P.alcance[nivel]);
        if (j < 0) continue;
        const grupo = Math.min(Math.max(pob[i] * 0.05, 2 * P.minimo), 500, pob[i] / 2);
        pob[i] -= grupo;
        if (pob[j] <= 0) innov[j] = 0;
        adoptar(j, aptas(innov[i], j));   // el contacto también lleva las innovaciones
        pob[j] += grupo;
      }
    }

    // --- Hitos ---
    const regionHito = historia.regiones.map(r => r.hito || null);
    const africa = historia.regiones.findIndex(r => r.id === "africa");
    function hito(id, i) {
      if (hechos.has(id)) return;
      hechos.add(id);
      const h = { id, año: Math.round(año), celda: i };
      logros.push(h);
      oyentes.forEach(fn => fn(h));
    }
    function revisarHitos() {
      for (const i of tierra) {
        if (pob[i] < P.establecida || region[i] < 0) continue;
        if (region[i] !== africa) hito("salida_africa", i);
        if (regionHito[region[i]]) hito(regionHito[region[i]], i);
      }
      if (total >= 1e9) hito("mil_millones", -1);
      if (total >= 8e9) hito("ocho_mil_millones", -1);
      if (total <= 0) { hito("extincion", -1); fin = true; }
    }

    // --- Paso del tiempo ---
    function paso(dt) {
      año += dt;
      actualizarClima();
      crecer(dt);
      migrar(dt);
      cruzarMar(dt);
      for (const i of tierra) etapa[i] = pob[i] > 0 ? etapaDe(innov[i]) : VACIA;
      contar();
      revisarHitos();
    }
```

- [ ] **Step 4: Correr todas las pruebas del motor y ver que pasan**

Run: `node --test "pruebas/*.test.mjs"`
Expected: PASS (mundo, datos, motor-mundo y motor-gente: 22 pruebas).

- [ ] **Step 5: Commit**

```bash
git add poblacion/motor.js pruebas/motor-gente.test.mjs
git commit -m "Motor de población: crecimiento, migración, cruces de mar e hitos de llegada" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Motor — innovaciones y saber

**Files:**
- Modify: `poblacion/motor.js` (agregar `// --- Innovaciones ---` antes de `// --- Paso del tiempo ---` y cambiar `paso`)
- Test: `pruebas/motor-innovacion.test.mjs`

**Interfaces:**
- Consumes: internos de las Tareas 3 y 4 (`hito`, `rnd`, `saber`, `domestica`, `costa`, `BITS`, `aptaAgricultura`, `etapaDe`, `capacidad`, `total`, `totalIndustrial`).
- Produces: bits de `m.celdas.innovaciones` (ver `Motor.INNOVACION`), `m.celdas.etapa` de 2 a 4, y los hitos `agricultura_<id de la región>`, `primera_ciudad`, `escritura` e `industria`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`pruebas/motor-innovacion.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba } from "./ayuda.mjs";
const Motor = require("../poblacion/motor.js");
const { AGRICULTURA, CIUDADES, ESCRITURA, INDUSTRIA } = Motor.INNOVACION;
const KM2 = (2 * 111.32) ** 2;
const QUIETO = { cruce: [0, 0, 0], costera: 0, exploracion: 0, presion: 0, industriaGlobal: 0,
  contagio: { 1: 0, 2: 0, 4: 0, 8: 0, 16: 0, 32: 0 } };
const tres = (fila = "04440") => mundoDePrueba(["00000", fila, "00000"]);
const llenos = [-2, 0, 2].map(lon => ({ nombre: `C${lon}`, lat: 0, lon, personas: 6000 }));
const enCentro = [{ id: "centro", nombre: "Centro", riqueza: 1, cajas: [[-1, 1, -1, 1]] }];
const enTodo = [{ id: "todo", nombre: "Todo", riqueza: 1, cajas: [[-90, 90, -180, 180]] }];
const tiene = (m, lon, bit) => (m.celdas.innovaciones[m.celdaDe(0, lon)] & bit) !== 0;

test("la agricultura solo nace en el Holoceno y en una región con domesticables", () => {
  const h = historiaDePrueba({ inicio: -12000, origenes: llenos, domesticables: enCentro });
  const m = Motor.crear(tres(), h, { params: { ...QUIETO, agricultura: 1 } });
  const vistos = [];
  m.alHito(x => vistos.push(x.id));
  m.avanzar(2300);   // −9.700: todavía antes del Holoceno (−9.674)
  assert.equal([-2, 0, 2].some(lon => tiene(m, lon, AGRICULTURA)), false);
  m.avanzar(700);    // −9.000
  assert.equal(tiene(m, 0, AGRICULTURA), true);
  assert.equal(tiene(m, -2, AGRICULTURA), false);
  assert.equal(tiene(m, 2, AGRICULTURA), false);
  assert.ok(vistos.includes("agricultura_centro"));
});

test("la agricultura se contagia a las vecinas aptas y no a la tundra", () => {
  const h = historiaDePrueba({ inicio: -9600, origenes: llenos, domesticables: enCentro });
  const m = Motor.crear(tres("04420"), h, { params: { ...QUIETO, agricultura: 1, contagio: { ...QUIETO.contagio, 2: 1 } } });
  m.avanzar(500);
  assert.equal(tiene(m, 0, AGRICULTURA), true);
  assert.equal(tiene(m, -2, AGRICULTURA), true);
  assert.equal(tiene(m, 2, AGRICULTURA), false);
});

test("las ciudades solo nacen donde la densidad de agricultores pasa el umbral", () => {
  const h = historiaDePrueba({ inicio: -9600, origenes: llenos, domesticables: enTodo });
  const base = { ...QUIETO, agricultura: 1, ciudades: 1 };
  const nunca = Motor.crear(tres(), h, { params: { ...base, densidadCiudad: 1e9 } });
  nunca.avanzar(3000);
  assert.equal(tiene(nunca, 0, CIUDADES), false);
  const pronto = Motor.crear(tres(), h, { params: { ...base, densidadCiudad: 1 } });
  const vistos = [];
  pronto.alHito(x => vistos.push(x.id));
  pronto.avanzar(3000);
  assert.equal(tiene(pronto, 0, CIUDADES), true);
  assert.ok(vistos.includes("primera_ciudad"));
});

test("el saber crece con la gente y sube la capacidad de los agricultores hasta su tope", () => {
  const h = historiaDePrueba({ inicio: -9600, origenes: llenos, domesticables: enTodo });
  const m = Motor.crear(tres(), h, { params: { ...QUIETO, agricultura: 1, ritmoSaber: 50, ciudades: 0 } });
  m.avanzar(100);
  const i = m.celdaDe(0, 0), antes = m.capacidad(i);
  m.avanzar(3000);
  assert.ok(m.capacidad(i) > antes * 1.5);
  assert.ok(m.capacidad(i) <= KM2 * 6 * (1 + Motor.PARAMS.saberMax) * 1.0001);
});

test("la industria necesita escritura y saber acumulado", () => {
  const h = historiaDePrueba({ inicio: -9600, origenes: llenos, domesticables: enTodo });
  const base = { ...QUIETO, agricultura: 1, ciudades: 1, densidadCiudad: 1, ritmoSaber: 50, saberIndustria: 10, industria: 1 };
  const sinEscritura = Motor.crear(tres(), h, { params: { ...base, escritura: 0 } });
  sinEscritura.avanzar(3000);
  assert.equal(tiene(sinEscritura, 0, INDUSTRIA), false);
  const con = Motor.crear(tres(), h, { params: { ...base, escritura: 1, vecinosEscritura: 1 } });
  const vistos = [];
  con.alHito(x => vistos.push(x.id));
  con.avanzar(3000);
  assert.equal(tiene(con, 0, ESCRITURA), true);
  assert.equal(tiene(con, 0, INDUSTRIA), true);
  assert.ok(vistos.includes("escritura") && vistos.includes("industria"));
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `node --test pruebas/motor-innovacion.test.mjs`
Expected: FAIL: ninguna celda llega a tener `AGRICULTURA`.

- [ ] **Step 3: Agregar innovaciones y saber**

En `poblacion/motor.js`, justo antes de `    // --- Paso del tiempo ---`, insertar:

```js
    // --- Innovaciones: aparecen según densidad, conexiones y saber (nunca por un tiempo fijo) y se contagian ---
    const probPor = (tasa, dt) => 1 - Math.exp(-tasa * dt);
    function vecinasCon(i, bit) {
      let n = 0;
      for (let k = 0; k < 8; k++) { const j = vecinas[i * 8 + k]; if (j >= 0 && pob[j] > 0 && (innov[j] & bit)) n++; }
      return n;
    }
    function puedeAdoptar(bit, v, i, apta) {
      if (bit === COSTERA) return costa[i] === 1;
      if (bit === ALTURA) return costa[i] === 1 && (v & COSTERA) !== 0;
      if (bit === AGRICULTURA) return apta;
      if (!apta || !(v & AGRICULTURA)) return false;
      return bit !== ESCRITURA || (v & CIUDADES) !== 0;
    }
    // Saber: crece con la gente (más personas, más ideas; Kremer 1993) y se iguala con el de las vecinas agrícolas
    function acumularSaber(i, v, dt) {
      const escribe = (v & ESCRITURA) !== 0;
      let s = saber[i] + dt * P.ritmoSaber * (pob[i] / 1e6) * (escribe ? P.escrituraSaber : 1);
      let suma = 0, n = 0;
      for (let k = 0; k < 8; k++) {
        const j = vecinas[i * 8 + k];
        if (j >= 0 && pob[j] > 0 && (innov[j] & AGRICULTURA)) { suma += saber[j]; n++; }
      }
      if (n) s += (suma / n - s) * probPor(P.difusionSaber * (escribe ? P.contagioEscritura : 1), dt);
      saber[i] = s;
    }
    function innovar(dt) {
      const fracInd = total > 0 ? totalIndustrial / total : 0;
      for (const i of tierra) {
        const p = pob[i];
        if (p <= 0) continue;
        let v = innov[i];
        const apta = aptaAgricultura(i);
        if (v & AGRICULTURA) acumularSaber(i, v, dt);
        if (!(v & COSTERA) && costa[i] && rnd() < probPor(P.costera * p / 1000, dt)) v |= COSTERA;
        if (!(v & AGRICULTURA) && apta && año >= historia.holoceno && domestica[i] >= 0) {
          const d = historia.domesticables[domestica[i]];
          const llena = Math.min(1, Math.max(0, (p / capacidad(i, RECOLECTORES) - P.llenaAgricultura) / (1 - P.llenaAgricultura)));
          if (llena > 0 && rnd() < probPor(P.agricultura * d.riqueza * llena, dt)) { v |= AGRICULTURA; hito(`agricultura_${d.id}`, i); }
        }
        if ((v & AGRICULTURA) && !(v & CIUDADES)) {
          const exceso = Math.min(1, Math.max(0, p / base[i] / P.densidadCiudad - 1));
          if (exceso > 0 && rnd() < probPor(P.ciudades * exceso * vecinasCon(i, AGRICULTURA) / 8, dt)) { v |= CIUDADES; hito("primera_ciudad", i); }
        }
        if ((v & CIUDADES) && !(v & ESCRITURA)) {
          const red = vecinasCon(i, CIUDADES) - P.vecinosEscritura + 1;
          if (red > 0 && rnd() < probPor(P.escritura * red, dt)) { v |= ESCRITURA; hito("escritura", i); }
        }
        if ((v & COSTERA) && (v & AGRICULTURA) && !(v & ALTURA) && costa[i]) {
          const s = Math.min(1, saber[i] / P.saberAltura);
          if (s > 0 && rnd() < probPor(P.altura * s, dt)) v |= ALTURA;
        }
        if ((v & ESCRITURA) && !(v & INDUSTRIA)) {
          const exceso = Math.min(1, Math.max(0, saber[i] / P.saberIndustria - 1));
          if (exceso > 0 && rnd() < probPor(P.industria * exceso, dt)) { v |= INDUSTRIA; hito("industria", i); }
        }
        // Contagio desde las vecinas (más rápido con escritura) y, para la industria, desde todo el mundo agrícola
        let union = 0;
        for (let k = 0; k < 8; k++) { const j = vecinas[i * 8 + k]; if (j >= 0 && pob[j] > 0) union |= innov[j]; }
        const global = fracInd > 0 && apta && (v & AGRICULTURA) && !(v & INDUSTRIA);
        if ((union & ~v) || global) {
          const mult = v & ESCRITURA ? P.contagioEscritura : 1;
          for (const bit of BITS) {
            if ((v & bit) || !puedeAdoptar(bit, v, i, apta)) continue;
            let tasa = union & bit ? P.contagio[bit] * vecinasCon(i, bit) * mult : 0;
            if (bit === INDUSTRIA) tasa += P.industriaGlobal * fracInd;
            if (tasa > 0 && rnd() < probPor(tasa, dt)) v |= bit;
          }
        }
        innov[i] = v;
        etapa[i] = etapaDe(v);
      }
    }

```

Y en `paso`, reemplazar la línea

```js
      for (const i of tierra) etapa[i] = pob[i] > 0 ? etapaDe(innov[i]) : VACIA;
```

por

```js
      innovar(dt);
```

(`vaciar` ya deja `etapa[i] = VACIA`; `innovar` actualiza la etapa de las celdas habitadas).

- [ ] **Step 4: Correr todas las pruebas y ver que pasan**

Run: `node --test "pruebas/*.test.mjs"`
Expected: PASS (27 pruebas).

- [ ] **Step 5: Commit**

```bash
git add poblacion/motor.js pruebas/motor-innovacion.test.mjs
git commit -m "Motor de población: agricultura, ciudades, escritura, navegación e industria según densidad y saber" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Partida — reloj, pausas y fin

**Files:**
- Create: `poblacion/partida.js`
- Test: `pruebas/partida.test.mjs`

**Interfaces:**
- Consumes: `Motor.crear`, `Motor.tramo` y `m.alHito`, `m.avanzar`, `m.año`, `m.pasoMax`, `m.terminado`, `m.semilla` (Tareas 3–5); `historia.velocidades`, `historia.presente`.
- Produces:
  - `Partida.textoAño(año, presente)` → `"hace 58.000 años"` | `"3000 a. C."` | `"1850"`; `Partida.MULTIPLICADORES = [0.25, 0.5, 1, 2, 4]`.
  - `Partida.crear(mundo, historia, opciones?)` → `p`. `opciones = { semilla, params, presupuestoMs = 3, pausarEnHitos = true, reloj = () => performance.now() }`.
  - `p.motor()`, `p.nueva(semilla?)`, `p.paso(dtSegundos)` → años avanzados, `p.añosPorSegundo()`, `p.reproduciendo()`, `p.setReproduciendo(b)` → estado real, `p.velocidad(i)` (0–4), `p.textoAño(año?)`, `p.textoVelocidad()` → `"2.000 años/s"`, `p.pendientes()` → copia de la cola de hitos, `p.tomarHito()` → el primero de la cola o `null`, `p.terminada()`, `p.alEvento(fn)` con `{ tipo: "hito", hito } | { tipo: "pausa" } | { tipo: "fin" } | { tipo: "nueva" }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`pruebas/partida.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { require, mundoDePrueba, historiaDePrueba } from "./ayuda.mjs";
const Partida = require("../poblacion/partida.js");
const QUIETO = { cruce: [0, 0, 0], costera: 0 };
const isla = () => mundoDePrueba(["000", "040", "000"], { lonOeste: -3 });
const conGente = extra => historiaDePrueba({ origenes: [{ nombre: "A", lat: 0, lon: 0, personas: 500 }], ...extra });

test("el año se escribe como 'hace N años', 'a. C.' o como año d. C.", () => {
  assert.equal(Partida.textoAño(-55974, 2026), "hace 58.000 años");
  assert.equal(Partida.textoAño(-10000, 2026), "10.000 a. C.");
  assert.equal(Partida.textoAño(-3000, 2026), "3000 a. C.");
  assert.equal(Partida.textoAño(1850, 2026), "1850");
});

test("la velocidad automática depende de la era y el multiplicador la escala", () => {
  const p = Partida.crear(isla(), conGente({ velocidades: [[-1e9, 1000], [-15000, 10]] }), { params: QUIETO, pausarEnHitos: false, presupuestoMs: Infinity });
  assert.equal(p.añosPorSegundo(), 1000);
  p.velocidad(4); assert.equal(p.añosPorSegundo(), 4000);
  p.velocidad(0); assert.equal(p.añosPorSegundo(), 250);
  p.velocidad(99); assert.equal(p.añosPorSegundo(), 4000);
  p.velocidad(2);
  p.paso(5.5);
  assert.equal(p.motor().año(), -14500);
  assert.equal(p.añosPorSegundo(), 10);
  assert.equal(p.textoVelocidad(), "10 años/s");
});

test("un cuadro avanza al menos un paso aunque se acabe el presupuesto de tiempo", () => {
  let t = 0;
  const p = Partida.crear(isla(), conGente(), { params: QUIETO, pausarEnHitos: false, presupuestoMs: 3, reloj: () => (t += 5) });
  p.paso(10);   // pediría 10.000 años
  assert.equal(p.motor().año(), -19990);
});

test("un hito pausa la partida y los hitos del mismo cuadro quedan en orden", () => {
  const h = conGente({
    regiones: [{ id: "b", nombre: "B", hito: "b", cajas: [[-90, 90, -180, 0]] }, { id: "c", nombre: "C", hito: "c", cajas: [[-90, 90, 0, 180]] }],
    origenes: [{ nombre: "B", lat: 0, lon: -2, personas: 500 }, { nombre: "C", lat: 0, lon: 2, personas: 500 }]
  });
  const p = Partida.crear(mundoDePrueba(["00000", "04040", "00000"]), h, { params: QUIETO, presupuestoMs: Infinity });
  const eventos = [];
  p.alEvento(e => eventos.push(e.tipo));
  p.paso(1);
  assert.equal(p.reproduciendo(), false);
  assert.deepEqual(p.pendientes().map(x => x.id), ["salida_africa", "b", "c"]);
  assert.equal(eventos.filter(t => t === "hito").length, 3);
  assert.equal(p.tomarHito().id, "salida_africa");
  assert.equal(p.tomarHito().id, "b");
  assert.equal(p.pendientes().length, 1);
});

test("la partida se detiene justo en el presente y no se puede reanudar", () => {
  const p = Partida.crear(isla(), conGente({ inicio: 1990, velocidades: [[-1e9, 10]] }), { params: QUIETO, pausarEnHitos: false, presupuestoMs: Infinity });
  const eventos = [];
  p.alEvento(e => eventos.push(e.tipo));
  p.paso(100);   // pediría 1.000 años
  assert.equal(p.motor().año(), 2026);
  assert.equal(p.terminada(), true);
  assert.equal(p.reproduciendo(), false);
  assert.equal(p.setReproduciendo(true), false);
  p.paso(1);
  assert.equal(eventos.filter(t => t === "fin").length, 1);
  assert.equal(p.textoAño(), "2026");
});

test("una partida nueva vuelve al inicio y vacía los avisos pendientes", () => {
  const p = Partida.crear(isla(), conGente(), { params: QUIETO, presupuestoMs: Infinity });
  p.paso(1);
  assert.ok(p.pendientes().length > 0);
  const eventos = [];
  p.alEvento(e => eventos.push(e.tipo));
  p.nueva(42);
  assert.equal(p.pendientes().length, 0);
  assert.equal(p.motor().año(), -20000);
  assert.equal(p.motor().semilla, 42);
  assert.equal(p.reproduciendo(), true);
  assert.deepEqual(eventos, ["nueva"]);
});

test("si la humanidad se extingue, la partida avisa y termina", () => {
  const h = conGente({ hielo: [{ nombre: "Todo", gMin: 0, cajas: [[-90, 90, -180, 180]] }] });
  const p = Partida.crear(isla(), h, { params: QUIETO, presupuestoMs: Infinity });
  const eventos = [];
  p.alEvento(e => eventos.push(e.tipo));
  p.paso(1);
  assert.ok(p.pendientes().some(x => x.id === "extincion"));
  assert.equal(p.terminada(), true);
  assert.ok(eventos.includes("fin"));
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `node --test pruebas/partida.test.mjs`
Expected: FAIL con `Cannot find module '../poblacion/partida.js'`.

- [ ] **Step 3: Escribir la partida**

`poblacion/partida.js`:

```js
// Partida de "La Tierra": el reloj (velocidad automática por era), la pausa en los hitos y el fin en el presente.
// No usa three.js ni el DOM.
const Partida = (() => {
  const MotorRef = typeof Motor !== "undefined" ? Motor : require("./motor.js");
  const MULTIPLICADORES = [0.25, 0.5, 1, 2, 4];

  function textoAño(año, presente) {
    if (año < -10000) return `hace ${(Math.round((presente - año) / 100) * 100).toLocaleString("es")} años`;
    if (año < 0) return `${Math.round(-año).toLocaleString("es")} a. C.`;
    return String(Math.max(1, Math.round(año)));
  }

  function crear(mundo, historia, opciones = {}) {
    const presupuestoMs = opciones.presupuestoMs ?? 3;
    const reloj = opciones.reloj ?? (() => performance.now());
    const oyentes = [];
    const emitir = e => oyentes.forEach(fn => fn(e));
    let motor, jugando = true, mult = 2, cola = [], finAvisado = false;

    function nueva(semilla) {
      motor = MotorRef.crear(mundo, historia, { semilla, params: opciones.params });
      cola = []; finAvisado = false; jugando = true;
      motor.alHito(h => {
        cola.push(h);
        if (opciones.pausarEnHitos !== false) jugando = false;
        emitir({ tipo: "hito", hito: h });
      });
      emitir({ tipo: "nueva" });
    }
    const añosPorSegundo = () => MotorRef.tramo(historia.velocidades, motor.año()) * MULTIPLICADORES[mult];

    function paso(dt) {
      if (!jugando || motor.terminado()) return 0;
      const meta = Math.min(dt * añosPorSegundo(), historia.presente - motor.año());
      const t0 = reloj();
      let hecho = 0;
      // Al menos un paso por cuadro; después, solo mientras quede presupuesto de tiempo
      do {
        const d = Math.min(meta - hecho, motor.pasoMax());
        if (d <= 0) break;
        motor.avanzar(d);
        hecho += d;
      } while (meta - hecho > 1e-6 && jugando && reloj() - t0 < presupuestoMs);
      if (motor.terminado() && !finAvisado) { finAvisado = true; jugando = false; emitir({ tipo: "fin" }); }
      return hecho;
    }

    nueva(opciones.semilla);
    return {
      motor: () => motor,
      nueva,
      paso,
      añosPorSegundo,
      reproduciendo: () => jugando,
      setReproduciendo(b) { jugando = !!b && !motor.terminado(); emitir({ tipo: "pausa" }); return jugando; },
      velocidad(i) { mult = Math.min(MULTIPLICADORES.length - 1, Math.max(0, Math.round(i))); },
      textoAño: (año = motor.año()) => textoAño(año, historia.presente),
      textoVelocidad: () => `${añosPorSegundo().toLocaleString("es", { maximumFractionDigits: 1 })} años/s`,
      pendientes: () => cola.slice(),
      tomarHito: () => cola.shift() || null,
      terminada: () => motor.terminado(),
      alEvento(fn) { oyentes.push(fn); }
    };
  }

  return { crear, textoAño, MULTIPLICADORES };
})();
if (typeof module !== "undefined") module.exports = Partida;
```

- [ ] **Step 4: Correr todas las pruebas y ver que pasan**

Run: `node --test "pruebas/*.test.mjs"`
Expected: PASS (34 pruebas).

- [ ] **Step 5: Commit**

```bash
git add poblacion/partida.js pruebas/partida.test.mjs
git commit -m "Partida de población: reloj por era, pausa en los hitos y fin en el presente" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Calibración contra la historia real

**Files:**
- Create: `pruebas/calibrar.mjs`
- Modify: `poblacion/motor.js` (solo valores de `PARAMS`)

**Interfaces:**
- Consumes: `MUNDO`, `HISTORIA`, `Motor.crear` (Tareas 1–5).
- Produces: `PARAMS` calibrados. La salida de `calibrar.mjs` va en el cuerpo del commit.

- [ ] **Step 1: Escribir el script de calibración**

`pruebas/calibrar.mjs`:

```js
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
const CONTINENTES = ["asia", "europa", "sahul", "norteamerica", "sudamerica"];
const n = Number(process.argv[2] || 30);
const años = Object.fromEntries(VENTANAS.map(([id]) => [id, []]));
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
  for (const [id] of VENTANAS) años[id].push(h.has(id) ? h.get(id) : Infinity);
  if (CONTINENTES.every(id => h.has(id))) completas++;
  poblaciones.push(m.poblacionTotal());
  process.stdout.write(".");
}

const pct = (arr, q) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
const fmt = a => a === Infinity ? "nunca" : a < -10000 ? `hace ${Math.round((P - a) / 1000)} mil` : a < 0 ? `${-Math.round(a)} a. C.` : `${Math.round(a)}`;
let ok = true;
console.log("\n\n  hito                p10            mediana        p90            ventana de la mediana");
for (const [id, a, b] of VENTANAS) {
  const med = pct(años[id], 0.5), bien = med >= a && med <= b;
  ok = ok && bien;
  console.log(`${bien ? "✓" : "✗"} ${id.padEnd(18)} ${fmt(pct(años[id], 0.1)).padEnd(14)} ${fmt(med).padEnd(14)} ${fmt(pct(años[id], 0.9)).padEnd(14)} ${fmt(a)} … ${fmt(b)}`);
}
const medPob = pct(poblaciones, 0.5), pobBien = medPob >= 3e9 && medPob <= 15e9;
const contBien = completas / n >= 0.8, tMed = pct(tiempos, 0.5), tBien = tMed < 2000;
ok = ok && pobBien && contBien && tBien;
console.log(`${pobBien ? "✓" : "✗"} población en ${P}: mediana ${(medPob / 1e9).toFixed(2)} mil millones (ventana 3–15)`);
console.log(`${contBien ? "✓" : "✗"} llegan a todos los continentes habitados: ${completas}/${n} partidas (mínimo 80 %)`);
console.log(`${tBien ? "✓" : "✗"} tiempo por partida: mediana ${Math.round(tMed)} ms (máximo 2000)`);
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Correr la calibración con los parámetros iniciales**

Run: `node pruebas/calibrar.mjs 10`
Expected: termina e imprime la tabla. Lo normal es que varias filas salgan con ✗; anota cuáles.

Si la mediana del tiempo pasa de 2000 ms, primero optimiza (sin cambiar resultados) y vuelve a medir: perfila con `node --cpu-prof pruebas/calibrar.mjs 3` y mira el `.cpuprofile` en las DevTools de Chrome. Los sospechosos habituales son `capacidad` dentro de `migrar`, `vecinasCon` dentro de `innovar` y `revisarHitos` (que recorre todas las celdas en cada paso). Suele bastar con dos cambios: precalcular por paso la capacidad de recolectores de cada celda en un `Float32Array`, y que `revisarHitos` deje de recorrer las celdas cuando ya se alcanzaron todas las regiones.

- [ ] **Step 3: Ajustar `PARAMS` en orden cronológico hasta que todo pase**

Cambia **un** parámetro por vez en `poblacion/motor.js`, corre `node pruebas/calibrar.mjs 10` y, cuando todo pase con 10 partidas, confirma con 30. Calibra en este orden: primero las llegadas, después la agricultura (el Holoceno ya la acota) y al final ciudades, industria y población, que dependen del saber.

| Si falla… | Ajusta | Efecto |
|---|---|---|
| `salida_africa` muy tarde / temprano | `exploracion`, `presion` | más alto = el frente avanza más rápido |
| `sahul` muy tarde | `cruce[0]`, `costera` | más alto = se cruza antes |
| `europa` muy tarde | `exploracion`, `densidad[1][2]` (tundra), `frio` | más gente aguanta el frío |
| `norteamerica` muy tarde | `densidad[1][2]` (tundra), `exploracion` | Beringia más transitable |
| `agricultura` muy tarde | `agricultura`, `llenaAgricultura` (más bajo) | aparece antes en el Holoceno |
| `primera_ciudad` muy temprano / tarde | `densidadCiudad`, `ritmoSaber`, `ciudades` | umbral más alto o saber más lento = más tarde |
| `industria` muy temprano / tarde | `saberIndustria`, `ritmoSaber`, `difusionSaber` | más saber necesario = más tarde |
| población en 2026 fuera de 3–15 mil millones | `densidad[4]`, `crecimiento[4]`, `industriaGlobal` | más densidad = más gente |
| menos del 80 % llega a todos los continentes | `cruce[0]`, `exploracion` | más alcance |

Reglas:
- Nunca agregues una condición con fechas ni un dato que fuerce un hito. Solo valen los parámetros de `PARAMS`.
- Mantén las densidades de recolectores dentro de 2× de sus valores etnográficos iniciales.
- Cuando cambies un parámetro de una época temprana, vuelve a revisar las filas posteriores.

- [ ] **Step 4: Confirmar con 30 partidas y con las pruebas**

Run: `node pruebas/calibrar.mjs`
Expected: todas las filas con ✓ y código de salida 0.

Run: `node --test "pruebas/*.test.mjs"`
Expected: PASS (34 pruebas; usan parámetros propios, así que no dependen de la calibración).

- [ ] **Step 5: Commit con el resultado**

```bash
git add pruebas/calibrar.mjs poblacion/motor.js
git commit -m "Calibración de la simulación de población contra la historia real" -m "<pega aquí la tabla que imprimió node pruebas/calibrar.mjs>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Escala "La Tierra" en 3D

**Files:**
- Create: `poblacion/vista.js`
- Modify: `index.html` (lista `SCALES`, carga de scripts, módulo `Space` y el muelle de la interfaz)

**Interfaces:**
- Consumes: `Partida.crear` (Tarea 6), `MUNDO`, `HISTORIA`; de `Space`: `loadTex`, `round`, `backdrop`, `aspectK`, `reduceMotion`, `renderer`, `Tex.forBody`, `byId.tierra`.
- Produces:
  - `VistaTierra.crear(opciones)` → objeto de escala `LV.tierra = { scene, objs, update(dt), setCapa(nombre, on), oclusor, minD, maxD, near, tgt, anchor, over() }`; `nombre` ∈ `"hielo" | "grupos" | "luces"`.
  - `VistaTierra.normal(lat, lon)` → `THREE.Vector3` unitario; `VistaTierra.R = 10`.
  - `Space.tierra = { partida, fallo, setCapa(nombre, on) }` y `Space.apuntar(normal, dist = 24)`.
  - Cada continente de `HISTORIA.continentes` gana `world`, `normal`, `view: 24` y `r: 0`.

- [ ] **Step 1: Escribir la vista**

`poblacion/vista.js`:

```js
// Escena 3D de la escala "La Tierra": globo con hielo y costas antiguas, bandas que caminan y luces de la partida.
const VistaTierra = (() => {
  const R = 10, D2R = Math.PI / 180, MAX_BANDAS = 3000, MAX_LUCES = 20000;

  // Escribe en arr el punto k de latitud y longitud dadas sobre una esfera de radio `radio`, con la misma
  // orientación que las texturas en THREE.SphereGeometry (u = 0 en la longitud −180°, v = 1 en el polo norte)
  function escribirPunto(arr, k, lat, lon, radio) {
    const phi = (lon + 180) * D2R, c = Math.cos(lat * D2R);
    arr[k * 3] = -Math.cos(phi) * c * radio;
    arr[k * 3 + 1] = Math.sin(lat * D2R) * radio;
    arr[k * 3 + 2] = Math.sin(phi) * c * radio;
  }
  const uno = new Float32Array(3);
  function normal(lat, lon) { escribirPunto(uno, 0, lat, lon, 1); return new THREE.Vector3(uno[0], uno[1], uno[2]); }
  // Azar fijo por número: cada celda reparte sus luces siempre en los mismos lugares
  const hash = n => { const s = Math.sin(n * 12.9898) * 43758.5453, t = Math.sin(n * 78.233) * 12345.6789; return [s - Math.floor(s), t - Math.floor(t)]; };

  function crear({ partida, historia, cargarTextura, respaldo, punto, fondo, aspectK, reduceMotion, pixelRatio }) {
    const scene = new THREE.Scene();
    fondo(scene);
    const sol = new THREE.Vector3(1, 0.25, 0.4).normalize();
    let angSol = 0;

    // Capa de datos: un píxel por celda (R = hielo de la glaciación, G = plataforma seca de un puente de tierra).
    // La fila 0 de una DataTexture es el sur, así que las filas del motor (0 = norte) se escriben al revés.
    const { ancho: W, alto: H } = partida.motor().celdas;
    const datos = new Uint8Array(W * H * 4);
    const capas = new THREE.DataTexture(datos, W, H, THREE.RGBAFormat);
    capas.magFilter = THREE.LinearFilter; capas.minFilter = THREE.LinearFilter;
    const negro = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
    negro.needsUpdate = true;

    // Globo: textura real de día, brillo del Sol en el mar, hielo y plataformas secas encima, noche azulada
    const globoMat = new THREE.ShaderMaterial({
      uniforms: { dia: { value: respaldo }, mares: { value: negro }, capas: { value: capas }, sol: { value: sol }, verCapas: { value: 1 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vWp;
        void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform sampler2D dia, mares, capas; uniform vec3 sol; uniform float verCapas; varying vec2 vUv; varying vec3 vN; varying vec3 vWp;
        void main() {
          vec3 N = normalize(vN), L = normalize(sol), V = normalize(cameraPosition - vWp);
          float nl = dot(N, L);
          vec4 c = texture2D(capas, vUv) * verCapas;
          vec3 col = texture2D(dia, vUv).rgb;
          col = mix(col, vec3(0.45, 0.42, 0.32), c.g * (1.0 - c.r));
          col = mix(col, vec3(0.93, 0.96, 1.0), c.r);
          float mar = texture2D(mares, vUv).r * (1.0 - c.g) * (1.0 - c.r);
          vec3 luz = col * (max(nl, 0.0) * 1.1 + 0.05);
          luz += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, normalize(L + V)), 0.0), 220.0) * mar * 0.5 * step(0.0, nl);
          luz += vec3(0.015, 0.025, 0.05) * (1.0 - smoothstep(-0.2, 0.1, nl));
          gl_FragColor = vec4(luz, 1.0);
        }`
    });
    const globo = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), globoMat);
    scene.add(globo);
    cargarTextura("earth_day.jpg").then(t => { if (t) globoMat.uniforms.dia.value = t; });
    cargarTextura("earth_spec.jpg").then(t => { if (t) globoMat.uniforms.mares.value = t; });
    // Atmósfera: borde azul, más brillante del lado de día
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 64, 32), new THREE.ShaderMaterial({
      uniforms: { sol: { value: sol } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 sol; varying vec3 vN; varying vec3 vV;
        void main() { float rim = pow(1.0 - max(dot(vN, vV), 0.0), 2.6); float dia = 0.25 + 0.75 * smoothstep(-0.3, 0.4, dot(vN, normalize(sol)));
          gl_FragColor = vec4(vec3(0.37, 0.66, 1.0) * rim * dia * 1.4, rim * dia); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    })));

    // Bandas de recolectores: puntos cálidos que caminan dentro de su celda
    const bPos = new Float32Array(MAX_BANDAS * 3);
    const bandasGeo = new THREE.BufferGeometry();
    bandasGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    bandasGeo.setDrawRange(0, 0);
    const bandas = new THREE.Points(bandasGeo, new THREE.PointsMaterial({ color: 0xffc27a, size: 3.2, sizeAttenuation: false, map: punto,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    bandas.frustumCulled = false;
    scene.add(bandas);
    const bCelda = new Int32Array(MAX_BANDAS), bU = new Float32Array(MAX_BANDAS), bV = new Float32Array(MAX_BANDAS);
    const bDu = new Float32Array(MAX_BANDAS), bDv = new Float32Array(MAX_BANDAS);
    let nBandas = 0;
    function rumbo(b) { const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.06; bDu[b] = Math.cos(a) * v; bDv[b] = Math.sin(a) * v; }
    function nuevaBanda(b, i) { bCelda[b] = i; bU[b] = 0.15 + Math.random() * 0.7; bV[b] = 0.15 + Math.random() * 0.7; rumbo(b); }
    function copiarBanda(a, b) { if (a === b) return; bCelda[b] = bCelda[a]; bU[b] = bU[a]; bV[b] = bV[a]; bDu[b] = bDu[a]; bDv[b] = bDv[a]; }
    // Cuántas bandas quiere cada celda de recolectores (sigue el logaritmo de su población); conserva las que siguen sirviendo
    function repartirBandas() {
      const c = partida.motor().celdas, quiere = new Map();
      let suma = 0;
      for (const i of c.tierra) {
        if (c.etapa[i] !== 1) continue;
        const n = Math.min(4, Math.max(1, Math.round(Math.log10(c.poblacion[i]) - 1)));
        quiere.set(i, n); suma += n;
      }
      if (suma > MAX_BANDAS) {
        const f = MAX_BANDAS / suma;
        for (const [i, n] of quiere) { const x = n * f; quiere.set(i, Math.floor(x) + (Math.random() < x % 1 ? 1 : 0)); }
      }
      const tiene = new Map();
      let k = 0;
      for (let b = 0; b < nBandas; b++) {
        const i = bCelda[b], ya = tiene.get(i) || 0;
        if ((quiere.get(i) || 0) > ya) { tiene.set(i, ya + 1); copiarBanda(b, k++); }
      }
      for (const [i, n] of quiere) for (let ya = tiene.get(i) || 0; ya < n && k < MAX_BANDAS; ya++) nuevaBanda(k++, i);
      nBandas = k;
      bandasGeo.setDrawRange(0, nBandas);
    }
    function moverBandas(dt) {
      const c = partida.motor().celdas, G = c.grados;
      for (let b = 0; b < nBandas; b++) {
        if (!reduceMotion) {
          bU[b] += bDu[b] * dt; bV[b] += bDv[b] * dt;
          if (bU[b] < 0.1 || bU[b] > 0.9) { bDu[b] = -bDu[b]; bU[b] = Math.min(0.9, Math.max(0.1, bU[b])); }
          if (bV[b] < 0.1 || bV[b] > 0.9) { bDv[b] = -bDv[b]; bV[b] = Math.min(0.9, Math.max(0.1, bV[b])); }
          if (Math.random() < dt * 0.3) rumbo(b);
        }
        const i = bCelda[b];
        escribirPunto(bPos, b, c.lat[i] + (0.5 - bV[b]) * G, c.lon[i] + (bU[b] - 0.5) * G, R * 1.004);
      }
      bandasGeo.attributes.position.needsUpdate = true;
    }

    // Luces de aldeas, ciudades e industria: solo se ven del lado de noche
    const lPos = new Float32Array(MAX_LUCES * 3), lBrillo = new Float32Array(MAX_LUCES);
    const lucesGeo = new THREE.BufferGeometry();
    lucesGeo.setAttribute("position", new THREE.BufferAttribute(lPos, 3));
    lucesGeo.setAttribute("brillo", new THREE.BufferAttribute(lBrillo, 1));
    lucesGeo.setDrawRange(0, 0);
    const luces = new THREE.Points(lucesGeo, new THREE.ShaderMaterial({
      uniforms: { sol: { value: sol }, mapa: { value: punto }, escala: { value: pixelRatio } },
      vertexShader: `attribute float brillo; uniform vec3 sol; uniform float escala; varying float vLuz;
        void main() {
          vLuz = brillo * (1.0 - smoothstep(-0.15, 0.1, dot(normalize(position), normalize(sol))));
          gl_PointSize = (2.0 + 5.0 * brillo) * escala;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `uniform sampler2D mapa; varying float vLuz;
        void main() { float a = texture2D(mapa, gl_PointCoord).a * vLuz; if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.78, 0.45) * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    luces.frustumCulled = false;
    scene.add(luces);
    function encenderLuces() {
      const c = partida.motor().celdas, G = c.grados;
      let k = 0;
      for (const i of c.tierra) {
        const e = c.etapa[i];
        if (e < 2) continue;
        const brillo = Math.min(1, Math.max(0.15, (Math.log10(c.poblacion[i]) - 3) / 5));
        const puntos = e === 2 ? 1 : e === 3 ? 3 : 5;
        for (let p = 0; p < puntos && k < MAX_LUCES; p++, k++) {
          const [hu, hv] = hash(i * 7 + p);
          escribirPunto(lPos, k, c.lat[i] + (hv - 0.5) * G * 0.8, c.lon[i] + (hu - 0.5) * G * 0.8, R * 1.002);
          lBrillo[k] = brillo * (p === 0 ? 1 : 0.6);
        }
      }
      lucesGeo.setDrawRange(0, k);
      lucesGeo.attributes.position.needsUpdate = true;
      lucesGeo.attributes.brillo.needsUpdate = true;
    }

    function pintarCapas() {
      const c = partida.motor().celdas;
      for (const i of c.tierra) {
        const t = ((H - 1 - Math.floor(i / W)) * W + (i % W)) * 4;
        datos[t] = c.hielo[i] ? 255 : 0;
        datos[t + 1] = c.plataforma[i] ? 255 : 0;
        datos[t + 3] = 255;
      }
      capas.needsUpdate = true;
    }

    // Continentes del muelle, con el punto del globo donde va su etiqueta
    const objs = historia.continentes.map(c => {
      const n = normal(c.lat, c.lon);
      return Object.assign(c, { world: n.clone().multiplyScalar(R * 1.02), normal: n, view: R * 2.4, r: 0 });
    });

    let tCapas = 1, tGente = 1, añoCapas = NaN, añoGente = NaN;
    partida.alEvento(e => {
      if (e.tipo !== "nueva") return;
      nBandas = 0; bandasGeo.setDrawRange(0, 0);
      añoCapas = añoGente = NaN;
    });
    function update(dt) {
      partida.paso(dt);
      if (!reduceMotion) {
        angSol += dt * Math.PI * 2 / 60;
        sol.set(Math.cos(angSol), 0.25, Math.sin(angSol)).normalize();
      }
      const año = partida.motor().año();
      tCapas += dt; tGente += dt;
      if (tCapas >= 0.25 && año !== añoCapas) { tCapas = 0; añoCapas = año; pintarCapas(); }
      if (tGente >= 0.5 && año !== añoGente) { tGente = 0; añoGente = año; repartirBandas(); encenderLuces(); }
      moverBandas(dt);
    }
    function setCapa(nombre, on) {
      if (nombre === "hielo") globoMat.uniforms.verCapas.value = on ? 1 : 0;
      if (nombre === "grupos") bandas.visible = on;
      if (nombre === "luces") luces.visible = on;
    }

    pintarCapas(); repartirBandas(); encenderLuces();
    return {
      scene, objs, update, setCapa, oclusor: globo,
      minD: R * 1.15, maxD: R * 6, near: R * 2.6,
      tgt: new THREE.Vector3(), anchor: new THREE.Vector3(),
      over: () => new THREE.Vector3(0, R * 0.9, R * 2.8).multiplyScalar(aspectK())
    };
  }

  return { crear, normal, R };
})();
if (typeof module !== "undefined") module.exports = VistaTierra;
```

- [ ] **Step 2: Registrar la escala en `index.html`**

1. En `SCALES`, reemplazar:

```js
const SCALES = [
  { id: "solar", name: "Sistema solar", span: "horas luz", pill: "" },
```

por:

```js
const SCALES = [
  { id: "tierra", name: "La Tierra", span: "miles de km", pill: "" },
  { id: "solar", name: "Sistema solar", span: "horas luz", pill: "" },
```

2. Cargar los scripts antes de la escena 3D. Reemplazar:

```html
<script>
// Escena 3D: estrellas, Sol, planetas, cinturones, órbitas y cámara que viaja entre astros.
```

por:

```html
<script src="poblacion/mundo.js"></script>
<script src="poblacion/datos.js"></script>
<script src="poblacion/motor.js"></script>
<script src="poblacion/partida.js"></script>
<script src="poblacion/vista.js"></script>
<script src="poblacion/panel.js"></script>
<script>
// Escena 3D: estrellas, Sol, planetas, cinturones, órbitas y cámara que viaja entre astros.
```

(`poblacion/panel.js` todavía no existe: el navegador da un 404 y sigue. Lo crea la Tarea 9.)

3. Crear `LV.tierra` dentro de `Space`. Reemplazar:

```js
  // Etiquetas y áreas de toque de las escalas cósmicas
```

por:

```js
  // La Tierra habitada (poblacion/*.js). Si algo falla, la escala queda vacía con un aviso y el resto sigue igual.
  let partidaTierra = null;
  try {
    if (typeof VistaTierra === "undefined") throw new Error("No se cargó poblacion/vista.js");
    partidaTierra = Partida.crear(MUNDO, HISTORIA);
    LV.tierra = VistaTierra.crear({
      partida: partidaTierra, historia: HISTORIA, cargarTextura: loadTex, punto: round, aspectK, reduceMotion,
      respaldo: new THREE.CanvasTexture(Tex.forBody(byId.tierra, BODIES.indexOf(byId.tierra))),
      fondo: sc => backdrop(sc, 2500, 900, 1400, 1.4, 0.55), pixelRatio: renderer.getPixelRatio()
    });
  } catch (e) {
    console.error("La Tierra habitada no está disponible:", e);
    partidaTierra = null;
    LV.tierra = { scene: new THREE.Scene(), minD: 12, maxD: 60, tgt: new THREE.Vector3(), anchor: new THREE.Vector3(), near: 26,
      over: () => new THREE.Vector3(0, 9, 28), objs: [], fallo: true };
  }

  // Etiquetas y áreas de toque de las escalas cósmicas
```

4. Área de toque más chica para los continentes. Reemplazar:

```js
        const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(o.r * 1.2, id === "stars" ? 1.4 : id === "galaxy" ? 2.4 : 4), 12, 6),
```

por:

```js
        const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(o.r * 1.2, id === "stars" ? 1.4 : id === "galaxy" ? 2.4 : id === "tierra" ? 1.2 : 4), 12, 6),
```

5. El globo tapa los toques del otro lado. Reemplazar:

```js
      L.labels.appendChild(t); o._tag = t;
    });
  });
  let lvl = "solar", focusObj = null;
```

por:

```js
      L.labels.appendChild(t); o._tag = t;
    });
  });
  if (LV.tierra.oclusor) LV.tierra.hits.push(LV.tierra.oclusor);
  let lvl = "solar", focusObj = null;
```

6. Las etiquetas del otro lado del globo se ocultan. Reemplazar:

```js
  function updateCosmosLabels(w, h) {
```

por:

```js
  const haciaCam = new THREE.Vector3();
  function updateCosmosLabels(w, h) {
```

y reemplazar:

```js
      let off = tmp.z > 1 || Math.abs(tmp.x) > 1.15 || Math.abs(tmp.y) > 1.15 || (o.near && !nearSun);
```

por:

```js
      let off = tmp.z > 1 || Math.abs(tmp.x) > 1.15 || Math.abs(tmp.y) > 1.15 || (o.near && !nearSun)
        || (o.normal && o.normal.dot(haciaCam.copy(camera.position).normalize()) < 0.2);
```

7. En el globo, la cámara vuela sobre el continente mirando al centro de la Tierra. Reemplazar:

```js
    focusObj = o; controls.minDistance = LV[lvl].minD;
    const dir = camera.position.clone().sub(o.world);
```

por:

```js
    focusObj = o; controls.minDistance = LV[lvl].minD;
    if (o.normal) return flyTo(() => LV[lvl].tgt, () => o.normal.clone().multiplyScalar(o.view), 2.2);
    const dir = camera.position.clone().sub(o.world);
```

8. Cada escala puede actualizarse en cada cuadro (solo la activa). Reemplazar:

```js
    controls.update();
    renderer.render(LV[lvl].scene, camera);
```

por:

```js
    if (LV[lvl].update) LV[lvl].update(dt);
    controls.update();
    renderer.render(LV[lvl].scene, camera);
```

9. Exponer la partida a la interfaz. Reemplazar:

```js
    setInset(x, y) { inset = { x, y }; applyOffset(); }
  };
```

por:

```js
    setInset(x, y) { inset = { x, y }; applyOffset(); },
    tierra: { partida: partidaTierra, fallo: !!LV.tierra.fallo, setCapa(n, on) { if (LV.tierra.setCapa) LV.tierra.setCapa(n, on); } },
    // Vuela sobre un punto del globo (vector unitario desde el centro de la Tierra)
    apuntar(n, dist = 24) {
      if (lvl !== "tierra") return;
      focusObj = null; controls.minDistance = LV.tierra.minD;
      flyTo(() => LV.tierra.tgt, () => n.clone().multiplyScalar(dist), 2);
    }
  };
```

- [ ] **Step 3: Muelle y fichas de continentes en la interfaz**

En el script de la interfaz de `index.html`:

1. Reemplazar:

```js
  const FAR = Object.entries(COSMOS).flatMap(([lv, list]) => list.map(o => Object.assign(o, { lv })));
  const byId = Object.fromEntries([...BODIES, ...CONSTS, ...FAR].map(b => [b.id, b]));
```

por:

```js
  const FAR = Object.entries(COSMOS).flatMap(([lv, list]) => list.map(o => Object.assign(o, { lv })));
  // Continentes de la escala "La Tierra" (poblacion/datos.js); vacío si la simulación no cargó
  const TIERRA = typeof HISTORIA !== "undefined" && !Space.tierra.fallo ? HISTORIA.continentes.map(c => Object.assign(c, { lv: "tierra" })) : [];
  const byId = Object.fromEntries([...BODIES, ...CONSTS, ...FAR, ...TIERRA].map(b => [b.id, b]));
```

2. Reemplazar:

```js
    group: "Las galaxias están en su dirección y distancia aproximadas, y sus tamaños están a la misma escala que las distancias."
  };
```

por:

```js
    group: "Las galaxias están en su dirección y distancia aproximadas, y sus tamaños están a la misma escala que las distancias.",
    tierra: "Las fechas de tu humanidad salen de la simulación; las reales, de la arqueología y la genética. Cada partida es distinta."
  };
```

3. Reemplazar:

```js
    const list = lv === "solar" ? BODIES.filter(b => b.dock !== false) : COSMOS[lv];
```

por:

```js
    const list = lv === "solar" ? BODIES.filter(b => b.dock !== false) : lv === "tierra" ? TIERRA : COSMOS[lv];
```

- [ ] **Step 4: Verificar en el navegador**

1. Desde la raíz del repo, servir la carpeta con `python -m http.server 8000` (o la vista previa de la sesión) y abrir `http://localhost:8000`.
2. Esperar: la app arranca como siempre (ficha de la Tierra, sistema solar) y la consola solo muestra el 404 de `poblacion/panel.js`.
3. En la escalera de escalas, tocar **La Tierra**. Esperar: un globo grande con textura real, atmósfera y el Sol girando despacio. Puntitos cálidos (bandas) caminan en África y aparecen etiquetas de continentes solo del lado visible.
4. En la consola, `Space.tierra.partida.textoAño()` devuelve un año que avanza ("hace 297.000 años"…); tras unos segundos, `Space.tierra.partida.pendientes()` muestra el primer hito y la partida queda en pausa (`reproduciendo()` → `false`).
5. Tocar **Asia** en el muelle: la cámara vuela sobre Asia y se abre su ficha (sin datos de la partida todavía).
6. Volver a **Sistema solar**: todo funciona como antes y `Space.tierra.partida.textoAño()` ya no avanza.
7. Revisar que no haya otros errores en la consola.

- [ ] **Step 5: Commit**

```bash
git add poblacion/vista.js index.html
git commit -m "Escala La Tierra: globo con hielo, costas antiguas, bandas y luces de la partida" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Interfaz — reloj, tarjeta, avisos y Bitácora

**Files:**
- Create: `poblacion/panel.js`
- Modify: `index.html` (HTML de herramientas, capas, tarjeta, aviso y modal; CSS; script de la interfaz)
- Test: `pruebas/panel.test.mjs`

**Interfaces:**
- Consumes: `Space.tierra`, `Space.apuntar` (Tarea 8); la partida (Tarea 6); `VistaTierra.normal` (Tarea 8); `HISTORIA` (Tarea 2); `openModal` de la interfaz existente.
- Produces: `PanelTierra.iniciar({ partida, historia, normal, irA, abrirModal })` → `{ mostrar(on) }`; utilidades puras `PanelTierra.personas(n)`, `PanelTierra.realEn(tabla, año)`, `PanelTierra.textoReal([min, max])`, `PanelTierra.rango(real, presente)`, `PanelTierra.comparar(año, real)`. Define el getter `stats` de cada continente.

- [ ] **Step 1: Escribir las pruebas que fallan (utilidades de texto)**

`pruebas/panel.test.mjs`:

```js
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
});
```

- [ ] **Step 2: Correr las pruebas y ver que fallan**

Run: `node --test pruebas/panel.test.mjs`
Expected: FAIL con `Cannot find module '../poblacion/panel.js'`.

- [ ] **Step 3: Escribir el panel**

`poblacion/panel.js`:

```js
// Interfaz de la escala "La Tierra": tarjeta comparativa, avisos de hitos, Bitácora de tu humanidad y fichas de continentes.
const PanelTierra = (() => {
  const PartidaRef = typeof Partida !== "undefined" ? Partida : require("./partida.js");
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const num = (n, d = 1) => n.toLocaleString("es", { maximumFractionDigits: d });

  function personas(n) {
    if (n >= 1e9) return `${num(n / 1e9)} mil millones`;
    if (n >= 1e6) { const v = num(n / 1e6); return `${v} ${v === "1" ? "millón" : "millones"}`; }
    return num(n, 0);
  }
  // Población real estimada en un año: [mínimo, máximo], interpolada en escala logarítmica
  function realEn(tabla, año) {
    const k = tabla.findIndex(f => f[0] >= año);
    if (k === 0) return [tabla[0][1], tabla[0][2]];
    if (k < 0) { const f = tabla[tabla.length - 1]; return [f[1], f[2]]; }
    const [a0, mn0, mx0] = tabla[k - 1], [a1, mn1, mx1] = tabla[k], t = (año - a0) / (a1 - a0);
    const lg = (x, y) => Math.exp(Math.log(x) + (Math.log(y) - Math.log(x)) * t);
    return [lg(mn0, mn1), lg(mx0, mx1)];
  }
  const textoReal = ([a, b]) => b / a > 1.5 ? `${personas(a)} – ${personas(b)}` : `~${personas(Math.sqrt(a * b))}`;
  // Rango de fechas reales en el mismo formato que el reloj
  function rango(real, presente) {
    if (!real) return "no ocurrió";
    const [a, b] = real, t = x => PartidaRef.textoAño(x, presente);
    if (a === b) return t(a);
    if (b < -10000) return `${t(a).replace(/ años$/, "")}–${t(b).replace(/^hace /, "")}`;
    if (b < 0) return `${t(a).replace(/ a\. C\.$/, "")}–${t(b)}`;
    if (a < 0) return `${t(a)}–${t(b)} d. C.`;
    return `${t(a)}–${t(b)}`;
  }
  function comparar(año, real) {
    if (!real) return "";
    const [a, b] = real;
    if (año >= a && año <= b) return "dentro del rango real";
    return `${num(Math.round(año < a ? a - año : año - b), 0)} años ${año < a ? "antes" : "después"}`;
  }

  function iniciar({ partida, historia, normal, irA, abrirModal }) {
    const presente = historia.presente;
    const porId = Object.fromEntries(historia.hitos.map(h => [h.id, h]));
    const reg = Object.fromEntries(historia.regiones.map((r, k) => [r.id, k]));
    const card = $("t-card"), aviso = $("t-hito"), boton = $("btn-bitacora");
    let visible = false;
    const logrados = () => new Map(partida.motor().hitos().map(h => [h.id, h]));

    // Fichas de continente con datos de la partida en curso
    historia.continentes.forEach(c => Object.defineProperty(c, "stats", { configurable: true, get() {
      const pr = partida.motor().poblacionPorRegion(), hechos = logrados();
      const pob = c.regiones.reduce((s, id) => s + (pr[reg[id]] || 0), 0);
      return [["Tu humanidad aquí", personas(pob)], ...c.hitos.map(id => {
        const h = porId[id], l = hechos.get(id);
        return [h.corto, `${l ? partida.textoAño(l.año) : "Aún no"} · real: ${rango(h.real, presente)}`];
      })];
    } }));

    function pintarTarjeta() {
      if (!visible) return;
      const m = partida.motor(), año = m.año();
      $("t-pob").textContent = personas(m.poblacionTotal());
      $("t-real").textContent = textoReal(realEn(historia.poblacionReal, año));
      $("t-nota").hidden = año >= -10000;
      const hechos = logrados();
      $("t-cont").replaceChildren(...historia.continentes.map(c => {
        const li = el("li", null, c.nombre);
        li.classList.toggle("si", c.hitos.length === 0 || c.hitos.some(id => hechos.has(id)));
        return li;
      }));
    }

    function mostrarHito() {
      const h = partida.pendientes()[0];
      if (!visible || !h) { aviso.hidden = true; return; }
      const d = porId[h.id] || { titulo: h.id, real: null, texto: "", fuente: "" };
      $("t-hito-titulo").textContent = d.titulo;
      $("t-hito-tuyo").textContent = partida.textoAño(h.año);
      $("t-hito-real").textContent = rango(d.real, presente);
      $("t-hito-texto").textContent = d.texto;
      $("t-hito-fuente").textContent = d.fuente ? `Fuente: ${d.fuente}` : "";
      $("t-hito-ir").hidden = h.celda < 0;
      aviso.hidden = false;
      $("t-hito-seguir").focus();
    }
    $("t-hito-seguir").addEventListener("click", () => {
      partida.tomarHito();
      if (partida.pendientes().length) return mostrarHito();
      aviso.hidden = true;
      if (!partida.terminada()) partida.setReproduciendo(true);
    });
    $("t-hito-ir").addEventListener("click", () => {
      const h = partida.pendientes()[0];
      if (!h || h.celda < 0) return;
      const c = partida.motor().celdas;
      irA(normal(c.lat[h.celda], c.lon[h.celda]));
    });

    function pintarBitacora() {
      const hechos = logrados(), fin = partida.terminada();
      $("bitacora-intro").textContent = fin
        ? `Tu partida terminó en ${partida.textoAño()}. Así se compara tu humanidad con la real.`
        : `Hitos de tu partida hasta ${partida.textoAño()}, junto a lo que pasó en la realidad.`;
      const lista = historia.hitos.filter(h => hechos.has(h.id) || (fin && h.real))
        .sort((x, y) => (hechos.get(x.id)?.año ?? Infinity) - (hechos.get(y.id)?.año ?? Infinity));
      $("bitacora-lista").replaceChildren(...(lista.length ? lista.map(h => {
        const l = hechos.get(h.id), li = el("li");
        li.append(el("b", null, h.corto),
          el("span", "t-comp", `${l ? `Tu humanidad: ${partida.textoAño(l.año)}` : "No ocurrió en tu partida"} · Real: ${rango(h.real, presente)}`));
        if (l && h.real) li.append(el("span", "t-comp no", comparar(l.año, h.real)));
        return li;
      }) : [el("li", "no", "Todavía no hay hitos en esta partida.")]));
    }
    boton.addEventListener("click", () => { pintarBitacora(); abrirModal("bitacora"); });

    partida.alEvento(e => {
      if (e.tipo === "hito") mostrarHito();
      if (e.tipo === "nueva") { aviso.hidden = true; pintarTarjeta(); }
      if (e.tipo === "fin" && visible) { pintarBitacora(); abrirModal("bitacora"); }
    });
    setInterval(pintarTarjeta, 250);

    function mostrar(on) {
      visible = on; card.hidden = !on; boton.hidden = !on;
      if (on) { pintarTarjeta(); mostrarHito(); } else aviso.hidden = true;
    }
    return { mostrar };
  }

  return { iniciar, personas, realEn, textoReal, rango, comparar };
})();
if (typeof module !== "undefined") module.exports = PanelTierra;
```

- [ ] **Step 4: Correr las pruebas y ver que pasan**

Run: `node --test "pruebas/*.test.mjs"`
Expected: PASS (38 pruebas).

- [ ] **Step 5: HTML nuevo en `index.html`**

1. Botón de la Bitácora. Reemplazar:

```html
    <button class="chip" id="btn-tour">Vista general</button>
```

por:

```html
    <button class="chip" id="btn-tour">Vista general</button>
    <button class="chip" id="btn-bitacora" hidden>Bitácora</button>
```

2. Capas propias de cada escala. Reemplazar:

```html
        <button class="layer-opt" role="menuitemcheckbox" id="opt-orbits" aria-checked="true">Órbitas</button>
        <button class="layer-opt" role="menuitemcheckbox" id="opt-labels" aria-checked="true">Nombres</button>
        <button class="layer-opt" role="menuitemcheckbox" id="opt-const" aria-checked="true">Constelaciones</button>
```

por:

```html
        <button class="layer-opt opt-solar" role="menuitemcheckbox" id="opt-orbits" aria-checked="true">Órbitas</button>
        <button class="layer-opt" role="menuitemcheckbox" id="opt-labels" aria-checked="true">Nombres</button>
        <button class="layer-opt opt-solar" role="menuitemcheckbox" id="opt-const" aria-checked="true">Constelaciones</button>
        <button class="layer-opt opt-tierra" role="menuitemcheckbox" id="opt-hielo" aria-checked="true" hidden>Hielo y costas antiguas</button>
        <button class="layer-opt opt-tierra" role="menuitemcheckbox" id="opt-grupos" aria-checked="true" hidden>Grupos</button>
        <button class="layer-opt opt-tierra" role="menuitemcheckbox" id="opt-luces" aria-checked="true" hidden>Luces</button>
```

3. Tarjeta y aviso. Reemplazar:

```html
    <div class="clock scale-pill" id="scale-pill" hidden><span id="scale-text"></span></div>
  </div>
```

por:

```html
    <div class="clock scale-pill" id="scale-pill" hidden><span id="scale-text"></span></div>
  </div>

  <section class="t-card" id="t-card" hidden aria-label="Tu humanidad comparada con la real">
    <div class="t-row"><span>Tu humanidad</span><strong id="t-pob"></strong></div>
    <div class="t-row"><span>Real</span><strong id="t-real"></strong></div>
    <p class="t-nota" id="t-nota" hidden>Antes de 10.000 a. C. la cifra real es una estimación muy incierta.</p>
    <ul class="t-cont" id="t-cont" aria-label="Continentes alcanzados"></ul>
  </section>

  <section class="t-hito" id="t-hito" hidden role="dialog" aria-labelledby="t-hito-titulo" aria-live="polite">
    <span class="kind">Hito</span>
    <h2 id="t-hito-titulo"></h2>
    <dl class="t-fechas">
      <div><dt>Tu humanidad</dt><dd id="t-hito-tuyo"></dd></div>
      <div><dt>En la realidad</dt><dd id="t-hito-real"></dd></div>
    </dl>
    <p id="t-hito-texto"></p>
    <p class="t-fuente" id="t-hito-fuente"></p>
    <div class="q-foot">
      <button class="chip" id="t-hito-ir" type="button">Ver en el globo</button>
      <button class="chip primary" id="t-hito-seguir" type="button">Seguir</button>
    </div>
  </section>
```

4. Modal de la Bitácora. Reemplazar:

```html
  <div class="modal" id="missions" hidden role="dialog" aria-modal="true" aria-labelledby="missions-title">
```

por:

```html
  <div class="modal" id="bitacora" hidden role="dialog" aria-modal="true" aria-labelledby="bitacora-title">
    <div class="modal-in">
      <h2 id="bitacora-title">Bitácora de tu humanidad</h2>
      <button class="icon-btn sheet-close" data-close="bitacora" aria-label="Cerrar bitácora">
        <svg viewBox="0 0 16 16"><path d="M3.3 2.3 8 7l4.7-4.7 1 1L9 8l4.7 4.7-1 1L8 9l-4.7 4.7-1-1L7 8 2.3 3.3z"/></svg>
      </button>
      <p class="modal-intro" id="bitacora-intro"></p>
      <ol class="t-lista" id="bitacora-lista"></ol>
    </div>
  </div>

  <div class="modal" id="missions" hidden role="dialog" aria-modal="true" aria-labelledby="missions-title">
```

5. Créditos. Reemplazar:

```html
      <p class="credits">Texturas: Tierra y Luna de NASA (Blue Marble y Black Marble, vía los ejemplos de three.js); planetas de Planet Pixel Emporium, de James Hastings-Trew (vía threex.planets). Retratos renderizados con Blender (Cycles).</p>
```

por:

```html
      <p class="credits">Texturas: Tierra y Luna de NASA (Blue Marble y Black Marble, vía los ejemplos de three.js); planetas de Planet Pixel Emporium, de James Hastings-Trew (vía threex.planets). Retratos renderizados con Blender (Cycles). La Tierra habitada: nivel del mar de Spratt y Lisiecki (2016); población real de HYDE 3.2, McEvedy y Jones (1978) y Naciones Unidas; la fuente de cada hito aparece en su aviso.</p>
```

- [ ] **Step 6: CSS en `index.html`**

Reemplazar:

```css
/* Niveles del cuestionario */
```

por:

```css
/* La Tierra habitada: tarjeta comparativa, aviso de hito y Bitácora */
.t-card {
  position: fixed; left: calc(18px + env(safe-area-inset-left, 0px)); top: calc(84px + env(safe-area-inset-top, 0px));
  width: 230px; box-sizing: border-box; display: grid; gap: 6px; padding: 12px 14px; background: var(--panel);
  border: 1px solid var(--line); border-radius: 14px; backdrop-filter: blur(8px); font-size: 12.5px;
}
.t-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.t-row span { color: var(--muted); }
.t-row strong { font-family: var(--f-mono); font-weight: 500; color: var(--star); font-variant-numeric: tabular-nums; text-align: right; }
.t-row + .t-row strong { color: var(--ice); }
.t-nota { margin: 0; font-size: 11px; color: var(--muted); }
.t-cont { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
.t-cont li { font-family: var(--f-mono); font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
.t-cont li.si { border-color: var(--star); color: var(--star); }
.t-hito {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(118px + env(safe-area-inset-bottom, 0px)); z-index: 5;
  width: min(460px, calc(100vw - 32px)); box-sizing: border-box; display: grid; gap: 10px; padding: 18px 20px;
  background: var(--panel-solid); border: 1px solid var(--star); border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}
.t-hito h2 { margin: 0; font-size: 18px; line-height: 1.3; }
.t-hito p { margin: 0; color: #c4cbe0; font-size: 14px; }
.t-hito .t-fuente { font-size: 12px; color: var(--muted); }
.t-fechas { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); border-radius: var(--r); overflow: hidden; }
.t-fechas div { background: var(--panel-solid); padding: 8px 10px; display: grid; gap: 2px; min-width: 0; }
.t-fechas dt { font-size: 11px; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; }
.t-fechas dd { margin: 0; font-family: var(--f-mono); font-size: 13.5px; color: var(--star); overflow-wrap: anywhere; }
.t-fechas div + div dd { color: var(--ice); }
.t-lista { list-style: none; margin: 0; padding: 0; display: grid; }
.t-lista li { display: grid; gap: 4px; padding: 12px 0; border-top: 1px solid var(--line); }
.t-lista li:first-child { border-top: 0; }
.t-lista b { font-size: 15px; }
.t-lista .t-comp { font-family: var(--f-mono); font-size: 12.5px; color: #c4cbe0; }
.t-lista .no { color: var(--muted); }
@media (max-width: 760px) {
  .t-card { left: auto; right: 16px; top: calc(124px + env(safe-area-inset-top, 0px)); width: 190px; padding: 10px 12px; font-size: 11.5px; }
  .t-hito { bottom: calc(132px + env(safe-area-inset-bottom, 0px)); padding: 14px 16px; }
}

/* Niveles del cuestionario */
```

- [ ] **Step 7: Conectar el reloj, las capas y el panel en el script de la interfaz**

1. Reemplazar el bloque de `Space.onLevel` (incluida la llamada inicial):

```js
  Space.onLevel = lv => {
    zoom.querySelectorAll("button").forEach(b => b.setAttribute("aria-current", String(b.dataset.lv === lv)));
    buildDock(lv);
    if (current) markDock(current.id);
    const solar = lv === "solar";
    document.querySelector(".clock:not(.scale-pill)").hidden = !solar;
    $("scale-pill").hidden = solar;
    $("scale-text").textContent = scaleOf(lv).pill;
    $("btn-layers").parentElement.hidden = !solar;
  };
  Space.onLevel("solar");
```

por (la llamada inicial se mueve al final del script, cuando el reloj y el panel ya existen):

```js
  let panel = null;
  Space.onLevel = lv => {
    zoom.querySelectorAll("button").forEach(b => b.setAttribute("aria-current", String(b.dataset.lv === lv)));
    buildDock(lv);
    if (current) markDock(current.id);
    const solar = lv === "solar", tierra = lv === "tierra" && !Space.tierra.fallo;
    document.querySelector(".clock:not(.scale-pill)").hidden = !(solar || tierra);
    $("scale-pill").hidden = solar || tierra;
    $("scale-text").textContent = lv === "tierra" ? "No se pudo cargar la simulación de población." : scaleOf(lv).pill;
    $("btn-layers").parentElement.hidden = !(solar || tierra);
    document.querySelectorAll(".opt-solar").forEach(b => { b.hidden = !solar; });
    document.querySelectorAll(".opt-tierra").forEach(b => { b.hidden = !tierra; });
    if (panel) panel.mostrar(tierra);
    syncClock();
  };
```

2. Reemplazar:

```js
  toggle($("opt-const"), on => Space.setConsts(on));
```

por:

```js
  toggle($("opt-const"), on => Space.setConsts(on));
  toggle($("opt-hielo"), on => Space.tierra.setCapa("hielo", on));
  toggle($("opt-grupos"), on => Space.tierra.setCapa("grupos", on));
  toggle($("opt-luces"), on => Space.tierra.setCapa("luces", on));
```

3. Reemplazar el bloque del reloj:

```js
  // Reloj de la simulación
  const speed = $("speed");
  const setSpeed = () => { $("speed-out").textContent = Space.setSpeed(+speed.value); };
  speed.addEventListener("input", setSpeed); setSpeed();
  let playing = true;
  $("btn-play").addEventListener("click", () => {
    playing = !playing; Space.setPlaying(playing);
    $("ico-pause").hidden = !playing; $("ico-play").hidden = playing;
    $("btn-play").setAttribute("aria-label", playing ? "Pausar el tiempo" : "Reanudar el tiempo");
  });
  const dateOut = $("date-out");
  dateOut.addEventListener("click", () => Space.today());
  const tickDate = () => { dateOut.textContent = Space.date().toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }); };
  tickDate(); setInterval(tickDate, 200);
```

por:

```js
  // Reloj: el del sistema solar o, en la escala "La Tierra", el de la partida de población
  const speed = $("speed"), dateOut = $("date-out"), partida = Space.tierra.partida;
  const enTierra = () => !!partida && Space.level() === "tierra";
  const velocidad = { solar: 2, tierra: 2 };
  let playing = true;
  function showPlaying(p) {
    $("ico-pause").hidden = !p; $("ico-play").hidden = p;
    $("btn-play").setAttribute("aria-label", p ? "Pausar el tiempo" : "Reanudar el tiempo");
  }
  function tickDate() {
    if (enTierra()) { dateOut.textContent = partida.textoAño(); $("speed-out").textContent = partida.textoVelocidad(); }
    else dateOut.textContent = Space.date().toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  }
  function setSpeed() {
    if (enTierra()) { velocidad.tierra = +speed.value; partida.velocidad(+speed.value); tickDate(); }
    else { velocidad.solar = +speed.value; $("speed-out").textContent = Space.setSpeed(+speed.value); }
  }
  function syncClock() {
    const t = enTierra();
    speed.max = t ? "4" : "5";
    speed.value = String(t ? velocidad.tierra : velocidad.solar);
    setSpeed();
    showPlaying(t ? partida.reproduciendo() : playing);
    dateOut.title = t ? "Empezar una partida nueva" : "Volver a la fecha de hoy";
    tickDate();
  }
  speed.addEventListener("input", setSpeed);
  $("btn-play").addEventListener("click", () => {
    if (enTierra()) return showPlaying(partida.setReproduciendo(!partida.reproduciendo()));
    playing = !playing; Space.setPlaying(playing); showPlaying(playing);
  });
  dateOut.addEventListener("click", () => {
    if (!enTierra()) return Space.today();
    if (confirm("¿Empezar una partida nueva? La humanidad volverá a nacer en África hace 300.000 años.")) partida.nueva();
  });
  if (partida) partida.alEvento(() => { if (enTierra()) showPlaying(partida.reproduciendo()); });
  setInterval(tickDate, 200);
```

4. Reemplazar:

```js
  // Estado inicial: ficha de la Tierra lista y viaje desde la vista general
```

por:

```js
  // La Tierra habitada: tarjeta, avisos de hitos y Bitácora
  if (partida && typeof PanelTierra !== "undefined") {
    panel = PanelTierra.iniciar({ partida, historia: HISTORIA, normal: VistaTierra.normal, irA: n => Space.apuntar(n), abrirModal: openModal });
  }
  Space.onLevel("solar");

  // Estado inicial: ficha de la Tierra lista y viaje desde la vista general
```

- [ ] **Step 8: Verificar en el navegador (escritorio y celular)**

Servir con `python -m http.server 8000` y abrir `http://localhost:8000`. Comprobar, con la consola sin errores:

1. Sistema solar: reloj, velocidad, pausa, "volver a hoy" y capas funcionan como antes.
2. Entrar a **La Tierra**:
   - El reloj muestra "hace 298.000 años" y la velocidad "10.000 años/s".
   - El menú de capas muestra *Hielo y costas antiguas*, *Grupos*, *Luces* y *Nombres*, y cada una apaga y prende lo suyo.
   - La tarjeta muestra "Tu humanidad" y "Real", con la nota de estimación incierta.
3. Llega el primer hito:
   - El aviso muestra las dos fechas, el texto y la fuente, y la partida se pausa.
   - **Ver en el globo** vuela al lugar; **Seguir** cierra el aviso y reanuda.
4. Pausa y reanudación con el botón; el control deslizante va de ×0,25 a ×4.
5. **Revisión 5:** con un aviso abierto, ir a Sistema solar y volver. El año no avanzó y el aviso sigue ahí.
6. **Revisión 4:** tocar la fecha, aceptar la partida nueva. El aviso se cierra y el reloj vuelve a "hace 298.000 años".
7. **Revisión 3:** jugar a ×4 hasta 2026 (atender cada aviso).
   - El reloj se detiene en "2026" y se abre la Bitácora con todos los hitos y sus diferencias.
   - Reanudar no hace nada.
8. Tocar un continente del muelle: su ficha muestra "Tu humanidad aquí" y las llegadas de la partida frente a las reales.
9. A ancho de celular (375 × 812):
   - La tarjeta no tapa la escalera de escalas ni las herramientas.
   - El aviso cabe sobre el muelle.
   - No hay scroll horizontal.
10. **Fallo de carga:** renombrar temporalmente `poblacion/vista.js` y recargar.
    - "La Tierra" muestra "No se pudo cargar la simulación de población." y el resto de la app funciona.
    - Devolver el nombre al terminar.

- [ ] **Step 9: Commit**

```bash
git add poblacion/panel.js pruebas/panel.test.mjs index.html
git commit -m "La Tierra habitada: reloj de la partida, tarjeta comparativa, avisos de hitos y Bitácora" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Publicación

**Files:**
- Modify: `.github/workflows/pages.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la rama `feat/poblacion-historia` lista para un PR a `main`; al hacer merge, el sitio publicado incluye `poblacion/`.

- [ ] **Step 1: Publicar `poblacion/` con el sitio**

En `.github/workflows/pages.yml`, reemplazar:

```yaml
      # Solo lo que necesita la página: la app, las texturas y los retratos.
      - name: Preparar el sitio
        run: |
          mkdir _site
          cp -r index.html tex renders _site/
```

por:

```yaml
      # Solo lo que necesita la página: la app, las texturas, los retratos y la simulación de población.
      - name: Preparar el sitio
        run: |
          mkdir _site
          cp -r index.html tex renders poblacion _site/
```

- [ ] **Step 2: Documentar en el README**

En `README.md`:

1. En "Qué incluye", después de la línea de **Misiones espaciales**, agregar:

```markdown
- **La Tierra habitada**: la humanidad nace hace 300.000 años en África y se extiende sola por el planeta, con glaciaciones, puentes de tierra, agricultura, ciudades e industria. Cada hito se compara con su fecha real y su fuente.
```

2. En la tabla de "Estructura", después de la fila de `renders/`, agregar:

```markdown
| `poblacion/` | La Tierra habitada: mapa en celdas (`mundo.js`, generado), datos reales con fuentes (`datos.js`), motor de la simulación, reloj de la partida, vista 3D y panel |
| `herramientas/generar_mundo.py` | Genera `poblacion/mundo.js` a partir de las texturas de la Tierra |
| `pruebas/` | Pruebas del motor y la partida, y la calibración contra la historia real |
```

3. Antes de "## Créditos", agregar:

````markdown
## La Tierra habitada: pruebas y calibración

El motor (`poblacion/motor.js`) no usa el navegador, así que se prueba con Node 24:

```bash
node --test "pruebas/*.test.mjs"
```

La calibración corre 30 partidas completas y compara sus hitos con la historia real (sale con error si alguna mediana cae fuera de su ventana):

```bash
node pruebas/calibrar.mjs
```

Si cambian las texturas de la Tierra, hay que regenerar el mapa (requiere Pillow):

```bash
python herramientas/generar_mundo.py
```
````

- [ ] **Step 3: Verificación final**

Run: `node --test "pruebas/*.test.mjs"`
Expected: PASS (38 pruebas).

Run: `node pruebas/calibrar.mjs`
Expected: todas las filas con ✓, código 0.

Repetir en el navegador los puntos 2, 3 y 7 del Step 8 de la Tarea 9.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pages.yml README.md
git commit -m "Publicar la simulación de población con el sitio y documentarla" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Push y PR (pedir permiso antes)**

Preguntar al usuario antes de subir. Con su visto bueno:

```bash
git push -u origin feat/poblacion-historia
gh pr create --base main --head feat/poblacion-historia --title "La Tierra habitada: motor de población y modo Historia" --body-file <archivo con el resumen, los resultados de calibrar.mjs y la verificación en el navegador, terminado en la línea de Claude Code>
```

El sitio se publica al hacer merge del PR (el workflow corre con cada push a `main`).
