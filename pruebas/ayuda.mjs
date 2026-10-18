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
    puentes: [], hielo: [], humedos: { cajas: [], tramos: [] }, rios: [], domesticables: [], islas: [], barreras: [], arcaicos: [],
    regiones: [{ id: "todo", nombre: "Todo", hito: null, cajas: [[-90, 90, -180, 180]] }],
    origenes: [], hitos: [],
    ...extra
  };
}

// Huella de una partida: FNV-1a de los bytes de población, innovaciones, saber de recolectores y arcaicos.
// Sirve para comprobar que el modo Historia da exactamente lo mismo que antes.
export function huella(m) {
  const c = m.celdas; let h = 0x811c9dc5 >>> 0;
  const mezclar = a => { const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let k = 0; k < b.length; k++) { h ^= b[k]; h = Math.imul(h, 16777619) >>> 0; } };
  mezclar(c.poblacion); mezclar(c.innovaciones); mezclar(c.saberRecolector); mezclar(c.arcaicos);
  return h.toString(16).padStart(8, "0");
}
