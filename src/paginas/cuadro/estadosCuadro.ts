/**
 * Nombres, colores y reglas de presentacion del cuadro pagos (estados,
 * papeles, flota, fechas y vencimiento de saldos).
 */
import type { EstadoCuadro, EstadoPapeles, FilaCuadro, Flota } from "../../api/cliente";
import type { TonoPastilla } from "../../componentes/TablaDatos";

/**
 * Nombres y colores del cuadro pagos. Los tonos repiten los colores que se
 * usaban en el Excel para que el equipo los reconozca:
 * morado = sin radicar, verde = radicado, azul = facturado sin datos,
 * naranja = revisado por contabilidad (falta gerencia), amarillo = todo pagado.
 */
export const ETIQUETA_ESTADO_CUADRO: Record<EstadoCuadro, string> = {
  EN_RUTA: "En proceso",
  SIN_RADICAR: "Sin radicar",
  RADICADO: "Radicado",
  FACTURADO_SIN_DATOS: "Facturado sin datos",
  FACTURADO: "Facturado",
  PAGADO: "Factura pagada",
  ANULADO: "Anulado",
};

/**
 * Color de la pastilla de estado, con el significado de los colores del Excel.
 * Todo pagado siempre es amarillo.
 */
export function tonoEstadoCuadro(f: Pick<FilaCuadro, "estado" | "todoPagado">): TonoPastilla {
  if (f.todoPagado) return "amarillo";
  switch (f.estado) {
    case "SIN_RADICAR":
      return "morado";
    case "RADICADO":
      return "verde";
    case "FACTURADO_SIN_DATOS":
      return "azul";
    case "FACTURADO":
      return "info";
    case "PAGADO":
      return "ok";
    default:
      return "neutro";
  }
}

/** Nombre del estado para mostrar; "Todo pagado" cuando ya se pago todo. */
export const etiquetaEstadoCuadro = (f: Pick<FilaCuadro, "estado" | "todoPagado">) =>
  f.todoPagado ? "Todo pagado" : ETIQUETA_ESTADO_CUADRO[f.estado];

export const ETIQUETA_PAPELES: Record<EstadoPapeles, string> = {
  EN_RUTA: "En ruta",
  CONDUCTOR: "Con el conductor",
  PARQUEADERO: "En el parqueadero",
  OFICINA: "Donde Don Alexander",
  RADICADO: "Radicados",
};

/** Pasos de los papeles. Parqueadero y oficina solo para CORAME / Cartones America. */
export const pasosPapeles = (flujoCorame: boolean): EstadoPapeles[] =>
  flujoCorame ? ["EN_RUTA", "CONDUCTOR", "PARQUEADERO", "OFICINA", "RADICADO"] : ["EN_RUTA", "CONDUCTOR", "RADICADO"];

export const ETIQUETA_FLOTA: Record<Flota, string> = {
  LOPEZ: "Flota Lopez",
  MYC: "Flota MYC",
  TERCERO: "Tercero",
};

/** Fecha de hoy en Colombia, "AAAA-MM-DD". */
export const hoyColombia = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);

/** "2026-09-30" -> "30/09/2026" (sin pasar por Date: no se corre de dia). */
export const fechaCorta = (f: string | null | undefined) => {
  if (!f) return "-";
  const [a, m, d] = f.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

/** Saldo de un tercero sin pagar y ya vencido (15 dias despues de descargar). */
export const saldoVencido = (f: FilaCuadro) =>
  f.flota === "TERCERO" && !f.anulado && !f.fechaPagoSaldo && !!f.venceSaldo && f.venceSaldo <= hoyColombia();
