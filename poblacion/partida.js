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
