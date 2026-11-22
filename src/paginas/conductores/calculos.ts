/**
 * Calculos del modulo Conductores en el navegador (los mismos de
 * backend/src/calculoConductores.ts, para ver el resultado mientras se
 * escribe) y lectura de la matriz de fletes conductor desde el Excel.
 */
import type { ConceptoCuenta } from "../../api/cliente";

/** Conceptos de la hoja de cuenta de viaje, en su orden, con su nombre. */
export const CONCEPTOS: Array<[ConceptoCuenta, string]> = [
  ["acpm", "ACPM"],
  ["peajes", "Peajes"],
  ["cargue", "Cargue"],
  ["descargue", "Descargue"],
  ["parqueo", "Parqueo"],
  ["llantas", "Llantas"],
  ["lavada", "Lavada"],
  ["comision", "Comision"],
  ["engrase", "Engrase"],
  ["propinas", "Propinas"],
  ["arreglos", "Arreglos"],
  ["accesorios", "Accesorios"],
  ["otros", "Otros"],
];

/** Centavos exactos. */
const c2 = (v: number) => Math.round(v * 100 + Number.EPSILON) / 100;
/** Numero de un campo (vacio = 0). */
const numero = (v: string) => (v.trim() === "" ? 0 : Number(v) || 0);

/**
 * Totales de la cuenta de viaje mientras se escribe: el ACPM vacio es el
 * combustible de los anticipos; el saldo es gastos - lo recibido (positivo:
 * se le debe al conductor; negativo: el conductor debe).
 */
export function totalesCuenta(valores: Record<ConceptoCuenta, string>, combustible: number, recibido: number) {
  const acpm = valores.acpm.trim() === "" ? combustible : numero(valores.acpm);
  const total = c2(CONCEPTOS.reduce((s, [k]) => s + (k === "acpm" ? acpm : numero(valores[k])), 0));
  return { acpm, total, saldo: c2(total - recibido) };
}

/** Texto del saldo con el conductor. */
export const textoSaldo = (saldo: number) => (saldo > 0 ? "Se le debe al conductor" : saldo < 0 ? "El conductor debe" : "A paz y salvo");

/** Una fila de la matriz leida del Excel. */
export interface FilaMatriz {
  nombre: string;
  valor: number;
  tipo: string;
  desde: string | null;
}

/** Texto de una celda para comparar encabezados. */
const texto = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

/** Fecha de una celda (Date o "AAAA-MM-DD") en "AAAA-MM-DD", o null. */
function fecha(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const t = String(v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

/**
 * La matriz de fletes conductor de una hoja (filas x columnas, como el Excel
 * "SWK-973" hoja TABLAS): busca el titulo "FLETES CONDUCTOR", toma los
 * encabezados de la fila de abajo (EMPRESA, VALOR, FECHA VIGENCIA, TIPO) y lee
 * las filas hasta la primera sin nombre. Sin ese titulo, busca directamente
 * una fila con EMPRESA y VALOR. Devuelve [] si no la encuentra.
 */
export function leerMatrizConductor(filas: unknown[][]): FilaMatriz[] {
  let filaTitulo = -1;
  let colInicio = 0;
  filas.forEach((f, i) => {
    if (filaTitulo >= 0) return;
    const c = f.findIndex((v) => texto(v) === "FLETES CONDUCTOR");
    if (c >= 0) {
      filaTitulo = i;
      colInicio = c;
    }
  });
  const filaEnc = filaTitulo >= 0 ? filaTitulo + 1 : filas.findIndex((f) => f.some((v) => texto(v) === "EMPRESA") && f.some((v) => texto(v) === "VALOR"));
  if (filaEnc < 0 || !filas[filaEnc]) return [];
  const enc = filas[filaEnc];
  /** Columna de un encabezado (desde el inicio del bloque del conductor). */
  const col = (nombre: string) => enc.findIndex((v, i) => i >= colInicio && texto(v) === nombre);
  const cNombre = col("EMPRESA");
  const cValor = col("VALOR");
  const cTipo = col("TIPO");
  const cDesde = col("FECHA VIGENCIA");
  if (cNombre < 0 || cValor < 0) return [];
  const resultado: FilaMatriz[] = [];
  for (const f of filas.slice(filaEnc + 1)) {
    const nombre = String(f[cNombre] ?? "").trim();
    if (!nombre) break;
    const valor = Number(f[cValor]);
    if (!Number.isFinite(valor) || valor <= 0) continue;
    const t = texto(cTipo >= 0 ? f[cTipo] : "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    resultado.push({ nombre, valor, tipo: t === "FIJO" || t === "INTEGRO" ? t : "TON", desde: cDesde >= 0 ? fecha(f[cDesde]) : null });
  }
  return resultado;
}

/** "2026-11" -> "2026-10". */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}
