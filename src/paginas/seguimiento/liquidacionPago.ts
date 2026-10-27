/**
 * Liquidacion del pago a un tercero (igual a docs/Liq Viaje Pago ejemplo.xlsx):
 * el cuadro que se arma cada vez que se le paga, con sus viajes, los
 * descuentos (retenciones y gestion financiera) y los avances (anticipos y
 * poliza). Flete total = total de los viajes - descuentos - avances.
 *
 * No depende de exceljs: se prueba aparte (liquidacionPago.test.ts) y el
 * Excel lo arma excelLiquidacion.ts.
 */
import type { ViajeTercero } from "../../api/cliente";
import { FOPAT_TERCERO, POLIZA_TERCERO, RETEFUENTE_TERCERO } from "./liquidacionTerceros";

/** Gestion financiera (4 x 1000 del banco + 0,1201 % + 5.000 por liquidacion), como en el ejemplo. */
export const GMF_POR_MIL = 4;
export const GESTION_PORCENTAJE = 0.001201;
export const GESTION_FIJO = 5000;

/** Un viaje en la liquidacion. */
export interface FilaLiquidacion {
  /** Cuenta de cobro (factura) del tercero. */
  factura: string;
  /** Remision o, si no tiene, manifiesto. */
  remision: string;
  fecha: string;
  empresa: string;
  toneladas: number | null;
  /** Valor por tonelada; null si se pacto un valor fijo. */
  valorTon: number | null;
  total: number;
}

/** Un renglon de descuento o de avance. */
export interface RenglonLiquidacion {
  descripcion: string;
  valor: number;
}

/** El cuadro completo. */
export interface Liquidacion {
  fecha: string;
  tercero: string;
  placas: string[];
  filas: FilaLiquidacion[];
  totalViajes: number;
  descuentos: RenglonLiquidacion[];
  totalDescuentos: number;
  avances: RenglonLiquidacion[];
  totalAvances: number;
  fleteTotal: number;
}

/** "1.234,5" del por mil para la descripcion del ICA. */
const porMil = (n: number) => String(n).replace(".", ",");
/** Nombre del cliente como en el ejemplo ("Ecoambiental"). */
const titulo = (s: string) => s.trim().toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

/**
 * Arma la liquidacion de unos viajes (de un mismo tercero, ya pactados).
 * - descontar: retenciones (retefuente 1 %, FOPAT 0,1 %, ICA por cliente),
 *   gestion financiera y la poliza RCE de cada manifiesto. Sin marcar solo se
 *   restan los anticipos.
 * - cuenta: cuenta de cobro para los viajes que no tienen la suya.
 */
export function armarLiquidacion(
  viajes: ViajeTercero[],
  { fecha, descontar, cuenta }: { fecha: string; descontar: boolean; cuenta: string }
): Liquidacion {
  const ordenados = [...viajes].filter((v) => v.valorTercero !== null).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const filas: FilaLiquidacion[] = ordenados.map((v) => ({
    factura: v.cuentaCobroTercero || cuenta,
    remision: v.remision || v.manifiesto || "",
    fecha: v.fecha,
    empresa: v.empresa,
    toneladas: v.pesoKg === null ? null : v.pesoKg / 1000,
    valorTon: v.valorTerceroFijo !== null ? null : v.valorTerceroTon,
    total: v.valorTercero ?? 0,
  }));
  const totalViajes = filas.reduce((s, f) => s + f.total, 0);

  const descuentos: RenglonLiquidacion[] = [];
  if (descontar && totalViajes > 0) {
    descuentos.push({ descripcion: "Retef. (Total de la tonelada x 1%)", valor: Math.round(totalViajes * RETEFUENTE_TERCERO) });
    descuentos.push({ descripcion: "Retencion FOPAT 0,1%", valor: Math.round(totalViajes * FOPAT_TERCERO) });
    // ReteICA: uno por cliente y tarifa, sobre lo de sus viajes.
    const ica = new Map<string, { empresa: string; porMil: number; base: number }>();
    for (const v of ordenados) {
      const clave = `${v.empresa}|${v.icaPorMil}`;
      const g = ica.get(clave) ?? { empresa: v.empresa, porMil: v.icaPorMil, base: 0 };
      g.base += v.valorTercero ?? 0;
      ica.set(clave, g);
    }
    for (const g of ica.values()) {
      descuentos.push({
        descripcion: `ReteIca. (${titulo(g.empresa)} x ${g.porMil ? `${porMil(g.porMil)}/1000` : "No presenta ICA"})`,
        valor: Math.round((g.base * g.porMil) / 1000),
      });
    }
    descuentos.push({
      descripcion: "Gestion financiera",
      valor: Math.round((totalViajes * GMF_POR_MIL) / 1000 + GESTION_FIJO + totalViajes * GESTION_PORCENTAJE),
    });
  }

  // Avances: uno por viaje del vehiculo (manifiesto), aunque lleve varios
  // clientes: sus anticipos juntos y una sola poliza RCE, como en el ejemplo.
  const porManifiesto = new Map<string, { cual: string; anticipo: number; transferencia: number }>();
  for (const v of ordenados) {
    const clave = v.manifiesto || `viaje ${v.id}`;
    const g = porManifiesto.get(clave) ?? {
      cual: `${v.fecha.split("-").reverse().join("/")}${v.manifiesto ? ` · ${v.manifiesto}` : ""}`,
      anticipo: 0,
      transferencia: 0,
    };
    g.anticipo += v.efectivo + v.combustible;
    g.transferencia += v.transferencia;
    porManifiesto.set(clave, g);
  }
  const avances: RenglonLiquidacion[] = [];
  for (const { cual, anticipo, transferencia } of porManifiesto.values()) {
    const poliza = descontar ? POLIZA_TERCERO : 0;
    if (anticipo + poliza > 0) {
      avances.push({ descripcion: `${anticipo ? "Anticipo" : ""}${anticipo && poliza ? " + " : ""}${poliza ? "Poliza RCE" : ""} (${cual})`, valor: anticipo + poliza });
    }
    if (transferencia > 0) avances.push({ descripcion: `Adicional por transferencia (${cual})`, valor: transferencia });
  }

  const totalDescuentos = descuentos.reduce((s, d) => s + d.valor, 0);
  const totalAvances = avances.reduce((s, a) => s + a.valor, 0);
  return {
    fecha,
    tercero: ordenados[0]?.tercero ?? viajes[0]?.tercero ?? "",
    placas: [...new Set(ordenados.map((v) => v.placa))],
    filas,
    totalViajes,
    descuentos,
    totalDescuentos,
    avances,
    totalAvances,
    fleteTotal: totalViajes - totalDescuentos - totalAvances,
  };
}
