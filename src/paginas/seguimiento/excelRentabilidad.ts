/**
 * Excel de la rentabilidad con las columnas de docs/ejemplo rentabilidad.xlsx:
 * una hoja por grupo (TERCEROS, CELSO, MAURICIO...). Los saldos, la
 * rentabilidad y la ganancia van con formula (como en el ejemplo) para que se
 * puedan ajustar en el Excel; al final, los totales.
 *
 * exceljs se carga solo al descargar (import dinamico).
 */
import type { Cell, Worksheet } from "exceljs";
import type { FilaRentabilidad } from "../../api/cliente";
import { placaConGuion } from "../cuadro/facturacion";

/** Una columna del Excel: titulo, formato y su valor (o su formula con las letras de las demas). */
interface ColumnaExcel {
  id: string;
  titulo: string;
  tipo: "texto" | "fecha" | "moneda";
  valor: (f: FilaRentabilidad) => string | number | null;
  /** Formula de la fila n: L(id) da la celda de otra columna en esa fila. */
  formula?: (L: (id: string) => string) => string;
  /** Se suma en la fila de totales. */
  suma?: boolean;
}

const BORDE = { style: "thin" as const, color: { argb: "FF000000" } };
const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
const AZUL = "FFB4C6E7";
const MONEDA = "#,##0";
const FECHA = "d/mm/yyyy";

/** Columna de plata (se suma en los totales); con formula si se da. */
const m = (id: string, titulo: string, valor: (f: FilaRentabilidad) => number, formula?: ColumnaExcel["formula"]): ColumnaExcel => ({
  id,
  titulo,
  tipo: "moneda",
  valor,
  formula,
  suma: true,
});
/** Columna de texto. */
const t = (id: string, titulo: string, valor: (f: FilaRentabilidad) => string | null): ColumnaExcel => ({ id, titulo, tipo: "texto", valor });
/** Columna de fecha. */
const d = (id: string, titulo: string, valor: (f: FilaRentabilidad) => string | null): ColumnaExcel => ({ id, titulo, tipo: "fecha", valor });

/** Columnas de la hoja TERCEROS (rentabilidad = saldo empresa - saldo tercero). */
const COLUMNAS_TERCEROS: ColumnaExcel[] = [
  d("fecha", "FECHA", (f) => f.fecha),
  t("placa", "PLACA", (f) => placaConGuion(f.placa)),
  t("tercero", "PROPIETARIO / TENEDOR", (f) => f.tercero),
  t("empresa", "EMPRESA", (f) => f.empresa),
  t("remision", "REMIS", (f) => f.remision ?? f.manifiesto),
  t("factura", "N° FACT.", (f) => f.facturaNumero),
  d("fechaFactura", "FECHA FACTURA", (f) => f.facturaFecha),
  m("valor", "VALOR SALDO EMPRESA", (f) => f.valorEmpresa),
  m("retencion", "RETEF. RET.FOPAT", (f) => f.retencion),
  m("ica", "RETE ICA", (f) => f.reteIca),
  m("bancaria", "COMIS BANCAR", (f) => f.bancaria),
  m("super", "CONT. SUPERTR. 0,1201", (f) => f.supertransporte),
  m("comision", "COMISION", (f) => f.comision),
  m("tLopez", "T. LOPEZ", (f) => f.tLopez),
  m(
    "saldoEmpresa",
    "SALDO EMPRESA CON DESCUENTOS",
    (f) => f.saldoEmpresa,
    (L) => `${L("valor")}-${L("retencion")}-${L("ica")}-${L("bancaria")}-${L("super")}-${L("comision")}-${L("tLopez")}`
  ),
  m("flete", "FLETE TERCERO", (f) => f.fleteTercero),
  m("retTercero", "RETEF. RET.FOPAT TERCEROS", (f) => f.retencionTercero),
  m("icaTercero", "RETE ICA", (f) => f.reteIcaTercero),
  m("superTercero", "CONT. SUPERTR. 0,1201%", (f) => f.bancariaTercero),
  m("poliza", "PLANILLA- POLIZA RCE", (f) => f.poliza),
  m("anticipo", "ANTICIPO", (f) => f.anticipo),
  m(
    "saldoTercero",
    "SALDO CONDUCTOR CON DESCUENTOS",
    (f) => f.saldoBeneficiario,
    (L) => `${L("flete")}-${L("retTercero")}-${L("icaTercero")}-${L("superTercero")}-${L("poliza")}`
  ),
  m("rentabilidad", "RENTABIL. EMPRESA", (f) => f.rentabilidad, (L) => `${L("saldoEmpresa")}-${L("saldoTercero")}`),
  m("renta", "ANTICIPO DE RENTA 3,5", (f) => f.anticipoRenta, (L) => `ROUND(${L("rentabilidad")}*3.5%,0)`),
  m("ganancia", "RENTABIL. EMPRESA TOTAL", (f) => f.ganancia, (L) => `${L("rentabilidad")}-${L("renta")}`),
  d("pagoEmpresa", "PAGO EMPRESA", (f) => f.fechaPagoEmpresa),
  d("pagoTercero", "PAGO A TERCERO", (f) => f.fechaPagoBeneficiario),
  d("pagoRentabilidad", "PAGO RENTABIL.", (f) => f.fechaPagoRentabilidad),
];

/** Columnas de la hoja de un socio o carro propio (saldo = lo que se le paga al dueno). */
function columnasSocio(grupo: string): ColumnaExcel[] {
  // XGJ-197 (dobletroque): el anticipo va en efectivo y combustible.
  const anticipo =
    grupo === "XGJ-197"
      ? [m("efectivo", "ANTICIPO EFECTIVO", (f) => f.efectivo + f.transferencia), m("combustible", "COMBUST.", (f) => f.combustible)]
      : [m("anticipo", "ANTICIPO", (f) => f.anticipo)];
  const restaAnticipo = grupo === "XGJ-197" ? ["efectivo", "combustible"] : ["anticipo"];
  return [
    d("fecha", "FECHA", (f) => f.fecha),
    t("placa", "PLACA", (f) => placaConGuion(f.placa)),
    t("empresa", "EMPRESA", (f) => f.empresa),
    t("remision", "REMISION", (f) => f.remision ?? f.manifiesto),
    t("factura", "N° FACT.", (f) => f.facturaNumero),
    d("fechaFactura", "FECHA FACTURA", (f) => f.facturaFecha),
    m("valor", "VALOR SALDO EMPRESA", (f) => f.valorEmpresa),
    m("retencion", "RETEF. RET.FOPAT", (f) => f.retencion),
    m("ica", "RETE ICA", (f) => f.reteIca),
    m("renta", "ANTICIPO DE RENTA 3,5", (f) => f.anticipoRenta),
    m("bancaria", "COMIS. BANCARIA", (f) => f.bancaria),
    m("super", "CONT. SUPERT. 0,1201", (f) => f.supertransporte),
    m("comision", "COMIS", (f) => f.comision),
    m("tLopez", "T. LOPEZ", (f) => f.tLopez),
    m("descargue", "DESCARG. CAME", (f) => f.descargue),
    m("poliza", "PLANILLA- POLIZA RCE", (f) => f.poliza),
    ...anticipo,
    m("saldo", "SALDO CON DESCUENTOS", (f) => f.saldoBeneficiario, (L) =>
      [L("valor"), ...["retencion", "ica", "renta", "bancaria", "super", "comision", "tLopez", "descargue", "poliza", ...restaAnticipo].map(L)].join("-")
    ),
    m("ganancia", "GANANCIA EMPRESA", (f) => f.ganancia, (L) => `${L("comision")}+${L("tLopez")}`),
    d("pagoEmpresa", "PAGO EMPRESA", (f) => f.fechaPagoEmpresa),
    d("pagoDueno", `PAGO A ${grupo}`, (f) => f.fechaPagoBeneficiario),
    d("pagoRentabilidad", "PAGO RENTABIL.", (f) => f.fechaPagoRentabilidad),
  ];
}

/** "2026-10-05" -> Date a mediodia local (que Excel no lo corra de dia). */
const fechaExcel = (f: string | null) => {
  if (!f) return null;
  const [a, mes, dd] = f.slice(0, 10).split("-").map(Number);
  return new Date(a, mes - 1, dd, 12);
};

/** Letra de la columna n (1 = A, 27 = AA). */
const letra = (n: number): string => (n <= 26 ? String.fromCharCode(64 + n) : letra(Math.floor((n - 1) / 26)) + letra(((n - 1) % 26) + 1));

/** Escribe una hoja: encabezado azul, una fila por viaje (con sus formulas) y los totales. */
function hojaGrupo(hoja: Worksheet, grupo: string, filas: FilaRentabilidad[]) {
  const columnas = grupo === "TERCEROS" ? COLUMNAS_TERCEROS : columnasSocio(grupo);
  const pos = new Map(columnas.map((c, i) => [c.id, letra(i + 1)]));
  hoja.columns = columnas.map((c) => ({ width: c.tipo === "texto" ? (c.id === "empresa" || c.id === "tercero" ? 30 : 14) : c.tipo === "fecha" ? 12 : 15 }));
  const titulos = hoja.addRow(columnas.map((c) => c.titulo));
  titulos.height = 36;
  titulos.eachCell((c: Cell) => {
    c.font = { bold: true, size: 9 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.border = BORDES;
  });
  hoja.views = [{ state: "frozen", ySplit: 1, xSplit: 2 }];
  const ordenadas = [...filas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  for (const f of ordenadas) {
    const n = hoja.rowCount + 1;
    const L = (id: string) => `${pos.get(id)}${n}`;
    const fila = hoja.addRow(
      columnas.map((c) => {
        const v = c.valor(f);
        if (c.tipo === "fecha") return fechaExcel(v as string | null);
        return c.formula ? { formula: c.formula(L), result: v as number } : v;
      })
    );
    fila.eachCell({ includeEmpty: true }, (c: Cell, col: number) => {
      const tipo = columnas[col - 1]?.tipo;
      c.border = BORDES;
      c.font = { size: 9 };
      if (tipo === "moneda") c.numFmt = MONEDA;
      if (tipo === "fecha") c.numFmt = FECHA;
    });
  }
  // Totales de las columnas de plata.
  const primera = 2;
  const ultima = hoja.rowCount;
  const total = hoja.addRow(columnas.map((_, i) => (i === 0 ? "TOTAL" : null)));
  columnas.forEach((c, i) => {
    if (!c.suma) return;
    const celda = total.getCell(i + 1);
    const col = letra(i + 1);
    celda.value = { formula: `SUM(${col}${primera}:${col}${ultima})`, result: filas.reduce((s, f) => s + Number(c.valor(f) ?? 0), 0) };
    celda.numFmt = MONEDA;
  });
  total.eachCell({ includeEmpty: true }, (c: Cell) => {
    c.font = { bold: true, size: 9 };
    c.border = BORDES;
  });
}

/** Arma y descarga el Excel con una hoja por grupo (en el orden dado). */
export async function descargarRentabilidad(grupos: Array<{ grupo: string; filas: FilaRentabilidad[] }>, nombreArchivo: string): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  for (const g of grupos.filter((x) => x.filas.length)) {
    // Los nombres de hoja no admiten algunos signos y van hasta 31 letras.
    hojaGrupo(libro.addWorksheet(g.grupo.replace(/[\\/?*[\]:]/g, " ").slice(0, 31)), g.grupo, g.filas);
  }
  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Lee las matrices del Excel de rentabilidad: "Matriz Comisiones" (CLIENTES,
 * COM, LOPEZ) y "Matriz Retenciones" (EMPRESA, RETEFUENTE, RETEICA, LUGAR).
 * Las filas sin cliente o sin numero se saltan.
 */
export async function leerMatrices(archivo: File) {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  const hoja = (nombre: RegExp) => libro.worksheets.find((h) => nombre.test(h.name));
  const texto = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" && "result" in (v as object) ? String((v as { result: unknown }).result ?? "") : String(v)).trim();
  const numero = (v: unknown) => {
    const n = Number(texto(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const comisiones: Array<{ cliente: string; comision: number; tLopez: number }> = [];
  hoja(/comisi/i)?.eachRow((fila) => {
    const cliente = texto(fila.getCell(2).value);
    const comision = numero(fila.getCell(3).value);
    if (!cliente || comision === null || /^CLIENTES?$/i.test(cliente)) return;
    comisiones.push({ cliente, comision, tLopez: numero(fila.getCell(4).value) ?? 0 });
  });
  const retenciones: Array<{ cliente: string; reteicaPorMil: number; ciudad: string | null }> = [];
  let ultimo = "";
  hoja(/retenci/i)?.eachRow((fila) => {
    // Las filas de otra ciudad del mismo cliente vienen sin nombre: se toma el de arriba.
    const nombre = texto(fila.getCell(2).value);
    if (nombre && !/^EMPRESA$/i.test(nombre)) ultimo = nombre;
    const ica = numero(fila.getCell(4).value);
    if (!ultimo || ica === null || /^EMPRESA$/i.test(nombre)) return;
    retenciones.push({ cliente: ultimo, reteicaPorMil: ica, ciudad: texto(fila.getCell(5).value) || null });
  });
  return { comisiones, retenciones };
}
