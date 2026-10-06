/** Estados del viaje para mostrar: nombre para la gente y tono de color. */
/** Nombre de cada estado para la gente (el codigo interno sigue en la base). */
export const ETIQUETA_ESTADO: Record<string, string> = {
  CONFIRMADO: "Expedido",
  CUMPLIDO: "Cumplido",
  ANULADO: "Anulado",
  VALIDACION_ERROR: "Error de validacion",
  REMESA_ERROR: "Error en remesa",
  MANIFIESTO_ERROR: "Error en manifiesto",
  ANULACION_ERROR: "Error al anular",
  REINTENTANDO: "Enviando...",
  ANULANDO: "Anulando...",
  CUMPLIENDO: "Cumpliendo...",
};

export function tonoEstado(estado: string): "ok" | "aviso" | "error" | "info" | "neutro" {
  if (estado === "CUMPLIDO") return "ok";
  if (estado === "CONFIRMADO") return "info";
  if (estado === "ANULADO") return "neutro";
  if (["REINTENTANDO", "ANULANDO", "CUMPLIENDO"].includes(estado)) return "aviso";
  return "error";
}

export const ERRORES = ["VALIDACION_ERROR", "REMESA_ERROR", "MANIFIESTO_ERROR", "ANULACION_ERROR"];
