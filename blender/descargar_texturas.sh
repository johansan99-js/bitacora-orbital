#!/usr/bin/env bash
# Descarga las texturas originales (en alta resolución) que usa render_planets.py.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p raw && cd raw
T=https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/planets
X=https://raw.githubusercontent.com/jeromeetienne/threex.planets/master/images
for f in earth_atmos_2048.jpg earth_normal_2048.jpg earth_specular_2048.jpg earth_clouds_1024.png earth_lights_2048.png moon_1024.jpg; do
  curl -fsSL -o "$f" "$T/$f"
done
for f in sunmap.jpg mercurymap.jpg mercurybump.jpg venusmap.jpg marsmap1k.jpg marsbump1k.jpg jupitermap.jpg saturnmap.jpg \
         saturnringcolor.jpg saturnringpattern.gif uranusmap.jpg neptunemap.jpg plutomap1k.jpg plutobump1k.jpg; do
  curl -fsSL -o "$f" "$X/$f"
done
echo "Texturas listas en blender/raw/"
