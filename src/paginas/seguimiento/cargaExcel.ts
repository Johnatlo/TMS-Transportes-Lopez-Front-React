/**
 * Lectura de los Excel de la carga inicial: "Cartera Total" (facturas
 * pendientes con su valor por placa), la hoja de anticipos de las EDS y los
 * nombres de los terceros de la "Matriz Terceros".
 *
 * leerHojas convierte el archivo en tablas de valores (con exceljs, cargado
 * solo cuando se usa); carteraDesdeFilas y anticiposDesdeFilas no dependen de
 * exceljs y se prueban aparte (cargaExcel.test.ts).
 */
import type { Row } from "exceljs";
import type { AnticipoImportado, FacturaImportada, NombreTerceroImportado } from "../../api/cliente";
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

/** Placas que aparecen en un texto ("UYX-813- ZAP-745" -> UYX813, ZAP745). */
const placasEn = (v: unknown) => [...titulo(v).matchAll(/\b([A-Z]{3})\s*-?\s*(\d{3})\b/g)].map((m) => m[1] + m[2]);

/**
 * Nombre del titular escrito en la matriz, sin la cedula que a veces lo
 * acompana: "JAMES C.C 80.163.499" -> "JAMES". Espacios simples.
 */
export function limpiarNombreTercero(v: unknown): string {
  return String(v ?? "")
    .replace(/\s+C\.?\s?C\.?(\s*[\d.]+)?\s*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/[\s-]+$/, "")
    .trim();
}

/**
 * Nombres de los terceros de la "Matriz Terceros" (una hoja por tercero). En
 * la fila 1 de cada hoja va el nombre, a veces la cedula ("CC 4.414.451" o un
 * numero) y la placa; las placas tambien salen del nombre de la hoja y de la
 * columna PLACA de los viajes. Las hojas repetidas ("(2)", "(3)") se juntan
 * por nombre. Se saltan las hojas sin nombre arriba (Empaques-Celso empieza
 * con los titulos).
 */
export function tercerosDesdeHojas(hojas: HojaExcel[]): NombreTerceroImportado[] {
  const porNombre = new Map<string, NombreTerceroImportado>();
  for (const hoja of hojas) {
    const arriba = (hoja.filas[0] ?? []).filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
    if (arriba.length === 0 || arriba.some((v) => titulo(v).startsWith("FECHA"))) continue;
    // El nombre es la primera celda con letras que no es solo placa ni solo cedula.
    const celdaNombre = arriba.find((v) => /[A-Z]{4}/i.test(String(v)) && placasEn(v).length === 0 && !/^\s*C\.?\s?C\b/i.test(String(v)));
    const nombre = limpiarNombreTercero(celdaNombre);
    if (!nombre) continue;
    let cedula: string | null = null;
    for (const v of arriba) {
      const m = typeof v === "number" ? String(v) : /C\.?\s?C\.?\s*([\d.]{6,})/i.exec(String(v))?.[1];
      if (m && m.replace(/\D/g, "").length >= 6) {
        cedula = m.replace(/\D/g, "");
        break;
      }
    }
    const placas = new Set<string>([...placasEn(hoja.nombre), ...arriba.flatMap(placasEn)]);
    const i = filaTitulos(hoja.filas, ["PLACA", "EMPRESA"]);
    if (i >= 0) {
      const c = hoja.filas[i].map(titulo).indexOf("PLACA");
      for (const f of hoja.filas.slice(i + 1)) placasEn(f[c]).forEach((p) => placas.add(p));
    }
    const previo = porNombre.get(nombre);
    if (previo) {
      placas.forEach((p) => previo.placas.includes(p) || previo.placas.push(p));
      previo.cedula ??= cedula;
    } else {
      porNombre.set(nombre, { nombre, cedula, placas: [...placas] });
    }
  }
  return [...porNombre.values()];
}
