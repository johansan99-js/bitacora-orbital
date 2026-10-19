"""Copias WebP de las texturas JPG más pesadas, para que la página baje menos bytes.

Los JPG originales no se tocan: siguen en tex/ porque herramientas/generar_mundo.py lee tex/earth_spec.jpg y
tex/earth_day.jpg para generar poblacion/mundo.js (cambiarlos cambiaría las huellas de la simulación), y porque la
página los pide si el navegador no puede abrir la copia WebP.

Solo se copian los que bajan al menos un 20 % (los de Mercurio y la Luna, llenos de detalle fino, no ganan nada).
La lista tiene que coincidir con el conjunto WEBP de index.html (lo comprueba pruebas/pagina.test.mjs).

Uso: python herramientas/publicar_webp.py   (necesita Pillow, el mismo que generar_mundo.py)
"""
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
CALIDAD = 80
ARCHIVOS = ["earth_day.jpg", "earth_night.jpg", "earth_spec.jpg", "earth_clouds.jpg", "jupiter.jpg", "mars.jpg",
            "pluto.jpg", "pluto_bump.jpg", "sun.jpg"]


def main():
    for nombre in ARCHIVOS:
        jpg = RAIZ / "tex" / nombre
        webp = jpg.with_suffix(".webp")
        Image.open(jpg).convert("RGB").save(webp, "WEBP", quality=CALIDAD, method=6)
        antes, despues = jpg.stat().st_size, webp.stat().st_size
        print(f"{nombre}: {antes // 1024} kB -> {webp.name}: {despues // 1024} kB ({100 - despues * 100 // antes} % menos)")


if __name__ == "__main__":
    main()
