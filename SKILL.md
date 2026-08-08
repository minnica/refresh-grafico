---
name: refresh-grafico
description: Convierte HTML de emails viejos al DSL de repositorios compatibles (11ty + Nunjucks), generando archivos .md en src/. Usar cuando el usuario pida actualizar, migrar, refrescar o maquetar piezas de correo a partir de HTML antiguos, mencione "refresh gráfico" o invoque $refresh-grafico. Cubre el lote completo, desde la preparación hasta la validación, incluido el trabajo desatendido de lotes grandes.
---

# Refresh gráfico de emails

Convertir HTML de correos antiguos en archivos `.md` que compilen con el DSL del
repositorio activo. **No reescribir nunca el texto**: trasladarlo literalmente.

## Comprobar compatibilidad

Los scripts pertenecen a esta skill, no al repositorio activo. Antes de empezar:

1. Resuelve la ruta absoluta del directorio que contiene este `SKILL.md`; ése es
   `<skill-dir>` en los comandos de este documento.
2. Comprueba que la skill incluya `scripts/prepare.js`, `scripts/extract.js`,
   `scripts/check.js` y `scripts/prepare.config.json`.
3. Desde la raíz del repositorio activo, comprueba que exista
   `src/_content/ulatina_general_config.njk`.

El repositorio activo **no necesita una carpeta `scripts/`**. Si falta un archivo
incluido en la skill o la configuración Nunjucks requerida en el repositorio,
detente y explica qué falta; no inventes sustitutos ni copies los scripts al
proyecto.

Todos los scripts aceptan `--root <ruta>` y, si se omite, usan el directorio de
trabajo actual. Pasa siempre la raíz explícita para evitar operar sobre la skill
o sobre otro repositorio por accidente. Sustituye `<skill-dir>` y `<repo-root>`
por rutas absolutas reales; no uses esos marcadores literalmente.

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

Antes de lanzar subagentes, hacer un único preflight y confirmar que todo el
trabajo previsto cabe dentro de estos límites:

- leer los scripts y la configuración incluidos en la skill;
- leer y escribir únicamente dentro de `<repo-root>` y directorios temporales;
- ejecutar Node, el build ya instalado y los scripts deterministas sin red;
- no instalar dependencias, editar la skill, escribir fuera del workspace ni
  solicitar `sandbox_permissions=require_escalated`.

Si el preflight detecta que una operación imprescindible excede esos límites,
detenerse **antes** de repartir el lote y explicar la configuración necesaria.
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

Cuatro pasos. Los pasos 1, 2 y 4 son scripts deterministas — no los hagas a
mano ni improvises su resultado.

```bash
# 1. Prepara los .md con frontmatter y permalink ya resueltos
node "<skill-dir>/scripts/prepare.js" --root "<repo-root>" --dest src/maestrias/retencion

# 2. Reduce cada HTML a un brief compacto (quita el ~90% de markup)
node "<skill-dir>/scripts/extract.js" --root "<repo-root>" --all --out .prepare/briefs

# 3. Convertir  ← lo único que haces tú, con este documento
# 4. Validar
node "<skill-dir>/scripts/check.js" --root "<repo-root>"
```

`prepare.js` deja en `.prepare/manifest.json` los pares origen → destino.
Trabaja siempre desde ahí, no de una lista escrita a mano.

## Regla de oro del paso 3

**Lee el brief, no el HTML.** El brief (`.prepare/briefs/<nombre>.brief.md`)
ya trae el texto por secciones, los assets mapeados, los enlaces resueltos y
los merge tags traducidos. Abrir el HTML crudo cuesta ~10× más contexto y es
lo que provoca que se mezcle contenido entre piezas.

Sólo abre el HTML si el brief tiene un vacío evidente.

## Cómo repartir el trabajo

Un lote grande **no se hace en una sola pasada**: emails del mismo cliente se
parecen entre sí y el contenido se contamina. Lanza subagentes con **3 a 5
emails cada uno**, en paralelo. A cada subagente dale:

- las rutas de sus briefs y sus `.md` destino (del manifest),
- esta skill,
- las rutas absolutas de `<skill-dir>` y `<repo-root>`,
- la instrucción de correr
  `node "<skill-dir>/scripts/check.js" --root "<repo-root>" --only <archivo>`
  al terminar.

Un email por subagente aísla más, pero repite el coste de arranque N veces;
3-5 es el punto de equilibrio.

## Estructura de un .md

El frontmatter ya lo generó `prepare.js`: **no lo toques**. Debajo del
`{%- import %}` van los bloques.

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
2. **Merge tags**: usa el mapeo del brief. `$BF{nombre}` → `{$firstName}`,
`$BF{programa}` → `{$dataPrograma}`, `$BF{fechainicioclases}` →
`{$dataFechaInicioClases}`. Nunca dejes un `$BF{…}`: `markdown-it-attrs` se
come las llaves y deja `$BF` visible en el correo.
3. **Imágenes**: usa la columna «destino» del brief. Las marcadas **omitir** no
van en el `.md` — las pone el layout o un preset. Nunca inventes una URL.
4. **Enlaces**: los `mailto:` y `tel:` se omiten (van en el footer). El
WhatsApp usa el número canónico del brief, no el del HTML viejo.
5. **Colores de fondo**: los del brief son del original. Si hay UI-kit, manda
el UI-kit. Ante la duda, pregunta antes de inventar un color.
6. **Header y footer** no se escriben: los pone el layout.

## Al terminar

```bash
node "<skill-dir>/scripts/check.js" --root "<repo-root>" --only <nombre-del-archivo>
```

Debe salir sin errores. La regla `texto` compara tu `.md` contra el HTML de
origen y avisa si perdiste o inventaste contenido; trátala en serio: es la
única red que detecta un párrafo olvidado.

Si `check.js` marca contenido perdido que en realidad es del header o del
footer, no lo agregues al `.md` — añádelo a `textCheck.ignore` en
`<skill-dir>/scripts/prepare.config.json`.

## Pendiente: configuración multi-repositorio

`scripts/prepare.config.json` vive ahora dentro de la skill y es compartido por
todos los repositorios donde se use. Queda pendiente diseñar una selección de
configuración por repositorio o universidad —por ejemplo, perfiles nombrados o
una opción `--config`— para independizar `importLine`, perfiles de frontmatter,
assets, merge tags, textos ignorados y WhatsApp.

Hasta resolverlo, antes de ejecutar el pipeline compara esa configuración con el
repositorio activo. Si no corresponde, detente y pregunta; no modifiques el
repositorio ni reutilices silenciosamente valores de otra universidad.
