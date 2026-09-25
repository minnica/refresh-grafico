# Lecciones verificadas de refresh-grafico

Memoria procedural persistente de la skill. Las reglas para leer y mantener
este archivo están en `../SKILL.md`.

## RG-20260808-01

- Alcance: `global`
- Síntoma: El brief omite contenido legítimo que `check.js` reporta después como texto perdido, aunque el HTML sí lo contiene antes del footer.
- Causa: `extract.js` segmenta por atributos `bgcolor`; si el footer declara su fondo sólo en CSS, puede quedar unido al bloque de contenido anterior y `isBoilerplate` descarta el segmento completo al encontrar un texto ignorado del footer.
- Solución: Cuando `check.js` señale texto perdido que no figura en el brief, inspeccionar únicamente el fragmento del HTML alrededor de ese texto, separar el contenido real del footer y trasladarlo literalmente al bloque DSL correspondiente.
- Verificación: Las piezas corregidas pasaron la regla de texto de `check.js --only`; la recurrencia se confirmó en siete emails adicionales de retención de masters, incluidos tres casos donde el brief conservó el merge tag en su tabla pero omitió el callout de fecha situado antes del footer y otro donde descartó una nota legítima. Los lotes verificados pasaron builds de Eleventy de 98, 104, 107, 110 y 113 archivos. Una corrección manual descartó otro bloque detectado porque pertenecía al área de contacto del footer, por lo que ese caso no cuenta como confirmación. En otra confirmación, los avisos de texto perdido desaparecieron aunque la pieza siguió bloqueada por una migración de assets independiente. Seis piezas adicionales de retención de masters requirieron recuperar avisos, notas o bloques de fecha y acción omitidos junto al footer; todas pasaron `check.js --only` y el build de Eleventy de 120 archivos. En un lote de ventas de masters se recuperaron cuatro bloques legítimos omitidos —acciones, notas y cierres comerciales—; las 49 piezas pasaron `check.js --only` y el build de Eleventy de 195 archivos.
- No aplicar cuando: El texto reportado pertenece realmente al header o footer; en ese caso debe omitirse y registrarse como candidato para `textCheck.ignore`.
- Confirmaciones: 18

## RG-20260808-02

- Alcance: `global`
- Síntoma: Al colocar varios párrafos dentro de un mismo item `text` y una sola lista de clases al final, el HTML compilado deja los primeros párrafos sin las clases esperadas.
- Causa: `markdown-it-attrs` aplica la lista de atributos únicamente al bloque Markdown adyacente, no a todos los párrafos anteriores contenidos en el mismo item DSL.
- Solución: Cuando varios párrafos deban compartir estilos, convertir cada párrafo en un item `text` independiente, aplicar sus clases explícitamente y conservar el ritmo con un spacer interno.
- Verificación: Dos correcciones manuales separaron párrafos que requerían ritmo propio; pasaron `check.js --only` y los builds de Eleventy mostraron elementos independientes con sus clases esperadas.
- No aplicar cuando: Los párrafos deban formar deliberadamente un único bloque o cada párrafo requiera un tratamiento visual distinto definido por la pieza.
- Confirmaciones: 2

## RG-20260808-03

- Alcance: `universidad:ulatina`
- Síntoma: Una pieza de `masters` queda maquetada con botones, listas o viñetas de la familia cromática de otra línea académica, usa puntos genéricos cuando cada elemento tiene un concepto visual distinto, o muestra números como texto cuando existe el preset numerado.
- Causa: Se aplicaron controles genéricos sin seleccionar las variantes de grado ni distinguir listas homogéneas de listas con iconografía semántica disponible en el UI-kit.
- Solución: En piezas ubicadas bajo `src/masters/`, usar la familia wine cuando corresponda: `buttonWine`; `listBullWine` con `icon_point_wine.png` para listas homogéneas; `listIcons` con iconos wine cuyo significado coincida claramente con cada elemento para listas heterogéneas; y `listBullNumberWine` con los iconos numerados wine para secuencias de pasos.
- Verificación: Los presets existen en `ulatina_general_config.njk`; las correcciones manuales abarcan un CTA, una lista numerada y tres listas semánticas en piezas distintas, todas aprobadas por `check.js --only` y por builds de Eleventy de 89 y 98 archivos. Tres piezas adicionales de ventas sustituyeron viñetas genéricas por cinco iconos wine con significado específico dentro de `listIcons`; pasaron `check.js --only` y el build de Eleventy de 194 archivos.
- No aplicar cuando: La pieza pertenece a otro grado, una referencia válida define otro tratamiento o el usuario proporciona colores o instrucciones explícitas distintas.
- Confirmaciones: 9

## RG-20260808-04

- Alcance: `universidad:ulatina`
- Síntoma: Las aperturas de emails de `masters` quedan sobredimensionadas, centradas o con un color de acento que no corresponde a la jerarquía visual de la línea.
- Causa: Se interpretó el texto inicial como hero promocional en lugar de seguir la jerarquía editorial usada en las referencias de `masters`.
- Solución: Como base para aperturas de `src/masters/`, usar saludo o titular principal en `.fs-22 .ulatina-base-color .d-left`, subtítulo en `.fs-18 .ulatina-base-color .d-left` y cuerpo en `.fs-16 .ulatina-base-color .d-left`; separar saludo y cuerpo cuando requieran jerarquías distintas.
- Verificación: Correcciones manuales en dos piezas de retención ajustaron esta jerarquía; ambas pasaron `check.js --only`, el build de 89 archivos y coinciden con referencias existentes de `masters`.
- No aplicar cuando: El HTML, una referencia de mayor precedencia o una instrucción explícita define deliberadamente un hero centrado u otra escala.
- Confirmaciones: 2

## RG-20260808-05

- Alcance: `universidad:ulatina`
- Síntoma: `img_banner_study.jpg` queda omitida como asset pendiente durante la conversión.
- Causa: El extractor sólo encontraba la versión alojada en el proveedor antiguo y no tenía una coincidencia canónica verificada.
- Solución: Usar `https://ap-university-storage.s3.us-east-1.amazonaws.com/ulatina/img_banner_study.jpg` para ese nombre de asset.
- Verificación: La URL fue incorporada mediante corrección manual, pasó `check.js --only` y compiló correctamente en el build de Eleventy de 89 archivos.
- No aplicar cuando: El archivo de origen tenga otro nombre o una referencia/instrucción explícita indique otra imagen.
- Confirmaciones: 1

## RG-20260808-06

- Alcance: `universidad:ulatina`
- Síntoma: Una llamada positiva, una fecha prioritaria o un aviso operativo de `masters` se presenta con fondo wine y texto blanco; o, en el extremo opuesto, un cierre genérico de apoyo recibe fondo verde sin requerir énfasis.
- Causa: Se trasladó el color oscuro del HTML antiguo o se generalizó el verde a cualquier cierre, sin distinguir el propósito del bloque.
- Solución: En `src/masters/`, usar fondo `#A8D42E` con `.ulatina-base-color` para llamadas positivas y datos prioritarios tratados como callouts autónomos; mantener blanco o el fondo editorial correspondiente en cierres genéricos y cuando la fecha forme parte de un bloque operativo con su CTA, sin constituir por sí sola un callout. En retención, cuando haya dos fechas o hitos consecutivos, no agruparlos bajo un único fondo: crear un bloque por dato y conservar la jerarquía corregida entre `#A8D42E` con texto base y `#4F4F51` con texto blanco.
- Verificación: Seis correcciones manuales delimitaron el patrón: un cierre positivo y cuatro callouts de fecha o trámite usan verde, mientras un cierre genérico y un bloque operativo con fecha y CTA permanecen blancos; todas pasaron `check.js --only` y builds de Eleventy de 89, 98, 104 o 107 archivos. Tres piezas adicionales separaron pares de fechas en callouts verde y gris oscuro, en lugar de fusionarlos; pasaron `check.js --only` y el build de Eleventy de 120 archivos. Cinco piezas de ventas confirmaron el mismo fondo verde con texto base para beneficios, vigencias y acciones prioritarias; pasaron `check.js --only` y el build de Eleventy de 194 archivos.
- No aplicar cuando: El bloque no sea un callout autónomo, la fecha esté integrada en prosa operativa con su acción, o una instrucción explícita/referencia de mayor precedencia defina otro color.
- Confirmaciones: 14

## RG-20260809-07

- Alcance: `universidad:ulatina`
- Síntoma: El saludo de una pieza de `masters/rt` muestra el token de nombre con el mismo peso que el resto de la frase y pierde jerarquía visual.
- Causa: Se aplicó negrita al saludo completo o no se destacó el valor personalizado dentro del saludo.
- Solución: En saludos de `src/masters/rt`, envolver únicamente el token de nombre en negrita, conservando la puntuación literal del brief y la jerarquía `.fs-22 .ulatina-base-color .d-left`.
- Verificación: La corrección se repitió en seis piezas del lote; todas pasaron `check.js --only` y el build de Eleventy de 98 archivos.
- No aplicar cuando: El saludo completo deba ir en negrita por una referencia de mayor precedencia, el token aparezca fuera de un saludo o el brief no contenga personalización.
- Confirmaciones: 6

## RG-20260809-08

- Alcance: `universidad:ulatina`
- Síntoma: Una sección extensa de preguntas frecuentes en `masters/rt` queda como un bloque oscuro uniforme y dificulta distinguir preguntas de respuestas.
- Causa: Se conservó el fondo oscuro del HTML antiguo y se asignó el mismo color a toda la sección.
- Solución: En secciones de preguntas frecuentes de `src/masters/rt`, usar fondo claro; presentar las preguntas en `.fs-18 .ulatina-primary-color .d-left` y las respuestas en `.fs-16 .ulatina-base-color .d-left`, manteniendo spacers de 30 entre entradas.
- Verificación: El patrón fue aplicado manualmente en dos piezas con preguntas frecuentes; ambas pasaron `check.js --only` y el build de Eleventy de 98 archivos.
- No aplicar cuando: Una instrucción explícita o referencia de mayor precedencia requiera fondo oscuro, o la sección no tenga estructura de pregunta y respuesta.
- Confirmaciones: 2

## RG-20260809-09

- Alcance: `universidad:ulatina`
- Síntoma: Un CTA directamente relacionado con el texto precedente queda aislado en una franja de color adicional y fragmenta innecesariamente la lectura.
- Causa: Se creó un bloque independiente por cada cambio de fondo observado en el HTML viejo, aunque el botón pertenece semánticamente a la sección anterior.
- Solución: En `src/masters/rt`, integrar el CTA en el mismo bloque que su explicación cuando ambos forman una sola acción, separándolo con un spacer de 30; reservar un bloque independiente para CTAs que funcionen como sección autónoma.
- Verificación: Tres correcciones manuales integraron CTAs relacionados dentro del bloque editorial correspondiente, incluida una sección con dos acciones complementarias; todas pasaron `check.js --only` y builds de Eleventy de 98 o 107 archivos.
- No aplicar cuando: El CTA constituya un hero, cierre o sección autónoma, o una referencia de mayor precedencia conserve deliberadamente la franja separada.
- Confirmaciones: 3

## RG-20260809-10

- Alcance: `universidad:ulatina`
- Síntoma: Una sección que cuenta con imágenes editoriales significativas queda convertida sólo como texto, pierde la composición en columnas o conserva como pendiente una imagen de `online.ulatina.cr/file/img/` que ya fue migrada.
- Causa: Un asset marcado para verificación se interpretó como permiso para aplanar toda la estructura y no se aplicó la migración canónica confirmada por el usuario, aunque el HTML mostraba inequívocamente una relación imagen-texto.
- Solución: En ULATINA, cuando una imagen editorial use `https://online.ulatina.cr/file/img/<archivo>`, construir su URL canónica como `https://ap-university-storage.s3.us-east-1.amazonaws.com/ulatina/<archivo>`, conservando exactamente el mismo nombre. Si está asociada a texto, usar `modules/ulatina/table_cells.njk` con `cellConfig: imageProgram` y estilo horizontal; conservar el orden visual colocando `imagen | texto` o `texto | imagen` según el HTML.
- Verificación: Cuatro correcciones previas incorporaron imágenes editoriales mediante `table_cells`. Tres piezas adicionales restauraron celdas imagen-texto con el mismo basename bajo S3; una URL manual que reutilizaba el asset de otra pieza se corrigió contra el HTML original. Las siete confirmaciones pasaron `check.js --only`, y los builds de Eleventy de 98, 104, 107 o 120 archivos confirmaron las imágenes en la salida. Siete piezas de ventas adicionales conservaron aperturas o secciones editoriales como celdas horizontales de texto e imagen con `imageProgram`, en vez de aplanarlas a texto; pasaron `check.js --only` y el build de Eleventy de 194 archivos.
- No aplicar cuando: La imagen sea de header, footer o preset; la URL de origen no pertenezca al prefijo confirmado de ULATINA; el nombre del archivo no pueda conservarse de forma inequívoca; la imagen sea un banner independiente; o una referencia de mayor precedencia defina otra composición.
- Confirmaciones: 14

## RG-20260809-11

- Alcance: `universidad:ulatina`
- Síntoma: Las encuestas NPS de `src/masters/rt` pierden el separador visual entre el saludo y el cuerpo aunque el brief incluya `ulatina_bibliotecas.png` como asset por verificar.
- Causa: El asset se omitió al no tener una coincidencia local, pese a que las correcciones manuales confirmaron tanto su URL canónica como su función editorial en dos piezas equivalentes.
- Solución: En piezas NPS de `src/masters/rt` cuyo brief incluya `ulatina_bibliotecas.png`, insertar la URL canónica en un bloque de imagen independiente, con fondo blanco, gutters en 0 y ancho 100%, entre el saludo y el contenido de la encuesta.
- Verificación: Dos correcciones manuales aplicaron el mismo bloque; ambas pasaron `check.js --only` después del formateador oficial y compilaron en un build de Eleventy de 101 archivos.
- No aplicar cuando: La pieza no sea una encuesta NPS, el brief no incluya ese asset, una referencia de mayor precedencia defina otra composición o la imagen corresponda al header/footer.
- Confirmaciones: 2

## RG-20260809-12

- Alcance: `global`
- Síntoma: Una migración conserva las palabras pero pierde negritas u otros énfasis editoriales visibles en el HTML, porque el brief presenta el contenido como texto plano.
- Causa: Se trató la literalidad como conservación exclusiva del texto y no se revisó el marcado inline del HTML cuando la jerarquía visual del brief resultaba insuficiente.
- Solución: Cuando una sección del brief reúna varias frases sin indicar énfasis y el HTML muestre una jerarquía inline relevante, inspeccionar sólo ese fragmento y conservar las negritas en Markdown sin alterar las palabras. Tratar ese vacío de formato como una razón válida para consultar el HTML.
- Verificación: Una corrección manual restauró el énfasis inline de dos mensajes; pasó `check.js --only` y el build de Eleventy de 104 archivos.
- No aplicar cuando: El énfasis pertenezca al header/footer, sea decorativo sin función editorial, o una referencia/instrucción de mayor precedencia defina otra jerarquía.
- Confirmaciones: 1

## RG-20260809-13

- Alcance: `universidad:ulatina`
- Síntoma: Una pieza festiva pierde su banner y sus imágenes editoriales porque los nombres antiguos quedan marcados como `verificar`, aun cuando existen reemplazos canónicos confirmados.
- Causa: El catálogo no relacionó `Captura_2.JPG`, `uft-arbol-navidad-2022.png` y `uft-esferas-navidad-2022.png` con los assets vigentes, y se omitieron en lugar de conservar su función visual.
- Solución: En este patrón de ULATINA, reemplazar `Captura_2.JPG` por `https://ap-university-storage.s3.us-east-1.amazonaws.com/ulatina/felices_fiestas.jpg` y renderizarla con un item `image` a ancho completo. Reemplazar las dos imágenes decorativas laterales por `https://ap-university-storage.s3.us-east-1.amazonaws.com/ulatina/img_attention.png` dentro de las celdas que preservan el orden imagen-texto del HTML.
- Verificación: La corrección manual pasó `check.js --only`; el build de Eleventy de 104 archivos produjo el banner al 100% y dos filas con las imágenes canónicas dentro de columnas alternadas.
- No aplicar cuando: Los nombres de origen no coincidan, la pieza no pertenezca a ULATINA, una referencia indique assets distintos o la imagen corresponda al header/footer.
- Confirmaciones: 1

## RG-20260809-14

- Alcance: `universidad:ulatina`
- Síntoma: En un cierre operativo de `masters/rt`, la frase que introduce un CTA de apoyo queda tratada como cuerpo regular alineado a la izquierda y no establece la jerarquía visual de la acción.
- Causa: Se clasificó la entrada del CTA como prosa informativa por su marcado en el HTML antiguo, sin atender a su función de callout dentro del bloque de soporte ni al patrón de las referencias del grado.
- Solución: Cuando una frase o párrafo breve introduzca inmediatamente un CTA de apoyo en `src/masters/rt`, conservar su texto literal y presentarlo en negrita, centrado y separado del botón por un spacer de 30. Usar `.fs-18 .ulatina-base-color .d-center` como base y `.fs-22` cuando el cierre de soporte sea la acción principal de la sección.
- Verificación: Una corrección previa aplicó el tratamiento a un bloque de soporte con `buttonWA`. Tres entradas adicionales de CTA —dos operativas en una pieza y un cierre principal en otra— se centraron y jerarquizaron en `.fs-18` o `.fs-22`; todas pasaron `check.js --only` y builds de Eleventy de 113 o 120 archivos.
- No aplicar cuando: El texto no introduzca inmediatamente el CTA, contenga una secuencia de pasos o advertencias que requiera lectura alineada a la izquierda, el CTA sea autónomo, o una instrucción de mayor precedencia defina otra jerarquía.
- Confirmaciones: 4

## RG-20260809-15

- Alcance: `global`
- Síntoma: La validación final con `check.js --root` reporta errores de archivos históricos ajenos al manifest, aunque todas las piezas del lote actual ya pasaron su revisión individual.
- Causa: Sin `--only`, `check.js` recorre todos los `.md` de `src/`; el manifest vigente limita el formateador, pero no limita esa enumeración global.
- Solución: Para validar el lote completo sin mezclar deuda histórica, obtener las rutas del manifest vigente y ejecutar secuencialmente `check.js --only` sobre cada `pair.md`; reportar por separado cualquier resultado de la revisión global del repositorio.
- Verificación: El recorrido del manifest aprobó 7 de 7 piezas sin hallazgos después del formato final y el build de Eleventy produjo 120 archivos; la invocación global había reportado 204 errores y 11 avisos en archivos fuera del lote.
- No aplicar cuando: El repositorio completo ya está limpio, se desea auditar deliberadamente todo `src/` o una versión futura de `check.js` limita por sí misma la validación al manifest.
- Confirmaciones: 1

## RG-20260809-16

- Alcance: `universidad:ulatina`
- Síntoma: Un brief conserva tokens históricos con identificador como `&#36;{1#nombre}` y `&#36;{32#Programa}` sin traducir, aunque sus sufijos corresponden a variables canónicas conocidas.
- Causa: Algunos HTML antiguos omiten el prefijo `BF`; el extractor reconoce las familias BF, pero no esta variante numérica abreviada.
- Solución: Cuando el patrón completo sea inequívocamente un merge tag de ULATINA, eliminar el identificador anterior al último `#`, resolver el sufijo con el alias configurado o el diccionario y reemplazarlo por el token canónico completo en negrita, conservando el byte SOH cuando corresponda.
- Verificación: Los dos tokens abreviados de una pieza se resolvieron mediante el alias de nombre y la coincidencia exacta de programa; `check.js --only` quedó sin hallazgos y el build de Eleventy de 120 archivos compiló la salida. Otra pieza histórica resolvió `${1#nombre}` como `{$firstName}`; pasó `check.js --only` y el build de Eleventy de 195 archivos.
- No aplicar cuando: La expresión sea texto literal, código, no tenga un sufijo reconocible o existan varias variables canónicas igualmente plausibles.
- Confirmaciones: 2

## RG-20260809-17

- Alcance: `universidad:ulatina`
- Síntoma: Una nota informativa de `masters/rt` conserva el fondo oscuro y texto blanco del HTML antiguo, por lo que se percibe como alerta, o usa viñetas gráficas innecesarias para contenido neutral.
- Causa: Se trasladó literalmente el tratamiento oscuro y se aplicó la variante genérica de viñeta wine sin distinguir una nota editorial de una alerta prioritaria.
- Solución: Para notas informativas neutrales de `src/masters/rt`, usar fondo `#f2f2f2`, título `.fs-18 .ulatina-primary-color .d-left`, cuerpo `.fs-16 .ulatina-base-color .d-left` y, cuando haya una lista textual simple, `listBullWine` con `bullet: &bull;` en lugar de una imagen.
- Verificación: Una corrección manual convirtió una nota oscura en bloque neutro, ajustó título, cuerpo y viñetas; pasó `check.js --only` y el build de Eleventy de 120 archivos.
- No aplicar cuando: El contenido sea una alerta, tenga urgencia real, requiera iconografía semántica o una instrucción explícita defina otro tratamiento.
- Confirmaciones: 1

## RG-20260809-18

- Alcance: `global`
- Síntoma: Una sección visualmente continua queda con un salto vertical excesivo porque se divide en varios `setBlock` y cada bloque conserva sus spacers externos de 48.
- Causa: Se aplicó mecánicamente el ritmo de apertura y cierre a límites internos que existen por razones técnicas de módulo, no porque comience una nueva sección visual.
- Solución: Cuando dos `setBlock` adyacentes formen una sola sección visual, evitar duplicar los spacers externos y mantener un ritmo interno total de 30 entre ellos; conservar 48 en los límites exteriores de la sección completa.
- Verificación: Correcciones manuales en dos piezas eliminaron o redujeron spacers duplicados entre bloques continuos; ambas pasaron `check.js --only` y el build de Eleventy de 120 archivos.
- No aplicar cuando: Los bloques sean secciones independientes, cambien deliberadamente de ritmo o una referencia de mayor precedencia requiera separación amplia.
- Confirmaciones: 2

## RG-20260810-19

- Alcance: `repositorio:emails-ap`
- Síntoma: `check.js` reporta como inexistentes todas las clases CSS válidas del UI-kit, aunque las piezas usan clases presentes en `styles.scss` y el build termina correctamente.
- Causa: `public/css/styles.css` queda en 0 bytes después del build asíncrono de esta configuración de Eleventy; como el archivo existe, el validador lo toma como fuente disponible pero no puede extraer ninguna clase generada.
- Solución: Después del build y antes de la validación final, compilar `src/_includes/css/styles.scss` con Sass mediante una escritura síncrona a `public/css/styles.css`; no desactivar la regla CSS ni eliminar las clases de las piezas.
- Verificación: La compilación síncrona generó 44,954 bytes de CSS; las mismas piezas que antes acumulaban errores de clases pasaron después `check.js --only`, y el recorrido final aprobó 26 de 26 archivos tras un build de Eleventy de 146 archivos. En otro lote, la recompilación síncrona dejó 44,955 bytes y permitió validar 49 de 49 piezas tras un build de Eleventy de 195 archivos. En la revisión manual posterior, el CSS volvió a vaciarse durante el recorrido; recompilar Sass de forma síncrona antes de cada validación estabilizó 39 de 39 piezas corregidas después de un build de 194 archivos. En un lote UNPHU, el CSS volvió a quedar temporalmente sin clases durante la sexta validación posterior a un build de 74 archivos; recompilar Sass de forma síncrona antes de cada `check.js --only` estabilizó 16 de 16 piezas.
- No aplicar cuando: `public/css/styles.css` ya tenga contenido válido, el repositorio use otra fuente de estilos o una versión futura del build espere correctamente la escritura antes de finalizar.
- Confirmaciones: 4

## RG-20260810-20

- Alcance: `repositorio:emails-ap`
- Síntoma: Los CTAs y enlaces de contacto de `src/masters/vt` conservan el número caduco `50640017234`, omiten el mensaje precargado o toman otro dato del HTML histórico.
- Causa: El valor compartido `canonicalWhatsapp` de `prepare.config.json` quedó desactualizado para la línea de ventas de masters de este repositorio, y algunas piezas no recibieron ningún enlace canónico durante la conversión.
- Solución: En `src/masters/vt`, usar `https://api.whatsapp.com/send?phone=50640006958&text=Hola%20quiero%20m%C3%A1s%20informaci%C3%B3n.` para los CTAs genéricos de contacto; conservar otro mensaje sólo cuando la pieza o una instrucción de mayor precedencia defina uno específico.
- Verificación: Treinta piezas corregidas incorporaron el número vigente y el mensaje precargado; todas quedaron dentro de las 39 piezas que pasaron `check.js --only` después del formateador oficial y compilaron en el build de Eleventy de 194 archivos.
- No aplicar cuando: La pieza no esté bajo `src/masters/vt`, el CTA tenga un destino distinto, o el brief, el UI-kit o una instrucción explícita proporcionen otro número o mensaje vigente.
- Confirmaciones: 30

## RG-20260810-21

- Alcance: `universidad:ulatina`
- Síntoma: Las piezas usan aliases históricos o rutas equivocadas para el sello QS Stars y la imagen de medios de pago, aunque el concepto visual es inequívoco.
- Causa: El catálogo y los HTML antiguos mezclan `icons/logo_qs_stars.png`, `qs_stars.png` y `medios_pago.png` con ubicaciones que ya no corresponden a los assets canónicos vigentes.
- Solución: Para ULATINA, normalizar el sello QS Stars a `https://ap-university-storage.s3.us-east-1.amazonaws.com/ulatina/qs_star.png`; normalizar la imagen de medios de pago a `https://ap-university-storage.s3.us-east-1.amazonaws.com/ulatina/icons/medios_pago.png`.
- Verificación: Cuatro piezas corrigieron el sello QS Stars y tres corrigieron medios de pago; las siete pasaron `check.js --only` y el build de Eleventy de 194 archivos generó sus salidas.
- No aplicar cuando: El asset de origen represente otro concepto, una referencia o instrucción explícita indique una variante distinta, o la pieza no pertenezca a ULATINA.
- Confirmaciones: 7

## RG-20260810-22

- Alcance: `universidad:ulatina`
- Síntoma: Las secciones de apoyo de `src/masters/vt` quedan sobredimensionadas, centradas o teñidas con el color primario como si cada subtítulo fuera un hero; las etiquetas de políticas compiten visualmente con el contenido principal.
- Causa: Se trasladó una jerarquía promocional uniforme sin distinguir títulos principales, subtítulos editoriales, etiquetas funcionales, cuerpo y cierres de acción.
- Solución: Como base en `src/masters/vt`, reservar `.fs-22` para títulos principales o entradas autónomas de CTA; usar `.fs-18` para subtítulos editoriales y `.fs-16` para cuerpo y etiquetas funcionales como políticas. Alinear a la izquierda el contenido informativo; usar `.ulatina-primary-color` sólo para encabezados editoriales reales y `.ulatina-base-color` para explicaciones o entradas de acción. Mantener centrado cuando el bloque sea deliberadamente promocional o un cierre autónomo.
- Verificación: Trece piezas redujeron títulos secundarios de `.fs-22` a `.fs-18` o `.fs-16`, corrigieron alineación y separaron el uso de color primario frente a base; todas pasaron `check.js --only` y el build de Eleventy de 194 archivos.
- No aplicar cuando: Una referencia o instrucción de mayor precedencia defina otra jerarquía, el bloque sea un hero o callout autónomo, o el cambio de escala no corresponda al rol semántico del contenido.
- Confirmaciones: 13

## RG-20260917-23

- Alcance: `repositorio:emails-ap`
- Síntoma: Al preparar un DOCX, una pieza intenta sobrescribir un `.md` de un lote anterior porque su etiqueta interna `Copy` pertenece por error a otra población.
- Causa: `prepare-docx.js` deriva el nombre de destino de la etiqueta interna del documento, aunque el nombre del DOCX y las piezas contiguas indiquen otra población.
- Solución: Detenerse ante la colisión, confirmar con el usuario el nombre correcto, preservar el archivo existente y corregir de forma consistente la ruta del `.md`, su permalink y el par correspondiente del manifest antes de formatear, validar y crear el snapshot.
- Verificación: En maestrías, la pieza anterior se comparó byte a byte con su baseline y quedó intacta; las tres piezas del lote corregido pasaron `check.js --only`, y el build de Eleventy generó 232 archivos. El mismo conflicto se confirmó después en diplomados: se preservó la pieza activa, se corrigió el destino pasivo, las tres piezas pasaron `check.js --only` y el build generó 233 archivos.
- No aplicar cuando: La sobrescritura sea intencional y esté autorizada, el nombre interno corresponda realmente a la población de destino o no exista una colisión con contenido previo.
- Confirmaciones: 2

## RG-20260917-24

- Alcance: `universidad:udla`
- Síntoma: El build de Eleventy falla al leer el frontmatter con `YAMLException` cuando un asunto de Infobip contiene un token canónico cuyo namespace usa el byte SOH.
- Causa: YAML no admite el carácter de control SOH dentro de un scalar entre comillas, mientras que el documento de UDLA define explícitamente los campos personalizables de asunto con la sintaxis de Infobip `{{…}}`.
- Solución: En asuntos de piezas UDLA destinadas a Infobip, conservar literalmente los placeholders `{{…}}` del DOCX y no envolverlos en Markdown; seguir usando los tokens canónicos completos, con SOH real y negrita, en el cuerpo del email.
- Verificación: Dos piezas conservaron los placeholders de Infobip en `subject1`–`subject4`, pasaron `check.js --only` sin hallazgos y compilaron correctamente en un build de Eleventy de 204 archivos. Cuatro piezas adicionales de Licenciaturas conservaron la misma sintaxis en sus asuntos y quedaron dentro de un lote de seis emails que pasó `check.js --only` y compiló en un build de 42 archivos.
- No aplicar cuando: El asunto no vaya a Infobip, el origen use otra sintaxis de personalización o la plataforma acepte de forma comprobada el token canónico sin introducir caracteres de control inválidos en YAML.
- Confirmaciones: 5

## RG-20260917-25

- Alcance: `universidad:udla`
- Síntoma: `prepare-docx.js` no separa correctamente las piezas o incorpora instrucciones del brief dentro del cuerpo cuando un DOCX de Nautilus usa encabezados como `Copy Email N`, `Subject:` en una línea independiente, `Subject line:` o varios asuntos unidos por ` o `.
- Causa: El documento no sigue el contrato estructural `Subject:` + `Copy:` que espera el preparador; además, algunas instrucciones de la pieza siguiente aparecen antes de su asunto y no sirven como límite confiable del cuerpo anterior.
- Solución: Antes de ejecutar el preparador, normalizar cada bloque lógico a un primer `Subject:`, alternativas `Subject 2:`, un `Copy:` estable, el contenido delimitado entre `Cuerpo del Email:` y el primer CTA, las etiquetas de botones sin sus marcadores editoriales y un cierre `FOOTER`. Cuando el lote provenga de varios DOCX, combinar después sus pares y briefs en un único manifest sin alterar los `.md` ya procesados.
- Verificación: Dos DOCX con cuatro piezas de permanencia y dos de recuperación se normalizaron y combinaron; las seis piezas conservaron sus asuntos, cuerpos y CTA, pasaron el formateador oficial y `check.js --only`, y compilaron en un build de Eleventy de 42 archivos.
- No aplicar cuando: El DOCX ya use la estructura estándar de la skill, las líneas editoriales formen parte explícita del contenido o los límites de cuerpo y CTA no puedan determinarse sin una decisión humana.
- Confirmaciones: 1
