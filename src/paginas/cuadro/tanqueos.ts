/**
 * El cuadro de anticipos por tanqueo: lo que se entrego de una vez en una
 * bomba (la ida y, si la hay, su vuelta), con su estado frente a la bomba.
 * Sin dependencias de React: se prueba aparte (tanqueos.test.ts).
 */
import type { AnticipoBomba } from "../../api/cliente";
import type { TonoPastilla } from "../../componentes/TablaDatos";

/**
 * Cruce con la relacion de la bomba:
 * - CRUZADO: todo lo que dio la bomba (combustible y efectivo) tiene su vale
 *   (o, sin ningun vale, ya traia la factura de la bomba del Excel) y coincide.
 * - DIFERENCIA: el valor de algun vale no es el que se habia registrado
 *   (1.000 o mas), aunque aun falten vales: hay que revisarlo.
 * - SIN_CRUZAR: aun no aparece en ninguna relacion de la bomba.
 * - SOLO_EFECTIVO: no paso por la bomba; no hay nada que cruzar.
 */
export type EstadoCruce = "CRUZADO" | "DIFERENCIA" | "SIN_CRUZAR" | "SOLO_EFECTIVO";

/** Un tanqueo con sus tramos (ida y vuelta) y sus totales. */
export interface Tanqueo {
  clave: string;
  tanqueoId: number | null;
  fecha: string;
  placa: string;
  bombaId: number | null;
  bomba: string | null;
  idaYVuelta: boolean;
  facturaBomba: string | null;
  fechaFacturaBomba: string | null;
  flota: string | null;
  ida: AnticipoBomba;
  vuelta: AnticipoBomba | null;
  tramos: AnticipoBomba[];
  efectivo: number;
  combustible: number;
  total: number;
  cruce: EstadoCruce;
  /** Combustible del vale - lo que se habia registrado (suma de los tramos cruzados). */
  diferencia: number;
  /** Todo lo de la bomba pagado (fecha de pago en cada tramo). */
  pagado: boolean;
  /** Fecha de pago (la de la ida). */
  fechaPago: string | null;
}

/** Diferencia que se toma como real (por debajo son redondeos). */
export const DIFERENCIA_MINIMA = 1000;

/** Lo que cambio el combustible de un tramo al cruzarlo: valor del vale (o de los galones) - lo registrado. */
export const diferenciaCombustible = (t: AnticipoBomba) => (t.combustibleEntregado === null ? 0 : t.combustible - t.combustibleEntregado);
/** Lo que cambio el efectivo de un tramo al cruzarlo con el vale de efectivo. */
export const diferenciaEfectivo = (t: AnticipoBomba) => (t.efectivoEntregado === null ? 0 : t.efectivo - t.efectivoEntregado);
/** Lo que un tramo cambio al cruzarlo (combustible y efectivo). */
export const diferenciaTramo = (t: AnticipoBomba) => diferenciaCombustible(t) + diferenciaEfectivo(t);

/**
 * Lo que le falta a un tramo para quedar cruzado: el vale de combustible y/o
 * el de efectivo (solo de lo que dio la bomba).
 */
export function faltaCruzar(t: AnticipoBomba): { combustible: boolean; efectivo: boolean } {
  const deBomba = t.bombaId !== null;
  return {
    combustible: deBomba && t.combustible > 0 && !t.cruzadoCombustible,
    efectivo: deBomba && t.efectivo > 0 && !t.cruzadoEfectivo,
  };
}

/** Agrupa los tramos por tanqueo (los anticipos viejos sin tanqueo quedan solos). */
export function agruparPorTanqueo(tramos: AnticipoBomba[]): Tanqueo[] {
  const grupos = new Map<string, AnticipoBomba[]>();
  for (const t of tramos) {
    const clave = t.tanqueoId ? `t${t.tanqueoId}` : `a${t.id}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), t]);
  }
  return [...grupos.entries()].map(([clave, ts]) => {
    const ida = ts.find((t) => t.tramo === "IDA") ?? ts[0];
    const vuelta = ts.find((t) => t.tramo === "VUELTA" && t !== ida) ?? null;
    const conCombustible = ts.filter((t) => t.combustible > 0 && t.bombaId !== null);
    const diferencia = ts.reduce((s, t) => s + diferenciaTramo(t), 0);
    // Sin ningun vale y con la factura de la bomba: se cargo del Excel ya cruzado.
    const conVales = ts.some((t) => t.cruzadoCombustible || t.cruzadoEfectivo);
    const cruzado =
      conCombustible.length > 0 &&
      (conVales ? ts.every((t) => !faltaCruzar(t).combustible && !faltaCruzar(t).efectivo) : !!ida.facturaBomba);
    const conBomba = ts.filter((t) => t.bombaId !== null);
    return {
      clave,
      tanqueoId: ida.tanqueoId,
      fecha: ida.fecha,
      placa: ida.placa ?? "",
      bombaId: ida.bombaId,
      bomba: ida.bomba,
      idaYVuelta: ida.idaYVuelta || !!vuelta,
      facturaBomba: ida.facturaBomba,
      fechaFacturaBomba: ida.fechaFacturaBomba,
      flota: ida.flota,
      ida,
      vuelta,
      tramos: vuelta ? [ida, vuelta] : ts,
      efectivo: ts.reduce((s, t) => s + t.efectivo, 0),
      combustible: ts.reduce((s, t) => s + t.combustible, 0),
      total: ts.reduce((s, t) => s + t.valor, 0),
      // Una diferencia se muestra aunque aun falten vales: es lo que hay que revisar.
      cruce:
        conCombustible.length === 0
          ? "SOLO_EFECTIVO"
          : Math.abs(diferencia) >= DIFERENCIA_MINIMA
            ? "DIFERENCIA"
            : cruzado
              ? "CRUZADO"
              : "SIN_CRUZAR",
      diferencia,
      pagado: conBomba.length > 0 && conBomba.every((t) => !!t.fechaPago),
      fechaPago: ida.fechaPago,
    };
  });
}

/**
 * Posibles vueltas de un tanqueo (indicio): otros tanqueos de un solo tramo
 * de la misma placa y el mismo dia que no se juntaron solos (pasa cuando hay
 * 3 o mas ese dia, o en distinta bomba). Se juntan a mano con un clic.
 */
export function posiblesVueltas(g: Tanqueo, todos: Tanqueo[]): Tanqueo[] {
  if (g.idaYVuelta || !g.tanqueoId) return [];
  return todos.filter((o) => o !== g && !o.idaYVuelta && !!o.tanqueoId && o.placa === g.placa && o.fecha === g.fecha);
}

/** Colores de las bombas (no se usa el verde: es el de los cruzados). */
const COLORES_BOMBA: TonoPastilla[] = ["azul", "naranja", "morado", "turquesa", "amarillo"];

/**
 * Color de cada bomba: por orden alfabetico, uno distinto a cada una (con
 * mas de 5 bombas se repiten). El mismo nombre siempre da el mismo color
 * mientras no se agreguen bombas.
 */
export function coloresBombas(nombres: Array<string | null>): Map<string, TonoPastilla> {
  const unicos = [...new Set(nombres.filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b, "es"));
  return new Map(unicos.map((n, i) => [n, COLORES_BOMBA[i % COLORES_BOMBA.length]]));
}
