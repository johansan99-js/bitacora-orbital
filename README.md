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

## Cómo abrirlo

Las texturas se cargan como archivos aparte, así que la página necesita un servidor local (abrir `index.html` con doble clic no carga las texturas: el navegador lo bloquea). Por ejemplo, desde esta carpeta:

```bash
python3 -m http.server 8000
```

y abre <http://localhost:8000>. Necesita internet para cargar three.js y las fuentes.

Para publicarlo gratis en internet, activa **GitHub Pages** en *Settings → Pages* (rama `main`, carpeta raíz).

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html` | Toda la app: estilos, datos (planetas, lunas, estrellas, galaxias, cuestionario, misiones) y la escena 3D con three.js r128 |
| `tex/` | Texturas de los planetas, optimizadas para la web |
| `renders/` | Retratos de cada astro (WebP), hechos con Blender |
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

## Créditos

- Tierra (día, noche, nubes, relieve y océanos) y Luna: imágenes de NASA (Blue Marble y Black Marble), tomadas de los ejemplos de [three.js](https://github.com/mrdoob/three.js).
- Demás planetas, el Sol y los anillos de Saturno: [Planet Pixel Emporium](http://planetpixelemporium.com/planets.html), de James Hastings-Trew, vía [threex.planets](https://github.com/jeromeetienne/threex.planets). Revisa su licencia antes de cualquier uso comercial.
- Motor 3D: [three.js](https://threejs.org) r128. Retratos: [Blender](https://www.blender.org).
- Venus, las lunas de Júpiter y Saturno, las estrellas y las galaxias usan texturas procedurales hechas en el propio código.
