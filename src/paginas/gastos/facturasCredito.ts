/**
 * Reporte de facturas credito para la contadora: las facturas marcadas como
 * credito de un mes o de una quincena (del 1 al 15, o del 16 a fin de mes),
 * por la fecha del gasto (la de la factura).
 */
import type { EmpresaGasto, Gasto } from "../../api/cliente";

/** Periodo del reporte: un mes ("2026-11") o una quincena ("2026-11-Q1" / "2026-11-Q2"). */
export type PeriodoReporte = string;

/** Primer y ultimo dia de un periodo del reporte. */
export function rangoDe(periodo: PeriodoReporte): { desde: string; hasta: string } {
  const mes = periodo.slice(0, 7);
  const ultimo = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
  if (periodo.endsWith("-Q1")) return { desde: `${mes}-01`, hasta: `${mes}-15` };
  if (periodo.endsWith("-Q2")) return { desde: `${mes}-16`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

/** Las facturas credito (no anuladas) de una empresa (o de las dos) en el periodo, por fecha. */
export function facturasCredito(gastos: Gasto[], periodo: PeriodoReporte, empresa: EmpresaGasto | "TODAS"): Gasto[] {
  const { desde, hasta } = rangoDe(periodo);
  return gastos
    .filter((g) => !g.anulado && g.tipoFactura === "CREDITO" && (empresa === "TODAS" || g.empresa === empresa))
    .filter((g) => g.causaDesde >= desde && g.causaDesde <= hasta)
    .sort((a, b) => a.causaDesde.localeCompare(b.causaDesde) || a.id - b.id);
}
