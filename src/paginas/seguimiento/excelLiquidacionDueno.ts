/**
 * Excel de la liquidacion a un dueno, con el formato de docs/Liq duenos
 * ejemplo.xlsx: titulo "CUENTAS ... A ...", los viajes con sus 20 columnas, la
 * suma, los conceptos y el total. Los totales van con formula, y las cuentas
 * escritas en un concepto tambien, para poder ajustarlos en el Excel.
 *
 * exceljs se carga solo al descargar (import dinamico).
 */
import type { Cell, Worksheet } from "exceljs";
import type { ConceptoLiquidacion, LiquidacionDueno } from "../../api/cliente";
import { placaConGuion } from "../cuadro/facturacion";
import { limpiarExpresion, tituloCuenta } from "./liquidacionDuenos";

const BORDE = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
const MORADO = "FF9933FF";
const MONEDA = "#,##0";
const FECHA = "mm-dd-yy";
const LETRA = { name: "Arial Narrow", size: 10 };
/** Columna del saldo (R) y de la descripcion de los conceptos (K:Q). */
const SALDO = 18;
const CONCEPTO_DESDE = 11;
const CONCEPTO_HASTA = 17;

/** "2026-10-05" -> Date a mediodia local (que Excel no lo corra de dia). */
const fechaExcel = (f: string | null) => {
  if (!f) return null;
  const [a, m, d] = f.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d, 12);
};

/** Valor de un concepto: con la cuenta escrita como formula, si es una cuenta. */
function valorConcepto(c: ConceptoLiquidacion): Cell["value"] {
  const cuenta = limpiarExpresion(c.expresion);
  if (!cuenta || /^\d+(\.\d+)?$/.test(cuenta)) return c.valor;
  return { formula: c.valor < 0 ? `-(${cuenta})` : cuenta, result: c.valor };
}

/** Un renglon de conceptos: descripcion en K:Q y valor en R. */
function renglon(hoja: Worksheet, descripcion: string, valor: Cell["value"]) {
  const f = hoja.addRow([]);
  hoja.mergeCells(f.number, CONCEPTO_DESDE, f.number, CONCEPTO_HASTA);
  const d = f.getCell(CONCEPTO_DESDE);
  d.value = descripcion;
  d.font = LETRA;
  d.alignment = { horizontal: "left", vertical: "top", wrapText: true };
  d.border = BORDES;
  // Combinadas no crecen solas: una linea por cada 60 letras.
  f.height = Math.max(1, Math.ceil(descripcion.length / 60)) * 14;
  const v = f.getCell(SALDO);
  v.value = valor;
  v.font = { ...LETRA, bold: true };
  v.numFmt = MONEDA;
  v.alignment = { horizontal: "right", vertical: "top" };
  v.border = BORDES;
  return f;
}

/** Una suma sin borde, en la columna del saldo. */
function suma(hoja: Worksheet, formula: string, resultado: number) {
  const f = hoja.addRow([]);
  const c = f.getCell(SALDO);
  c.value = { formula, result: resultado };
  c.font = { ...LETRA, bold: true };
  c.numFmt = MONEDA;
  c.alignment = { horizontal: "right" };
  return f;
}

/** Arma y descarga el Excel de la liquidacion a un dueno. */
export async function descargarLiquidacionDueno(l: LiquidacionDueno): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  const [a, m, d] = l.fecha.split("-");
  const nombre = l.nombre.charAt(0).toUpperCase() + l.nombre.slice(1).toLowerCase();
  const hoja = libro.addWorksheet(`${nombre} ${d}-${m}-${a.slice(2)}`.slice(0, 31), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  hoja.columns = [9, 8, 18, 11, 9, 9, 10, 9, 8, 10, 9, 8, 8, 8, 8, 8, 10, 11, 9, 9].map((width) => ({ width }));

  const titulo = hoja.addRow([tituloCuenta(l.nombre, l.fecha)]);
  hoja.mergeCells(1, 1, 1, 20);
  titulo.getCell(1).font = { ...LETRA, bold: true };
  titulo.getCell(1).alignment = { horizontal: "center" };
  titulo.getCell(1).border = BORDES;

  const encabezado = hoja.addRow([
    "FECHA", "PLACA", "EMPRESA", "REMISIÓN", "N° FACT.", "FECHA FACTURA", "VALOR SALDO EMPRESA", "RETEF. RET.FOPAT", "RETE ICA", "ANTICIPO DE RENTA 3,5",
    "COMIS. BANCARIA", "CONT. SUPERT. 0,1201", "COMIS", "T. LOPEZ", "DESCARG. CAME", "PLANILLA- POLIZA RCE", "ANTICIPO", "SALDO CON DESCUENT.", "PAGO EMPRESA", `PAGO A ${l.nombre.toUpperCase()}`,
  ]);
  encabezado.height = 56;
  encabezado.eachCell((c: Cell) => {
    c.font = { ...LETRA, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    c.border = BORDES;
  });

  for (const v of l.filas) {
    const n = hoja.rowCount + 1;
    const f = hoja.addRow([
      fechaExcel(v.fecha), placaConGuion(v.placa), v.empresa, v.remision ?? v.manifiesto, v.facturaNumero, fechaExcel(v.facturaFecha), v.valorEmpresa, v.retencion, v.reteIca, v.anticipoRenta,
      v.bancaria, v.supertransporte, v.comision, v.tLopez, v.descargue, v.poliza, v.anticipo, { formula: `G${n}-SUM(H${n}:Q${n})`, result: v.saldo }, fechaExcel(v.fechaPagoEmpresa), fechaExcel(l.fecha),
    ]);
    f.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
      c.font = { ...LETRA, bold: col === SALDO };
      c.border = BORDES;
      if (col === 1 || col === 6 || col >= 19) c.numFmt = FECHA;
      if (col >= 7 && col <= SALDO) c.numFmt = MONEDA;
      if (col === SALDO) c.alignment = { horizontal: "center" };
    });
  }

  const primera = 3;
  const subtotal = suma(hoja, `SUM(R${primera}:R${hoja.rowCount})`, l.totalViajes).number;
  for (const c of l.conceptos) renglon(hoja, c.descripcion, valorConcepto(c));
  let total = subtotal;
  if (l.conceptos.length) total = suma(hoja, `SUM(R${subtotal}:R${hoja.rowCount})`, l.total).number;
  if (l.saldoPendiente) {
    const pagado = renglon(hoja, "VALOR PAGADO", l.pagado).number;
    renglon(hoja, "SALDO PENDIENTE", { formula: `R${total}-R${pagado}`, result: l.saldoPendiente });
  }

  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `cuentas-${l.nombre.split(" ")[0].toLowerCase()}-${l.fecha}.xlsx`;
  enlace.click();
  URL.revokeObjectURL(url);
}
