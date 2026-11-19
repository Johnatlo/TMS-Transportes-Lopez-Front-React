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
  EMPRESA: "Gasto de la empresa",
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

/** Los gastos de una categoria dentro de un paso, con su subtotal. */
export interface GrupoCategoria {
  categoria: string;
  partidas: PartidaUtilidad[];
  total: number;
}

/**
 * Agrupa los gastos de un paso por categoria (vehiculo, seguros, impuestos...)
 * para el desglose: las categorias en el orden del libro de gastos y, dentro
 * de cada una, los gastos de mayor a menor.
 */
export function porCategoria(partidas: PartidaUtilidad[], orden: string[]): GrupoCategoria[] {
  const grupos = new Map<string, PartidaUtilidad[]>();
  for (const p of partidas) grupos.set(p.categoria, [...(grupos.get(p.categoria) ?? []), p]);
  const posicion = (c: string) => (orden.includes(c) ? orden.indexOf(c) : orden.length);
  return [...grupos.entries()]
    .sort(([a], [b]) => posicion(a) - posicion(b) || a.localeCompare(b))
    .map(([categoria, lista]) => ({
      categoria,
      partidas: [...lista].sort((a, b) => b.monto - a.monto),
      total: Math.round(lista.reduce((s, p) => s + p.monto, 0) * 100) / 100,
    }));
}
