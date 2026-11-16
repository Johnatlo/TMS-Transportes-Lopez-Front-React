/**
 * Nombres de los pasos de la cascada y de los descuentos del viaje (los
 * mismos de backend/src/calculoUtilidades.ts), para la pantalla y el Excel.
 */
import type { ClaveDescuentoUtilidad, PartidaUtilidad } from "../../api/cliente";

/** Descuentos del viaje en el orden en que se muestran. */
export const DESCUENTOS: Array<[ClaveDescuentoUtilidad, string]> = [
  ["retencion", "Retencion en la fuente + FOPAT"],
  ["reteIca", "ReteICA"],
  ["anticipoRenta", "Anticipo de renta"],
  ["bancaria", "4 x 1000 y comision bancaria"],
  ["supertransporte", "Supertransporte"],
  ["comision", "Comision"],
  ["tLopez", "T. Lopez"],
  ["descargue", "Descargue"],
  ["poliza", "Poliza RCE"],
  ["otrosDescuentos", "Otros descuentos"],
];

/** Nombre de cada paso de un gasto del libro. */
export const NOMBRE_PASO: Record<PartidaUtilidad["paso"], string> = {
  DIRECTO: "3. Gasto directo",
  CONDUCTOR: "4. Nomina del conductor",
  GENERAL: "5. Gasto general",
};

/** "2026-10" -> "Octubre 2026". */
export function nombreMes(mes: string): string {
  const t = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return t[0].toUpperCase() + t.slice(1);
}

/** El mes anterior a "AAAA-MM". */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}
