/**
 * Excel de cualquier tabla del sistema (el boton "Exportar" de TablaDatos),
 * con el mismo estilo que el de Rentabilidad: encabezado azul con filtro y
 * congelado, pesos con separador de miles, fechas como fecha de Excel y una
 * fila de totales en las columnas de numeros.
 *
 * columnaExcel y tipoDe no dependen de exceljs y se prueban aparte
 * (excelTabla.test.ts); exceljs se carga solo al descargar.
 */
import type { Cell } from "exceljs";

/** Una columna lista para el Excel: su titulo, sus valores y si va a la derecha (montos). */
export interface ColumnaTabla {
  titulo: string;
  valores: Array<string | number | null | undefined>;
  derecha?: boolean;
}

/** Como se escribe una columna: texto, fecha, pesos (con total) o numero (con decimales y total). */
export type TipoColumna = "texto" | "fecha" | "pesos" | "numero";

const AZUL = "FFB4C6E7";
const BORDE = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
const FECHA = /^\d{4}-\d{2}-\d{2}(T|$)/;

/**
 * Tipo de una columna por sus valores: numeros -> pesos si son enteros y la
 * columna va a la derecha (montos), si no numero; "2026-10-05" -> fecha; lo
 * demas, texto. Las vacias no cuentan.
 */
export function tipoDe(c: ColumnaTabla): TipoColumna {
  const llenos = c.valores.filter((v) => v !== null && v !== undefined && v !== "");
  if (!llenos.length) return "texto";
  if (llenos.every((v) => typeof v === "number")) {
    return c.derecha && llenos.every((v) => Number.isInteger(v)) ? "pesos" : "numero";
  }
  if (llenos.every((v) => typeof v === "string" && FECHA.test(v))) return "fecha";
  return "texto";
}

/** "2026-10-05" (o con hora) -> Date a mediodia local, para que Excel no la corra de dia. */
const fechaExcel = (f: string) => {
  const [a, m, d] = f.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d, 12);
};

/** Valor de una celda segun el tipo de su columna. */
export function valorCelda(v: string | number | null | undefined, tipo: TipoColumna): string | number | Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (tipo === "fecha" && typeof v === "string") return fechaExcel(v);
  return v;
}

/** Letra de la columna n (1 = A, 27 = AA). */
const letra = (n: number): string => (n <= 26 ? String.fromCharCode(64 + n) : letra(Math.floor((n - 1) / 26)) + letra(((n - 1) % 26) + 1));

/** Arma y descarga el Excel: una hoja con las filas que se pasan (las que estan en pantalla con los filtros). */
export async function descargarTabla(columnas: ColumnaTabla[], nombreHoja: string, nombreArchivo: string): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet((nombreHoja || "Datos").replace(/[\\/*?:[\]]/g, " ").slice(0, 31), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const tipos = columnas.map(tipoDe);
  const filas = columnas[0]?.valores.length ?? 0;
  // Ancho por el texto mas largo de la columna (entre 10 y 45).
  hoja.columns = columnas.map((c, i) => {
    const largo = Math.max(c.titulo.length, ...c.valores.map((v) => (v === null || v === undefined ? 0 : String(v).length)));
    return { width: tipos[i] === "fecha" ? 12 : tipos[i] === "pesos" ? Math.max(14, Math.min(largo + 4, 20)) : Math.max(10, Math.min(largo + 2, 45)) };
  });

  const titulos = hoja.addRow(columnas.map((c) => c.titulo));
  titulos.height = 32;
  titulos.eachCell((c: Cell) => {
    c.font = { bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.border = BORDES;
  });
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };

  for (let r = 0; r < filas; r++) {
    const fila = hoja.addRow(columnas.map((c, i) => valorCelda(c.valores[r], tipos[i])));
    fila.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
      c.border = BORDES;
      c.font = { size: 10 };
      const tipo = tipos[col - 1];
      if (tipo === "fecha") c.numFmt = "dd/mm/yyyy";
      if (tipo === "pesos") c.numFmt = "#,##0";
      if (tipo === "numero") c.numFmt = "#,##0.###";
    });
  }

  // Totales de las columnas de numeros, con formula.
  if (filas > 0 && tipos.some((t) => t === "pesos" || t === "numero")) {
    const ultima = filas + 1;
    const total = hoja.addRow(
      columnas.map((c, i) => {
        const tipo = tipos[i];
        if (i === 0 && tipo === "texto") return "TOTAL";
        if (tipo !== "pesos" && tipo !== "numero") return null;
        const suma = c.valores.reduce<number>((s, v) => s + (typeof v === "number" ? v : 0), 0);
        return { formula: `SUBTOTAL(9,${letra(i + 1)}2:${letra(i + 1)}${ultima})`, result: suma };
      })
    );
    total.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
      c.font = { bold: true, size: 10 };
      c.border = BORDES;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
      const tipo = tipos[col - 1];
      if (tipo === "pesos") c.numFmt = "#,##0";
      if (tipo === "numero") c.numFmt = "#,##0.###";
    });
  }

  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
