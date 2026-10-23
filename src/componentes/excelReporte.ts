/**
 * Excel de un reporte (estado de cuenta, totales por mes...): una hoja por
 * tabla, con titulo, periodo, encabezados en azul, valores con su formato
 * (pesos, fechas) y fila de totales. Es generico: lo usan los reportes de
 * cualquier cuadro. exceljs se carga solo al descargar.
 */
import type { Cell } from "exceljs";

/** Una columna de una hoja del reporte. */
export interface ColumnaReporte {
  titulo: string;
  ancho?: number;
  /** pesos: "#,##0"; fecha: "AAAA-MM-DD" se escribe como fecha de Excel. */
  formato?: "texto" | "pesos" | "fecha" | "numero";
}

/** Una hoja: una tabla con sus columnas, filas y, si se quiere, totales. */
export interface HojaReporte {
  nombre: string;
  columnas: ColumnaReporte[];
  filas: Array<Array<string | number | null>>;
  totales?: Array<string | number | null>;
}

const AZUL = "FF9BC2E6";
const BORDE = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };

/** "2026-10-05" -> Date a mediodia local (que Excel no lo corra de dia). */
const fechaExcel = (f: string) => {
  const [a, m, d] = f.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d, 12);
};

/** Arma y descarga el Excel del reporte. */
export async function descargarReporte(
  d: { titulo: string; subtitulo: string; hojas: HojaReporte[] },
  nombreArchivo: string
): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  for (const h of d.hojas) {
    const hoja = libro.addWorksheet(h.nombre.slice(0, 31), { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    hoja.columns = h.columnas.map((c) => ({ width: c.ancho ?? (c.formato === "pesos" ? 16 : c.formato === "fecha" ? 12 : 18) }));
    const t = hoja.addRow([d.titulo]);
    t.getCell(1).font = { bold: true, size: 13 };
    hoja.addRow([d.subtitulo]).getCell(1).font = { size: 10, italic: true };
    hoja.addRow([]);
    const enc = hoja.addRow(h.columnas.map((c) => c.titulo));
    enc.eachCell((c: Cell) => {
      c.font = { bold: true, size: 10 };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = BORDES;
    });
    enc.height = 30;
    hoja.pageSetup.printTitlesRow = `${enc.number}:${enc.number}`;
    const escribir = (valores: Array<string | number | null>, negrita: boolean) => {
      const fila = hoja.addRow(
        valores.map((v, i) => (h.columnas[i]?.formato === "fecha" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? fechaExcel(v) : v))
      );
      fila.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
        const f = h.columnas[col - 1]?.formato;
        if (f === "pesos" || f === "numero") c.numFmt = "#,##0";
        if (f === "fecha") c.numFmt = "dd/mm/yyyy";
        c.border = BORDES;
        c.font = { size: 10, bold: negrita };
      });
    };
    for (const f of h.filas) escribir(f, false);
    if (h.totales) escribir(h.totales, true);
  }
  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
