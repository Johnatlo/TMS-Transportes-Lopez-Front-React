/**
 * Excel del cuadro de anticipos (el boton Exportar), como la hoja "EDS
 * CHUSACA - RETORNO - S ESTE" de docs/ejemplo cuadro anticipos.xlsx: una fila
 * por anticipo entregado, con la ida y la vuelta en filas aparte (en pantalla
 * van juntas en el tanqueo, pero en ningun lado se suman). Solo lo que esta en
 * pantalla con los filtros.
 *
 * filasAnticipos y columnasAnticipos no dependen de exceljs y se prueban
 * aparte (excelAnticipos.test.ts).
 */
import type { AnticipoBomba } from "../../api/cliente";
import type { ColumnaTabla } from "../../componentes/excelTabla";
import { placaConGuion } from "./facturacion";
import type { Tanqueo } from "./tanqueos";

/** "LOPEZ", "M&C" o "TERCERO" (como en el Excel de anticipos). */
const flotaTexto = (f: string | null) => (f === "LOPEZ" ? "LOPEZ" : f === "MYC" ? "M&C" : f === "TERCERO" ? "TERCERO" : "");

/** Los tramos de los tanqueos (ida y vuelta por separado), por fecha, placa e ida antes que vuelta. */
export function filasAnticipos(tanqueos: Tanqueo[]): AnticipoBomba[] {
  return tanqueos
    .flatMap((g) => g.tramos)
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) ||
        placaConGuion(a.placa ?? "").localeCompare(placaConGuion(b.placa ?? "")) ||
        (a.tanqueoId ?? a.id) - (b.tanqueoId ?? b.id) ||
        Number(a.tramo === "VUELTA") - Number(b.tramo === "VUELTA"),
    );
}

/** Columnas del Excel (titulos del ejemplo) con los valores de cada tramo. */
export function columnasAnticipos(tramos: AnticipoBomba[]): ColumnaTabla[] {
  const col = (titulo: string, valor: (t: AnticipoBomba) => string | number | null, derecha = false): ColumnaTabla => ({
    titulo,
    valores: tramos.map(valor),
    derecha,
  });
  return [
    col("FECHA ANTICIPO", (t) => t.fecha),
    col("PLACA", (t) => placaConGuion(t.placa ?? "")),
    col("TRAMO", (t) => (t.tramo === "VUELTA" ? "VUELTA" : "IDA")),
    col("EMPRESA PROV", (t) => t.empresa ?? (t.tramo === "VUELTA" ? "VUELTA PENDIENTE" : "")),
    col("MANIFIESTO", (t) => t.manifiesto ?? ""),
    col("EFECTIVO", (t) => Math.round(t.efectivo), true),
    col("COMBUST.", (t) => Math.round(t.combustible), true),
    col("GALONES", (t) => t.galones),
    col("DESC.", (t) => (t.descuento === null ? null : Math.round(t.descuento)), true),
    col("VALOR TOTAL", (t) => Math.round(t.efectivo + t.combustible), true),
    col("EDS", (t) => t.bomba ?? "SOLO EFECTIVO"),
    col("N° FACTURA", (t) => t.facturaBomba ?? ""),
    col("FECHA FACTURA", (t) => t.fechaFacturaBomba),
    col("EMPRESA DEL VEHICULO", (t) => flotaTexto(t.flota)),
    col("FECHA DE PAGO", (t) => t.fechaPago),
  ];
}

/** Descarga el Excel de los tanqueos en pantalla, una fila por ida y otra por vuelta. */
export async function descargarAnticipos(tanqueos: Tanqueo[], nombreArchivo: string): Promise<void> {
  const { descargarTabla } = await import("../../componentes/excelTabla");
  await descargarTabla(columnasAnticipos(filasAnticipos(tanqueos)), "ANTICIPOS", nombreArchivo);
}
