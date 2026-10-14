/**
 * Reglas del envio a facturacion (cuadro para la contadora): sugerir la
 * tarifa de la matriz de fletes, el peso a facturar, el total y la nota de la
 * factura, y agrupar los viajes por factura. Sin React: se prueban aparte
 * (facturacion.test.ts).
 */
import type { FilaPorFacturar, TarifaFlete } from "../../api/cliente";

/** Sufijos legales que no ayudan a reconocer al cliente ("SAS", "LTDA"...). */
const SUFIJOS = /\b(S\s?A\s?S|S\s?A|LTDA|S\s?EN\s?C|E\s?S\s?P|INC|E\s?U)\b/g;

/**
 * Nombre comparable: mayusculas, sin tildes, sin puntuacion y sin sufijos
 * legales. "RECOLAM S.EN C." -> "RECOLAM"; "TOLUA ... S.A.S." -> "TOLUA ...".
 */
export function normalizarNombre(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(SUFIJOS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palabras del nombre, sin la "S" final para que RECICLAJE y RECICLAJES coincidan. */
const palabras = (s: string) =>
  normalizarNombre(s)
    .split(" ")
    .map((p) => p.replace(/S$/, ""))
    .filter(Boolean);

/**
 * Que tanto se parece una tarifa al cliente del viaje (0 = nada). Se compara
 * contra la razon social de la tarifa y contra su nombre:
 * 3 = igual, 2 = uno contiene al otro, 1 = comparten la mayoria de palabras.
 */
export function parecido(empresa: string, tarifa: TarifaFlete): number {
  const e = palabras(empresa).join(" ");
  if (!e) return 0;
  let mejor = 0;
  for (const nombre of [tarifa.razonSocial, tarifa.nombre]) {
    const t = palabras(nombre ?? "").join(" ");
    if (!t) continue;
    if (t === e) mejor = Math.max(mejor, 3);
    else if (t.startsWith(e) || e.startsWith(t)) mejor = Math.max(mejor, 2);
    else {
      const pe = new Set(e.split(" "));
      const pt = t.split(" ");
      const comunes = pt.filter((p) => pe.has(p)).length;
      if (comunes >= Math.ceil(Math.min(pe.size, pt.length) * 0.6)) mejor = Math.max(mejor, 1);
    }
  }
  return mejor;
}

/** Tarifas especiales: no se sugieren solas (se eligen a mano). */
const ESPECIAL = /-\s*34\s*TON|CLIENTES|ADIC|URBANO/i;

/** Las tarifas del cliente, la mas parecida primero y luego la de nombre mas corto. */
export function tarifasDelCliente(empresa: string, tarifas: TarifaFlete[]): TarifaFlete[] {
  return tarifas
    .map((t) => ({ t, p: parecido(empresa, t) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.t.nombre.length - b.t.nombre.length)
    .map((x) => x.t);
}

/**
 * Tarifa sugerida para un viaje: la ultima usada con ese cliente; si no, la
 * mas parecida que no sea especial (-34 TON, clientes o ciudades adicionales,
 * urbano); si solo hay especiales, la primera. null si no hay ninguna.
 */
export function sugerirTarifa(empresa: string, tarifas: TarifaFlete[], ultimaId?: number | null): TarifaFlete | null {
  if (ultimaId) {
    const ultima = tarifas.find((t) => t.id === ultimaId);
    if (ultima) return ultima;
  }
  const delCliente = tarifasDelCliente(empresa, tarifas);
  return delCliente.find((t) => !ESPECIAL.test(t.nombre)) ?? delCliente[0] ?? null;
}

/** Peso a facturar: el real, o el minimo pactado si fue por menos (34000, 32000 kg). */
export function pesoAFacturar(pesoKg: number | null, tarifa: TarifaFlete | null): number | null {
  if (pesoKg === null) return tarifa?.pesoMinimoKg ?? null;
  return tarifa?.pesoMinimoKg && pesoKg < tarifa.pesoMinimoKg ? tarifa.pesoMinimoKg : pesoKg;
}

/** Total por peso: toneladas x valor por tonelada, en pesos enteros. */
export function totalPorPeso(pesoKg: number | null, valorTon: number | null): number | null {
  if (pesoKg === null || valorTon === null) return null;
  return Math.round((pesoKg / 1000) * valorTon);
}

/** "SZP339" -> "SZP-339" (como va en la nota y en el cuadro). */
export function placaConGuion(placa: string): string {
  const p = placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}\d/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

/** 34000 -> "34,000" (asi escriben las cifras en la nota). */
const miles = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * Nota de la factura, como la escriben a mano:
 * "REMISION 1111 TON 34,000 $150,000 SZP-339" (por peso) o
 * "REMISION 1111 $4,500,000 SZP-339" (fijo). CORAME / Cartones America van
 * con el numero del "transporte" en vez de la remision.
 */
export function notaFactura(d: {
  flujoCorame: boolean;
  remision: string;
  placa: string;
  tipo: "TON" | "FIJO";
  pesoKg: number | null;
  valorTon: number | null;
  total: number | null;
}): string {
  const partes = [d.flujoCorame ? "TRANSPORTE" : "REMISION", d.remision.trim() || "?"];
  if (d.tipo === "TON") {
    if (d.pesoKg !== null) partes.push("TON", miles(d.pesoKg));
    if (d.valorTon !== null) partes.push(`$${miles(d.valorTon)}`);
  } else if (d.total !== null) {
    partes.push(`$${miles(d.total)}`);
  }
  partes.push(placaConGuion(d.placa));
  return partes.join(" ");
}

/** Un viaje en el cuadro de envio, con lo que se puede editar. */
export interface FilaEnvio {
  fila: FilaPorFacturar;
  incluir: boolean;
  tarifaId: number | null;
  razonSocial: string;
  tipo: "TON" | "FIJO";
  valorTon: number | null;
  pesoFacturadoKg: number | null;
  /** Solo se escribe en FIJO; en TON se calcula. */
  totalFijo: number | null;
  remision: string;
  facturaNumero: string;
  notaFactura: string;
  /** Si la nota se edito a mano, ya no se rearma sola. */
  notaEditada: boolean;
}

/** Total de una fila: por peso (TON) o el fijo. */
export const totalDe = (e: FilaEnvio) => (e.tipo === "FIJO" ? e.totalFijo : totalPorPeso(e.pesoFacturadoKg, e.valorTon));

/** La nota que corresponde a los datos de la fila. */
export const notaDe = (e: FilaEnvio) =>
  notaFactura({
    flujoCorame: e.fila.flujoCorame,
    remision: e.remision,
    placa: e.fila.placa,
    tipo: e.tipo,
    pesoKg: e.pesoFacturadoKg,
    valorTon: e.valorTon,
    total: e.totalFijo,
  });

/**
 * Aplica una tarifa a la fila: tipo, valor, peso a facturar y razon social. La
 * nota se rearma si no se edito a mano.
 */
export function aplicarTarifa(e: FilaEnvio, tarifa: TarifaFlete | null): FilaEnvio {
  const fijo = tarifa?.tipo === "FIJO";
  const nueva: FilaEnvio = {
    ...e,
    tarifaId: tarifa?.id ?? null,
    tipo: fijo ? "FIJO" : "TON",
    valorTon: fijo ? null : tarifa?.valor ?? e.valorTon,
    totalFijo: fijo ? tarifa?.valor ?? e.totalFijo : null,
    pesoFacturadoKg: pesoAFacturar(e.fila.pesoKg, tarifa),
    razonSocial: tarifa?.razonSocial?.trim() || e.fila.empresa,
  };
  return nueva.notaEditada ? nueva : { ...nueva, notaFactura: notaDe(nueva) };
}

/**
 * Fila inicial del cuadro de envio. Si el viaje ya se habia enviado, se parte
 * de lo guardado; si no, de la tarifa sugerida.
 */
export function filaInicial(f: FilaPorFacturar, tarifas: TarifaFlete[], ultimaId?: number | null): FilaEnvio {
  const base: FilaEnvio = {
    fila: f,
    incluir: f.estado === "RADICADO" && !f.enviadoFacturarEn,
    tarifaId: null,
    razonSocial: f.empresa,
    tipo: "TON",
    valorTon: null,
    pesoFacturadoKg: f.pesoKg,
    totalFijo: null,
    remision: f.remision ?? "",
    facturaNumero: f.facturaNumero ?? "",
    notaFactura: "",
    notaEditada: false,
  };
  if (f.enviadoFacturarEn) {
    const tarifa = tarifas.find((t) => t.id === f.tarifaFleteId) ?? null;
    const guardada: FilaEnvio = {
      ...base,
      tarifaId: tarifa?.id ?? null,
      razonSocial: tarifa?.razonSocial?.trim() || f.empresa,
      tipo: f.tipoFlete === "FIJO" ? "FIJO" : "TON",
      valorTon: f.tarifaKilo === null ? null : Math.round(f.tarifaKilo * 1000 * 100) / 100,
      pesoFacturadoKg: f.pesoFacturadoKg ?? f.pesoKg,
      totalFijo: f.valorFijo,
      notaFactura: f.notaFactura ?? "",
      notaEditada: !!f.notaFactura,
    };
    return guardada.notaEditada ? guardada : { ...guardada, notaFactura: notaDe(guardada) };
  }
  return aplicarTarifa(base, sugerirTarifa(f.empresa, tarifas, ultimaId));
}

/**
 * Bloques del cuadro: los viajes con el mismo numero de factura van juntos
 * (en el orden en que aparece cada factura); los que no tienen numero van
 * cada uno en su propio bloque.
 */
export function agruparPorFactura<T extends { facturaNumero: string }>(filas: T[]): T[][] {
  const bloques: T[][] = [];
  const porNumero = new Map<string, T[]>();
  for (const f of filas) {
    const numero = f.facturaNumero.trim().toUpperCase();
    if (!numero) {
      bloques.push([f]);
      continue;
    }
    const bloque = porNumero.get(numero);
    if (bloque) bloque.push(f);
    else {
      const nuevo = [f];
      porNumero.set(numero, nuevo);
      bloques.push(nuevo);
    }
  }
  return bloques;
}

/** Fila cruda leida del Excel de la matriz (columnas A a E). */
export interface FilaMatrizCruda {
  nombre: unknown;
  razonSocial: unknown;
  valor: unknown;
  tipo: unknown;
  observaciones: unknown;
}

/**
 * Convierte las filas del Excel "MATRIZ FLETES" en tarifas.
 *
 * - Sin nombre: se ignora. Valor no numerico ("?"): sin valor.
 * - Las filas "X -34 TON" (fijo cuando va por menos de 34 toneladas) no son
 *   una tarifa aparte: se convierten en peso minimo de 34000 kg de "X".
 */
export function convertirMatriz(filas: FilaMatrizCruda[]): Omit<TarifaFlete, "id">[] {
  const texto = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
  const minimos = new Set<string>();
  const tarifas: Omit<TarifaFlete, "id">[] = [];
  for (const f of filas) {
    const nombre = texto(f.nombre);
    if (!nombre) continue;
    const menos34 = /^(.*?)\s*-\s*34\s*TON$/i.exec(nombre);
    if (menos34) {
      minimos.add(normalizarNombre(menos34[1]));
      continue;
    }
    const valor = typeof f.valor === "number" ? f.valor : Number(texto(f.valor).replace(/,/g, ""));
    const tipo = texto(f.tipo).toUpperCase();
    tarifas.push({
      nombre,
      razonSocial: texto(f.razonSocial) || null,
      valor: Number.isFinite(valor) && texto(f.valor) !== "" ? valor : null,
      tipo: (["TON", "FIJO", "POR", "POR3"].includes(tipo) ? tipo : "TON") as TarifaFlete["tipo"],
      pesoMinimoKg: null,
      observaciones: texto(f.observaciones) || null,
    });
  }
  return tarifas.map((t) => (minimos.has(normalizarNombre(t.nombre)) ? { ...t, pesoMinimoKg: 34000 } : t));
}
