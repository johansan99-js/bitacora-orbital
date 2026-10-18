# La Tierra habitada: motor de población y modo Historia

**Fecha:** 2026-10-14 · **Estado:** aprobado · **Cambio:** 2026-10-15, se agregan humanos arcaicos y saber de recolectores (ver [Otros humanos y saber de recolectores](#otros-humanos-y-saber-de-recolectores-cambio-del-2026-10-15))
**Sub-proyecto:** 1 de 4 (ver [Hoja de ruta](#hoja-de-ruta))

## Objetivo

Agregar a la Bitácora Orbital una quinta escala, **La Tierra**, donde la humanidad nace hace 300.000 años en África y se extiende sola por el planeta real: migra, crece, cruza el mar, inventa la agricultura, funda ciudades y llega al presente. Nada está guionizado: la historia surge de reglas simples basadas en factores reales (clima, glaciaciones, nivel del mar, puentes de tierra, especies domesticables), así que cada partida sale distinta.

El propósito es **aprender comparando**: cada vez que la humanidad simulada alcanza un hito, la app muestra cuándo ocurrió en la partida y cuándo ocurrió en la realidad, con su fuente.

### Decisiones tomadas

| Tema | Decisión |
|---|---|
| Qué se simula | Historia humana emergente (no vida artificial ni una animación de datos) |
| Para qué | Aprender comparando con la historia real |
| Dónde vive | Nueva escala "La Tierra", la más cercana, con su propio reloj |
| Desde cuándo | Hace 300.000 años hasta hoy (2026) |
| Libertad | Libre, con reglas basadas en factores reales; cada partida varía |
| Enfoque técnico | Híbrido: una cuadrícula calcula la historia; encima se dibujan bandas que caminan y luego luces de aldeas y ciudades |
| Modo juego | Sí, pero en sub-proyectos posteriores; el motor queda preparado con "palancas" |
| Otros humanos (2026-10-15) | Neandertales y denisovanos como fondo real del modo Historia: ocupan su territorio y nuestra especie los desplaza según su saber. Sin encuentros, mestizaje ni decisiones (eso sigue en la fase 3) |

### Criterios de éxito

1. En una partida típica la humanidad sale de África y llega a todos los continentes habitados; la agricultura nace en varias regiones; la población llega a miles de millones en el presente.
2. Las fechas de los hitos son **comparables** a las reales: las medianas de 30 partidas caen en las ventanas de la tabla de [calibración](#calibración-contra-la-historia-real).
3. Funciona fluida en celular y en computadora, igual que el resto de la app.
4. Si la nueva escala falla, el resto de la Bitácora sigue funcionando.

## Alcance

**Entra en este sub-proyecto:** escala "La Tierra", mapa del mundo, motor de población, vista 3D (globo, hielo, costas antiguas, bandas, luces), reloj de la simulación, avisos de hitos, tarjeta comparativa, Bitácora de tu humanidad, pruebas, calibración y publicación.

**No entra:** plagas, guerras, comercio, religión, rasgos genéticos, encuentros, mestizaje o decisiones con otras especies humanas (aquí solo son fondo; ver el cambio del 2026-10-15), condiciones iniciales elegidas por quien juega, poderes y decisiones. Son de los sub-proyectos 2 a 4. El motor expone sus parámetros como opciones para que esas fases se enchufen sin rehacerlo, pero esta fase no implementa ninguna intervención.

## Arquitectura

### Integración con la app actual

- `SCALES` gana una primera entrada: `{ id: "tierra", name: "La Tierra", span: "miles de km", pill: "" }`. Pasa a ser el peldaño más cercano del zoom.
- `Space` registra `LV.tierra` con su propia `THREE.Scene`, igual que las escalas de estrellas, galaxia y Grupo Local.
- Único cambio al bucle actual: `frame()` llama a `LV[lvl].update(dt)` si la escala lo define. Las escalas existentes no lo definen y no cambian.
- En la escala "La Tierra" la barra de reloj existente se conecta al reloj de la simulación (ver [Interfaz](#interfaz)). El reloj del sistema solar no se toca.
- El workflow de Pages copia también `poblacion/`: `cp -r index.html tex renders poblacion _site/`.

### Archivos nuevos

Todos se cargan con `<script>` clásicos, sin módulos ni compilación, como el resto de la app. Cada uno expone un único objeto global.

| Archivo | Global | Qué hace | Depende de |
|---|---|---|---|
| `poblacion/mundo.js` | `MUNDO` | Datos fijos del mapa: tierra o mar, bioma, costa, superficie y región de cada celda. Generado, no se edita a mano | — |
| `poblacion/datos.js` | `HISTORIA` | Datos reales sin lógica: curva del nivel del mar, periodos húmedos, puentes de tierra, regiones con domesticables, capas de hielo, hitos reales, población real estimada, velocidades del reloj. Cada dato con su fuente | — |
| `poblacion/motor.js` | `Motor` | La simulación pura. No usa three.js ni el DOM. Funciona igual en el navegador y en Node | `MUNDO`, `HISTORIA` (inyectados) |
| `poblacion/partida.js` | `Partida` | El reloj de la partida: velocidad automática por era, pausa en los hitos, fin en el presente, nueva partida. Sin DOM ni three.js | `Motor` |
| `poblacion/vista.js` | `VistaTierra` | La escena 3D de la escala: globo, capa de datos, bandas, luces | three.js, `Motor` |
| `poblacion/panel.js` | `PanelTierra` | Avisos de hitos, tarjeta comparativa, Bitácora de tu humanidad y fichas de continentes | `Partida`, `HISTORIA`, DOM |
| `herramientas/generar_mundo.py` | — | Script de desarrollo (Python 3 + Pillow): lee `tex/earth_spec.jpg` y `tex/earth_day.jpg` y escribe `poblacion/mundo.js` | Pillow |
| `pruebas/motor.test.mjs` | — | Pruebas unitarias del motor con un mundo de mentira (`node --test`) | Node 24 |
| `pruebas/calibrar.mjs` | — | Corre 30 partidas completas con el mapa real y compara con la historia | Node 24 |

`herramientas/` y `pruebas/` no se publican.

### Interfaz del motor

```js
const m = Motor.crear(MUNDO, HISTORIA, opciones);
m.avanzar(años);          // avanza la simulación; internamente en pasos de tamaño adecuado a la era
m.año();                  // año calendario: negativo = a. C. (p. ej. −55974 = hace 58.000 años); "hace N años" = 2026 − año
m.poblacionTotal();       // número de personas
m.celdas;                 // vistas de solo lectura: poblacion (Float64Array), etapa (Uint8Array), innovaciones (Uint16Array);
                          // desde el 2026-10-15 también saberRecolector (Float32Array) y arcaicos (Float32Array, 0–1 ocupación)
m.climaActual();          // { nivelMar, intensidadGlacial, humedoSahara, puentesAbiertos: [...] }
m.alHito(fn);             // fn({ id, año, celda }) la primera vez que ocurre cada hito
```

`opciones` (todas con valor por defecto realista): `semilla`, `origenes` (celdas iniciales en África), `natalidad` (multiplicador), `intensidadGlacial` (multiplicador), `puentesDeTierra` (sí/no), `cruceDeMar` (multiplicador). En esta fase la interfaz no permite cambiarlas, pero las pruebas sí las usan.

## El mundo

### Celdas

- Cuadrícula de 2° × 2° (180 × 90 = 16.200 celdas, ~220 km de lado en el ecuador). Unas 5.000 son tierra firme hoy.
- Cada celda guarda: tierra o mar actual, superficie real en km² (menor cerca de los polos), bioma base, si es costa y su región (para domesticables, hielo y puentes).
- Vecinas: las 8 de alrededor, con la longitud que da la vuelta al mundo. Se precalculan solo para celdas que pueden ser tierra en algún momento.
- **Bioma base**, del color de `earth_day.jpg` combinado con la latitud: hielo, tundra, desierto, estepa, bosque o selva.
- **Tierra o mar**, de `earth_spec.jpg` (el océano es claro): la celda es tierra si más de la mitad de sus píxeles lo son.

### Capacidad

Personas por km² que una celda puede alimentar, según bioma y etapa. Los valores base para recolectores siguen densidades etnográficas: de ~0,01/km² en desierto a ~0,3/km² en costas y selvas ricas, con un extra en la costa por la pesca. Los agricultores alimentan de 10 a 100 veces más, las ciudades más todavía y la etapa industrial otro salto. La capacidad final de una celda en un momento dado = superficie × densidad(bioma, etapa) × factor de clima.

### Clima en el tiempo

Todo el clima sale de **una curva real del nivel del mar** de los últimos 300.000 años (entre 0 y unos −130 m), simplificada a una tabla en `datos.js` a partir de Spratt y Lisiecki (2016). De ella se deriva la intensidad glacial.

- **Puentes de tierra.** Cada uno es una lista de celdas que se vuelven tierra cuando el mar baja de su umbral. Valores aproximados: Beringia ~−50 m, Sunda ~−40 m, Nueva Guinea–Australia (estrecho de Torres) ~−12 m, Tasmania ~−50 m, Doggerland ~−25 m, Sri Lanka ~−10 m. Cada umbral se verifica contra una fuente al escribir `datos.js` y la cita.
- **Capas de hielo.** Norte de Norteamérica (Laurentino y Cordillerano), norte de Europa (Fenoscandia) y Patagonia: cada región tiene su extensión máxima (la del Último Máximo Glacial) y se cubre en proporción a la intensidad glacial. Las celdas cubiertas tienen capacidad cero.
- **Sahara y Arabia verdes.** En los periodos húmedos (hace ~130.000–115.000, ~100.000, ~80.000 y 14.500–5.000 años) los desiertos de esas regiones toman capacidad de estepa. Abren y cierran las rutas de salida de África.
- **Frío global.** En las glaciaciones la capacidad de latitudes medias y altas baja.
- **Holoceno** (últimos 11.700 años): clima estable, condición necesaria para la agricultura.

### Cruzar el mar

Desde una celda costera habitada, con poca probabilidad por paso, un grupo puede colonizar una celda de tierra a través de hasta N celdas de agua. N empieza en 1, sube a 2 con **navegación costera** y a todo un océano con **navegación de altura**. Así Australia es alcanzable saltando entre islas aunque nunca hubo un puente completo, y la Polinesia llega tarde.

## Reglas de la población

### Estado

Por celda: población (número real de personas), etapa (0 deshabitada, 1 recolectores, 2 agricultores, 3 ciudades, 4 industrial) e innovaciones conocidas (bits).

### Arranque

Hace 300.000 años, unos pocos miles de personas repartidas en varios puntos de África (origen panafricano): el norte (Jebel Irhoud, Marruecos, ~300.000 años), el este (Omo, Etiopía, ~230.000) y el sur.

### Cada paso

El tamaño del paso depende de la era (200 años antes del Holoceno, 1 año desde 1900). En cada paso, para cada celda habitada:

1. **Crecer:** crecimiento logístico hacia la capacidad: `ΔP = r · P · (1 − P/K) · Δt`, con `r` según la etapa y multiplicado por la opción `natalidad`.
2. **Migrar:** una fracción se mueve a las vecinas habitables, mayor cuanto más llena está la celda y repartida según el espacio libre de cada vecina. Además hay un goteo de exploradores aunque la celda no esté llena, calibrado para que el frente avance del orden de 1 km por año. La migración nunca crea ni destruye personas.
3. **Cruzar el mar:** según [Cruzar el mar](#cruzar-el-mar).
4. **Innovar y contagiar:** cada innovación nace en celdas que cumplen sus condiciones, con una probabilidad por año que crece con la **densidad** y las **conexiones** de la celda, nunca con un tiempo de espera fijo. Una vez presente, se contagia a celdas vecinas aptas.

**Por qué densidad y no tiempo (riesgo de "efecto mariposa").** En una simulación libre de 300.000 años, un atraso temprano (cruzar el Sinaí 3.000 años tarde) podría arrastrarse hasta el final. Dos mecanismos lo absorben sin guionizar fechas:

- **El embudo del Holoceno:** la agricultura exige el clima estable de los últimos 11.700 años. No importa cuándo llegaron los recolectores a Mesopotamia: todos esperan esa misma salida climática.
- **El reloj se regula por masa crítica:** cada celda agrícola acumula **saber**, que crece con su población (más personas, más ideas, como en el modelo de Kremer, 1993) y se comparte con las vecinas. El saber sube la capacidad de agricultores y ciudades, y ciudades, navegación de altura e industria nacen según la densidad, el número de vecinas conectadas y el saber acumulado. Donde hay más gente conectada, la historia se acelera; donde no, espera.

| Innovación | Nace cuando… (probabilidad proporcional a…) | Efecto |
|---|---|---|
| Navegación costera | Hay población en la costa (a su tamaño) | N = 2 |
| Agricultura | Holoceno + región con domesticables + celda llena de recolectores (a lo llena que está y a la riqueza de la región) | Etapa 2; la capacidad se multiplica y los agricultores desplazan a los recolectores al expandirse |
| Ciudades | Agricultura + densidad por encima de un umbral (al exceso de densidad y a las vecinas agrícolas) | Etapa 3 |
| Escritura | Ciudades con varias vecinas que también tienen ciudades (al tamaño de esa red) | El saber crece y se comparte más rápido, y el contagio de innovaciones se acelera |
| Navegación de altura | Costa + navegación costera + agricultura (al saber acumulado) | Cruzar océanos |
| Industria | Escritura + saber acumulado por encima de un umbral (al exceso de saber); además se contagia a todo el mundo agrícola en proporción a la población que ya es industrial | Etapa 4: segundo salto de capacidad y crecimiento que luego baja (transición demográfica) |

Regiones con domesticables (con un "paquete" más o menos rico, que cambia la probabilidad): Creciente Fértil, China (ríos Amarillo y Yangtsé), Mesoamérica, Andes, Nueva Guinea, Sahel y Etiopía, este de Norteamérica.

### Otros humanos y saber de recolectores (cambio del 2026-10-15)

**Por qué.** Con las reglas de arriba, la humanidad simulada sale de África hace unos 296.000 años y llega a América hace unos 270.000, cuando lo real es hace 70.000–50.000 y 23.000–15.000. Un estudio de factibilidad (seis juegos de parámetros) mostró que ningún ajuste de parámetros lo corrige: la salida nunca baja de hace 227.000 años. Lo que frenó la expansión real no estaba en el modelo: otros humanos ya ocupaban Eurasia, y vivir en el desierto o cruzar el mar requería saber que tardó en acumularse. El usuario eligió agregar ambas cosas (opción A del estudio).

**Saber de recolectores.** Toda celda habitada acumula un saber de recolectores, con la misma regla de Kremer que el saber agrícola:
- crece cada año en proporción a su población;
- sube hacia la media de sus vecinas cuando esta es mayor (nunca baja por compartirlo);
- viaja con la gente: una celda vacía que recibe migrantes o un desembarco toma el saber de quienes llegan, y una habitada se queda con el mayor de los dos;
- se pierde si la celda se vacía.

**Compuertas.** Algunas capacidades solo se abren cuando el saber de recolectores pasa un umbral. La apertura es una rampa: cero por debajo del umbral S y completa a 1,25 S.
- **Desierto:** las celdas de bioma base desierto que no son valle de río solo alimentan recolectores en proporción a la rampa. Esto rige también en los periodos húmedos; sin esa condición, el primer Sahara verde (hace 245.000–235.000 años) abre la salida de África.
- **Mar:** la probabilidad de cruzar el mar sin navegación de altura (sin navegación o con la costera) se multiplica por la rampa.
- El frío sigue igual que antes: no hay compuerta de frío.

**Humanos arcaicos.** Neandertales (Europa, Levante, Anatolia, Zagros y Asia central hasta el Altái) y denisovanos (Asia oriental al norte de los 22°) ocupan su territorio desde el inicio de la partida.
- Sus rangos son cajas aproximadas en `datos.js`, cada una con su fuente.
- En una celda ocupada, los recolectores de nuestra especie solo disponen del 1 % de la capacidad.
- La ocupación se reduce a un ritmo proporcional a la rampa del mayor saber de recolectores de nuestra especie en la celda o sus vecinas, frente al umbral de los arcaicos. Ese umbral es fijo: su saber no crece.
- No hay fechas: los arcaicos desaparecen cuando y donde nuestra especie los supera.
- Esta fase no los dibuja en el globo ni simula encuentros. Aparecen en los textos y en un hito nuevo, "Desaparición de los neandertales".

**Arreglos que acompañan el cambio.**
- **Arabia** pasa a ser una región propia que, como África, no cuenta para la salida, tal como dice el hito ("fuera de África y Arabia"). Hay una barrera entre África y Arabia al sur de los 26° (Bab el-Mandeb).
- **Un desembarco** solo cuenta como llegada a una región si la celda puede sostener a la población establecida (`capacidad ≥ establecida`), no solo si llegaron suficientes personas.

**Resultado medido en el estudio** (prototipo, 5 semillas, sin calibrar el resto): salida de África hace 62.000–77.000 años, Europa hace ~57.000, Norteamérica hace 23.000–28.000; Australia entre hace 18.000 y 45.000 según el umbral del mar. La calibración (abajo) ajusta los parámetros nuevos junto con los existentes.

**Riesgos conocidos.**
- Una vez que África se llena, el saber de recolectores crece a ritmo casi constante, así que cada umbral equivale casi a una fecha; además, los hitos tempranos variarán poco entre partidas. Se acepta porque el saber depende de la población y de las conexiones (no hay ninguna fecha en las reglas), igual que el saber agrícola ya aprobado.
- Las cajas de los arcaicos son aproximadas: un hueco entre ellas abre una salida temprana, por eso la compuerta del desierto es imprescindible.
- La regla de densidades "dentro de 2× de los valores etnográficos" se aplica a las densidades base. Las compuertas y la ocupación arcaica reducen la capacidad efectiva de los recolectores de nuestra especie, no la densidad humana total.

### Hitos

El motor avisa una sola vez, la primera vez que ocurre cada uno:

- Salida de África (primera población estable fuera de África y Arabia; Arabia es una región propia que cuenta como África para este hito).
- Desaparición de los neandertales: cuando su territorio ocupado baja del 1 % del inicial. En la realidad, hace 41.000–39.000 años (Higham et al. 2014). Se muestra para comparar, sin ventana de calibración.
- Llegada a Asia, Europa, Australia, Norteamérica, Sudamérica, Polinesia y Nueva Zelanda.
- Cada origen independiente de la agricultura (uno por región de domesticables).
- Primera ciudad, primera escritura, industria.
- 1.000 millones y 8.000 millones de personas.

Cada hito tiene en `datos.js` su fecha real con rango y fuente. Referencias aproximadas, a confirmar y citar al escribir los datos (la fila del fósil no es un hito: es el punto de partida de la partida):

| Hito | En la realidad |
|---|---|
| Fósil más antiguo de *Homo sapiens* (inicio) | ~300.000 años (Jebel Irhoud) |
| Llegada a Australia | hace ~65.000–50.000 años |
| Llegada a Europa | hace ~54.000–45.000 años |
| Llegada a América | hace ~23.000–15.000 años |
| Agricultura en el Creciente Fértil | hace ~11.500–10.000 años |
| Primera ciudad (Uruk) | ~4000 a. C. |
| Escritura (cuneiforme) | ~3200 a. C. |
| Nueva Zelanda | ~1250–1300 d. C. |
| Revolución industrial | ~1760 d. C. |
| 1.000 millones de personas | ~1804 |
| 8.000 millones de personas | noviembre de 2022 |

### Azar

Generador pseudoaleatorio con semilla. La misma semilla con las mismas opciones produce exactamente la misma partida. Cada partida nueva usa una semilla al azar.

## Vista 3D

- **Globo:** la Tierra con sus texturas reales (día y océanos), más una **capa de datos** de 180 × 90 píxeles (uno por celda) que se actualiza unas pocas veces por segundo. El shader usa esa capa para pintar el **hielo** y la **plataforma seca** de los puentes abiertos.
- **Luces nocturnas simuladas:** la textura real de luces (`earth_night.jpg`, ciudades de hoy) **no** se usa en esta escala. El lado nocturno muestra las luces de las celdas agrícolas, urbanas e industriales de la partida, con brillo según su población.
- **Sol:** gira despacio alrededor del globo (decorativo, una vuelta por minuto aproximadamente) para que se vean el lado de día y el de noche.
- **Bandas:** hasta ~3.000 puntos cálidos que caminan al azar dentro de las celdas habitadas por recolectores. Cuántos tiene cada celda sigue el logaritmo de su población. Cuando una celda se vuelve agrícola, sus bandas se apagan y aparece su luz; las ciudades brillan más.
- **Movimiento reducido:** con `prefers-reduced-motion` las bandas no caminan y el Sol no gira.
- **Cámara:** OrbitControls alrededor del globo, con límites de distancia propios de la escala.

## Interfaz

Reutiliza la barra de reloj, el muelle, el menú de capas, la hoja lateral y los modales que ya existen.

- **Reloj:**
  - Muestra el año de la partida: "hace 58.000 años" (antes de 10.000 a. C.), "3000 a. C." y "1850" (años d. C. sin sufijo).
  - Velocidad **Automática** por era, definida en `datos.js` para poder ajustarla. Valores iniciales:

    | Era | Años por segundo | Duración aprox. |
    |---|---|---|
    | 300.000–80.000 años atrás | 10.000 | 22 s |
    | 80.000–12.000 | 2.000 | 34 s |
    | 12.000–5.000 | 200 | 35 s |
    | 3000 a. C.–1500 d. C. | 50 | 90 s |
    | 1500–1900 | 5 | 80 s |
    | 1900–2026 | 2 | 63 s |

    Unos 5 minutos de reloj; con las pausas de los hitos, 6–8 minutos por partida.
  - El control deslizante multiplica la velocidad automática: ×0,25, ×0,5, ×1, ×2, ×4.
  - Pausa y reanudación con el botón actual.
  - El botón de la fecha ofrece empezar una **nueva partida** (otra semilla), con confirmación.
  - Al llegar a 2026 la partida se detiene y abre la Bitácora de tu humanidad.
- **Tarjeta comparativa** (siempre visible en la escala): población de la partida frente a la real estimada para ese año ("Tu humanidad: 2,1 millones · Real: ~4 millones"). Antes de 10.000 a. C. la cifra real se muestra como rango con la nota "estimación muy incierta". También muestra los continentes alcanzados.
- **Aviso de hito:** tarjeta con título, las dos fechas ("Tu humanidad: hace 58.000 años · En la realidad: hace 65.000–50.000 años"), una frase de explicación y la fuente. Por defecto **pausa** la partida hasta cerrarla. Tocarla vuela la cámara al lugar del hito.
- **Bitácora de tu humanidad:** modal con todos los hitos alcanzados, cada uno junto a su fecha real y la diferencia. Al terminar la partida es el resumen final.
- **Muelle:** en esta escala, botones de continentes (África, Europa, Asia, Oceanía, América) que vuelan la cámara.
- **Menú de capas:** "Hielo y costas antiguas", "Grupos", "Luces".
- Todo el texto en español y la disposición funciona a ancho de celular, como el resto de la app.

## Pruebas

### Pruebas unitarias (`node --test pruebas/`)

Sobre un mundo de mentira pequeño (unas decenas de celdas, con su propia curva de clima):

- La población de una celda nunca supera su capacidad (con una tolerancia mínima por el paso de tiempo).
- Migrar no crea ni destruye personas.
- Un puente de tierra se abre cuando el mar baja de su umbral y se cierra al subir.
- Las celdas cubiertas de hielo no tienen población.
- La agricultura nunca nace fuera de una región con domesticables ni antes del Holoceno.
- La misma semilla y las mismas opciones producen el mismo estado tras N pasos; otra semilla produce otro.
- Cada hito se avisa una sola vez.

### Calibración contra la historia real

`node pruebas/calibrar.mjs` corre 30 partidas completas con el mapa real, sin dibujar, y muestra para cada hito la mediana y los percentiles 10 y 90. La fase está terminada cuando:

| Hito | Ventana aceptada para la mediana |
|---|---|
| Salida de África | hace 130.000–45.000 años |
| Australia | hace 80.000–35.000 |
| Europa | hace 60.000–30.000 |
| América | hace 30.000–12.000 |
| Primera agricultura | hace 13.000–8.000 |
| Primera ciudad | hace 8.000–4.000 |
| Industria | 1500–1900 d. C. |
| Población en 2026 | 3.000–15.000 millones |
| 1.000 millones de personas (agregada el 2026-10-15) | 1500–1950 d. C. |

Agregado el 2026-10-15 a pedido del usuario: además, al menos el 80 % de las partidas llega a la industria antes de 2026. La primera calibración dejaba la población preindustrial entre 10 y 50 veces por encima de la real (los 1.000 millones caían entre 3600 y 900 a. C.) y en 8 de cada 30 partidas la industria nunca llegaba.

Y además en al menos el 80 % de las partidas la humanidad llega a todos los continentes habitados. Si no se cumple, se ajustan los parámetros de las reglas; nunca se fuerza un resultado. Cada partida sin dibujo debe tardar menos de 2 segundos.

Se calibra en orden cronológico: primero las llegadas a los continentes, después la agricultura (que el Holoceno ya acota) y al final ciudades, escritura, industria y población, que dependen sobre todo del saber. Las fechas de Polinesia y Nueva Zelanda se muestran para comparar, pero no tienen ventana de calibración.

Desde el cambio del 2026-10-15, la calibración ajusta también los parámetros nuevos: ritmo y difusión del saber de recolectores, umbrales del desierto, del mar y de los arcaicos, y ritmo de desplazamiento. La desaparición de los neandertales se muestra para comparar, sin ventana. El límite de 2 s por partida sigue en pie: el estudio midió 4,5–5,5 s en la computadora del usuario, así que la calibración incluye optimizar el motor sin cambiar sus resultados.

### Rendimiento y prueba en el navegador

- La simulación usa como máximo ~3 ms por cuadro; los pasos se reparten entre cuadros.
- Antes de publicar: servidor local, escala "La Tierra" a tamaño de escritorio y de celular, una partida completa en velocidad ×4 sin errores en la consola y con el globo, las bandas, las luces y los avisos funcionando.

## Errores

- Si los archivos de `poblacion/` no cargan, la escala "La Tierra" muestra un aviso ("No se pudo cargar la simulación") y las demás escalas funcionan igual.
- Si una textura no llega, el globo usa la textura procedimental de respaldo, como hoy.
- El motor limita cada valor a rangos válidos (población ≥ 0, sin NaN). Si algo se sale de rango, lo corrige y lo registra en la consola en lugar de romper la partida.

## Fuentes y créditos

Cada dato real en `datos.js` lleva su referencia en un comentario. Las fuentes principales se suman a los créditos de la app (modal "Escala del universo") y al README:

- Nivel del mar: Spratt y Lisiecki (2016), *A Late Pleistocene sea level stack*.
- Población real desde 10.000 a. C.: base HYDE (Klein Goldewijk et al.) y Naciones Unidas para el presente.
- Fechas de hitos: publicaciones citadas por hito (p. ej. Hublin et al. 2017 para Jebel Irhoud).
- Humanos arcaicos (cambio del 2026-10-15): rangos aproximados de neandertales (incluido el Altái, Krause et al. 2007) y denisovanos (cueva de Denisova, Reich et al. 2010; Tíbet, Chen et al. 2019); desaparición de los neandertales, Higham et al. (2014).

## Hoja de ruta

Cada sub-proyecto tiene su propia especificación, plan y entrega, y debe funcionar por sí solo antes del siguiente.

1. **Motor + escala "La Tierra" + modo Historia** (este documento).
2. **Modo juego: Laboratorio orbital.** Quien juega elige las condiciones al empezar (dónde nace la humanidad, natalidad, intensidad de las glaciaciones, puentes de tierra) y usa poderes durante la partida (glaciación, erupción tipo Toba, plaga, sequía, regalar una innovación) con un recurso de Energía Orbital. Ideas para evaluar en su diseño: poderes primordiales repartidos como "semillas" al inicio.
3. **Modo juego: Tu pueblo.** Guiar un linaje concreto; decisiones en momentos clave con la partida en pausa; rasgos ganados por presión selectiva (cuellos de botella); encuentros con otros pueblos y especies humanas (neandertales, denisovanos). Desde el cambio del 2026-10-15 ya existen como fondo del modo Historia; esta fase les agrega encuentros, mestizaje y decisiones.
4. **Capas profundas.** Religión e interpretación de los "milagros", mito fundacional, rutas de comercio que llevan tecnología, fe y plagas, crisis de era (tipo colapso de la Edad del Bronce), profetas, héroes y herejes, dioses rivales en la estación orbital (requiere una IA oponente) y la rebelión "Prometeo".
