/**
 * Excel "VALES" del pago a la bomba (igual a docs/Vales Coesco EJEMPLO.pdf):
 * lo que la gerente arma cada quincena para pagarle a la bomba.
 *
 * - Membrete de la empresa (logo, nombre, VALES, las estaciones, NIT,
 *   version, numero y fecha).
 * - Una fila por anticipo de las facturas de la quincena con lo que cobro la
 *   bomba: fecha, placa, efectivo, combustible, descuento, total, EDS, factura,
 *   fecha y vencimiento de la factura, empresa del vehiculo y fechas de pago.
 * - Totales, los abonos de los socios restados y el valor a pagar.
 *
 * filasVales y resumenPago no dependen de exceljs y se prueban aparte
 * (excelVales.test.ts); exceljs se carga solo al descargar.
 */
import type { Cell, Worksheet } from "exceljs";
import type { AbonoSocio, AnticipoBomba, RelacionBomba } from "../../api/cliente";
import { placaConGuion } from "./facturacion";
import logoUrl from "../../assets/logo-empresa.png";

/** Una fila del Excel: un anticipo (tramo) de una factura de la bomba. */
export interface FilaVale {
  fecha: string;
  placa: string;
  efectivo: number;
  combustible: number;
  descuento: number;
  total: number;
  eds: string;
  factura: string;
  fechaFactura: string;
  venceFactura: string | null;
  /** LOPEZ, M&C o TERCERO. */
  empresaVehiculo: string;
  fechaPago: string | null;
}

/** "LOPEZ", "M&C" o "TERCERO" (como en el Excel de anticipos). */
const flotaTexto = (f: string | null) => (f === "LOPEZ" ? "LOPEZ" : f === "MYC" ? "M&C" : f === "TERCERO" ? "TERCERO" : "");

/**
 * Filas del Excel con lo que cobro la bomba en cada factura: una por tanqueo
 * (tramo) y factura, con el efectivo y el combustible de sus vales; los vales
 * sin tanqueo en el TMS salen solos. Por fecha y placa.
 */
export function filasVales(relaciones: RelacionBomba[], tramos: AnticipoBomba[], fechaPago: string | null): FilaVale[] {
  const porId = new Map(tramos.map((t) => [t.id, t]));
  const filas: FilaVale[] = [];
  for (const r of relaciones) {
    const grupos = new Map<string, RelacionBomba["vales"]>();
    for (const v of r.vales) {
      const clave = v.tramoId ? `t${v.tramoId}` : `v${v.id}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), v]);
    }
    for (const vales of grupos.values()) {
      const t = vales[0].tramoId ? porId.get(vales[0].tramoId) : undefined;
      const efectivo = vales.filter((v) => v.tipo === "EFECTIVO").reduce((s, v) => s + v.valor, 0);
      const combustible = vales.filter((v) => v.tipo !== "EFECTIVO").reduce((s, v) => s + v.valor, 0);
      filas.push({
        fecha: t?.fecha ?? vales[0].fecha,
        placa: placaConGuion(t?.placa ?? vales[0].placa),
        efectivo,
        combustible,
        descuento: 0,
        total: efectivo + combustible,
        eds: t?.bomba ?? vales[0].eds.replace(/^EDS\s+/i, ""),
        factura: r.numero,
        fechaFactura: r.fecha,
        venceFactura: r.fechaVencimiento,
        empresaVehiculo: flotaTexto(t?.flota ?? null),
        fechaPago: fechaPago ?? r.fechaPago,
      });
    }
  }
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.placa.localeCompare(b.placa));
}

/** Totales del pago: lo de las facturas, los abonos de los socios y lo que queda por pagar. */
export function resumenPago(filas: FilaVale[], abonos: Pick<AbonoSocio, "valor">[]) {
  const efectivo = filas.reduce((s, f) => s + f.efectivo, 0);
  const combustible = filas.reduce((s, f) => s + f.combustible, 0);
  const total = filas.reduce((s, f) => s + f.total, 0);
  const totalAbonos = abonos.reduce((s, a) => s + a.valor, 0);
  return { efectivo, combustible, total, totalAbonos, aPagar: Math.max(0, total - totalAbonos) };
}

/** Membrete de la empresa (como el del ejemplo). */
const MEMBRETE = {
  empresa: "TRANSPORTES LOPEZ C SAS",
  nit: "901.319.583-1",
  version: "1.0",
  pie: ["601) 9029828 - 3163972530 – 3176428363", "CL 46 #1-31 Este", "transporteslopezcsas@gmail.com"],
};

const COLUMNAS: Array<{ titulo: string; ancho: number }> = [
  { titulo: "FECHA ANTICIPO", ancho: 12 },
  { titulo: "PLACA", ancho: 10 },
  { titulo: "EFECTIVO", ancho: 13 },
  { titulo: "COMBUST.", ancho: 13 },
  { titulo: "DESC.", ancho: 7 },
  { titulo: "VALOR TOTAL", ancho: 13 },
  { titulo: "EDS", ancho: 13 },
  { titulo: "N° FACTURA", ancho: 13 },
  { titulo: "FECHA FACTURA", ancho: 12 },
  { titulo: "FECHA VENC FACTURA", ancho: 12 },
  { titulo: "EMPRESA DEL VEHICULO", ancho: 11 },
  { titulo: "FECHA DE PAGO EFECTIVO", ancho: 12 },
  { titulo: "FECHA DE PAGO COMBUST.", ancho: 12 },
];

const BORDE = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
/** Azul del membrete y de los titulos del ejemplo. */
const AZUL = "FF9BC2E6";
const AZUL_CLARO = "FFDDEBF7";
const MONEDA = "#,##0";
const FECHA = "d/mm/yyyy";

/** "2026-10-05" -> Date a mediodia local (que Excel no lo corra de dia). */
const fechaExcel = (f: string | null) => {
  if (!f) return null;
  const [a, m, d] = f.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d, 12);
};

/** El logo de la empresa como data URL (para meterlo en el Excel). */
async function logoBase64(): Promise<string | null> {
  try {
    const blob = await (await fetch(logoUrl)).blob();
    return await new Promise((listo) => {
      const lector = new FileReader();
      lector.onload = () => listo(String(lector.result));
      lector.onerror = () => listo(null);
      lector.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Membrete: logo, nombre, VALES, estaciones, NIT, version, numero y fecha. */
async function membrete(hoja: Worksheet, libro: import("exceljs").Workbook, d: DatosVales) {
  hoja.mergeCells("A1:B2");
  hoja.mergeCells("C1:M1");
  hoja.mergeCells("C2:F2");
  hoja.mergeCells("G2:H2");
  hoja.mergeCells("I2:M2");
  const titulo = hoja.getCell("C1");
  titulo.value = `${MEMBRETE.empresa}\nVALES\n${d.estaciones.join(" - ")}`;
  titulo.font = { bold: true, size: 11 };
  titulo.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  const datos: Array<[string, string]> = [
    ["C2", `NIT: ${MEMBRETE.nit}`],
    ["G2", `VERSION: ${MEMBRETE.version}`],
    ["I2", `${d.numero ? `No.: ${d.numero}\n` : ""}FECHA: ${d.fecha.split("-").reverse().join("/")}`],
  ];
  for (const [ref, texto] of datos) {
    const c = hoja.getCell(ref);
    c.value = texto;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_CLARO } };
  }
  for (const ref of ["A1", "C1", "C2", "G2", "I2"]) hoja.getCell(ref).border = BORDES;
  hoja.getRow(1).height = 48;
  hoja.getRow(2).height = 32;
  const logo = await logoBase64();
  if (logo) {
    const id = libro.addImage({ base64: logo, extension: "png" });
    hoja.addImage(id, { tl: { col: 0.2, row: 0.2 }, ext: { width: 150, height: 60 } });
  }
}

/** Lo que va en el Excel. */
export interface DatosVales {
  /** Numero del pago (consecutivo); null si aun no se registra. */
  numero: number | null;
  /** Fecha del reporte "AAAA-MM-DD". */
  fecha: string;
  /** Estaciones de las facturas ("COESCO - CHUSACA - RETORNO - SAN ESTEBAN"). */
  estaciones: string[];
  filas: FilaVale[];
  /** Abonos de los socios que se descuentan ("Reciclajes 28/09/2026", valor). */
  abonos: Array<{ etiqueta: string; valor: number }>;
}

/** Arma y descarga el Excel VALES del pago a la bomba. */
export async function descargarVales(d: DatosVales, nombreArchivo: string): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("VALES", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  hoja.columns = COLUMNAS.map((c) => ({ width: c.ancho }));
  await membrete(hoja, libro, d);

  hoja.addRow([]);
  const titulos = hoja.addRow(COLUMNAS.map((c) => c.titulo));
  titulos.height = 42;
  titulos.eachCell((c: Cell) => {
    c.font = { bold: true, size: 9 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = BORDES;
  });
  // Al imprimir, los titulos se repiten en cada hoja.
  hoja.pageSetup.printTitlesRow = `${titulos.number}:${titulos.number}`;

  for (const f of d.filas) {
    const fila = hoja.addRow([
      fechaExcel(f.fecha),
      f.placa,
      f.efectivo,
      f.combustible,
      f.descuento,
      f.total,
      f.eds,
      f.factura,
      fechaExcel(f.fechaFactura),
      fechaExcel(f.venceFactura),
      f.empresaVehiculo,
      fechaExcel(f.fechaPago),
      fechaExcel(f.fechaPago),
    ]);
    fila.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
      c.border = BORDES;
      c.font = { size: 9, bold: [6, 7, 9, 10, 11, 12, 13].includes(col) };
      if ([3, 4, 5, 6].includes(col)) c.numFmt = MONEDA;
      if ([1, 9, 10, 12, 13].includes(col)) c.numFmt = FECHA;
      if ([7, 11].includes(col)) c.alignment = { horizontal: "center" };
    });
  }

  const r = resumenPago(d.filas, d.abonos);
  hoja.addRow([]);
  const totales = hoja.addRow([null, null, r.efectivo, r.combustible, null, r.total]);
  for (const col of [3, 4, 6]) {
    const c = totales.getCell(col);
    c.numFmt = MONEDA;
    c.font = { bold: true, size: 9 };
    c.border = BORDES;
  }

  // Abonos de los socios restados y lo que queda por pagar.
  if (d.abonos.length) {
    hoja.addRow([]);
    for (const a of d.abonos) {
      const fila = hoja.addRow([]);
      hoja.mergeCells(fila.number, 2, fila.number, 5);
      fila.getCell(2).value = a.etiqueta;
      fila.getCell(2).font = { bold: true, size: 9 };
      fila.getCell(6).value = -a.valor;
      fila.getCell(6).numFmt = MONEDA;
      fila.getCell(6).font = { bold: true, size: 9 };
      for (const col of [2, 6]) fila.getCell(col).border = BORDES;
    }
  }
  const final = hoja.addRow([]);
  hoja.mergeCells(final.number, 2, final.number, 5);
  final.getCell(2).value = "VALOR A PAGAR";
  final.getCell(6).value = r.aPagar;
  for (const col of [2, 6]) {
    final.getCell(col).font = { bold: true, size: 10 };
    final.getCell(col).border = BORDES;
  }
  final.getCell(6).numFmt = MONEDA;
  final.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF92D050" } };

  hoja.addRow([]);
  for (const linea of MEMBRETE.pie) hoja.addRow([linea]).getCell(1).font = { size: 8 };

  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
