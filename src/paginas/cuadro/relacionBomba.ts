/**
 * Lectura de la relacion quincenal de la bomba ("RELACION VALES DESPACHO -
 * CONSUMO" de COESCO, una por factura: AE5044797). Llega en PDF o en Excel;
 * de los dos se sacan el numero de la factura, su fecha y los vales (EDS,
 * numero de vale, fecha, hora, placa, galones y valor).
 *
 * leerPdf usa pdfjs (cargado solo cuando se usa) y devuelve los textos de
 * cada pagina con su posicion; valesDesdePdf y valesDesdeFilas no dependen de
 * ninguna libreria y se prueban aparte (relacionBomba.test.ts).
 */
import type { ValeBomba } from "../../api/cliente";
import { fechaCelda, numeroCelda } from "../seguimiento/cargaExcel";

/** Un texto del PDF con su posicion (x a la derecha, y hacia arriba, en puntos). */
export interface TextoPdf {
  x: number;
  y: number;
  texto: string;
}

/** Lo que trae una relacion de la bomba. */
export interface RelacionLeida {
  /** Numero de la factura (AE5044797); null si no se encontro. */
  numero: string | null;
  /** Fecha de la factura "AAAA-MM-DD"; null si no se encontro. */
  fecha: string | null;
  vales: ValeBomba[];
}

/** Lee los textos de cada pagina del PDF (pdfjs se descarga solo al usarlo). */
export async function leerPdf(archivo: File): Promise<TextoPdf[][]> {
  const pdfjs = await import("pdfjs-dist");
  const { default: trabajador } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = trabajador;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
  const paginas: TextoPdf[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const contenido = await (await doc.getPage(n)).getTextContent();
    paginas.push(
      contenido.items
        .filter((it): it is typeof it & { str: string; transform: number[] } => "str" in it && !!it.str.trim())
        .map((it) => ({ x: it.transform[4], y: it.transform[5], texto: it.str.trim() }))
    );
  }
  return paginas;
}

/** "30/09/2026" -> "2026-09-30"; null si no es fecha. */
const fechaDma = (t: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** Galones como los escribe la bomba: "89,767" son 89.767 galones (coma decimal). */
export function galonesTexto(t: string): number | null {
  const limpio = t.trim();
  if (/^\d+,\d{1,3}$/.test(limpio)) return Number(limpio.replace(",", "."));
  const n = Number(limpio.replace(/,/g, ""));
  return Number.isFinite(n) && limpio !== "" ? n : null;
}

/** Valor en pesos: "1,000,000.00" -> 1000000. */
const valorTexto = (t: string) => {
  const n = Number(t.trim().replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
};

/** Numero de la factura de la bomba: dos letras y digitos (AE5044797). */
const NUMERO_FACTURA = /^[A-Z]{2}\d{5,}$/;
/** Numero de vale: V y digitos (V56300011898). */
const NUMERO_VALE = /^V\d{6,}$/;

/**
 * Vales del PDF de la relacion. Cada vale es una fila que empieza en su
 * numero (V...). En la misma linea van la EDS, la fecha, la hora, la placa,
 * los galones y el valor (el numero mas a la derecha). La placa a veces sigue
 * en la linea de abajo ("SWN62" + "3"): se junta lo que esta en la columna de
 * la placa hasta la siguiente fila.
 */
export function valesDesdePdf(paginas: TextoPdf[][]): RelacionLeida {
  let numero: string | null = null;
  let fecha: string | null = null;
  const vales: ValeBomba[] = [];
  for (const items of paginas) {
    numero ??= items.find((i) => NUMERO_FACTURA.test(i.texto))?.texto ?? null;
    // La fecha de la factura va al lado de "Fecha:" (arriba de la tabla).
    const etiqueta = items.find((i) => /^Fecha:?$/i.test(i.texto) && i.texto.includes(":"));
    if (!fecha && etiqueta) {
      const f = items.filter((i) => Math.abs(i.y - etiqueta.y) <= 4 && i.x > etiqueta.x).sort((a, b) => a.x - b.x)[0];
      fecha = f ? fechaDma(f.texto) : null;
    }
    const xPlaca = items.find((i) => /^Placa$/i.test(i.texto))?.x ?? null;
    const filas = items.filter((i) => NUMERO_VALE.test(i.texto)).sort((a, b) => b.y - a.y);
    filas.forEach((fila, n) => {
      const linea = items.filter((i) => Math.abs(i.y - fila.y) <= 4).sort((a, b) => a.x - b.x);
      const abajo = n + 1 < filas.length ? filas[n + 1].y : -Infinity;
      const eds = linea.find((i) => /^EDS\b/i.test(i.texto))?.texto ?? "";
      const fechaVale = linea.map((i) => fechaDma(i.texto)).find(Boolean) ?? null;
      const hora = linea.find((i) => /^\d{1,2}:\d{2}(:\d{2})?$/.test(i.texto))?.texto ?? null;
      // Placa: lo que esta en su columna, en esta linea y debajo (antes de la siguiente fila).
      const enPlaca = xPlaca === null ? [] : items.filter((i) => Math.abs(i.x - xPlaca) <= 6 && i.y <= fila.y + 4 && i.y > abajo + 4);
      const placa = enPlaca
        .sort((a, b) => b.y - a.y)
        .map((i) => i.texto)
        .join("")
        .replace(/[^A-Z0-9]/gi, "")
        .toUpperCase();
      const numeros = linea.filter((i) => /^[\d.,]+$/.test(i.texto) && i.x > (xPlaca ?? 0));
      const valor = numeros.length ? valorTexto(numeros[numeros.length - 1].texto) : null;
      const galones = numeros.length > 1 ? galonesTexto(numeros[numeros.length - 2].texto) : null;
      if (!fechaVale || !valor || !placa) return;
      vales.push({ eds, vale: fila.texto, fecha: fechaVale, hora, placa, galones, valor });
    });
  }
  return { numero, fecha, vales };
}

/** Titulo comparable: mayusculas, sin tildes ni puntos, espacios simples. */
const titulo = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Vales del Excel de la relacion: la fila de titulos tiene "Nro. Docu" (o
 * "Vale"), "Placa" y "Valor"; las demas columnas (EDS, Fecha, Hora, Cant.)
 * se toman si estan. El numero de la factura se busca arriba de los titulos.
 */
export function valesDesdeFilas(filas: unknown[][]): RelacionLeida {
  const i = filas.findIndex((f) => {
    const t = f.map(titulo);
    return t.some((c) => c === "NRO DOCU" || c === "VALE") && t.includes("PLACA") && t.includes("VALOR");
  });
  if (i < 0) throw new Error('No se encontro la fila de titulos de la relacion (Nro. Docu, Placa, Valor).');
  const t = filas[i].map(titulo);
  const col = (...nombres: string[]) => t.findIndex((c) => nombres.includes(c));
  const c = { eds: col("EDS"), vale: col("NRO DOCU", "VALE"), fecha: col("FECHA"), hora: col("HORA"), placa: col("PLACA"), galones: col("CANT", "CANTIDAD", "GALONES"), valor: col("VALOR") };
  const arriba = filas.slice(0, i).flat().map((v) => String(v ?? "").trim());
  const numero = arriba.find((v) => NUMERO_FACTURA.test(v)) ?? null;
  const fechaArriba = filas.slice(0, i).flat().map((v) => fechaCelda(v) ?? fechaDma(String(v ?? ""))).find(Boolean) ?? null;
  const vales: ValeBomba[] = [];
  for (const f of filas.slice(i + 1)) {
    const valor = numeroCelda(f[c.valor]);
    const placa = String(f[c.placa] ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const fechaVale = c.fecha >= 0 ? fechaCelda(f[c.fecha]) ?? fechaDma(String(f[c.fecha] ?? "")) : null;
    if (!valor || !placa || !fechaVale) continue;
    const galones = c.galones >= 0 ? (typeof f[c.galones] === "number" ? (f[c.galones] as number) : galonesTexto(String(f[c.galones] ?? ""))) : null;
    vales.push({
      eds: c.eds >= 0 ? String(f[c.eds] ?? "").trim() : "",
      vale: c.vale >= 0 ? String(f[c.vale] ?? "").trim() || null : null,
      fecha: fechaVale,
      hora: c.hora >= 0 ? String(f[c.hora] ?? "").trim() || null : null,
      placa,
      galones,
      valor: Math.round(valor),
    });
  }
  return { numero, fecha: fechaArriba, vales };
}
