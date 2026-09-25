---
name: refresh-grafico
description: Convierte HTML o DOCX con varios emails al DSL de repositorios compatibles (11ty + Nunjucks), generando archivos .md en src/. Selecciona perfiles por universidad y repositorio. Usar cuando el usuario pida actualizar, migrar, refrescar o maquetar piezas de correo, mencione "refresh gráfico", invoque $refresh-grafico, incluya `Referencia:[ruta]` o pida aprender de sus correcciones manuales.
---

# Refresh gráfico de emails

Convertir HTML de correos antiguos o documentos DOCX con varias piezas en archivos
`.md` que compilen con el DSL del repositorio activo. **No reescribir nunca el
texto**: trasladarlo literalmente.

## Regla de agente único

Ejecutar siempre esta skill con el agente actual. **No crear, lanzar ni delegar
trabajo a subagentes**, aunque el lote sea grande, el usuario pida ejecución
desatendida o haya que validar, investigar errores o aprender correcciones.
Procesar el manifest secuencialmente y usar scripts deterministas para contener
el consumo de tokens. Si el lote no cabe cómodamente en el contexto, dividirlo
en grupos internos y completar uno antes de cargar el siguiente, sin delegarlos.

## Comprobar compatibilidad

Los scripts pertenecen a esta skill, no al repositorio activo. Antes de empezar:

1. Resuelve la ruta absoluta del directorio que contiene este `SKILL.md`; ése es
   `<skill-dir>` en los comandos de este documento.
2. Comprueba que la skill incluya `scripts/prepare.js`, `scripts/prepare-docx.js`, `scripts/extract.js`,
   `scripts/format.js`, `scripts/check.js`, `scripts/review.js`, `scripts/runtime.js`,
   `scripts/config.js`, `scripts/prepare.config.json`, `references/assets.json` y
   `references/variables.md` y `references/lessons.md`.
3. Resuelve la universidad con `--university <id>` o por autodetección. Comprueba
   que exista el `requiredConfig` de ese perfil. Para UNAPEC es
   `src/_content/unapec_general_config.njk`; para ULATINA,
   `src/_content/ulatina_general_config.njk`.

El repositorio activo **no necesita una carpeta `scripts/`**. Si falta un archivo
incluido en la skill o la configuración Nunjucks requerida en el repositorio,
detente y explica qué falta; no inventes sustitutos ni copies los scripts al
proyecto.

Tampoco crees `.prepare/` ni otros artefactos auxiliares dentro del repositorio.
El manifest, los briefs y las referencias de revisión viven bajo
`<skill-dir>/.state/`. `runtime.js` los separa por ruta canónica del repositorio y
por rama Git, y el `.gitignore` de la propia skill excluye `.state/`. No edites el
`.gitignore` del proyecto para este flujo.

Todos los scripts aceptan `--root <ruta>` y, si se omite, usan el directorio de
trabajo actual. Pasa siempre la raíz explícita para evitar operar sobre la skill
o sobre otro repositorio por accidente. Sustituye `<skill-dir>` y `<repo-root>`
por rutas absolutas reales; no uses esos marcadores literalmente.

## Instrucciones visuales y `Referencia:[ruta]`

Antes de preparar el lote, extrae del prompt las instrucciones visuales
explícitas, incluidos los colores HEX, y cualquier referencia escrita con esta
sintaxis (sin exigir que la ruta tenga un valor fijo):

```text
Referencia:[ruta/al/archivo-o-carpeta]
```

Acepta espacios alrededor de `Referencia:`, una ruta absoluta o una ruta
relativa a `<repo-root>`. Conserva espacios y caracteres especiales dentro de
los corchetes. Si aparecen varias líneas `Referencia:[...]`, procésalas en el
orden indicado. No interpretes como referencia una ruta que no esté delimitada
por corchetes.

Resuelve y comprueba cada ruta mediante una operación de sólo lectura antes de
convertir. Una referencia puede ser un archivo existente o una carpeta. Si es
una carpeta, inspecciona primero sus nombres y abre sólo los archivos necesarios
para identificar el patrón aplicable; no cargues toda la carpeta. Si la ruta no
existe, no es legible o resulta ambigua, informa cuál falló y continúa sin esa
referencia cuando todavía sea posible respetar las instrucciones explícitas. No
busques en Internet ni sustituyas la referencia por otra ruta inventada.

Usa los archivos referenciados como guía de maquetado: estructura de bloques,
selección de módulos y presets, ritmo de espaciado, alineación, jerarquía y
tratamiento visual. No copies de ellos texto, enlaces, imágenes, merge tags,
frontmatter ni datos particulares de otra pieza. Todo el contenido del nuevo
email debe seguir saliendo literalmente de su brief y el frontmatter generado
por `prepare.js` debe permanecer intacto.

Aplica esta precedencia cuando las fuentes difieran:

1. instrucciones explícitas del usuario en el prompt, incluidos sus HEX;
2. UI-kit o reglas obligatorias del repositorio activo;
3. archivos indicados mediante `Referencia:[ruta]`;
4. estilos observados en el HTML/brief original;
5. convenciones generales de esta skill.

Reproduce exactamente los HEX solicitados por el usuario, normalizando sólo la
capitalización si el resultado es equivalente. Usa clases o presets existentes
cuando produzcan ese mismo valor; si no, aplica el HEX en una propiedad válida
del DSL. No reemplaces un HEX explícito por el color «más cercano» de la paleta.
Si dos instrucciones explícitas se contradicen o un HEX no puede representarse
con el DSL disponible, conserva la pieza como pendiente y explica el conflicto
en vez de decidirlo silenciosamente.

## Variables BF y símbolo SOH

Usa `<skill-dir>/references/variables.md` como fuente de verdad para los tokens
de personalización. `extract.js` debe detectar tanto `$BF{nombre}` como el
formato `${BFnombre}` y sus variantes con identificador o separadores, por
ejemplo `$BF{1#nombre}` y `${BF32#Programa}`.

Resuelve el nombre así:

1. elimina el identificador anterior al último `#` y los separadores iniciales;
2. busca una coincidencia normalizada exacta en el diccionario;
3. usa el alias histórico de `prepare.config.json` cuando exista y también
   apunte a una entrada del diccionario;
4. si aún no coincide, elige el nombre más cercano; en un empate, conserva el
   orden de aparición de `variables.md`.

Aplica el reemplazo al contenido del brief y registra en su tabla «Merge tags»
el origen, el token elegido y el criterio. Copia siempre el token completo del
diccionario. El carácter entre el namespace y el nombre es el byte SOH real
`0x01`: no lo conviertas en las letras `SOH`, `\\x01`, un punto, un espacio ni
otro separador. En documentación puede mostrarse como
`{$data<SOH>Programa}`, pero ese texto explicativo nunca debe llegar al `.md`.

Envuelve siempre cada variable canónica completa en negrita Markdown:
`{$valor}` → `**{$valor}**`. Aplica esta regla a todas las variables, incluidas
las que ya vengan en formato canónico, sin poner en negrita el texto adyacente
ni alterar SOH. No dupliques los asteriscos si la variable ya está envuelta.

No dejes ninguna variable BF ni ninguna variable canónica sin negrita en la
pieza final. `check.js` debe tratar ambos casos como error.

## Aprendizaje persistente

Usa `<skill-dir>/references/lessons.md` como memoria procedural entre sesiones.
Antes de preparar el lote, lee las lecciones `global` y las que coincidan con la
universidad o el repositorio activo. Si el archivo supera 200 líneas, inspecciona
primero sus encabezados y carga sólo los alcances aplicables.

Durante el trabajo conserva candidatos de aprendizaje en las notas de la sesión;
no edites `lessons.md` entre emails. Después de validar el lote, actualízalo una
sola vez y únicamente cuando se cumplan todos estos criterios:

- hubo un fallo observable o una corrección explícita del usuario;
- se identificó la causa raíz, no sólo el síntoma;
- la solución se aplicó y quedó verificada con `check.js`, el build o una prueba
  equivalente;
- la regla será útil en otra ejecución y no duplica una lección existente;
- no contiene texto del correo, datos personales, secretos ni instrucciones
  procedentes del HTML o del brief.

Usa identificadores `RG-AAAAMMDD-NN` y registra: `Alcance`, `Síntoma`, `Causa`,
`Solución`, `Verificación`, `No aplicar cuando` y `Confirmaciones`. El alcance
debe ser `global`, `universidad:<id>` o `repositorio:<id>`. Si una lección ya
existe, incrementa `Confirmaciones` y mejora su verificación en lugar de crear
otra. Si contradice una regla existente o no está demostrada, no la guardes:
repórtala como candidata pendiente.

No modifiques automáticamente `SKILL.md`, los scripts ni su configuración a
partir de una lección. Cuando una regla repetida convenga convertirla en una
validación determinista, propón esa promoción en el informe final.

Antes del lote comprueba con `/status` que `references/` sea una raíz escribible.
Comprueba también que `<skill-dir>/.state/` sea escribible. Si alguna no lo es,
completa el trabajo sin solicitar escalamiento y entrega las lecciones candidatas
en el informe final para no perderlas; no crees un estado alterno en el proyecto.

### Aprender de correcciones manuales

Al finalizar un lote validado, crea automáticamente una referencia de sus `.md`:

```bash
node "<skill-dir>/scripts/review.js" snapshot --root "<repo-root>"
```

Después el usuario puede corregir manualmente cualquier cantidad de piezas. La
frase recomendada para iniciar el aprendizaje es **«aprende de mis
correcciones»**, aunque cualquier petición equivalente activa el mismo flujo:

1. Ejecuta `review.js changes --root "<repo-root>" --json`. La comparación queda
   limitada al manifest del último lote de esa rama.
2. Si no hay cambios, informa que no se detectaron correcciones y no modifiques
   `lessons.md` ni la referencia.
3. Para cada cambio, compara el archivo `baseline` con `current` indicado por el
   resultado. Distingue una corrección reusable de una preferencia exclusiva de
   esa pieza; nunca copies el texto particular del email a `lessons.md`.
4. Ejecuta `check.js --only <archivo>` sobre cada pieza corregida y, cuando sea
   aplicable, el build. Un cambio que no pasa la validación queda como candidato,
   no como lección verificada.
5. Actualiza `lessons.md` una sola vez siguiendo el esquema anterior y resume qué
   reglas aprendiste y qué cambios no generalizaste.
6. Sólo después de registrar correctamente el aprendizaje, acepta el nuevo estado:

```bash
node "<skill-dir>/scripts/review.js" accept --root "<repo-root>"
```

Si un archivo fue borrado, no lo aceptes automáticamente: informa el caso y pide
confirmación porque puede ser una eliminación accidental, no una corrección.

## Modo desatendido

Aplicar este modo cuando el usuario diga que dejará el lote trabajando, pida no
recibir solicitudes de permiso o encargue un lote grande para completar de
principio a fin.

Una skill no puede cambiar la política de aprobaciones de la sesión. Para que no
aparezcan diálogos de permiso, la sesión debe iniciarse externamente con
`approval_policy = "never"` y acceso de escritura limitado al workspace. En CLI,
el equivalente es:

```bash
codex --sandbox workspace-write --ask-for-approval never
```

No recomendar `danger-full-access`: este pipeline no lo necesita.

Antes de procesar el lote, hacer un único preflight y confirmar que todo el
trabajo previsto cabe dentro de estos límites:

- leer los scripts, la configuración y las lecciones incluidos en la skill;
- leer y ejecutar el `formatter.js` de la extensión local VT Email DSL sin
  modificar ningún archivo de la extensión;
- leer y escribir dentro de `<repo-root>`, directorios temporales,
  `<skill-dir>/.state/` y `references/lessons.md`;
- ejecutar Node, el build ya instalado y los scripts deterministas sin red;
- no instalar dependencias, editar otros archivos de la skill, escribir en otras
  rutas externas ni solicitar `sandbox_permissions=require_escalated`.

Si el preflight detecta que una operación imprescindible excede esos límites,
detenerse **antes** de procesar el lote y explicar la configuración necesaria.
No iniciar un lote que quedará esperando una aprobación a mitad del proceso.

Durante el lote:

- considerar autorizada la creación y edición de los `.md` destino y los
  artefactos generados por el pipeline dentro del repositorio activo;
- no pedir confirmación entre emails ni entre pasos normales del pipeline;
- si un email falla, registrar el motivo, continuar con los demás y reintentarlo
  al terminar cuando sea solucionable sin nueva autoridad;
- si una URL, asset o decisión de UI requiere información externa no disponible,
  marcar ese email como pendiente y continuar; no inventar valores;
- validar cada email y luego el lote completo;
- al final, informar cuántos pasaron, cuáles fallaron y cuáles requieren una
  decisión humana. No declarar éxito total mientras haya pendientes.

## El pipeline

Seis pasos. Los pasos 1, 2, 4, 5 y 6 son scripts deterministas — no los hagas a
mano ni improvises su resultado.

```bash
# 1a. HTML: prepara los .md con frontmatter y permalink ya resueltos
node "<skill-dir>/scripts/prepare.js" --root "<repo-root>" --dest src/maestrias/retencion

# 1b. DOCX con varias piezas: separa por bloques Subject y crea briefs + manifest
node "<skill-dir>/scripts/prepare-docx.js" --root "<repo-root>" --source "src/documento.docx" --dest src/diplomados/retencion/permanencia --university unapec

# 2. Sólo HTML: reduce cada HTML a un brief compacto (quita el ~90% de markup)
node "<skill-dir>/scripts/extract.js" --root "<repo-root>" --all

# 3. Convertir  ← lo único que haces tú, con este documento
# 4. Formatear con la implementación real de la extensión instalada
node "<skill-dir>/scripts/format.js" --root "<repo-root>"

# 5. Validar, incluido el formato
node "<skill-dir>/scripts/check.js" --root "<repo-root>"

# 6. Guarda la referencia para detectar correcciones manuales posteriores
node "<skill-dir>/scripts/review.js" snapshot --root "<repo-root>"
```

`prepare.js` deja los pares origen → destino en el manifest privado de la skill.
Obtén sus rutas sin adivinarlas:

```bash
node "<skill-dir>/scripts/review.js" paths --root "<repo-root>" --json
```

Trabaja siempre desde el `manifest` reportado, no de una lista escrita a mano.

### Formato de entrega VT Email DSL

Antes de procesar el lote, confirma la extensión instalada con:

```bash
node "<skill-dir>/scripts/format.js" --version
```

`format.js` debe elegir la versión instalada más reciente de
`aplatam.vt-email-dsl` y ejecutar directamente su función
`formatVtEmailDsl`; no imites ni reimplementes sus reglas. Formatea sólo los
`.md` del manifest actual y usa por defecto 2 espacios, el fallback del
formateador. Si la configuración explícita del workspace usa otra indentación,
pasa las mismas opciones `--tab-size <n>` o `--tabs` tanto a `format.js` como a
`check.js`. Si falta la extensión o su export, detente antes del lote.
`check.js` debe fallar si volver a formatear cambiaría un `.md`.

## Regla de oro del paso 3

**Lee el brief, no el HTML.** Usa la carpeta `briefs` reportada por
`review.js paths`; cada `<nombre>.brief.md` ya trae el texto por secciones, los
assets mapeados, los enlaces resueltos y los merge tags traducidos. Abrir el HTML
crudo cuesta ~10× más contexto y es lo que provoca que se mezcle contenido entre
piezas.

Sólo abre el HTML si el brief tiene un vacío evidente.

### Imágenes sin coincidencia exacta

`extract.js` consulta `references/assets.json` después de buscar el nombre en el
repositorio. Interpretar las acciones de la tabla de imágenes así:

- **usar**: coincidencia exacta; usar la URL indicada;
- **sugerir**: hay una coincidencia de nombre claramente superior; comprobar que
  su concepto corresponda al texto de la sección y usarla si coincide;
- **elegir**: hay dos o más candidatas cercanas; elegir sólo cuando el contexto
  descarte claramente las demás;
- **verificar**: no hubo coincidencia útil; conservar el email como pendiente;
- **omitir**: la imagen pertenece al header, footer o a un preset.

Se puede elegir por color dependiendo el grado de estudio al que pertenezca  segun sea el caso(masters, maestrias, diplomados, especializaciones). Si el significado no es
claro, no insertar ninguna candidata ni inventar otra URL. El catálogo es de
alcance `universidad:ulatina`; no reutilizarlo silenciosamente en otro cliente.

## Procesamiento secuencial

Siguiendo la regla de agente único, recorre el manifest en orden y termina un
email antes de abrir el brief del siguiente para reducir consumo de tokens y
evitar mezclar contenido entre piezas:

1. Lee únicamente el brief actual.
2. Convierte su `.md` destino.
3. Ejecuta `format.js --only <archivo>`.
4. Ejecuta `check.js --only <archivo>`.
5. Corrige, vuelve a formatear y valida antes de continuar.
6. Si no puede resolverse sin inventar información, registra el bloqueo y pasa
   al siguiente email.

Mantén sólo un resumen breve de progreso y de candidatos de aprendizaje; no
arrastres el contenido completo de emails ya validados.

## Estructura de un .md

El frontmatter ya lo generó `prepare.js`: **no lo toques**. Debajo del
`{%- import %}` van los bloques.

Los ejemplos siguientes muestran ULATINA. Usa siempre `moduleNamespace`,
presets, clases y paleta del perfil seleccionado. Para UNAPEC los módulos viven
en `modules/unapec/`, las clases de marca comienzan con `.unapec-` y los presets
se leen de `src/_content/unapec_general_config.njk`; no traslades nombres de
presets o colores de ULATINA.

```
{%- setBlock "Hero", {
  config: {
    table:   { bgcolor: "#ffffff" },
    gutters: { width: 32 },
    spacer:  { size: 0 }
  },
  file: "modules/ulatina/text_list_cta.njk"
} -%}
-: spacer @ size: 48 | :-
-: text | Texto del correo {.fs-16 .ulatina-base-color .d-left}
:-
-: spacer @ size: 48 | :-
{%- endsetBlock -%}
```

Un bloque por sección del brief. El primer argumento (`"Hero"`, `"CTA"`) es
sólo una etiqueta humana; ningún template lo lee.

### Qué `file:` usar

| `file:` | Cuándo |
| --- | --- |
| `modules/ulatina/text_list_cta.njk` | Lo habitual: texto, listas y/o botones |
| `modules/ulatina/general.njk` | Bloque simple: una imagen o un texto suelto |
| `modules/ulatina/table_cells.njk` | Rejilla de celdas: imagen+texto en paralelo, 2 columnas |

### Items disponibles

```
-: tipo @ arg: valor, arg: valor | contenido :-
```

| Tipo | Contenido |
| --- | --- |
| `spacer` | vacío; el tamaño va en `@ size: N` |
| `text` | Markdown; párrafos separados por línea en blanco |
| `cta` | `**Texto**{.clases}` |
| `list` | líneas `- url | texto` cuando `bullet: image` |
| `image` | una URL |
| `cell` | `texto | imagen`, separado por `|` |

### Ritmo de spacers

48 al abrir y cerrar cada bloque, 30 entre elementos internos. Es la
convención del repo; respétala salvo que el UI-kit diga otra cosa.

## Presets

Nunca escribas a mano lo que ya es un preset. Se invocan por nombre y el
parser resuelve la propiedad correspondiente de
`src/_content/ulatina_general_config.njk`.

**Botones** — `buttonPurple`, `buttonWine`, `buttonMaestria`, `buttonLavender`,
`buttonGreen`, `buttonWhite`, `buttonWA`.

```
-: cta @ table: buttonPurple, gutters: buttonPurple, spacer: buttonPurple |
**Ver calendario**{.fs-18 .white-color .d-center} {.d-center}
:-
```

WhatsApp lleva además el icono a la izquierda:

```
-: cta @ table: buttonWA, gutters: buttonWA, spacer: buttonWA, image: WALeft |
**Contactanos**{.fs-18 .white-color .d-center} {.d-center}
:-
```

**Listas con viñeta de imagen** — `listBullLavender`, `listBullPoint`,
`listIcons`, `listIconsCircle`:

```
-: list @ bulletCell: listBullLavender, textCell: listBullLavender, bullet: image, bulletConfig: listBullLavender, addSpacer: listBullLavender, gutters: listBullLavender |
- https://…/icons/icon_point_purple.png | Acceso al campus virtual {.fs-16 .ulatina-base-color .d-left}
:-
```

**Celdas** — `imageProgram`, `configTableWhite`, `configTableLavender`,
`configTablePurple`, `configTableLight`.

**Cajas** — `boxPurple`, `boxLavender`, `boxGray`, `boxBorder`, `boxDarkPurple`.

## Clases CSS

Sólo existen las que genera `src/_includes/css/styles.scss`. Verifícalas
contra `public/css/styles.css` si dudas — `check.js` lo hace por ti.

| Familia | Clases |
| --- | --- |
| Tamaño | `.fs-8` … `.fs-48` |
| Color de texto | `.ulatina-base-color`, `.ulatina-primary-color`, `.ulatina-lavender-color`, `.ulatina-purple-color`, `.ulatina-lemon-color`, `.ulatina-gray-color`, `.white-color`, `.black-color` |
| Fondo | los mismos con `-bg-color` |
| Alineación | `.d-left`, `.d-center`, `.d-right`, `.d-underline` |
| Espaciado | `.p-N`, `.m-N`, `.m-top-N`, `.m-bottom-N` (N ∈ 5,10…50,60) |
| Móvil | `.m-hide`, `.m-center`, `.m-left`, `.m-fluid-img` |

**El sufijo `-color` es obligatorio.** `.ulatina-base` no existe y no aplica
ningún estilo: compila sin error y el texto sale sin color. Es el error más
frecuente de este repo.

Paleta: `ulatina-base #373738` · `ulatina-primary #772342` ·
`ulatina-secondary #2E2E2E` · `ulatina-gray #5C5C5E` · `ulatina-lemon #A8D42E` ·
`ulatina-purple #41184D` · `ulatina-lavender #994EAD`.

## Reglas de conversión

1. **Texto literal.** No corrijas ortografía, gramática ni voseo. Si el
original dice "realicés" o "Contactanos", va tal cual.
2. **Merge tags**: usa exclusivamente el reemplazo ya aplicado y documentado
en el brief a partir de `references/variables.md`. Entrega cada token como
`**{$valor}**` y conserva intacto SOH. Nunca dejes `$BF{…}`, `${BF…}` ni una
variable canónica sin negrita.
3. **Imágenes**: usa la columna «destino» del brief y respeta las acciones del
apartado «Imágenes sin coincidencia exacta». Las marcadas **omitir** no van en
el `.md` — las pone el layout o un preset. Nunca inventes una URL.
4. **Enlaces**: los `mailto:` y `tel:` se omiten (van en el footer). El
WhatsApp usa el número canónico del brief, no el del HTML viejo.
5. **Colores de fondo**: los del brief son del original. Aplica la precedencia
del apartado «Instrucciones visuales y `Referencia:[ruta]`»; ante la duda,
pregunta antes de inventar un color.
6. **Header y footer** no se escriben: los pone el layout.

## Al terminar

```bash
node "<skill-dir>/scripts/check.js" --root "<repo-root>" --only <nombre-del-archivo>
```

Debe salir sin errores. La regla `texto` compara tu `.md` contra el HTML de
origen y avisa si perdiste o inventaste contenido; trátala en serio: es la
única red que detecta un párrafo olvidado.

Cuando todo el lote pase sus validaciones, ejecuta el `snapshot` del apartado de
aprendizaje. No lo ejecutes antes: la referencia debe representar exactamente lo
que generó la skill, previo a cualquier corrección manual del usuario.

Si `check.js` marca contenido perdido que en realidad es del header o del
footer, no lo agregues al `.md`. Registra el texto como candidato para
`textCheck.ignore` y como aprendizaje verificado cuando corresponda; no
modifiques automáticamente `<skill-dir>/scripts/prepare.config.json`.

## Configuración multiuniversidad

`scripts/prepare.config.json` contiene perfiles nombrados. Los scripts aceptan
`--university <id>` y también autodetectan el perfil cuando sólo uno de sus
`requiredConfig` existe. Cada universidad mantiene separados `importLine`,
namespace de módulos, frontmatter, assets, merge tags, textos ignorados y
WhatsApp. Si la detección es nula o ambigua, detenerse y pedir el id; nunca
reutilizar silenciosamente valores de otra universidad.

Para DOCX, `prepare-docx.js` separa piezas por líneas `Subject:`, conserva los
asuntos y preencabezado en frontmatter, genera briefs en `.state/` y omite las
marcas `LOGO`, `CTA` y `FOOTER` del cuerpo porque son instrucciones estructurales.
