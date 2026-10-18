// Catálogo del modo "Tu pueblo" de "La Tierra": reglas, rasgos y momentos de decisión. Solo datos, sin lógica.
// Los nombres de biomas, etapas e innovaciones ("DESIERTO", "AGRICULTURA"…) los traduce pueblo.js a los del motor.
// Una caja es [latMín, latMáx, lonMín, lonMáx]. Los valores numéricos son del juego, no mediciones.
// `real` compara cada decisión con lo que se sabe que ocurrió, con su fuente.
const PUEBLO = (() => {
  const SIMPLIFICACION = "Simplificación del juego: no corresponde a un gen concreto.";
  return {
    reglas: {
      // Años mínimos entre dos decisiones, por tramos desde cada año (como historia.pasos)
      intervalo: [[-1e9, 2000], [-10000, 300], [1500, 50]],
      bloqueoInicial: ["AGRICULTURA", "CIUDADES", "INDUSTRIA"],
      sequiaCaida: 0.25, cuelloFraccion: 0.3, frioParte: 0.2, frioGlacial: 0.5, ganadoAños: 1000,
      rasgoPorEspecie: { neandertales: "herencia_neandertal", denisovanos: "herencia_denisovana" }
    },

    rasgos: [
      { id: "resistentes_sed", nombre: "Resistentes a la sed",
        texto: "Sobrevivir a la sequía te volvió más apto en desiertos y estepas.",
        fuente: SIMPLIFICACION,
        mods: { aptitud: [{ donde: { biomas: ["DESIERTO", "ESTEPA"] }, valor: 1.3 }] } },
      { id: "adaptados_frio", nombre: "Adaptados al frío",
        texto: "Con ropa y abrigo, tu pueblo vive mejor en tierras frías.",
        fuente: SIMPLIFICACION,
        mods: { aptitud: [{ donde: { frio: true }, valor: 1.3 }] } },
      { id: "herencia_neandertal", nombre: "Herencia neandertal",
        texto: "Genes heredados de los neandertales podrían ayudar un poco en el frío.",
        fuente: "Green et al. (2010), Science 328; Prüfer et al. (2014), Nature 505. Simplificación del juego: las fuentes documentan la mezcla, no una ventaja en el frío.",
        mods: { aptitud: [{ donde: { frio: true }, valor: 1.15 }] } },
      { id: "herencia_denisovana", nombre: "Herencia denisovana",
        texto: "Un gen denisovano ayuda a vivir en la altura, como en el Tíbet.",
        fuente: "Huerta-Sánchez et al. (2014), Nature 512. La caja de los Andes es una simplificación del juego: no es una herencia denisovana documentada (la adaptación andina tiene otro origen).",
        mods: { aptitud: [{ donde: { cajas: [[27, 40, 75, 105], [-25, 5, -80, -63]] }, valor: 1.4 }] } },
      { id: "lactosa", nombre: "Leche en la edad adulta",
        texto: "Beber leche de adultos es una ventaja donde hay ganado y campos.",
        fuente: "Itan et al. (2009), PLoS Computational Biology 5",
        mods: { capacidad: [{ donde: { etapas: ["AGRICULTORES", "URBANA"] }, valor: 1.15 }] } },
      { id: "defensas", nombre: "Mejores defensas",
        texto: "Tras vivir epidemias, tu pueblo las resiste mejor.",
        fuente: "McNeill (1976), Plagues and Peoples",
        mods: { defensas: 0.5 } }
    ],

    momentos: [
      { id: "nacimiento", limite: 1, titulo: "¿Dónde nace tu pueblo?",
        texto: "Hace unos 300.000 años, la humanidad aparece en África. Elige la cuna de tu pueblo.",
        real: { texto: "Los fósiles más antiguos de nuestra especie vienen de Marruecos, Etiopía y Sudáfrica. Hoy se piensa que no hubo una sola cuna, sino varios grupos conectados por todo el continente.",
                fuente: "Hublin et al. (2017), Nature 546; Scerri et al. (2018), Trends in Ecology & Evolution 33" },
        opciones: [
          { id: "norte", texto: "Norte de África", detalle: "Jebel Irhoud, en Marruecos, donde hay restos de unos 300.000 años.", efecto: {} },
          { id: "este", texto: "Este de África", detalle: "Omo Kibish, en Etiopía, en la región del Gran Valle del Rift.", efecto: {} },
          { id: "sur", texto: "Sur de África", detalle: "Florisbad, en Sudáfrica, en la sabana del extremo sur.", efecto: {} }
        ] },

      { id: "sequia", limite: 2, titulo: "La gran sequía",
        texto: "Las lluvias fallan y el hambre aprieta. Tu pueblo se encoge. ¿Qué haces?",
        real: { texto: "En Pinnacle Point (Sudáfrica) hay marisco comido hace unos 164.000 años, en una época seca y fría. Es posible que la costa ayudara a algunos grupos a sobrevivir, pero la evidencia viene de un solo sitio.",
                fuente: "Marean et al. (2007), Nature 449" },
        opciones: [
          { id: "resistir", texto: "Resistir en casa", detalle: "Creces menos un tiempo; puedes volverte resistente a la sed.", efecto: { perder: 0.2, rasgo: "resistentes_sed" } },
          { id: "costa", texto: "Vivir del mar", detalle: "Mejor en la costa por 5.000 años; peor tierra adentro.", efecto: { mods: { aptitud: [{ donde: { costa: true }, valor: 1.5 }] }, duracion: 5000 } },
          { id: "dispersarse", texto: "Dispersarse", detalle: "Migras más por 3.000 años; te divides en grupos pequeños.", efecto: { mods: { migracion: 3 }, duracion: 3000 } }
        ] },

      { id: "frontera", limite: 3, titulo: "El umbral de África",
        texto: "Al norte y al este hay tierras nuevas, pero para llegar hay que cruzar un desierto o un estrecho de mar.",
        real: { texto: "Nuestra especie estuvo en el Levante hace más de 100.000 años, pero aquella salida no dejó una población duradera. Según otras investigaciones, la salida que sí perduró fue posterior, hace unos 70.000 a 50.000 años. Con el mar bajo, el estrecho de Bab el-Mandeb se acortaba mucho, aunque nunca se secó del todo.",
                fuente: "Grün et al. (2005), Journal of Human Evolution 49; Lambeck et al. (2011), Quaternary Science Reviews 30" },
        opciones: [
          { id: "cruzar", texto: "Cruzar ya", detalle: "Te expandes y cruzas mares por 2.000 años; pierdes a parte de la gente.", efecto: { mods: { migracion: 4, cruce: 10 }, duracion: 2000, perder: 0.1 } },
          { id: "esperar", texto: "Esperar en África", detalle: "Más seguros por 2.000 años, pero sin tierras nuevas.", efecto: { mods: { aptitud: [{ donde: {}, valor: 1.1 }], migracion: 0.5 }, duracion: 2000 } }
        ] },

      { id: "encuentro", limite: 2, titulo: "Otros humanos",
        texto: "En estas tierras viven otros humanos, más antiguos que tú. ¿Cómo te relacionas?",
        real: { texto: "Los genomas muestran que nuestra especie se mezcló con neandertales y con denisovanos: la gente de fuera de África lleva hoy un poco de ADN neandertal, y un gen denisovano ayuda a la gente del Tíbet a vivir en la altura. No sabemos cuánto de ese contacto fue pacífico.",
                fuente: "Green et al. (2010), Science 328; Prüfer et al. (2014), Nature 505; Huerta-Sánchez et al. (2014), Nature 512" },
        opciones: [
          { id: "evitar", texto: "Evitarlos", detalle: "Evitas conflictos por 5.000 años; ocupas menos tierra.", efecto: { mods: { evitaArcaicos: true, desplaza: 0.5 }, duracion: 5000 } },
          { id: "mezclarse", texto: "Mezclarse", detalle: "Recibes sus genes, pero los empujas más lento: menos tierra un tiempo.", efecto: { rasgo: "segun_especie", mods: { desplaza: 0.5 }, duracion: 5000 } },
          { id: "competir", texto: "Competir", detalle: "Ganas tierra rápido por 5.000 años; no heredas sus genes.", efecto: { mods: { desplaza: 3, perdidaArcaicos: 0.0005 }, duracion: 5000 } }
        ] },

      { id: "frio", limite: 1, titulo: "La edad de hielo",
        texto: "El hielo avanza y el frío se vuelve duro en el norte. ¿Cómo lo afrontas?",
        real: { texto: "Hay quien propone que la ropa cosida (agujas de hueso) ayudó a nuestra especie a vivir en climas fríos. Es una hipótesis discutida.",
                fuente: "Gilligan (2010), Journal of Archaeological Method and Theory 17" },
        opciones: [
          { id: "ropa", texto: "Inventar abrigo", detalle: "Creces menos un tiempo; vives mejor en tierras frías después.", efecto: { perder: 0.1, rasgo: "adaptados_frio" } },
          { id: "sur", texto: "Huir al sur", detalle: "Migras más por 3.000 años; el frío te resulta peor.", efecto: { mods: { migracion: 2, aptitud: [{ donde: { frio: true }, valor: 0.7 }] }, duracion: 3000 } }
        ] },

      { id: "cuello", limite: 2, titulo: "Casi la extinción",
        texto: "Tu pueblo se ha reducido a muy poca gente. Eres frágil.",
        real: { texto: "Los genomas actuales sugieren que los antepasados de la gente de fuera de África pasaron por un cuello de botella hace decenas de miles de años. Las fechas y las causas exactas son inciertas.",
                fuente: "Li y Durbin (2011), Nature 475" },
        opciones: [
          { id: "seguir", texto: "Seguir adelante", detalle: "Sobrevives; la prueba te deja una ventaja según su causa.", efecto: { rasgo: "segun_causa" } }
        ] },

      { id: "agricultura", limite: 2, titulo: "Las primeras semillas",
        texto: "Tu pueblo ha aprendido que algunas plantas se pueden sembrar. ¿Te haces agricultor?",
        real: { texto: "Los primeros agricultores solían comer peor y enfermar más que los cazadores-recolectores: sus esqueletos muestran más caries, menor estatura y más infecciones. Aun así, la agricultura se extendió porque permitía alimentar a muchas más personas.",
                fuente: "Larsen (2006), Quaternary International 150" },
        opciones: [
          { id: "adoptar", texto: "Sembrar", detalle: "Se abre el camino a más gente; se vive algo peor.", efecto: { desbloquea: ["AGRICULTURA"], mods: { aptitud: [{ donde: { etapas: ["AGRICULTORES", "URBANA", "INDUSTRIAL"] }, valor: 0.9 }] } } },
          { id: "recolectar", texto: "Seguir recolectando", detalle: "Más salud por 2.000 años; sin cultivos no creces tanto.", efecto: { bloquea: { bits: ["AGRICULTURA"], años: 2000 }, mods: { aptitud: [{ donde: { etapas: ["RECOLECTORES"] }, valor: 1.1 }] }, duracion: 2000 } }
        ] },

      { id: "ganado", limite: 1, titulo: "Animales de corral",
        texto: "Tienes cabras y vacas. Su leche podría alimentarte también de adulto. ¿La bebes?",
        real: { texto: "Según un modelo, la capacidad de digerir la leche de adultos apareció en Europa hace unos 7.500 años, entre los Balcanes y Europa central, y se fue haciendo común después.",
                fuente: "Itan et al. (2009), PLoS Computational Biology 5" },
        opciones: [
          { id: "leche", texto: "Beber leche", detalle: "Ventaja en tierras de cultivo; no aporta nada donde no hay campos.", efecto: { rasgo: "lactosa" } },
          { id: "no", texto: "Solo carne", detalle: "Algo más de ventaja agrícola por 2.000 años; sin la leche.", efecto: { mods: { aptitud: [{ donde: { etapas: ["AGRICULTORES"] }, valor: 1.05 }] }, duracion: 2000 } }
        ] },

      { id: "ciudades", limite: 2, titulo: "La primera ciudad",
        texto: "Hay tanta gente que podrías reunirla en una gran ciudad. ¿La fundas?",
        real: { texto: "Según McNeill, vivir amontonados con animales y recibir viajeros de lejos hizo de las ciudades focos de epidemias, y con el tiempo sus habitantes desarrollaron más defensas. Es una tesis histórica, no una medición.",
                fuente: "McNeill (1976), Plagues and Peoples" },
        opciones: [
          { id: "fundar", texto: "Fundar la ciudad", detalle: "Más gente y comercio; las epidemias golpean más fuerte.", efecto: { desbloquea: ["CIUDADES"], mods: { epidemia: 0.0003 } } },
          { id: "aldeas", texto: "Seguir en aldeas", detalle: "Más sanos por 2.000 años; la población crece menos.", efecto: { bloquea: { bits: ["CIUDADES"], años: 2000 }, mods: { aptitud: [{ donde: {}, valor: 1.05 }] }, duracion: 2000 } }
        ] },

      { id: "mar", limite: 1, titulo: "El mar abierto",
        texto: "Más allá de la costa hay un mar sin fin y quizá islas. ¿Te lanzas a explorar?",
        real: { texto: "Los pueblos de lenguas austronesias se expandieron por el Pacífico en oleadas, con largas pausas entre una y otra. Las fechas se deducen de las lenguas, así que son aproximadas.",
                fuente: "Gray, Drummond y Greenhill (2009), Science 323" },
        opciones: [
          { id: "explorar", texto: "Navegar al horizonte", detalle: "Puedes llegar a islas lejanas por 3.000 años; arriesgas gente.", efecto: { mods: { cruce: 5 }, duracion: 3000, perder: 0.05 } },
          { id: "quedarse", texto: "Quedarse en la costa", detalle: "Mejor vida costera por 3.000 años; sin islas lejanas.", efecto: { mods: { aptitud: [{ donde: { costa: true }, valor: 1.1 }] }, duracion: 3000 } }
        ] },

      { id: "industria", limite: 2, titulo: "Las máquinas",
        texto: "Con carbón y máquinas de vapor, tu pueblo podría producir mucho más. ¿Lo adoptas?",
        real: { texto: "La revolución industrial empezó en Gran Bretaña en el siglo XVIII, donde la mano de obra era cara y el carbón barato. Se discute si habría ocurrido igual en otro lugar.",
                fuente: "Allen (2009), The British Industrial Revolution in Global Perspective" },
        opciones: [
          { id: "adoptar", texto: "Adoptar las máquinas", detalle: "Mucha más gente y riqueza; las ciudades hacinadas sufren más epidemias.", efecto: { desbloquea: ["INDUSTRIA"], mods: { epidemia: 0.0002 } } },
          { id: "esperar", texto: "Esperar un tiempo", detalle: "Más calma por 200 años; la población crece menos.", efecto: { bloquea: { bits: ["INDUSTRIA"], años: 200 }, mods: { aptitud: [{ donde: {}, valor: 1.05 }] }, duracion: 200 } }
        ] }
    ]
  };
})();
if (typeof module !== "undefined") module.exports = PUEBLO;
