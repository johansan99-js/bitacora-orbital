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
    let motor, jugando = true, mult = 2, cola = [], debe = 0;

    function nueva(semilla) {
      motor = MotorRef.crear(mundo, historia, { semilla, params: opciones.params });
      cola = []; jugando = true; debe = 0;
      motor.alHito(h => {
        cola.push(h);
        if (opciones.pausarEnHitos !== false) jugando = false;
        emitir({ tipo: "hito", hito: h });
      });
      emitir({ tipo: "nueva" });
    }
    const añosPorSegundo = () => MotorRef.tramo(historia.velocidades, motor.año()) * MULTIPLICADORES[mult];

    // El motor siempre avanza en pasos completos, los mismos que en la calibración, así la historia no depende de los
    // cuadros por segundo ni de la velocidad: los años pedidos se acumulan en `debe` y el resto queda para el cuadro siguiente.
    function paso(dt) {
      if (!jugando || motor.terminado() || !(dt > 0)) return 0;
      const pedido = dt * añosPorSegundo();
      debe = Math.min(debe + pedido, Math.max(pedido, 10 * motor.pasoMax()));   // sin atraso infinito si la máquina no da abasto
      const t0 = reloj();
      let hecho = 0;
      // Al menos un paso si alcanza; después, solo mientras quede presupuesto de tiempo
      while (jugando && !motor.terminado()) {
        const d = Math.min(motor.pasoMax(), historia.presente - motor.año());
        if (debe < d - 1e-6) break;
        motor.avanzar(d);
        debe -= d;
        hecho += d;
        if (reloj() - t0 >= presupuestoMs) break;
      }
      if (!jugando) debe = 0;   // tras una pausa por hito no se arrastra el resto
      if (motor.terminado()) { jugando = false; debe = 0; emitir({ tipo: "fin" }); }
      return hecho;
    }

    nueva(opciones.semilla);
    return {
      motor: () => motor,
      nueva,
      paso,
      añosPorSegundo,
      reproduciendo: () => jugando,
      setReproduciendo(b) { jugando = !!b && !motor.terminado(); if (!jugando) debe = 0; emitir({ tipo: "pausa" }); return jugando; },
      velocidad(i) { if (Number.isFinite(i)) mult = Math.min(MULTIPLICADORES.length - 1, Math.max(0, Math.round(i))); },
      textoAño: (año = motor.año()) => textoAño(año, historia.presente),
      textoVelocidad() {
        const n = añosPorSegundo().toLocaleString("es", { maximumFractionDigits: 1 });
        return `${n} ${n === "1" ? "año" : "años"}/s`;
      },
      pendientes: () => cola.slice(),
      tomarHito: () => cola.shift() || null,
      terminada: () => motor.terminado(),
      alEvento(fn) { oyentes.push(fn); }
    };
  }

  return { crear, textoAño, MULTIPLICADORES };
})();
if (typeof module !== "undefined") module.exports = Partida;
