/**
 * Cuentas del pago a terceros en el navegador, para que el formulario muestre
 * el valor a pagar mientras se escribe. Son las mismas del backend
 * (src/terceros.ts: liquidar); lo que se guarda lo calcula siempre el backend.
 */
import type { ViajeTercero } from "../../api/cliente";

export const RETEFUENTE_TERCERO = 0.01;
export const FOPAT_TERCERO = 0.001;
export const POLIZA_TERCERO = 3000;

/** Lo que se escribe en el formulario del viaje. */
export interface DatosPagoTercero {
  pesoKg: number | null;
  valorTerceroTon: number | null;
  valorTerceroFijo: number | null;
  anticipoTransferencia: number | null;
  aplicaDescuentosTercero: boolean;
  /** ICA por mil (el escrito o el sugerido). */
  icaPorMil: number;
}

/** Valor del tercero, retenciones y valor a pagar (efectivo y combustible salen de la bomba). */
export function liquidarTercero(d: DatosPagoTercero, bomba: Pick<ViajeTercero, "efectivo" | "combustible">) {
  const valorTercero =
    d.valorTerceroFijo !== null
      ? Math.round(d.valorTerceroFijo)
      : d.valorTerceroTon !== null && d.pesoKg !== null
        ? Math.round((d.pesoKg / 1000) * d.valorTerceroTon)
        : null;
  const base = valorTercero ?? 0;
  const retefuente = Math.round(base * RETEFUENTE_TERCERO);
  const ica = Math.round((base * d.icaPorMil) / 1000);
  const fopat = Math.round(base * FOPAT_TERCERO);
  const poliza = valorTercero === null ? 0 : POLIZA_TERCERO;
  const totalDescuentos = retefuente + ica + fopat + poliza;
  const transferencia = d.anticipoTransferencia ?? 0;
  return {
    valorTercero,
    retefuente,
    ica,
    fopat,
    poliza,
    totalDescuentos,
    valorAPagar:
      valorTercero === null
        ? null
        : valorTercero - bomba.efectivo - bomba.combustible - transferencia - (d.aplicaDescuentosTercero ? totalDescuentos : 0),
  };
}

/** Texto del formulario a numero; vacio = null. */
export const numeroONulo = (t: string) => (t.trim() === "" ? null : Number(t));
