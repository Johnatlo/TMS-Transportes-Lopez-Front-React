/**
 * Excel del preoperacional:
 * - leerMatriz: lee la "MATRIZ CONTROL INTEGRAL CONDUCTORES" (los enlaces
 *   precargados de la hoja RESPUESTAS, el ultimo mantenimiento de "Documentos
 *   Vehiculo", el vencimiento del extintor de "Equipo Carretera" y EPS / ARL /
 *   pension de "Datos Conductor") para sugerir las respuestas.
 * - descargarPreoperacionales: el historico con una columna por pregunta, con
 *   el formato de los demas Excel (ver componentes/excelTabla.ts).
 *
 * exceljs se carga solo al usarlo.
 */
import type { Cell, Worksheet } from "exceljs";
import type { Preoperacional } from "../../api/cliente";
import { descargarTabla } from "../../componentes/excelTabla";
import { PREGUNTAS, respuestasDeEnlace } from "./preguntasPreoperacional";

/** Lo que se importa de la matriz. */
export interface MatrizPreoperacional {
  vehiculos: Array<{ placa: string; conductor: string; respuestas: Record<string, string> }>;
  conductores: Array<{ cedula: string; nombre: string; eps: string; arl: string; pension: string }>;
}

/** Texto de una celda (enlaces, textos enriquecidos y fechas como 2026-12-31). */
function textoCelda(c: Cell): string {
  const v = c.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("hyperlink" in v && v.hyperlink) return String(v.hyperlink);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return v.result instanceof Date ? v.result.toISOString().slice(0, 10) : String(v.result ?? "");
  }
  return String(v).trim();
}

/** Placa sin guion para cruzar las hojas. */
const clavePlaca = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

/** Filas de una hoja como objetos por titulo de columna (la fila 1 es el encabezado). */
function filas(hoja: Worksheet | undefined): Array<Record<string, Cell>> {
  if (!hoja) return [];
  const titulos: string[] = [];
  hoja.getRow(1).eachCell((c, i) => (titulos[i] = textoCelda(c).toUpperCase()));
  const out: Array<Record<string, Cell>> = [];
  hoja.eachRow((f, n) => {
    if (n === 1) return;
    const o: Record<string, Cell> = {};
    f.eachCell({ includeEmpty: true }, (c, i) => titulos[i] && (o[titulos[i]] = c));
    out.push(o);
  });
  return out;
}

/** Celda de la primera columna cuyo titulo empieza por alguno de los textos. */
const columna = (f: Record<string, Cell>, ...inicios: string[]) => {
  const k = Object.keys(f).find((t) => inicios.some((i) => t.startsWith(i)));
  return k ? textoCelda(f[k]) : "";
};

/** Lee la matriz de control integral (ver el comentario del archivo). */
export async function leerMatriz(archivo: File): Promise<MatrizPreoperacional> {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  const hoja = (nombre: string) => libro.worksheets.find((h) => h.name.trim().toUpperCase().startsWith(nombre));

  // Ultimo mantenimiento (Documentos Vehiculo) y vencimiento del extintor (Equipo Carretera), por placa.
  const mantenimiento = new Map<string, string>();
  for (const f of filas(hoja("DOCUMENTOS VEH"))) {
    const placa = clavePlaca(columna(f, "PLACA"));
    const fecha = columna(f, "FECHA ULTIMO MANT", "FECHA ÚLTIMO MANT");
    if (placa && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) mantenimiento.set(placa, fecha);
  }
  const extintor = new Map<string, string>();
  for (const f of filas(hoja("EQUIPO CARRETERA"))) {
    const placa = clavePlaca(columna(f, "PLACA"));
    const fecha = columna(f, "FECHA VENC. EXTINTOR", "FECHA VENC EXTINTOR");
    if (placa && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) extintor.set(placa, fecha);
  }

  // Un juego de respuestas por enlace precargado (placa y conductor).
  const vehiculos: MatrizPreoperacional["vehiculos"] = [];
  const respuestas = hoja("RESPUESTAS");
  respuestas?.eachRow((f, n) => {
    if (n === 1) return;
    const enlace = textoCelda(f.getCell(1));
    if (!/^https?:\/\//.test(enlace)) return;
    const r = respuestasDeEnlace(enlace);
    const placa = r.placa || textoCelda(f.getCell(2)).split(" ")[0];
    if (!placa) return;
    const p = clavePlaca(placa);
    if (mantenimiento.has(p)) r.fechaMantenimiento = mantenimiento.get(p)!;
    if (extintor.has(p) && !r.vencExtintor) r.vencExtintor = extintor.get(p)!;
    vehiculos.push({ placa, conductor: r.conductor ?? "", respuestas: r });
  });

  // EPS, ARL y pension por cedula.
  const conductores = filas(hoja("DATOS CONDUCTOR"))
    .map((f) => ({
      cedula: columna(f, "CÉDULA", "CEDULA").replace(/\D/g, ""),
      nombre: columna(f, "NOMBRE"),
      eps: columna(f, "EPS"),
      arl: columna(f, "ARL"),
      pension: columna(f, "PENSIÓN", "PENSION"),
    }))
    .filter((c) => c.cedula);
  return { vehiculos, conductores };
}

/** Descarga el historico de inspecciones: una fila por inspeccion y una columna por pregunta. */
export async function descargarPreoperacionales(lista: Preoperacional[], nombreArchivo: string): Promise<void> {
  const columnas = [
    { titulo: "Fecha", valores: lista.map((p) => p.fecha) },
    { titulo: "Placa", valores: lista.map((p) => p.placa) },
    { titulo: "Conductor", valores: lista.map((p) => p.conductor) },
    { titulo: "Manifiesto", valores: lista.map((p) => p.manifiesto) },
    { titulo: "Aprobo", valores: lista.map((p) => (p.aprobo ? "Sí" : "No")) },
    ...PREGUNTAS.filter((q) => !["fechaInspeccion", "placa", "conductor", "aprobo"].includes(q.clave)).flatMap((q) => [
      { titulo: q.titulo, valores: lista.map((p) => p.respuestas[q.clave] ?? "") },
      ...(q.novedad ? [{ titulo: `${q.titulo} - novedad`, valores: lista.map((p) => p.respuestas[q.novedad!] ?? "") }] : []),
    ]),
    { titulo: "Registro", valores: lista.map((p) => p.creadoPor) },
  ];
  await descargarTabla(columnas, "Preoperacional", nombreArchivo);
}
