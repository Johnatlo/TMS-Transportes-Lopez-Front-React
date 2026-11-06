/**
 * Mes ("2026-11") de una fecha, para el filtro "Mes" de las tablas. Acepta
 * "2026-11-05" o una fecha con hora ("2026-11-01T03:00:00.000Z"), que se pasa
 * a hora de Colombia (asi un viaje de la noche del 31 no cae en el mes
 * siguiente). Lo que no es fecha da "".
 */
export function mesDeFecha(v: unknown): string {
  const t = v === null || v === undefined ? "" : String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t.slice(0, 7);
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return "";
    // en-CA escribe el año y el mes como "2026-11".
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" }).format(d);
  }
  return "";
}
