/**
 * Excel del envio a facturacion (igual a docs/EJEMPLO CUADRO ENVIO DE
 * FACTURACION.png) y lectura del Excel de la matriz de fletes.
 *
 * exceljs se carga solo cuando se usa (import dinamico): es pesado y la
 * mayoria de las pantallas no lo necesitan.
 */
import type { Cell, Row, Worksheet } from "exceljs";
import type { FilaEnvio, FilaMatrizCruda } from "./facturacion";
import { placaConGuion, totalDe } from "./facturacion";

/** Columnas del cuadro, en el orden del ejemplo, con su ancho. */
const COLUMNAS: Array<{ titulo: string; ancho: number }> = [
  { titulo: "NOTA FACTURA", ancho: 30 },
  { titulo: "RAZON SOCIAL", ancho: 15 },
  { titulo: "FECHA", ancho: 14 },
  { titulo: "REMISION/TRANSPORTE", ancho: 14 },
  { titulo: "PESO", ancho: 14 },
  { titulo: "PLACA", ancho: 14 },
  { titulo: "CONDUCTOR", ancho: 14 },
  { titulo: "VALOR TON", ancho: 14 },
  { titulo: "TOTAL", ancho: 14 },
  { titulo: "FACTURA", ancho: 14 },
  { titulo: "N° REMESA", ancho: 14 },
  { titulo: "N° RADICADO", ancho: 14 },
];

const BORDE = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
/** Azul claro del encabezado del ejemplo. */
const AZUL = "FFB4C6E7";

/** "2026-10-05" -> Date a mediodia local (que Excel no lo corra de dia). */
const fechaExcel = (f: string) => {
  const [a, m, d] = f.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d, 12);
};

/** Remision como numero si es solo digitos (como en el ejemplo); si no, texto. */
const remisionExcel = (r: string) => (/^\d{1,15}$/.test(r.trim()) ? Number(r.trim()) : r.trim());

/** Pinta el encabezado de un bloque (fondo azul, negrita, centrado). */
function encabezado(hoja: Worksheet): Row {
  const fila = hoja.addRow(COLUMNAS.map((c) => c.titulo));
  fila.height = 30;
  fila.eachCell((celda: Cell) => {
    celda.font = { bold: true };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    celda.border = BORDES;
  });
  return fila;
}

/** Agrega un viaje al bloque con los formatos de cada columna. */
function viaje(hoja: Worksheet, e: FilaEnvio): Row {
  const total = totalDe(e);
  const fila = hoja.addRow([
    e.notaFactura,
    e.razonSocial,
    fechaExcel(e.fila.fecha),
    remisionExcel(e.remision),
    e.pesoFacturadoKg === null ? null : e.pesoFacturadoKg / 1000,
    placaConGuion(e.fila.placa),
    e.fila.conductor ?? "",
    e.tipo === "TON" ? e.valorTon : null,
    total,
    e.facturaNumero,
    e.fila.remesa ?? "",
    e.fila.radicadoRemesa ? (/^\d+$/.test(e.fila.radicadoRemesa) ? Number(e.fila.radicadoRemesa) : e.fila.radicadoRemesa) : "",
  ]);
  fila.eachCell({ includeEmpty: true }, (celda: Cell, col: number) => {
    celda.border = BORDES;
    const centrado = col <= 1 || (col >= 3 && col <= 6);
    celda.alignment = { horizontal: centrado ? "center" : "left", vertical: "middle", wrapText: true };
  });
  fila.getCell(3).numFmt = "m/d/yyyy";
  fila.getCell(5).numFmt = "0.000";
  fila.getCell(8).numFmt = "#,##0";
  fila.getCell(9).numFmt = "#,##0";
  // N° de remesa como texto: conserva los ceros a la izquierda (00006778).
  fila.getCell(11).numFmt = "@";
  return fila;
}

/**
 * Arma el Excel del envio: un bloque por factura (encabezado azul y sus
 * viajes), separados por una fila vacia, como el ejemplo. Lo descarga.
 */
export async function descargarCuadroEnvio(bloques: FilaEnvio[][], nombreArchivo: string): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Envio facturacion");
  hoja.columns = COLUMNAS.map((c) => ({ width: c.ancho }));
  bloques.forEach((bloque, i) => {
    if (i > 0) hoja.addRow([]);
    encabezado(hoja);
    for (const e of bloque) viaje(hoja, e);
  });
  const datos = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([datos], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  );
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Valor de una celda de exceljs: el resultado si es formula, el texto si es enriquecido. */
export function valorCelda(v: unknown): unknown {
  if (v && typeof v === "object") {
    const o = v as { result?: unknown; richText?: Array<{ text: string }>; text?: unknown };
    if ("result" in o) return o.result;
    if (o.richText) return o.richText.map((t) => t.text).join("");
    if ("text" in o) return o.text;
  }
  return v;
}

/**
 * Lee el Excel "MATRIZ FLETES": busca la fila de titulos (EMPRESA, RAZON
 * SOCIAL, VALOR, TIPO, OBSERVACIONES) y devuelve las filas de abajo.
 * Lanza Error si el archivo no tiene esa forma.
 */
export async function leerMatrizFletes(archivo: File): Promise<FilaMatrizCruda[]> {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  const hoja = libro.worksheets[0];
  if (!hoja) throw new Error("El archivo no tiene hojas.");
  let inicio = 0;
  hoja.eachRow((fila: Row, n: number) => {
    if (inicio) return;
    const a = String(valorCelda(fila.getCell(1).value) ?? "").trim().toUpperCase();
    const b = String(valorCelda(fila.getCell(2).value) ?? "").trim().toUpperCase();
    if (a === "EMPRESA" && b.startsWith("RAZON")) inicio = n;
  });
  if (!inicio) throw new Error('No se encontro la fila de titulos "EMPRESA | RAZON SOCIAL | VALOR | TIPO | OBSERVACIONES".');
  const filas: FilaMatrizCruda[] = [];
  hoja.eachRow((fila: Row, n: number) => {
    if (n <= inicio) return;
    filas.push({
      nombre: valorCelda(fila.getCell(1).value),
      razonSocial: valorCelda(fila.getCell(2).value),
      valor: valorCelda(fila.getCell(3).value),
      tipo: valorCelda(fila.getCell(4).value),
      observaciones: valorCelda(fila.getCell(5).value),
    });
  });
  return filas;
}
