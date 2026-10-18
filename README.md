# Bitácora Orbital

Explorador 3D del universo en español, hecho para aprender astronomía. Funciona en el navegador, en computadora y en celular.

## Qué incluye

- **Sistema solar en 3D**: el Sol, los 8 planetas, la Luna, Plutón y 6 lunas de Júpiter y Saturno, en su posición real de hoy. Puedes adelantar el tiempo hasta 2 años por segundo.
- **Texturas reales**: la Tierra de día y de noche (con luces de ciudades), nubes, reflejo del Sol en los océanos, y la sombra de Saturno sobre sus anillos.
- **Retratos fotorrealistas** de cada astro, renderizados con Blender (Cycles).
- **Cuatro escalas de viaje**: sistema solar, estrellas vecinas, Vía Láctea y Grupo Local (Andrómeda, las Nubes de Magallanes y más).
- **10 constelaciones** en su posición real del cielo.
- **Fichas** con datos, tiempo que tarda la luz y tu peso en cada mundo.
- **Misiones espaciales** (de Sputnik a Dragonfly) y un **cuestionario** con 3 niveles.
- **La Tierra habitada**: la humanidad nace hace 300.000 años en África y se extiende sola por el planeta, con glaciaciones, puentes de tierra, agricultura, ciudades e industria. Cada hito se compara con su fecha real y su fuente. En el modo **Tu pueblo** guías a un grupo con decisiones en momentos clave, ganas rasgos y te encuentras con neandertales y denisovanos; cada decisión se compara con lo que pasó en la realidad.

## Cómo abrirlo

Las texturas se cargan como archivos aparte, así que la página necesita un servidor local (abrir `index.html` con doble clic no carga las texturas: el navegador lo bloquea). Por ejemplo, desde esta carpeta:

```bash
python3 -m http.server 8000
```

y abre <http://localhost:8000>. three.js viene en `vendor/`; solo las fuentes se cargan de internet (sin conexión se usan las del sistema).

Se publica gratis en **GitHub Pages** con GitHub Actions (`.github/workflows/pages.yml`): cada push a `main` sube `index.html`, `tex/`, `renders/`, `poblacion/` y `vendor/`, y cambia el `?v=dev` de los `<script>` por el commit publicado, para que nadie mezcle un `index.html` nuevo con un script viejo de la caché. En local `?v=dev` no hace nada. Solo hay que elegir *Settings → Pages → Source: GitHub Actions* una vez. Antes de publicar corre las pruebas (`.github/workflows/pruebas.yml`, las mismas que en cada PR); si alguna falla, no se publica.

Para que nada llegue a `main` sin pasar las pruebas, el dueño del repositorio lo protege una vez, a mano: *Settings → Branches → Add branch protection rule* (o *Rules → Rulesets*) para `main`, con *Require a pull request before merging* y *Require status checks to pass*, eligiendo el check **`pruebas`** (aparece en la lista después de que el workflow haya corrido al menos una vez en un PR).

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html` | Toda la app: estilos, datos (planetas, lunas, estrellas, galaxias, cuestionario, misiones) y la escena 3D con three.js r128 |
| `tex/` | Texturas de los planetas, optimizadas para la web |
| `renders/` | Retratos de cada astro (WebP), hechos con Blender |
| `vendor/` | three.js r128 (`three.min.js`) y su `OrbitControls.js`, copiados sin cambios de los CDN que usaba la página, con su licencia MIT (`LICENSE-three.txt`). SHA-256: `9274bbce…c1ce2` y `02bb4ade…5e7b2` |
| `poblacion/` | La Tierra habitada: mapa en celdas (`mundo.js`, generado), datos reales con fuentes (`datos.js`), motor de la simulación, reloj de la partida, vista 3D y panel |
| `herramientas/generar_mundo.py` | Genera `poblacion/mundo.js` a partir de las texturas de la Tierra |
| `pruebas/` | Pruebas del motor y la partida, y la calibración contra la historia real |
| `blender/render_planets.py` | Script que genera los retratos |
| `blender/descargar_texturas.sh` | Descarga las texturas originales que usa el script |

Dentro de `index.html`, los datos que más vas a querer editar están al principio de los bloques `<script>`: `BODIES` (planetas y lunas), `CONSTS` (constelaciones), `QUIZ` y `LEVELS` (cuestionario), `MISSIONS`, `SCALES` y `COSMOS` (estrellas y galaxias).

## Volver a generar los retratos con Blender

Requiere Python 3.13 y el módulo oficial de Blender (`bpy`, unos 400 MB):

```bash
python3 -m venv .venv
.venv/bin/pip install bpy==5.2.2
blender/descargar_texturas.sh
.venv/bin/python blender/render_planets.py blender/raw blender/out            # todos
.venv/bin/python blender/render_planets.py blender/raw blender/out saturno    # solo uno
```

Salen en PNG de 720 × 720 con fondo transparente (unos 20 segundos por astro en CPU). Para la web se convierten a WebP de 460 × 460, por ejemplo con Pillow.

## La Tierra habitada: pruebas y calibración

El motor (`poblacion/motor.js`) no usa el navegador, así que se prueba con Node 24:

```bash
node --test "pruebas/*.test.mjs"     # o npm test; npm run test:rapido salta las huellas largas
```

Las huellas (`motor-historia.test.mjs`, `pueblo-huella.test.mjs`) comprueban que una partida con semilla fija da exactamente lo mismo que antes, bit a bit (población, innovaciones, saber y arcaicos de cada celda; en Historia también los hitos con su año y la población total). Si una cambia sin querer, algo cambió la simulación.

La calibración corre 30 partidas completas y compara sus hitos con la historia real (sale con error si alguna mediana cae fuera de su ventana o si menos del 80 % de las partidas llega a la industria). `--sin-tiempo` quita el criterio de tiempo por partida, que depende de la máquina; `--comparar` además exige que el informe sea idéntico a `pruebas/referencias/calibrar.txt` (lo hace cada noche `.github/workflows/nocturnas.yml`, junto con `jugar.mjs 8` como informativa). Si Historia cambia a propósito, la referencia se regenera con `node pruebas/calibrar.mjs --sin-tiempo > pruebas/referencias/calibrar.txt`.

```bash
node pruebas/calibrar.mjs
node pruebas/calibrar.mjs --comparar
```

La prueba de juego recorre partidas completas de **Tu pueblo** con tres jugadores automáticos (siempre la primera opción, siempre la segunda y al azar) y sale con error si no se cumple alguno de estos criterios: entre 8 y 14 decisiones por partida (contando el Nacimiento), el jugador al azar vivo en 2026 en el 30–85 % de las partidas, decisiones que importan (medido por semilla, el pueblo final de la política que más tiene sobre la que menos tiene mediana ≥ 1,5, o la fracción de partidas vivas difiere en 20 puntos o más) y tiempo por partida de a lo sumo 1,15 veces el del modo Historia (la mejor de 3 rondas pareadas):

```bash
node pruebas/jugar.mjs
```

Si cambian las texturas de la Tierra, hay que regenerar el mapa (requiere Pillow):

```bash
python herramientas/generar_mundo.py
```

## Créditos

- Tierra (día, noche, nubes, relieve y océanos) y Luna: imágenes de NASA (Blue Marble y Black Marble), tomadas de los ejemplos de [three.js](https://github.com/mrdoob/three.js).
- Demás planetas, el Sol y los anillos de Saturno: [Planet Pixel Emporium](http://planetpixelemporium.com/planets.html), de James Hastings-Trew, vía [threex.planets](https://github.com/jeromeetienne/threex.planets). Revisa su licencia antes de cualquier uso comercial.
- Motor 3D: [three.js](https://threejs.org) r128. Retratos: [Blender](https://www.blender.org).
- Venus, las lunas de Júpiter y Saturno, las estrellas y las galaxias usan texturas procedurales hechas en el propio código.
