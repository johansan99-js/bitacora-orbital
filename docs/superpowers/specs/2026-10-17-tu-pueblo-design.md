# La Tierra habitada, fase 3: Tu pueblo

**Fecha:** 2026-10-17 · **Estado:** borrador para revisión · **Sub-proyecto:** 3 de 4 (ver la [hoja de ruta de la fase 1](2026-10-14-poblacion-historia-design.md#hoja-de-ruta))

## Cómo se decidió este documento

El usuario pidió seguir con la fase 3 sin más preguntas. Lo que viene de él: la idea original ("interactivo estilo juego, que se pueda decidir qué pasaría"), el propósito de todo el proyecto (**aprender comparando** con la historia real) y la descripción de la fase 3 en la hoja de ruta aprobada: guiar un linaje concreto, decisiones en momentos clave con la partida en pausa, rasgos ganados por presión selectiva y encuentros con otros pueblos y especies humanas, con mestizaje. Todo lo demás es **decisión mía**, marcada con *(mi decisión)* donde no es obvio, para que el usuario lo revise.

## Objetivo

Un segundo modo de juego en la escala "La Tierra": eliges un grupo de recolectores en África hace 300.000 años y lo **guías**. El resto de la humanidad sigue igual que en el modo Historia. En momentos clave la partida se pausa y decides; cada decisión muestra después **qué hicieron de verdad** los pueblos reales, con su fuente. Tu pueblo puede crecer, mezclarse con neandertales y denisovanos, ganar rasgos, llegar a otros continentes o extinguirse.

La gracia educativa: ver que las decisiones tienen consecuencias que se acumulan durante milenios, que casi todos los linajes antiguos se extinguieron o se mezclaron, y que todos los humanos de hoy descienden de muchos grupos a la vez.

## Metas, no-metas y anti-metas

**Metas**
- Elegir dónde nace tu pueblo y guiarlo con unas **8 a 14 decisiones por partida** (mediana), cada una con 2 o 3 opciones.
- Cada decisión cambia de verdad lo que pasa (crecimiento, migración, cruces, mezcla, adopción de innovaciones) y lo muestra en el globo.
- **Rasgos** que se ganan por presión selectiva o por mestizaje, con efectos concretos y una explicación real.
- **Comparar**: después de cada decisión, una tarjeta "Qué pasó en la realidad"; al final, la Bitácora de tu pueblo junto a la historia real.
- Se puede perder: si tu pueblo se extingue, la partida lo dice y explica que eso les pasó a muchos linajes reales; puedes seguir mirando el resto de la humanidad.

**No-metas (quedan para otras fases)**
- Poderes, Energía Orbital y cambiar las condiciones del mundo (fase 2).
- Religión, mitos, comercio, crisis de era, dioses rivales (fase 4).
- Guardar la partida, multijugador, logros.
- Controlar celda por celda o mover gente con el ratón: se guía con decisiones, no se microgestiona *(mi decisión)*.

**Anti-metas (si pasa esto, fracasó aunque funcione)**
- El modo Historia cambia: sus resultados deben ser **idénticos bit a bit** con la misma semilla, y `calibrar.mjs` debe dar exactamente lo mismo.
- Decisiones de adorno, cuyo efecto no se nota en la partida.
- Inventar historia: cada "qué pasó en la realidad" y cada rasgo lleva una fuente real; lo especulativo se dice como tal.
- Un juego que se gana siempre eligiendo la opción "obvia": cada opción tiene costo y beneficio.
- Interrumpir demasiado: una partida no debe pasar de unos 10 minutos con las pausas.

## Tu pueblo dentro del motor

El motor sigue calculando personas por celda. Encima se agregan dos cantidades por celda *(mi decisión, después de la revisión del constructor)*:

- **`tuyos[i]`**: cuántas personas de la celda `i` **pertenecen a tu pueblo** como grupo (comparten su forma de vida y sus decisiones). Siempre `0 ≤ tuyos[i] ≤ pob[i]`.
- **`linaje[i]`**: qué fracción de la ascendencia de la celda viene de tu pueblo (entre 0 y 1). Es la herencia genética: se mezcla con cualquiera.

Tu pueblo empieza como uno de los grupos de origen (el que elijas, con su gente inicial); los otros orígenes siguen existiendo como en el modo Historia.

Reglas de **tu pueblo** (`tuyos`):
- **Se mueve como grupo.** De la gente que sale de una celda, la parte que son tuyos (en proporción) solo va a vecinas **vacías o donde tu pueblo ya es mayoría**; el resto de los emigrantes va como siempre. El total que sale de cada celda es el mismo que en el modo Historia. Así tu pueblo se expande como una mancha con fronteras, en vez de diluirse por todo el continente.
- **Se asimila donde es minoría.** En una celda donde los tuyos son menos de una fracción (parámetro, del orden del 20 %), se integran a los demás: `tuyos[i]` pasa a 0 (su herencia sigue en `linaje`). Lo mismo con grupos de menos de `minimo` personas.
- **Aptitud.** Tus decisiones y rasgos dan a tu pueblo multiplicadores de crecimiento y migración en las celdas donde aplican (por ejemplo, "Adaptados al frío" en celdas frías). Al crecer, la celda reparte su crecimiento entre los tuyos y los demás según la aptitud de cada parte.
- **Efectos que cambian el mundo.** Las opciones pueden cambiar la capacidad y la población de las celdas donde tu pueblo es mayoría, la forma de vida que adoptan (abajo), el ritmo con que desplazan a los arcaicos vecinos y los movimientos propios ("Cruzar el estrecho" mueve solo a los tuyos, con las mismas capacidades). Por eso, en una partida de "Tu pueblo" el resto del mundo diverge del modo Historia con la misma semilla; es esperable y no se calibra *(mi decisión)*.
- **Rechazar una innovación.** "Seguir recolectando", "Quedarse en aldeas" y "Esperar" (industria) impiden que las celdas donde tu pueblo es mayoría adopten esa innovación, ni por invención ni por contagio, durante un plazo (parámetro por innovación, del orden de 2.000 años para la agricultura y 200 para la industria). Al terminar el plazo se vuelve a ofrecer la decisión una vez; la segunda negativa dura hasta el final *(mi decisión)*. Mientras tanto tu pueblo conserva las ventajas de su forma de vida (por ejemplo, menos enfermedades).

Reglas de **tu herencia** (`linaje`):
- Viaja y se mezcla en proporción con toda la gente que migra o cruza el mar, sin restricciones. Una celda nueva toma la mezcla de los que llegan.
- **Tu herencia** (la cifra de la tarjeta) es la suma de `linaje[i] × pob[i]`, o sea cuántas personas "equivalentes" descienden de tu pueblo. El final muestra además cuánta gente vive en celdas con algo de tu linaje (más de 0,1 %).

Fin de tu pueblo:
- **Disolución.** Si `tuyos` queda en 0 en todas las celdas pero tu herencia vive, se avisa una sola vez: tu pueblo se disolvió entre otros, y su herencia sigue. Desde ahí no hay más decisiones; la partida sigue como en el modo Historia mostrando dónde está tu linaje.
- **Extinción.** Si tu herencia baja de `minimo` personas, tu linaje se extinguió (como el de los primeros que salieron hacia Levante hace ~120.000 años). La partida lo dice y se puede seguir mirando o empezar otra.
- Ambos cuentan como "perder tu pueblo" para la prueba de juego.

- **Sin pueblo, igual que antes.** Si no hay pueblo elegido (modo Historia), nada de esto se calcula ni consume azar: el motor da exactamente lo mismo que hoy.

**Azar.** Todo el azar nuevo sale de un generador **separado** con su propia semilla (derivada de la de la partida), para que el modo Historia no cambie y para que el mismo pueblo, con las mismas decisiones en los mismos años, repita la misma partida.

## Momentos de decisión

Una decisión se dispara cuando **le pasa algo a tu pueblo**, nunca por fecha. Cada tipo se ofrece como mucho las veces indicadas, con al menos un intervalo mínimo entre decisiones (parámetro; para que no se amontonen). Mientras decides, la partida está en pausa.

| Momento | Se dispara cuando… | Opciones (efecto) | Qué pasó en la realidad (fuente a confirmar en el plan) |
|---|---|---|---|
| **Nacimiento** (siempre, al empezar) | — | Este de África · Sur · Norte (Marruecos) — eliges la celda de inicio | No hubo una sola cuna: fósiles de Jebel Irhoud (~300.000 años), Omo Kibish (~233.000) y el sur de África sugieren un origen repartido por todo el continente (Hublin et al. 2017; Scerri et al. 2018) |
| **Sequía** (×2) | La capacidad de las celdas de tu pueblo baja más de un umbral por el clima | Resistir (crece menos, puede dar el rasgo "Resistentes a la sed") · Ir a la costa (más pesca, menos tierra) · Dispersarse (migra más) | Refugio costero de Pinnacle Point en una época fría y seca (Marean et al. 2007) |
| **Frontera** (×3) | Tu pueblo toca un desierto cerrado o una costa con un estrecho | Cruzar ahora (más migración o cruce, riesgo de pérdidas) · Esperar | Salida de África por el Sinaí o por Bab el-Mandeb; un grupo que salió hace ~120.000 años (Skhul y Qafzeh) no dejó descendientes conocidos |
| **Encuentro** (×2) | Una celda de tu pueblo es vecina de territorio neandertal o denisovano | Evitarlos · Convivir y mezclarse (rasgo de herencia) · Competir (desplazas más rápido, pierdes gente) | Fuera de África la gente tiene ~2 % de ADN neandertal (Green et al. 2010; Prüfer et al. 2014); el gen EPAS1 de altura en el Tíbet vino de los denisovanos (Huerta-Sánchez et al. 2014) |
| **Frío** (×1) | Tu pueblo vive en celdas frías durante una glaciación | Coser ropa y seguir al norte (rasgo "Adaptados al frío") · Volver al sur | Agujas de hueso y ropa cosida en el Paleolítico superior |
| **Cuello de botella** (×2) | Tu pueblo cae a menos de una fracción de su máximo | No hay elección: ganas un rasgo según la causa (sed, frío, enfermedad); el aviso explica qué es un cuello de botella | Cuellos de botella documentados en la genética humana |
| **Agricultura** (×1) | Tu pueblo es vecino de agricultores o puede empezar a cultivar | Adoptarla (más gente, más enfermedades) · Seguir recolectando | Los primeros agricultores eran más numerosos pero más bajos y enfermos (Larsen 2006) |
| **Ganado y leche** (×1) | Tu pueblo es agrícola en una región con ganado | Tomar leche (rasgo "Tolerancia a la lactosa") · No | La persistencia de la lactasa se extendió con el pastoreo (Itan et al. 2009) |
| **Ciudades** (×1) | Tu pueblo tiene celdas que pueden tener ciudades | Fundar ciudades (más saber, epidemias) · Quedarse en aldeas | |
| **Mar abierto** (×1) | Tu pueblo tiene navegación costera y costa frente a islas lejanas | Explorar (cruces más probables) · Quedarse | Expansión austronesia por el Pacífico |
| **Industria** (×1) | La industria llega a tu pueblo o a una vecina | Adoptarla rápido · Esperar | |

La tabla es el catálogo inicial *(mi decisión)*.

**Encuentros con arcaicos** *(mi decisión; el motor solo guarda qué parte de cada celda ocupan, no cuántos son)*:
- **Evitarlos:** tus emigrantes no entran a celdas ocupadas por arcaicos mientras dure el efecto; los desplazas más lento.
- **Convivir y mezclarse:** ganas el rasgo de herencia; los desplazas más lento (conviven) y la capacidad de tus celdas vecinas a ellos sube un poco.
- **Competir:** los desplazas más rápido en las celdas vecinas a tu pueblo, y tu pueblo pierde una parte de su gente en esas celdas.

**Enfermedades** *(mi decisión)*: el motor no tiene epidemias y no se agregan al mundo. Se modelan solo para tu pueblo, como menos aptitud (y algunas pérdidas en las celdas con ciudades) en sus celdas agrícolas y urbanas. El rasgo "Defensas contra epidemias" reduce eso.

**Causa de un cuello de botella** *(mi decisión)*: se atribuye por dónde perdió más gente tu pueblo durante la caída: en celdas de desierto o estepa → sed; en celdas frías o con hielo avanzando → frío; en celdas agrícolas o con ciudades → enfermedad; si no es claro, no se gana rasgo. En el plan, cada fila se convierte en datos (en `datos.js` o un archivo nuevo) con: condición, opciones, efectos numéricos, texto y fuente. Las fuentes se verifican al escribir el plan; si alguna no se confirma, el texto se corrige o la fila se quita.

### Rasgos

Un rasgo es un modificador permanente de tu pueblo que se hereda (viaja con `tuyos`) *(mi decisión: simplificado; no se modela la genética)*. Rasgos iniciales:

| Rasgo | Se gana por… | Efecto |
|---|---|---|
| Resistentes a la sed | Sequía (resistir) o cuello de botella por sed | Mejor aptitud en desiertos y estepas |
| Adaptados al frío | Frío (seguir al norte) o cuello de botella por frío | Mejor aptitud en tundra y taiga |
| Herencia neandertal | Encuentro (mezclarse) con neandertales | Mejor aptitud en celdas frías y templadas de Eurasia |
| Herencia denisovana | Encuentro (mezclarse) con denisovanos | Mejor aptitud en altura (Tíbet y Andes) |
| Tolerancia a la lactosa | Ganado y leche (tomar leche) | Más capacidad en celdas agrícolas con ganado |
| Defensas contra epidemias | Cuello de botella por enfermedad | Menos pérdidas por las epidemias de las ciudades |

Los efectos numéricos se fijan en el plan y se ajustan en la prueba de juego (abajo).

## Interfaz

- **Elegir modo:** al entrar a "La Tierra" o al empezar una partida nueva, una tarjeta ofrece **Historia** (como ahora) o **Tu pueblo**. En "Tu pueblo", la primera decisión (Nacimiento) es la elección del lugar.
- **Tarjeta de decisión:** como el aviso de hito, con la situación, el año, 2 o 3 botones de opción con su costo y beneficio en una línea, y el foco en la primera opción. No se cierra sin elegir. Después de elegir, la misma tarjeta muestra "Qué pasó en la realidad" y su fuente, con un botón **Seguir**.
- **Tu pueblo en el globo:** las bandas y luces de tus celdas se dibujan con otro color (el resto como ahora), y la cámara puede volar a tu pueblo con un botón.
- **Tarjeta comparativa:** suma "Tu pueblo", "Tu herencia" y los rasgos ganados.
- **Bitácora de tu pueblo:** cada decisión con lo que elegiste, lo que pasó después en tu partida y lo que pasó en la realidad; los hitos de la humanidad como en el modo Historia.
- **Final:** en 2026 o al extinguirse, un resumen: cuánto vivió tu pueblo, adónde llegó, qué rasgos tuvo, cuánta gente de hoy desciende de él.

Accesibilidad: lo mismo que la fase 1 (foco que no se pierde, nada que tape un modal abierto, todo usable con teclado).

## Pruebas

En el motor (Node, como hoy):
- **Modo Historia intacto:** con la misma semilla y sin pueblo, el estado tras N pasos es idéntico al de antes del cambio (comparando con una huella guardada); `calibrar.mjs` da la misma tabla.
- `0 ≤ tuyos[i] ≤ pob[i]` y `0 ≤ linaje[i] ≤ 1` en todas las celdas y pasos; la migración conserva a los tuyos (salvo asimilación) y la herencia.
- Tu pueblo solo emigra a celdas vacías o donde es mayoría; se asimila donde es minoría.
- Una innovación rechazada no aparece en las celdas de tu pueblo durante su plazo.
- Misma semilla + mismas decisiones en los mismos años ⇒ misma partida.
- Cada momento de decisión se dispara en su condición y nunca más veces que su límite; respeta el intervalo mínimo.
- Extinción y disolución se detectan una sola vez.
- Cada rasgo cambia la aptitud solo donde corresponde.

**Prueba de juego** (`pruebas/jugar.mjs`, nueva): 30 partidas con jugadores automáticos (siempre la primera opción, siempre la segunda, al azar). Criterios:
- Mediana de decisiones por partida entre 8 y 14.
- Tu pueblo llega a 2026 sin disolverse ni extinguirse en entre el 30 % y el 85 % de las partidas con el jugador al azar (se puede perder y se puede ganar).
- Las políticas dan resultados distintos (por ejemplo, la herencia final cambia de mediana entre ellas), o sea que las decisiones importan.
- Tiempo por partida dentro del mismo presupuesto que el modo Historia, más un 15 %.

En el navegador: elegir modo, decidir con teclado y ratón, ver tu pueblo de otro color, extinción, final y Bitácora.

## Lo que queda para quien construya

- Cómo se guardan los rasgos y la aptitud (por celda o por pueblo) y cómo se reparte la población al crecer, siempre que se cumplan las reglas de arriba.
- El formato de los datos de decisiones y rasgos.
- Los números de cada efecto, ajustados con `jugar.mjs`.
- El color y el estilo de tu pueblo en el globo, dentro del estilo actual.
