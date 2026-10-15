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
