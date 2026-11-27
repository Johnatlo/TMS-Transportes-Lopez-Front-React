# Guía de interfaz — SOFI por Transportes López

Reglas globales de la interfaz: fuentes, colores, tablas y estados. Todo lo que
aquí se define vive en **`src/tema.css`**. Cualquier pantalla nueva usa esas
variables y nunca escribe un color o un tamaño a mano.

---

## 1. Identidad

- **SOFI tiene dos modos: oscuro y claro.** El oscuro: casi negro, violeta
  eléctrico y durazno (inspirado en dope.security). El claro: la misma paleta
  invertida, con fondo blanco hueso, tinta casi negra y el mismo violeta.
- **Por defecto el modo es automático, con el día y la noche** (hora de
  Colombia): claro de 5:00 a.m. a 4:59 p.m. y oscuro de 5:00 p.m. a 4:59 a.m.
  Cambia solo, aunque la aplicación esté abierta. El login siempre va así.
- **Cada usuario puede fijar uno** con el botón sol/luna de la barra superior,
  y volver a automático desde su menú. Se guarda en su usuario
  (`PUT /auth/preferencias`: `oscuro`, `claro` o `auto`) y lo sigue a
  cualquier computador. El navegador recuerda la última elección para pintar
  bien desde el primer instante (`src/modoPantalla.ts` e `index.html`).
- **Logo:** `src/assets/logo-sofi.png` (día) y `logo-sofi-noche.png` (noche);
  el emblema solo: `emblema-sofi.png` y `emblema-sofi-noche.png`. Sobre una
  foto oscura va siempre la versión de noche.
- **Ninguna pantalla escribe un color a mano.** Todo color sale de las
  variables de `src/tema.css`: así cambia solo con el modo. Si hace falta un
  tono nuevo, se agrega a los dos modos.
- **El violeta es el color de la marca.** Se usa para lo que se puede hacer
  (botones primarios, enlaces, pestaña activa, página actual).
- **El color comunica estado.** Verde, ámbar y rojo solo aparecen cuando dicen
  algo: cumplido, por vencer, error.

---

## 2. Fuentes

| Uso | Fuente | Variable |
|---|---|---|
| Toda la interfaz | **Inter** (300, 400, 500, 600, 700) | `--fuente-ui` |
| Códigos y radicados (manifiesto, remesa, NIT, etiquetas del RNDC) | **Space Mono** (400, 700) | `--fuente-codigo` |

Se cargan desde Google Fonts en `index.html`. Si no cargan (sin internet), cae a
Segoe UI y Consolas, que tienen medidas parecidas.

Las palabras destacadas de un título (el nombre en "Buenas tardes, Principal")
van en Inter, con el color `--durazno`.

**Números:** las columnas de dinero y cantidades usan cifras tabulares
(`font-variant-numeric: tabular-nums`, ya incluido en la clase `num`), así los
montos quedan alineados.

### Escala de tamaños

| Variable | Tamaño | Para qué |
|---|---|---|
| `--texto-xs` | 11.5 px | Encabezados de columna, contadores, pastillas, datos secundarios |
| `--texto-sm` | 13 px | **Contenido de tablas**, ayudas bajo los campos |
| `--texto-base` | 14 px | Formularios y texto general |
| `--texto-md` | 16 px | Títulos de sección |
| `--texto-lg` | 20 px | Título de página |
| `--texto-xl` | 25.6 px | Cifras grandes del tablero |

Pesos: 400 texto, 500 botones y etiquetas, 600 títulos y dato principal de la
fila, 700 solo en cifras del tablero.

**En el celular**, todo campo de texto usa 16 px. Con menos, el iPhone hace zoom
al tocarlo.

---

## 3. Colores

Cada variable tiene un valor en modo claro (`:root`) y otro en modo oscuro
(`:root[data-tema="oscuro"]`). Se usa siempre la variable, nunca el valor.

### Marca (violeta)

| Variable | Claro | Oscuro | Uso |
|---|---|---|---|
| `--marca-50` | `#f5edff` | `#1f1630` | Fondo de elemento seleccionado, hover de fila clicable |
| `--marca-100` | `#ecdcfd` | `#2a1d42` | Bordes sobre fondo de marca |
| `--marca-200` | `#d9bcfb` | `#43296b` | Foco de campos |
| **`--marca-600`** | **`#7a2fd0`** | **`#af50ff`** | **Primario**: botones, enlaces, pestaña activa, página actual |
| `--marca-700` | `#6a25b8` | `#c88aff` | Hover del primario, texto sobre `--marca-50` |
| `--marca-900` | `#3b1470` | `#ecdcff` | Texto fuerte sobre fondos de marca |
| `--durazno` | `#b4534c` | `#fa9e98` | Palabras destacadas de los títulos |
| `--color-sobre-acento` | `#ffffff` | `#090909` | Letra sobre el violeta o un color de estado |

### Neutros

| Variable | Claro | Oscuro | Uso |
|---|---|---|---|
| `--gris-0` | `#ffffff` | `#141212` | Tarjetas, tablas, ventanas |
| `--gris-25` | `#fcfcfd` | `#171515` | Hover de fila, barra de filtros |
| `--gris-50` | `#f7f9fa` | `#090909` | **Fondo de la aplicación** |
| `--gris-100` | `#eeeef2` | `#1d1b1b` | Líneas entre filas, encabezados de tabla |
| `--gris-200` | `#e3e3ea` | `#2a2727` | Bordes de tarjetas, campos y botones |
| `--gris-300` | `#c9c9d3` | `#474747` | Bordes fuertes, campos deshabilitados |
| `--gris-500` | `#5c5c66` | `#a5a5a5` | Texto secundario, encabezados de columna |
| `--gris-700` | `#2e2e36` | `#d4d4d8` | Texto de las tablas |
| `--gris-900` | `#090909` | `#f7f9fa` | Texto principal, títulos, dato principal de la fila |

Un botón "oscuro" (fondo `--gris-900`, letra `--gris-0`) se invierte solo en
modo oscuro: queda claro con letra oscura.

### Estados

Cada estado tiene texto (`-700`), fondo (`-50`) y un punto o borde (`-500`), en
los dos modos.

| Estado | Cuándo |
|---|---|
| `ok` | Cumplido, activo, al día |
| `aviso` | Por vencer, clave temporal, en proceso |
| `error` | Rechazo del RNDC, vencido |
| `info` | Expedido o vigente, información |
| `neutro` | Anulado, inactivo |

Tonos de las pastillas y desgloses: `--morado-*`, `--turquesa-*`, `--rosa-*`
(también con `-700` y `-50`).

**Regla:** nunca solo color. Todo estado lleva también texto (la pastilla dice
"Cumplido", no solo es verde).

---

## 3b. Barra lateral, cabecera y movimiento

- **Barra lateral** (`componentes/Shell.tsx`): emblema de SOFI arriba y los
  grupos del menú (se abren y cierran con una
  animación; el de la pantalla actual siempre abierto). Cada pantalla es un
  botón grande en pastilla con su ícono; la actual va en violeta. "Contraer"
  la deja en solo íconos (círculos). Solo aparece lo que el rol puede ver.
- **Cabecera:** migas de pan (el grupo en pequeño y la pantalla como título),
  "Nuevo despacho" (en el celular se oculta: está en el menú), el reloj con las
  alertas de seguimiento recogidas (el número es el total; al hacer clic se
  despliega un botón por tipo), sol/luna, la campana y el menú del usuario.
- **Movimiento:** al cambiar de pantalla el contenido entra en cascada, de
  arriba abajo (`.pagina-entra`). Las animaciones son cortas (0,15 a 0,4 s) y
  quien pidió "reducir movimiento" en su equipo no las ve. Las ventanas y los
  filtros tienen su propia animación.

---

## 4. Forma

| Variable | Valor | Uso |
|---|---|---|
| `--radio-sm` | 8 px | Botones, campos, pestañas, botones de página |
| `--radio-md` | 12 px | Menús, tarjetas pequeñas |
| `--radio-lg` | 16 px | Paneles y ventanas |
| `--sombra-1` | muy suave | Paneles |
| `--sombra-2` | media | Ventanas y menús flotantes |

---

## 5. Tablas

Todo listado usa **`componentes/TablaDatos.tsx`** (como en Viajes, Plantillas y
Usuarios). Tiene, de arriba abajo:

1. **Pestañas de estado con contador.** Por ejemplo En curso, Con error,
   Cumplidos, Anulados, Todos. La activa va subrayada con `--marca-600`.
2. **Buscador**: busca en todas las columnas, sin importar tildes ni mayúsculas.
3. **Filtros**: un desplegable por cada columna marcada `filtrable`, con sus
   valores reales.
4. **Exportar**: descarga un CSV con lo filtrado, que abre bien en Excel.
5. **Encabezado ordenable**: un clic ordena ascendente, otro descendente, otro
   quita el orden.
6. **Páginas de 50 filas**, con "1–50 de 402" y los botones de página. Al
   cambiar de página vuelve al comienzo de la tabla.

Reglas:

- Texto de tabla a `--texto-sm` (13 px) y encabezados a `--texto-xs` en `--gris-500`.
- **El dato principal de la fila** (número de viaje, nombre) va en `--gris-900`
  y peso 600 (clase `principal`). El resto va en `--gris-700`.
- **Datos secundarios** debajo del principal: clase `dato-sec`, en `--texto-xs`.
- **Montos y cantidades** alineados a la derecha (`alinear: "derecha"`).
- **Códigos** (manifiesto, radicado) con la clase `codigo` (fuente mono).
- **Estados** con `<Pastilla tono="...">`, nunca con texto suelto de color.
- **Acciones** en la última columna. El primario (`btn-primary`) solo para la
  acción principal de la fila; las demás, secundarias.
- **Celular:** las tablas largas se desplazan dentro de su caja. Viajes se ve
  como tarjetas (`claseTabla="tabla-viajes"`).

---

### Tablas compactas (rediseño)

Todo esto lo hace `TablaDatos` sola; la pantalla solo afina con dos
propiedades de la columna:

- **Cabe en el ancho, sin barra de lado.** Si no cabe, se ocultan columnas
  desde la derecha hasta que quepa. Nunca se ocultan la(s) primera(s)
  columna(s), Estado, Remisión, Factura, Soportes ni los botones. Las ocultas
  se ven en el **panel de la fila** (clic en la fila, o el botón "⋯" si la
  fila ya abre otra cosa). El encabezado muestra cuántas hay ("+8").
- `prioridad`: 0 = nunca se oculta; mayor = se oculta antes. Con 50 o más
  tampoco sale en las tarjetas del celular.
- **"Columnas"** deja elegir qué ver; se recuerda por tabla en ese navegador.
- **Encabezado fijo** arriba y **barra de abajo fija** (páginas, totales,
  Cómoda / Compacta) mientras se ve la tabla.
- `sumar: "pesos" | "numero"`: la columna se suma (todo lo filtrado) en la
  barra de abajo.
- **Filtros:** el botón abre la ventana de la derecha (como siempre); los
  filtros puestos se ven encima de la tabla, cada uno con su ✕, y "Limpiar".
- **Celular:** cada fila es una tarjeta en dos columnas, con el nombre de
  cada dato arriba.
- **Cargando:** esqueleto gris que brilla (`Cargando` de `Estado.tsx`).
- Ningún contenedor de una tabla usa `overflow: hidden` (se usa `clip`):
  con `hidden` el encabezado deja de quedar fijo.

---

## 6. Botones

| Clase | Aspecto | Uso |
|---|---|---|
| `btn-primary` | Fondo `--marca-600`, texto blanco | La acción principal de la pantalla o fila. Una por bloque. |
| `btn-secondary` | Borde `--gris-200`, fondo blanco | Acciones secundarias |
| `boton-barra` | Sin borde, ícono + texto | Herramientas de tabla (Filtros, Exportar) |
| `btn-link` | Solo texto azul | Acciones menores dentro de un texto o fila |
| `btn-danger` | Rojo | Acciones que no se deshacen (Anular) |

---

## 7. Al hacer una pantalla nueva

- **Usa las variables de `tema.css`.** Si falta un color, se agrega allí con
  nombre y propósito, y también en esta guía.
- **Listados con `TablaDatos`.** No hagas una tabla a mano.
- **Escribe para quien despacha:** "Expedido" y no `CONFIRMADO`, "Error en
  remesa" y no `REMESA_ERROR`.
- **Revísala a 390 px de ancho.** No debe haber desplazamiento lateral de la página.
