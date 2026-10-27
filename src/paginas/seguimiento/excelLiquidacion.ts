/**
 * Excel de la liquidacion del pago a un tercero, con el formato de
 * docs/Liq Viaje Pago ejemplo.xlsx: fecha y placa arriba, los viajes, los
 * DESCUENTOS, los AVANCES DEL VEHICULO y el flete total. Los totales van con
 * formula (como en el ejemplo) para que se puedan ajustar en el Excel.
 *
 * exceljs se carga solo al descargar (import dinamico).
 */
import type { Cell, Worksheet } from "exceljs";
import type { Liquidacion, RenglonLiquidacion } from "./liquidacionPago";
import { placaConGuion } from "../cuadro/facturacion";

const BORDE = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
const AZUL = "FFB4C6E7";
const MONEDA = "#,##0";
const FECHA = "d/mm/yyyy";

/** "2026-10-05" -> Date a mediodia local (que Excel no lo corra de dia). */
const fechaExcel = (f: string) => {
  const [a, m, d] = f.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d, 12);
};

/** Titulo de una seccion (DESCUENTOS, AVANCES DEL VEHICULO) y su encabezado Descripcion / Valor. */
function seccion(hoja: Worksheet, nombre: string) {
  const t = hoja.addRow([]);
  hoja.mergeCells(t.number, 2, t.number, 8);
  t.getCell(2).value = nombre;
  t.getCell(2).font = { bold: true };
  t.getCell(2).alignment = { horizontal: "center" };
  t.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  t.getCell(2).border = BORDES;
  renglon(hoja, "Descripcion", "Valor", true);
}

/** Un renglon "descripcion | valor" (B:F y G:H unidas). Devuelve la fila. */
function renglon(hoja: Worksheet, descripcion: string, valor: Cell["value"], negrita = false) {
  const f = hoja.addRow([]);
  hoja.mergeCells(f.number, 2, f.number, 6);
  hoja.mergeCells(f.number, 7, f.number, 8);
  f.getCell(2).value = descripcion;
  f.getCell(7).value = valor;
  for (const col of [2, 7]) {
    const c = f.getCell(col);
    c.border = BORDES;
    c.font = { bold: negrita };
  }
  f.getCell(7).numFmt = MONEDA;
  f.getCell(7).alignment = { horizontal: negrita ? "center" : "right" };
  return f;
}

/** Celdas de valor (columna G) de unos renglones, para las formulas. */
function agregarRenglones(hoja: Worksheet, renglones: RenglonLiquidacion[]): string[] {
  return renglones.map((r) => `G${renglon(hoja, r.descripcion, r.valor).number}`);
}

/** Arma y descarga el Excel de la liquidacion. */
export async function descargarLiquidacion(l: Liquidacion, nombreArchivo: string): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Liquidacion", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  hoja.columns = [3, 12, 13, 12, 28, 9, 12, 15].map((width) => ({ width }));

  // Encabezado: fecha, placa y tercero.
  hoja.addRow([]);
  const r2 = hoja.addRow([null, "FECHA:", fechaExcel(l.fecha), null, null, null, "Placa:", l.placas.map(placaConGuion).join(", ")]);
  r2.getCell(3).numFmt = FECHA;
  const r3 = hoja.addRow([null, "Tercero:", l.tercero]);
  for (const f of [r2, r3]) for (const col of [2, 7]) f.getCell(col).font = { bold: true };
  hoja.addRow([]);
  hoja.addRow([]);

  // Viajes.
  const titulos = hoja.addRow([null, "Factura", "Remision", "Fecha", "Empresa", "Ton", "VL Ton", "Total"]);
  titulos.eachCell((c: Cell, col: number) => {
    if (col < 2) return;
    c.font = { bold: true };
    c.alignment = { horizontal: "center" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.border = BORDES;
  });
  const celdasTotal: string[] = [];
  for (const v of l.filas) {
    const n = hoja.rowCount + 1;
    // Con valor por tonelada el total es Ton x VL Ton (formula); con valor fijo, el valor.
    const total = v.valorTon !== null && v.toneladas !== null ? { formula: `F${n}*G${n}`, result: v.total } : v.total;
    const f = hoja.addRow([null, v.factura, v.remision, fechaExcel(v.fecha), v.empresa, v.toneladas, v.valorTon, total]);
    f.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
      if (col < 2) return;
      c.border = BORDES;
      if (col === 4) c.numFmt = FECHA;
      if (col === 6) c.numFmt = "0.000";
      if (col === 7 || col === 8) c.numFmt = MONEDA;
    });
    celdasTotal.push(`H${n}`);
  }
  const sumaViajes = celdasTotal.length ? celdasTotal.join("+") : "0";
  hoja.addRow([]);

  // Descuentos y avances.
  seccion(hoja, "DESCUENTOS");
  const celdasDescuentos = agregarRenglones(hoja, l.descuentos);
  if (!l.descuentos.length) renglon(hoja, "Sin retenciones (no se descuentan)", 0);
  hoja.addRow([]);
  seccion(hoja, "AVANCES DEL VEHICULO");
  const celdasAvances = agregarRenglones(hoja, l.avances);
  if (!l.avances.length) renglon(hoja, "Sin anticipos", 0);
  hoja.addRow([]);

  const restas = [...celdasDescuentos, ...celdasAvances].map((c) => `-${c}`).join("");
  const final = renglon(hoja, "Flete total", { formula: `${sumaViajes}${restas}`, result: l.fleteTotal }, true);
  final.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF92D050" } };

  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
