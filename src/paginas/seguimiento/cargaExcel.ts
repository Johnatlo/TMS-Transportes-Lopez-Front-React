/**
 * Lectura de los Excel de la carga inicial: "Cartera Total" (facturas
 * pendientes con su valor por placa) y la hoja de anticipos de las EDS.
 *
 * leerHojas convierte el archivo en tablas de valores (con exceljs, cargado
 * solo cuando se usa); carteraDesdeFilas y anticiposDesdeFilas no dependen de
 * exceljs y se prueban aparte (cargaExcel.test.ts).
 */
import type { Row } from "exceljs";
import type { AnticipoImportado, FacturaImportada } from "../../api/cliente";
import { valorCelda } from "../cuadro/excelFacturacion";

/** Una hoja del libro como tabla de valores (fila 1 = indice 0). */
export interface HojaExcel {
  nombre: string;
  filas: unknown[][];
}

/** Lee todas las hojas del archivo. Las formulas llegan con su resultado. */
export async function leerHojas(archivo: File): Promise<HojaExcel[]> {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  return libro.worksheets.map((hoja) => {
    const filas: unknown[][] = [];
    hoja.eachRow({ includeEmpty: true }, (fila: Row, n: number) => {
      const valores: unknown[] = [];
      fila.eachCell({ includeEmpty: true }, (celda, col) => {
        valores[col - 1] = valorCelda(celda.value);
      });
      filas[n - 1] = valores;
    });
    return { nombre: hoja.name, filas: Array.from(filas, (f) => f ?? []) };
  });
}

/** Titulo de columna comparable: mayusculas, sin tildes, espacios simples. */
const titulo = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/** Fecha de una celda como "AAAA-MM-DD" (exceljs da Date en UTC); null si no es fecha. */
export function fechaCelda(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const t = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
}

/** Numero de una celda: acepta texto con comas de miles ("3,000,000.00 "). */
export function numeroCelda(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = String(v ?? "").replace(/[\s $]/g, "").replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Placa de un titulo de columna ("SWO-594" o "SWO594") sin guion; null si no es placa. */
const placaDe = (v: unknown) => {
  const t = titulo(v).replace(/[\s-]/g, "");
  return /^[A-Z]{3}\d{3}$/.test(t) ? t : null;
};

/** Busca la fila de titulos: la primera que tiene todas las columnas pedidas. */
function filaTitulos(filas: unknown[][], requeridos: string[]): number {
  return filas.findIndex((f) => {
    const t = f.map(titulo);
    return requeridos.every((r) => t.some((c) => c.startsWith(r)));
  });
}

/**
 * Facturas pendientes de la hoja "Cartera Total": una por fila con fecha y
 * numero de factura. Las columnas de placas (SWO-594, SRO-029...) traen el
 * valor de cada placa; "Valor Factura" es lo que debe el cliente (placas
 * menos su anticipo). Se ignoran las filas de totales por dueno y por placa.
 */
export function carteraDesdeFilas(filas: unknown[][]): FacturaImportada[] {
  const i = filaTitulos(filas, ["FECHA DE FACTURA", "N° FACTURA", "EMPRESA", "VALOR FACTURA"]);
  if (i < 0) throw new Error('No se encontro la fila de titulos de "Cartera Total" (Fecha de Factura, N° Factura, Empresa, Valor Factura).');
  const t = filas[i].map(titulo);
  const col = (nombre: string) => t.findIndex((c) => c.startsWith(nombre));
  const cFecha = col("FECHA DE FACTURA");
  const cVence = col("FECHA VENCIMIENTO");
  const cNumero = col("N° FACTURA");
  const cEmpresa = col("EMPRESA");
  const cValor = col("VALOR FACTURA");
  const placas = filas[i].map((v, c) => ({ c, placa: placaDe(v) })).filter((p): p is { c: number; placa: string } => !!p.placa);
  const facturas: FacturaImportada[] = [];
  for (const f of filas.slice(i + 1)) {
    const fecha = fechaCelda(f[cFecha]);
    const numero = String(f[cNumero] ?? "").trim();
    const valor = numeroCelda(f[cValor]);
    if (!fecha || !numero || valor === null) continue;
    facturas.push({
      numero,
      empresa: String(f[cEmpresa] ?? "").trim(),
      fecha,
      vence: cVence >= 0 ? fechaCelda(f[cVence]) : null,
      valor: Math.round(valor),
      placas: placas
        .map((p) => ({ placa: p.placa, valor: Math.round(numeroCelda(f[p.c]) ?? 0) }))
        .filter((p) => p.valor !== 0),
    });
  }
  return facturas;
}

/**
 * Anticipos de la hoja de las EDS: una fila por anticipo con fecha y placa.
 * Columnas por titulo: FECHA ANTICIPO, PLACA, EMPRESA PROV (cliente del
 * viaje), EFECTIVO, COMBUST., GALONES, DESC., EDS, N° FACTURA, FECHA FACTURA
 * y FECHA DE PAGO (a la bomba).
 */
export function anticiposDesdeFilas(filas: unknown[][]): AnticipoImportado[] {
  const i = filaTitulos(filas, ["FECHA ANTICIPO", "PLACA", "EFECTIVO", "COMBUST"]);
  if (i < 0) throw new Error('No se encontro la fila de titulos de los anticipos (FECHA ANTICIPO, PLACA, EFECTIVO, COMBUST.).');
  const t = filas[i].map(titulo);
  const col = (nombre: string) => t.findIndex((c) => c === nombre || c.startsWith(nombre));
  const c = {
    fecha: col("FECHA ANTICIPO"),
    placa: col("PLACA"),
    cliente: col("EMPRESA PROV"),
    efectivo: col("EFECTIVO"),
    combustible: col("COMBUST"),
    galones: col("GALONES"),
    descuento: col("DESC"),
    eds: col("EDS"),
    factura: col("N° FACTURA"),
    fechaFactura: col("FECHA FACTURA"),
    fechaPago: col("FECHA DE PAGO"),
  };
  const texto = (f: unknown[], k: number) => (k >= 0 ? String(f[k] ?? "").trim() : "");
  const anticipos: AnticipoImportado[] = [];
  filas.slice(i + 1).forEach((f, n) => {
    const fecha = fechaCelda(f[c.fecha]);
    const placa = texto(f, c.placa);
    if (!fecha || !placa) return;
    anticipos.push({
      fila: i + n + 2,
      fecha,
      placa,
      cliente: texto(f, c.cliente),
      efectivo: Math.round(numeroCelda(f[c.efectivo]) ?? 0),
      combustible: Math.round(numeroCelda(f[c.combustible]) ?? 0),
      galones: c.galones >= 0 ? numeroCelda(f[c.galones]) : null,
      descuento: Math.round((c.descuento >= 0 ? numeroCelda(f[c.descuento]) : 0) ?? 0),
      eds: texto(f, c.eds),
      facturaBomba: texto(f, c.factura) || null,
      fechaFacturaBomba: c.fechaFactura >= 0 ? fechaCelda(f[c.fechaFactura]) : null,
      fechaPago: c.fechaPago >= 0 ? fechaCelda(f[c.fechaPago]) : null,
    });
  });
  return anticipos;
}
