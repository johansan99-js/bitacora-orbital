// Datos reales para la simulación de población de "La Tierra". Solo datos, sin lógica.
// Años en calendario: negativo = antes de Cristo. "hace N años" se cuenta desde el presente (2026).
// Una caja es [latMín, latMáx, lonMín, lonMáx] y se compara con el centro de cada celda de 2°.
const HISTORIA = (() => {
  const PRESENTE = 2026;
  const hace = (a, b = a) => [PRESENTE - a, PRESENTE - b];
  return {
    presente: PRESENTE,
    inicio: -298000,
    // Inicio del Holoceno, hace 11.700 años (Walker et al. 2009, Journal of Quaternary Science)
    holoceno: PRESENTE - 11700,

    // Nivel del mar (m respecto del actual) cada 2.000–10.000 años. Valores aproximados leídos de la curva de
    // Spratt y Lisiecki (2016), "A Late Pleistocene sea level stack", Climate of the Past 12: 1079–1092.
    nivelMar: [
      [305000, -40], [300000, -40], [290000, -50], [280000, -70], [270000, -90], [260000, -80], [250000, -40], [240000, -10],
      [235000, -40], [230000, -80], [225000, -40], [220000, -15], [215000, -60], [210000, -45], [205000, -25],
      [200000, -15], [195000, -40], [190000, -65], [180000, -75], [170000, -80], [160000, -90], [150000, -95],
      [145000, -100], [140000, -110], [135000, -60], [130000, -10], [125000, 5], [120000, 5], [115000, -20],
      [110000, -50], [105000, -40], [100000, -25], [95000, -35], [90000, -55], [85000, -40], [80000, -25],
      [75000, -60], [70000, -80], [65000, -85], [60000, -75], [55000, -70], [50000, -65], [45000, -70],
      [40000, -70], [35000, -75], [30000, -80], [25000, -120], [20000, -125], [18000, -120], [16000, -100],
      [14000, -80], [12000, -60], [10000, -40], [8000, -15], [6000, -3], [4000, 0], [0, 0]
    ].map(([h, m]) => [PRESENTE - h, m]).concat([[PRESENTE + 1000, 0]]),

    // Velocidad automática del reloj (años por segundo) desde cada año
    velocidades: [[-298000, 10000], [-78000, 2000], [-10000, 200], [-3000, 50], [1500, 5], [1900, 2]],
    // Tamaño máximo de cada paso de la simulación (años) desde cada año
    pasos: [[-298000, 200], [-10000, 20], [-3000, 10], [1500, 2], [1900, 1]],

    // Puentes de tierra: celdas de mar que quedan secas cuando el mar baja de `umbral` (m).
    // Umbral ≈ profundidad del estrecho según la batimetría GEBCO; valores aproximados.
    // Las cajas solo cubren la plataforma continental: el estrecho de Makassar, al este de Borneo, nunca se secó,
    // por eso llegar a Australia siempre exigió cruzar el mar (la línea de Wallace).
    puentes: [
      { id: "beringia", nombre: "Beringia", umbral: -50, bioma: 2, cajas: [[60, 72, 165, 180], [60, 72, -180, -158]] },
      { id: "sunda", nombre: "Sunda", umbral: -40, bioma: 6, cajas: [[-8, -2, 105, 115], [-2, 5, 101, 115], [5, 13, 99, 107]] },
      { id: "torres", nombre: "Estrecho de Torres", umbral: -12, bioma: 4, cajas: [[-12, -10, 140, 144]] },
      { id: "arafura", nombre: "Plataforma de Arafura", umbral: -50, bioma: 4, cajas: [[-14, -8, 130, 140]] },
      { id: "bass", nombre: "Estrecho de Bass", umbral: -50, bioma: 5, cajas: [[-41, -38, 144, 149]] },
      { id: "doggerland", nombre: "Doggerland", umbral: -25, bioma: 4, cajas: [[51, 56, -2, 8], [49, 51, -5, 2]] },
      { id: "golfo_persico", nombre: "Golfo Pérsico", umbral: -40, bioma: 4, cajas: [[24, 30, 48, 56]] },
      { id: "adan", nombre: "Puente de Adán", umbral: -10, bioma: 6, cajas: [[8, 10, 78, 80]] }
    ],

    // Capas de hielo: la celda se cubre cuando la intensidad glacial (0–1, según el nivel del mar) llega a gMin.
    // El orden de gMin sigue la secuencia de la última desglaciación: Dalton et al. (2020), Quaternary Science
    // Reviews 234, para Norteamérica; Hughes et al. (2016), Boreas 45, para Eurasia. Extensiones aproximadas.
    hielo: [
      { nombre: "Laurentino (sur)", gMin: 0.75, cajas: [[40, 50, -110, -60]] },
      { nombre: "Laurentino (centro)", gMin: 0.55, cajas: [[50, 60, -120, -60]] },
      { nombre: "Laurentino (norte)", gMin: 0.35, cajas: [[60, 76, -125, -60]] },
      { nombre: "Cordillerano", gMin: 0.75, cajas: [[48, 62, -140, -115]] },
      { nombre: "Fenoscandia", gMin: 0.6, cajas: [[54, 72, -10, 40]] },
      { nombre: "Fenoscandia (norte)", gMin: 0.4, cajas: [[62, 72, 0, 60]] },
      { nombre: "Islas Británicas", gMin: 0.75, cajas: [[52, 60, -11, 2]] },
      { nombre: "Patagonia", gMin: 0.7, cajas: [[-56, -40, -76, -70]] }
    ],

    // Sahara y Arabia verdes: en estos tramos sus desiertos tienen capacidad de estepa.
    // Larrasoaña, Roberts y Rohling (2013), PLoS ONE 8: e76514; deMenocal et al. (2000), Quaternary Science Reviews 19.
    humedos: {
      cajas: [[15, 32, -17, 35], [13, 32, 35, 60]],
      tramos: [hace(245000, 235000), hace(220000, 195000), hace(130000, 115000), hace(105000, 95000), hace(85000, 75000), hace(14500, 5000)]
    },

    // Valles de ríos en el desierto: siempre cuentan como estepa (riego natural).
    // Las cajas se dibujaron a mano sobre el mapa de 2° y son aproximadas.
    rios: [
      { nombre: "Nilo", cajas: [[22, 32, 30, 34]] },
      { nombre: "Tigris y Éufrates", cajas: [[29, 38, 38, 49]] },
      { nombre: "Indo", cajas: [[23, 32, 66, 74]] }
    ],

    // Regiones con especies domesticables. `riqueza` (0–1) ordena lo rico de cada "paquete" de plantas y animales
    // según Diamond (1997), "Armas, gérmenes y acero", y Larson et al. (2014), PNAS 111: 6139–6146.
    domesticables: [
      { id: "creciente_fertil", nombre: "Creciente Fértil", riqueza: 1, cajas: [[30, 38, 34, 48]] },
      { id: "china", nombre: "China", riqueza: 0.9, cajas: [[28, 40, 105, 122]] },
      { id: "nueva_guinea", nombre: "Nueva Guinea", riqueza: 0.5, cajas: [[-8, -3, 138, 148]] },
      { id: "mesoamerica", nombre: "Mesoamérica", riqueza: 0.7, cajas: [[14, 22, -105, -88]] },
      { id: "andes", nombre: "Andes", riqueza: 0.6, cajas: [[-18, -5, -80, -68]] },
      { id: "sahel", nombre: "Sahel y Etiopía", riqueza: 0.5, cajas: [[10, 17, -10, 35], [6, 14, 35, 42]] },
      { id: "este_norteamerica", nombre: "Este de Norteamérica", riqueza: 0.4, cajas: [[33, 42, -92, -80]] }
    ],

    // Islas demasiado chicas para el mapa de 2°: se agregan con su superficie (km²). Son superficies de tierra
    // aproximadas de cada archipiélago, según The World Factbook (CIA).
    islas: [
      { nombre: "Hawái", lat: 19.6, lon: -155.5, km2: 16600, bioma: 6 },
      { nombre: "Islas de la Sociedad", lat: -17.6, lon: -149.4, km2: 1600, bioma: 6 },
      { nombre: "Marquesas", lat: -9.0, lon: -139.5, km2: 1050, bioma: 6 },
      { nombre: "Rapa Nui", lat: -27.1, lon: -109.4, km2: 164, bioma: 4 },
      { nombre: "Islas Cook", lat: -21.2, lon: -159.8, km2: 240, bioma: 6 },
      { nombre: "Samoa", lat: -13.8, lon: -172.1, km2: 2840, bioma: 6 },
      { nombre: "Tonga", lat: -21.2, lon: -175.2, km2: 750, bioma: 6 },
      { nombre: "Fiyi", lat: -17.7, lon: 178.0, km2: 18300, bioma: 6 },
      { nombre: "Vanuatu", lat: -15.4, lon: 167.0, km2: 12200, bioma: 6 },
      { nombre: "Nueva Caledonia", lat: -21.3, lon: 165.5, km2: 18600, bioma: 5 },
      { nombre: "Islas Salomón", lat: -9.6, lon: 160.2, km2: 28400, bioma: 6 }
    ],

    // Regiones para los hitos de llegada. Gana la primera caja que contiene el centro de la celda.
    // Las cajas se dibujaron a mano sobre el mapa de 2° y son aproximadas.
    regiones: [
      // Arabia cuenta como África para la salida: el hito es "fuera de África y Arabia"
      { id: "arabia", nombre: "Arabia", hito: null, origen: true, cajas: [[21, 29, 37, 50], [21, 28, 50, 57], [21, 24, 57, 60], [15, 21, 41, 60], [12, 15, 43, 60]] },
      { id: "asia_occ", nombre: "Asia occidental", hito: null, cajas: [[36, 42, 26, 50], [29, 36, 34.5, 63], [24, 29, 50, 63], [12, 24, 60, 63]] },
      { id: "africa", nombre: "África", hito: null, origen: true, cajas: [[-36, 35, -20, 52], [35, 38, -2, 11.5]] },
      { id: "europa", nombre: "Europa", hito: "europa", cajas: [[35, 52, -25, 50], [52, 72, -25, 60]] },
      { id: "sahul", nombre: "Australia y Nueva Guinea", hito: "sahul", cajas: [[-45, -10, 112, 155], [-11, -1, 130, 152]] },
      { id: "nueva_zelanda", nombre: "Nueva Zelanda", hito: "nueva_zelanda", cajas: [[-48, -34, 165, 179]] },
      { id: "asia", nombre: "Asia", hito: "asia", cajas: [[-11, 80, 60, 180], [36, 52, 50, 60], [55, 80, -180, -168]] },
      { id: "norteamerica", nombre: "Norteamérica", hito: "norteamerica", cajas: [[13, 84, -168, -50], [7, 13, -92, -77]] },
      { id: "sudamerica", nombre: "Sudamérica", hito: "sudamerica", cajas: [[-56, 13, -82, -34]] },
      { id: "polinesia", nombre: "Polinesia", hito: "polinesia", cajas: [[-30, 25, -180, -105]] }
    ],

    // Estrechos que la cuadrícula de 2° deja como celdas vecinas aunque el mar nunca se secó del todo: Gibraltar
    // (14 km), Bab el-Mandeb, entre África y Arabia (unos 4 km en el Último Máximo Glacial; Lambeck et al. 2011,
    // Quaternary Science Reviews 30) y Bering (82 km; cuando baja el mar, el paso es el puente de Beringia, que tiene sus propias
    // celdas). Entre celdas de tierra firme de estas regiones no se camina: solo se cruza por mar.
    barreras: [
      { entre: ["africa", "europa"] },
      { entre: ["asia", "norteamerica"] },
      { entre: ["africa", "arabia"], latMax: 26 }
    ],

    // Humanos arcaicos que ya vivían en Eurasia cuando llegó nuestra especie (cambio del 2026-10-15).
    // Cajas aproximadas trazadas a mano sobre el mapa de 2°: ocupan su territorio desde el inicio de la partida.
    // No ocupan las regiones de origen (África y Arabia): el motor las salta.
    arcaicos: [
      { id: "neandertales", nombre: "Neandertales", hito: "neandertales", cajas: [[36, 56, -10, 60], [29, 42, 34.5, 62], [36, 54, 60, 90]],
        fuente: "Krause et al. (2007), Nature 449 (Altái); sitios del Levante (Tabun, Kebara) y del Zagros (Shanidar)" },
      { id: "denisovanos", nombre: "Denisovanos", hito: null, cajas: [[22, 55, 90, 145]],
        fuente: "Reich et al. (2010), Nature 468 (cueva de Denisova); Chen et al. (2019), Nature 569 (Xiahe, Tíbet)" }
    ],

    // Origen panafricano: varios grupos en distintos puntos de África
    origenes: [
      { nombre: "Jebel Irhoud (Marruecos)", lat: 31.9, lon: -8.9, personas: 2000 },   // Hublin et al. (2017), Nature 546
      { nombre: "Omo Kibish (Etiopía)", lat: 5.4, lon: 35.9, personas: 2000 },        // Vidal et al. (2022), Nature 601
      { nombre: "Florisbad (Sudáfrica)", lat: -28.8, lon: 26.1, personas: 2000 }      // Grün et al. (1996), Nature 382
    ],

    // Hitos, en orden cronológico real. `real` = [año más antiguo, año más reciente] de la evidencia.
    hitos: [
      { id: "salida_africa", titulo: "Tu humanidad salió de África", corto: "Salida de África", real: hace(70000, 50000),
        texto: "La gran dispersión de la que desciende casi toda la humanidad no africana ocurrió hace unos 70.000–50.000 años. Hubo salidas anteriores, como la de Misliya (Israel) hace unos 180.000 años, que dejaron poca o ninguna huella en la población actual.",
        fuente: "Bergström et al. (2021), Nature 590; Hershkovitz et al. (2018), Science 359" },
      { id: "asia", titulo: "Tu humanidad llegó al sur y este de Asia", corto: "Sur y este de Asia", real: hace(73000, 45000),
        texto: "Los dientes de Lida Ajer (Sumatra) indican Homo sapiens en el sudeste asiático hace unos 73.000–63.000 años; la mayoría de los sitios de la región tienen menos de 50.000.",
        fuente: "Westaway et al. (2017), Nature 548" },
      { id: "sahul", titulo: "Tu humanidad llegó a Australia y Nueva Guinea", corto: "Australia y Nueva Guinea", real: hace(65000, 50000),
        texto: "Nunca hubo un puente de tierra completo desde Asia: hubo que cruzar el mar. Madjedbebe, en el norte de Australia, se ha fechado en unos 65.000 años, aunque otros investigadores proponen unos 50.000.",
        fuente: "Clarkson et al. (2017), Nature 547; O'Connell et al. (2018), PNAS 115" },
      { id: "europa", titulo: "Tu humanidad llegó a Europa", corto: "Llegada a Europa", real: hace(54000, 45000),
        texto: "Grotte Mandrin (Francia) muestra Homo sapiens hace unos 54.000 años y Bacho Kiro (Bulgaria), hace unos 45.000. Allí convivieron miles de años con los neandertales.",
        fuente: "Slimak et al. (2022), Science Advances 8; Hublin et al. (2020), Nature 581" },
      { id: "neandertales", titulo: "Desaparecieron los neandertales", corto: "Desaparición de los neandertales", real: hace(41000, 39000),
        texto: "Los últimos neandertales desaparecieron de Europa hace unos 41.000–39.000 años, después de miles de años de convivencia con nuestra especie. Casi toda la humanidad no africana conserva entre un 1 y un 2 % de ADN neandertal.",
        fuente: "Higham et al. (2014), Nature 512" },
      { id: "norteamerica", titulo: "Tu humanidad llegó a Norteamérica", corto: "Llegada a Norteamérica", real: hace(23000, 15000),
        texto: "Las huellas humanas de White Sands (Nuevo México) tienen unos 23.000–21.000 años; muchos sitios de Norteamérica tienen entre 16.000 y 14.000.",
        fuente: "Bennett et al. (2021), Science 373" },
      { id: "sudamerica", titulo: "Tu humanidad llegó a Sudamérica", corto: "Llegada a Sudamérica", real: hace(18500, 14500),
        texto: "Monte Verde, en el sur de Chile, estaba habitado hace unos 14.500 años, y quizá desde antes.",
        fuente: "Dillehay et al. (2015), PLoS ONE 10: e0141923" },
      { id: "agricultura_creciente_fertil", titulo: "Nació la agricultura en el Creciente Fértil", corto: "Agricultura: Creciente Fértil", real: [-9500, -8000],
        texto: "Entre Israel e Irán se domesticaron el trigo, la cebada, las lentejas, las cabras y las ovejas.",
        fuente: "Larson et al. (2014), PNAS 111" },
      { id: "agricultura_china", titulo: "Nació la agricultura en China", corto: "Agricultura: China", real: [-8000, -6000],
        texto: "En los valles de los ríos Amarillo y Yangtsé se domesticaron el mijo y el arroz.",
        fuente: "Larson et al. (2014), PNAS 111" },
      { id: "agricultura_mesoamerica", titulo: "Nació la agricultura en Mesoamérica", corto: "Agricultura: Mesoamérica", real: [-8000, -7000],
        texto: "En el sur de México se domesticaron la calabaza y el maíz.",
        fuente: "Piperno et al. (2009), PNAS 106" },
      { id: "agricultura_nueva_guinea", titulo: "Nació la agricultura en Nueva Guinea", corto: "Agricultura: Nueva Guinea", real: [-8000, -5000],
        texto: "En las tierras altas de Nueva Guinea, en el sitio de Kuk, se cultivaron el taro y el plátano.",
        fuente: "Denham et al. (2003), Science 301" },
      { id: "agricultura_andes", titulo: "Nació la agricultura en los Andes", corto: "Agricultura: Andes", real: [-8000, -5000],
        texto: "En los Andes y la costa del Perú se domesticaron calabazas, la papa y la quinua; más tarde, la llama y la alpaca.",
        fuente: "Larson et al. (2014), PNAS 111" },
      { id: "primera_ciudad", titulo: "Nació la primera ciudad", corto: "Primera ciudad", real: [-4000, -3500],
        texto: "Uruk, en Mesopotamia, llegó a tener decenas de miles de habitantes: suele considerarse la primera ciudad.",
        fuente: "Algaze (2008), Ancient Mesopotamia at the Dawn of Civilization" },
      { id: "escritura", titulo: "Nació la escritura", corto: "Escritura", real: [-3300, -3200],
        texto: "Las tablillas protocuneiformes de Uruk son la escritura más antigua conocida; en Egipto apareció casi al mismo tiempo.",
        fuente: "Woods, ed. (2010), Visible Language, Oriental Institute de Chicago" },
      { id: "agricultura_sahel", titulo: "Nació la agricultura en el Sahel y Etiopía", corto: "Agricultura: Sahel y Etiopía", real: [-3000, -2000],
        texto: "Al sur del Sahara se domesticaron el sorgo y el mijo perla.",
        fuente: "Manning et al. (2011), Journal of Archaeological Science 38; Larson et al. (2014), PNAS 111" },
      { id: "agricultura_este_norteamerica", titulo: "Nació la agricultura en el este de Norteamérica", corto: "Agricultura: este de Norteamérica", real: [-3000, -1800],
        texto: "En el este de Norteamérica se domesticaron el girasol, una calabaza y otras plantas de semilla.",
        fuente: "Smith (2006), PNAS 103" },
      { id: "polinesia", titulo: "Tu humanidad llegó a la Polinesia", corto: "Llegada a la Polinesia", real: [-900, -800],
        texto: "La cultura Lapita llegó a Tonga y Samoa hacia 900–800 a. C. La Polinesia oriental (Tahití, Hawái, Rapa Nui) se pobló mucho después, hacia 1000–1200 d. C.",
        fuente: "Burley et al. (2012), PLoS ONE 7: e48769; Wilmshurst et al. (2011), PNAS 108" },
      { id: "nueva_zelanda", titulo: "Tu humanidad llegó a Nueva Zelanda", corto: "Llegada a Nueva Zelanda", real: [1250, 1300],
        texto: "Fue la última gran tierra habitada: los antepasados de los maoríes llegaron desde la Polinesia oriental hacia 1250–1300 d. C.",
        fuente: "Wilmshurst et al. (2011), PNAS 108; Bunbury, Petchey y Bickler (2022), PNAS 119: e2207609119" },
      { id: "industria", titulo: "Empezó la Revolución Industrial", corto: "Revolución Industrial", real: [1760, 1830],
        texto: "Empezó en Gran Bretaña hacia 1760, con la máquina de vapor y las fábricas textiles, y desde allí se extendió por el mundo.",
        fuente: "Allen (2009), The British Industrial Revolution in Global Perspective" },
      { id: "mil_millones", titulo: "Tu humanidad llegó a 1.000 millones de personas", corto: "1.000 millones de personas", real: [1804, 1804],
        texto: "La humanidad tardó unos 300.000 años en llegar a sus primeros 1.000 millones de personas, hacia 1804.",
        fuente: "Naciones Unidas, División de Población" },
      { id: "ocho_mil_millones", titulo: "Tu humanidad llegó a 8.000 millones de personas", corto: "8.000 millones de personas", real: [2022, 2022],
        texto: "Naciones Unidas fijó el 15 de noviembre de 2022 como el día en que la humanidad llegó a 8.000 millones.",
        fuente: "Naciones Unidas (2022), World Population Prospects" },
      { id: "extincion", titulo: "Tu humanidad se extinguió", corto: "Extinción", real: null,
        texto: "En la realidad no pasó: aunque hubo momentos difíciles, la humanidad siguió creciendo.", fuente: "" }
    ],

    // Población real estimada [año, mínimo, máximo]. Desde 10.000 a. C.: rango de las estimaciones de HYDE 3.2
    // (Klein Goldewijk et al. 2017), McEvedy y Jones (1978) y Naciones Unidas. Antes no hay censos: son rangos
    // amplios a partir de estudios genéticos y arqueológicos.
    poblacionReal: [
      [-298000, 2e4, 2e5], [-100000, 5e4, 5e5], [-50000, 1e5, 1e6], [-20000, 5e5, 2e6],
      [-10000, 1e6, 1e7], [-5000, 5e6, 2e7], [-3000, 1.4e7, 4.5e7], [-1000, 5e7, 1.15e8],
      [1, 1.7e8, 3e8], [1000, 2.54e8, 3.45e8], [1500, 4.25e8, 5.4e8], [1700, 6e8, 6.79e8],
      [1800, 8.13e8, 1.125e9], [1900, 1.55e9, 1.762e9], [1950, 2.5e9, 2.6e9], [2000, 6.1e9, 6.2e9], [2026, 8.2e9, 8.3e9]
    ],

    // Continentes del muelle de la escala "La Tierra". `stats` lo reemplaza el panel con datos de la partida.
    continentes: [
      { id: "c-africa", nombre: "África", tipo: "Continente", lat: 3, lon: 20, color: "#f3c56b", regiones: ["africa"], hitos: [], stats: [],
        lede: "Aquí nace la humanidad: los fósiles más antiguos de Homo sapiens son africanos.",
        facts: ["Los fósiles de Jebel Irhoud (Marruecos) tienen unos 300.000 años: son los Homo sapiens más antiguos conocidos.",
          "Durante la mayor parte de nuestra historia, casi toda la humanidad vivió en África."] },
      { id: "c-europa", nombre: "Europa", tipo: "Continente", lat: 50, lon: 15, color: "#8fb8ff", regiones: ["europa"], hitos: ["europa"], stats: [],
        lede: "Llegaron desde Asia occidental y encontraron a los neandertales, que vivían allí desde hacía cientos de miles de años.",
        facts: ["Los Homo sapiens más antiguos de Europa ampliamente aceptados tienen entre 54.000 y 45.000 años.",
          "Allí convivieron miles de años con los neandertales."] },
      { id: "c-asia", nombre: "Asia", tipo: "Continente", lat: 40, lon: 95, color: "#ff9f6b", regiones: ["arabia", "asia_occ", "asia"], hitos: ["salida_africa", "asia"], stats: [],
        lede: "El continente más grande fue el primer paso fuera de África y la ruta hacia Oceanía y América.",
        facts: ["La salida principal de África ocurrió hace unos 70.000–50.000 años, aunque hubo salidas anteriores.",
          "En China surgió la agricultura del mijo y del arroz hace unos 10.000–8.000 años."] },
      { id: "c-oceania", nombre: "Oceanía", tipo: "Continente", lat: -22, lon: 140, color: "#7fd8a4", regiones: ["sahul", "nueva_zelanda", "polinesia"], hitos: ["sahul", "polinesia", "nueva_zelanda"], stats: [],
        lede: "Australia, Nueva Guinea y miles de islas que solo se alcanzaron navegando.",
        facts: ["Para llegar a Australia hubo que cruzar el mar: ni en las glaciaciones existió un puente de tierra completo desde Asia.",
          "Nueva Zelanda fue la última gran tierra habitada, hacia 1250–1300 d. C."] },
      { id: "c-america", nombre: "América", tipo: "Continente", lat: 10, lon: -80, color: "#d79bff", regiones: ["norteamerica", "sudamerica"], hitos: ["norteamerica", "sudamerica"], stats: [],
        lede: "El último continente poblado, al que se llegó desde Siberia por Beringia.",
        facts: ["En la glaciación, Beringia unía Siberia con Alaska.",
          "Las huellas de White Sands (Nuevo México) tienen entre 23.000 y 21.000 años."] }
    ]
  };
})();
if (typeof module !== "undefined") module.exports = HISTORIA;
