/**
 * Nombres, colores y reglas de presentacion del cuadro pagos (estados,
 * papeles, flota, fechas y vencimiento de saldos).
 */
import { hoyColombia } from "../../api/cliente";
import type { EstadoCuadro, EstadoFactura, EstadoPapeles, FilaCuadro, Flota } from "../../api/cliente";
import type { TonoPastilla } from "../../componentes/TablaDatos";

/**
 * Nombres y colores del cuadro pagos. Los tonos repiten los colores que se
 * usaban en el Excel para que el equipo los reconozca:
 * morado = sin radicar, verde = listo para facturar (radicado), azul = facturado sin datos,
 * naranja = revisado por contabilidad (falta gerencia). Todo pagado (ya hay
 * fecha pago factura) va en verde y pinta toda la fila de verde.
 *
 * Papeles y factura son dos estados aparte (dos pastillas): facturar no
 * esconde si los papeles estan radicados. Solo "todo pagado" y "anulado"
 * reemplazan a los dos.
 */
export const ETIQUETA_ESTADO_CUADRO: Record<EstadoCuadro, string> = {
  EN_RUTA: "En proceso",
  SIN_RADICAR: "Sin radicar",
  // Internamente sigue siendo RADICADO (papeles radicados en el cliente); en
  // pantalla se llama "Listo para facturar".
  RADICADO: "Listo para facturar",
  // Solo CORAME / Cartones America: los papeles ya quedaron radicados en el cliente.
  RADICADOS: "Radicados",
  PAGADO: "Todo pagado",
  ANULADO: "Anulado",
};

/**
 * Color de la pastilla de estado, con el significado de los colores del Excel.
 * Todo pagado siempre es verde.
 */
export function tonoEstadoCuadro(f: Pick<FilaCuadro, "estado" | "todoPagado">): TonoPastilla {
  if (f.todoPagado) return "ok";
  switch (f.estado) {
    case "SIN_RADICAR":
      return "morado";
    case "RADICADO":
      return "verde";
    case "RADICADOS":
      return "turquesa";
    case "PAGADO":
      return "ok";
    default:
      return "neutro";
  }
}

/** Nombre del estado para mostrar; "Todo pagado" cuando ya se pago todo. */
export const etiquetaEstadoCuadro = (f: Pick<FilaCuadro, "estado" | "todoPagado">) =>
  f.todoPagado ? "Todo pagado" : ETIQUETA_ESTADO_CUADRO[f.estado];

export const ETIQUETA_ESTADO_FACTURA: Record<EstadoFactura, string> = {
  SIN_FACTURAR: "Sin facturar",
  FACTURADO_SIN_DATOS: "Facturado sin datos",
  FACTURADO: "Facturado",
};

/** Color de la pastilla de la factura: azul sin datos, celeste facturado. */
export const tonoEstadoFactura = (e: EstadoFactura): TonoPastilla =>
  e === "FACTURADO_SIN_DATOS" ? "azul" : e === "FACTURADO" ? "info" : "neutro";

/**
 * Pastilla de factura que se muestra junto a la de papeles: ninguna si aun no
 * se facturo, ni cuando ya esta todo pagado o anulado (esos reemplazan a todo).
 */
export const muestraFactura = (f: Pick<FilaCuadro, "estado" | "estadoFactura" | "todoPagado">) =>
  !f.todoPagado && f.estado !== "ANULADO" && f.estado !== "PAGADO" && f.estadoFactura !== "SIN_FACTURAR";

/** Los dos estados en un texto ("Listo para facturar · Facturado"), para buscar y filtrar. */
export const textoEstados = (f: Pick<FilaCuadro, "estado" | "estadoFactura" | "todoPagado">) =>
  muestraFactura(f) ? `${etiquetaEstadoCuadro(f)} · ${ETIQUETA_ESTADO_FACTURA[f.estadoFactura]}` : etiquetaEstadoCuadro(f);

export const ETIQUETA_PAPELES: Record<EstadoPapeles, string> = {
  EN_RUTA: "En ruta",
  DESCARGADO: "Ya descargo",
  CONDUCTOR: "Con el conductor",
  PARQUEADERO: "En el parqueadero",
  OFICINA: "Donde Don Alexander",
  RADICADO: "Listo para facturar",
  RADICADOS: "Radicados",
};

/**
 * Pasos de los papeles. Parqueadero, oficina y "radicados" (el ultimo, ya
 * radicados en el cliente) solo para CORAME / Cartones America.
 */
export const pasosPapeles = (flujoCorame: boolean): EstadoPapeles[] =>
  flujoCorame
    ? ["EN_RUTA", "DESCARGADO", "CONDUCTOR", "PARQUEADERO", "OFICINA", "RADICADO", "RADICADOS"]
    : ["EN_RUTA", "DESCARGADO", "CONDUCTOR", "RADICADO"];

export const ETIQUETA_FLOTA: Record<Flota, string> = {
  LOPEZ: "Flota Lopez",
  MYC: "Flota MYC",
  TERCERO: "Tercero",
};

/**
 * Fecha de hoy en Colombia ("AAAA-MM-DD") y "2026-09-30" -> "30/09/2026" (sin
 * pasar por Date: no se corre de dia). Viven en api/cliente.ts; se reexportan
 * aqui con el nombre que usa el cuadro.
 */
export { hoyColombia, soloDia as fechaCorta } from "../../api/cliente";

/** Saldo de un tercero sin pagar y ya vencido (su viernes de pago ya llego). */
export const saldoVencido = (f: FilaCuadro) =>
  f.flota === "TERCERO" && !f.dueno && !f.anulado && !f.fechaPagoSaldo && !!f.venceSaldo && f.venceSaldo <= hoyColombia();
