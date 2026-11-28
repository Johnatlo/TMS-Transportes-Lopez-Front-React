/**
 * Reglas del Inicio: estado de cada viaje segun sus citas, avance en el mapa,
 * viajes por semana y formatos de fecha y ruta (hora de Colombia).
 */
import type { PlantillaViaje, Viaje } from "../../api/tipos";

export const DIA = 86_400_000;

/** Estado de un viaje en el Inicio. */
export type EstadoViaje = "En camino" | "Programado" | "Finalizado" | "Anulado" | "Con incidencia";

/**
 * Estado para el Inicio: Anulado, Finalizado (cumplido o ya paso la cita de
 * descargue), Con incidencia (cualquier error), Programado (aun no carga) o En
 * camino (entre la cita de cargue y la de descargue).
 */
export function estadoViaje(v: Viaje, ahora: Date): EstadoViaje {
  if (v.estado === "ANULADO") return "Anulado";
  if (v.estado === "CUMPLIDO") return "Finalizado";
  if (v.estado !== "CONFIRMADO") return "Con incidencia";
  const ini = new Date(v.fechaHoraCargue).getTime();
  const fin = v.fechaHoraDescargue ? new Date(v.fechaHoraDescargue).getTime() : ini;
  if (ahora.getTime() < ini) return "Programado";
  if (ahora.getTime() <= fin) return "En camino";
  return "Finalizado";
}

/** Clase CSS del color de cada estado. */
export function claseEstado(e: EstadoViaje): string {
  return {
    "En camino": "estado-azul",
    Programado: "estado-gris",
    Finalizado: "estado-verde",
    Anulado: "estado-neutro",
    "Con incidencia": "estado-rojo",
  }[e];
}

/**
 * Fraccion del viaje recorrida (0 a 1) segun la hora actual entre la cita de
 * cargue y la de descargue. Para el mapa y la barra de avance.
 */
export function avance(v: Viaje, ahora: Date): number {
  const ini = new Date(v.fechaHoraCargue).getTime();
  const fin = v.fechaHoraDescargue ? new Date(v.fechaHoraDescargue).getTime() : ini;
  if (fin <= ini) return 1;
  return Math.min(1, Math.max(0, (ahora.getTime() - ini) / (fin - ini)));
}

/** "AAAA-MM-DD" del dia en Colombia. */
export function claveDia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(d);
}

/** "HH:MM" en hora de Colombia; vacio sin valor. */
export function hora(valor: string | null): string {
  return valor
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(valor))
    : "";
}

/** "DD/MM" en hora de Colombia (no del texto UTC: de noche seria el dia siguiente). */
export function diaMes(valor: string): string {
  const [, m, d] = claveDia(new Date(valor)).split("-");
  return `${d}/${m}`;
}

/** "Ciudad origen -> ciudad destino" de una plantilla, con el municipio corto. */
export function ruta(p: PlantillaViaje | undefined): string {
  if (!p) return "-";
  return `${corto(p.remitente?.ciudad)} → ${corto(p.destinatario?.ciudad)}`;
}

/** "SOACHA CUNDINAMARCA" -> "Soacha": el municipio sin el departamento. */
export function corto(ciudad: string | null | undefined): string {
  if (!ciudad) return "?";
  const primera = ciudad.split(" ")[0];
  return primera.charAt(0) + primera.slice(1).toLowerCase();
}

/** Variacion porcentual; null si no hay base para comparar. */
export function variacion(actual: number, previo: number): number | null {
  if (previo === 0) return null;
  return Math.round(((actual - previo) / previo) * 100);
}

/** Viajes de una semana (lunes a domingo). */
export interface Semana {
  total: number;
  /** Lunes a domingo. */
  porDia: number[];
  etiqueta: string;
}

/**
 * Viajes confirmados por semana (lunes a domingo, hora de Colombia), por fecha
 * de expedicion. Devuelve la semana actual y las 4 anteriores.
 */
export function viajesPorSemana(viajes: Viaje[], ahora: Date): Semana[] {
  const [a, m, d] = claveDia(ahora).split("-").map(Number);
  const hoyUtc = Date.UTC(a, m - 1, d);
  const diaSemana = (new Date(hoyUtc).getUTCDay() + 6) % 7; // 0 = lunes
  const lunes = hoyUtc - diaSemana * DIA;
  return Array.from({ length: 5 }, (_, s) => {
    const inicio = lunes - s * 7 * DIA;
    const porDia = Array(7).fill(0);
    for (const v of viajes) {
      const [va, vm, vd] = claveDia(new Date(v.fechaCreacion)).split("-").map(Number);
      const i = (Date.UTC(va, vm - 1, vd) - inicio) / DIA;
      if (i >= 0 && i < 7) porDia[i]++;
    }
    const fin = new Date(inicio + 6 * DIA);
    const ini = new Date(inicio);
    const f = (x: Date) => `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
    return { total: porDia.reduce((x, y) => x + y, 0), porDia, etiqueta: `${f(ini)} - ${f(fin)}` };
  });
}
