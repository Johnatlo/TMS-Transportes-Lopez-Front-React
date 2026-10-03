# Guía de interfaz — TMS Transportes López

Reglas globales de la interfaz: fuentes, colores, tablas y estados. Todo lo que
aquí se define vive en **`src/tema.css`**. Cualquier pantalla nueva usa esas
variables y nunca escribe un color o un tamaño a mano.

---

## 1. Identidad

- **Sobria y operativa.** Es una herramienta de trabajo diario: primero se lee
  el dato, después la decoración.
- **El azul del logo es el color de la marca.** Se usa para lo que se puede
  hacer (botones primarios, enlaces, pestaña activa, página actual) y nada más.
- **Fondo gris muy claro, tarjetas blancas.** Los bordes son finos y las sombras
  casi imperceptibles.
- **El color comunica estado.** Verde, ámbar y rojo solo aparecen cuando dicen
  algo: cumplido, por vencer, error.

---

## 2. Fuentes

| Uso | Fuente | Variable |
|---|---|---|
| Toda la interfaz | **Plus Jakarta Sans** (400, 500, 600, 700) | `--fuente-ui` |
| Códigos y radicados (manifiesto, remesa, NIT, etiquetas del RNDC) | **JetBrains Mono** (400, 500) | `--fuente-codigo` |

Se cargan desde Google Fonts en `index.html`. Si no cargan (sin internet), cae a
Segoe UI y Consolas, que tienen medidas parecidas.

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

### Marca (azul del logo)

| Variable | Color | Uso |
|---|---|---|
| `--marca-50` | `#eef4ff` | Fondo de elemento seleccionado, hover de fila clicable |
| `--marca-100` | `#dce8fd` | Bordes sobre fondo de marca |
| `--marca-200` | `#b9d1fa` | Foco de campos |
| `--marca-400` | `#4f8de6` | Gráficas (serie secundaria) |
| `--marca-500` | `#2b6fd6` | Gráficas (serie principal), íconos activos |
| **`--marca-600`** | **`#1a56c2`** | **Primario**: botones, enlaces, pestaña activa, página actual |
| `--marca-700` | `#154397` | Hover del primario, texto sobre `--marca-50` |
| `--marca-900` | `#0d2654` | Texto fuerte sobre fondos de marca |
| `--cielo-400` | `#5aa9e6` | Acento secundario (curvas del logo); uso escaso |

### Neutros

| Variable | Color | Uso |
|---|---|---|
| `--gris-0` | `#ffffff` | Tarjetas, tablas, ventanas |
| `--gris-25` | `#fbfcfe` | Hover de fila, barra de filtros |
| `--gris-50` | `#f5f7fa` | **Fondo de la aplicación**, encabezado de tabla |
| `--gris-100` | `#eef1f5` | Líneas entre filas, contadores |
| `--gris-200` | `#e3e7ee` | Bordes de tarjetas, campos y botones |
| `--gris-300` | `#cdd4df` | Bordes de campos deshabilitados |
| `--gris-500` | `#6b7486` | Texto secundario, encabezados de columna |
| `--gris-700` | `#374151` | Texto de las tablas |
| `--gris-900` | `#111827` | Texto principal, títulos, dato principal de la fila |

### Estados

Cada estado tiene texto (`-700`), fondo (`-50`) y un punto o borde (`-500`).

| Estado | Texto | Fondo | Punto | Cuándo |
|---|---|---|---|---|
| `ok` | `#11734f` | `#e8f6ef` | `#19a46c` | Cumplido, activo, al día |
| `aviso` | `#a8590a` | `#fdf4e4` | `#f0a020` | Por vencer, clave temporal, en proceso |
| `error` | `#c0262d` | `#fdeced` | `#e5484d` | Rechazo del RNDC, vencido |
| `info` | `#154397` | `#eef4ff` | `#2b6fd6` | Expedido o vigente, información |
| `neutro` | `#4b5563` | `#f1f3f6` | `#9aa3b2` | Anulado, inactivo |

**Regla:** nunca solo color. Todo estado lleva también texto (la pastilla dice
"Cumplido", no solo es verde).

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
