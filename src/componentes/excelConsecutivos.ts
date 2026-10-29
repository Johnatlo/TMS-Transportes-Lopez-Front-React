/**
 * Excel del libro de consecutivos de manifiestos y remesas, igual a
 * docs/Ejemplo consecutivos Manifiestos & Remesas.xlsx: una hoja por mes
 * ("JULIO 2026"), una fila por remesa, encabezado en negrita con filtro y el
 * FOPAT con su formula (=valor x 0,1 %).
 *
 * filaExcel no depende de exceljs y se prueba aparte (excelConsecutivos.test.ts);
 * exceljs se carga solo al descargar.
 */
import type { Cell } from "exceljs";
import type { FilaConsecutivo } from "../api/cliente";

/** Encabezados del ejemplo, con su ancho. */
export const COLUMNAS_CONSECUTIVOS: Array<{ titulo: string; ancho: number }> = [
  { titulo: "FECHA PLANILLADA", ancho: 12 },
  { titulo: "PLACA", ancho: 11.5 },
  { titulo: "EMPRESA", ancho: 20 },
  { titulo: "VALOR DE MANIFIESTO", ancho: 12.5 },
  { titulo: "LIQUIDACION RETENCION FOPAT 0,1%", ancho: 14.5 },
  { titulo: "CITA CARGUE Y DESCARGUE", ancho: 29.5 },
  { titulo: "N° MANIFIESTO", ancho: 14 },
  { titulo: "N° REMESA", ancho: 13 },
  { titulo: "RADICADO REMESA", ancho: 15 },
  { titulo: "ESTADO", ancho: 16.5 },
  { titulo: "codigo municipio de cargue", ancho: 14.5 },
  { titulo: "Producto Transportado", ancho: 16.5 },
  { titulo: "Tipo Identificación Persona Remitente", ancho: 14 },
  { titulo: "No Identificación Persona Remitente", ancho: 18.5 },
  { titulo: "Nombre  Persona Remitemte", ancho: 18.5 },
  { titulo: "codigo municipio de descargue", ancho: 12.5 },
  { titulo: "Tipo Identificación Persona Destinatario", ancho: 14.5 },
  { titulo: "No Identificación Persona Destinatario", ancho: 18.5 },
  { titulo: "Nombre  Persona Destinatario", ancho: 18.5 },
  { titulo: "Valor Total Viaje", ancho: 11.5 },
  { titulo: "Valor Viaje en Efectivo", ancho: 16 },
];

/** Partes de una fecha en hora de Colombia (el servidor guarda en UTC). */
function partes(fecha: string) {
  const p = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(fecha));
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { anio: v("year"), mes: v("month"), dia: v("day"), hora: `${v("hour")}:${v("minute")}` };
}

/** "JULIO 2026": nombre de la hoja del mes (como en el ejemplo). */
export function hojaDelMes(fecha: string): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", month: "long", year: "numeric" })
    .format(new Date(fecha))
    .replace(" de ", " ")
    .toUpperCase();
}

/** "(31) NIT" o "(13) Cedula de ciudadania", como en el ejemplo. */
const tipoId = (t: string | null) => (t === "N" ? "(31) NIT" : t === "C" ? "(13) Cedula de ciudadania" : t ?? "");

/** Codigo DANE del municipio como numero (el RNDC lo da con tres ceros al final: 25754000 -> 25754). */
const codigoMunicipio = (c: string | null) => {
  if (!c) return null;
  const corto = c.length === 8 && c.endsWith("000") ? c.slice(0, 5) : c;
  return /^\d+$/.test(corto) ? Number(corto) : corto;
};

/** Estado como en el ejemplo (CUMPLIDO, ANULADO...). */
function estado(f: FilaConsecutivo): string {
  if (f.estadoViaje === "ANULADO") return "ANULADO";
  if (f.estadoViaje === "CUMPLIDO" || f.estadoRemesa === "CUMPLIDA") return "CUMPLIDO";
  if (f.estadoViaje === "CONFIRMADO") return "EXPEDIDO";
  return f.estadoViaje.replace(/_/g, " ");
}

/** Empresa como en el ejemplo: Cartones America con sus toneladas ("CORAME 33,298"). */
function empresa(f: FilaConsecutivo): string {
  const cliente = (f.cliente ?? "").trim();
  if (/CORAME|CARTONES\s+AMERICA/i.test(cliente) && f.pesoReal) {
    return `CORAME ${(f.pesoReal / 1000).toFixed(3).replace(".", ",")}`;
  }
  return cliente;
}

/** Valores de una fila del Excel (sin la formula del FOPAT, que se pone al escribirla). */
export function filaExcel(f: FilaConsecutivo): Array<string | number | Date | null> {
  const fecha = partes(f.fechaPlanillada);
  const cargue = partes(f.citaCargue);
  const descargue = partes(f.citaDescargue);
  const anulado = f.estadoViaje === "ANULADO";
  return [
    new Date(Number(fecha.anio), Number(fecha.mes) - 1, Number(fecha.dia), 12),
    f.placa ? f.placa.replace(/^([A-Z]{3})-?(\w{3})$/i, "$1-$2") : "",
    anulado ? "ANULADO" : empresa(f),
    anulado ? "ANULADO" : f.valorManifiesto ?? null,
    null,
    `CARGUE ${cargue.dia}/${cargue.mes} ${cargue.hora} DESCARGUE ${descargue.dia}/${descargue.mes} ${descargue.hora}`,
    f.consecutivoManifiesto ?? "",
    f.consecutivoRemesa ?? "",
    f.radicadoRemesa ? (/^\d+$/.test(f.radicadoRemesa) ? Number(f.radicadoRemesa) : f.radicadoRemesa) : null,
    estado(f),
    codigoMunicipio(f.codMunicipioCargue),
    f.producto ?? "",
    tipoId(f.remitenteTipoId),
    f.remitenteNit ? (/^\d+$/.test(f.remitenteNit) ? Number(f.remitenteNit) : f.remitenteNit) : null,
    f.remitenteNombre ?? "",
    codigoMunicipio(f.codMunicipioDescargue),
    tipoId(f.destinatarioTipoId),
    f.destinatarioNit ? (/^\d+$/.test(f.destinatarioNit) ? Number(f.destinatarioNit) : f.destinatarioNit) : null,
    f.destinatarioNombre ?? "",
    // Valor Total Viaje: lo que se le factura al cliente (el flete del cuadro de facturacion).
    anulado ? null : f.valorFacturar,
    null,
  ];
}

/** Arma y descarga el Excel: una hoja por mes (del mas reciente al mas viejo, como el ejemplo). */
export async function descargarConsecutivos(filas: FilaConsecutivo[], nombreArchivo: string): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  const ordenadas = [...filas].sort(
    (a, b) => a.fechaPlanillada.localeCompare(b.fechaPlanillada) || (a.consecutivoRemesa ?? "").localeCompare(b.consecutivoRemesa ?? "")
  );
  const meses = new Map<string, FilaConsecutivo[]>();
  for (const f of ordenadas) {
    const m = hojaDelMes(f.fechaPlanillada);
    meses.set(m, [...(meses.get(m) ?? []), f]);
  }
  for (const [mes, delMes] of [...meses.entries()].reverse()) {
    const hoja = libro.addWorksheet(mes.slice(0, 31));
    hoja.columns = COLUMNAS_CONSECUTIVOS.map((c) => ({ width: c.ancho }));
    const titulos = hoja.addRow(COLUMNAS_CONSECUTIVOS.map((c) => c.titulo));
    titulos.height = 58;
    titulos.eachCell((c: Cell) => {
      c.font = { bold: true, size: 11 };
      c.alignment = { wrapText: true, vertical: "middle" };
    });
    hoja.views = [{ state: "frozen", ySplit: 1 }];
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS_CONSECUTIVOS.length } };
    for (const f of delMes) {
      const valores = filaExcel(f);
      const fila = hoja.addRow(valores);
      // FOPAT: formula sobre el valor del manifiesto (vacio si no lleva valor).
      if (typeof valores[3] === "number") {
        fila.getCell(5).value = { formula: `D${fila.number}*0.1%`, result: valores[3] * 0.001 };
      } else if (valores[3] === "ANULADO") {
        fila.getCell(5).value = "ANULADO";
      }
      fila.getCell(1).numFmt = "dd/mm/yyyy";
      fila.getCell(4).numFmt = "#,##0";
      fila.getCell(5).numFmt = "#,##0";
      fila.getCell(20).numFmt = "#,##0";
    }
  }
  if (!libro.worksheets.length) libro.addWorksheet("SIN DATOS");
  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
