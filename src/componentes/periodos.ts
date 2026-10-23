/**
 * Periodos rapidos de los reportes (como en los programas contables): ultimos
 * dos meses, este mes, el mes anterior, esta quincena y este año. Trabajan con
 * fechas "AAAA-MM-DD" sin pasar por la zona horaria.
 */

/** Un periodo con su nombre. */
export interface Periodo {
  id: string;
  etiqueta: string;
  desde: string;
  hasta: string;
}

/** Ultimo dia de un mes (mes de 1 a 12). */
const ultimoDia = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();
/** 5 -> "05". */
const dos = (n: number) => String(n).padStart(2, "0");
/** Año, mes y dia -> "AAAA-MM-DD". */
const fecha = (a: number, m: number, d: number) => `${a}-${dos(m)}-${dos(d)}`;

/** Los periodos rapidos a partir de hoy ("AAAA-MM-DD"). */
export function periodosRapidos(hoy: string): Periodo[] {
  const [a, m, d] = hoy.split("-").map(Number);
  // Mismo dia, dos meses antes (o el ultimo dia de ese mes si no existe).
  const m2 = m - 2 <= 0 ? m + 10 : m - 2;
  const a2 = m - 2 <= 0 ? a - 1 : a;
  const mAnt = m === 1 ? 12 : m - 1;
  const aAnt = m === 1 ? a - 1 : a;
  return [
    { id: "dosMeses", etiqueta: "Ultimos 2 meses", desde: fecha(a2, m2, Math.min(d, ultimoDia(a2, m2))), hasta: hoy },
    { id: "mes", etiqueta: "Este mes", desde: fecha(a, m, 1), hasta: hoy },
    { id: "mesAnterior", etiqueta: "Mes anterior", desde: fecha(aAnt, mAnt, 1), hasta: fecha(aAnt, mAnt, ultimoDia(aAnt, mAnt)) },
    { id: "quincena", etiqueta: "Esta quincena", desde: fecha(a, m, d > 15 ? 16 : 1), hasta: hoy },
    { id: "anio", etiqueta: "Este año", desde: fecha(a, 1, 1), hasta: hoy },
  ];
}
