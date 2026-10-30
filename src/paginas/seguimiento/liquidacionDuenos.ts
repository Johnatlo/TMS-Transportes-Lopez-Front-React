/**
 * Liquidacion a un dueno (igual a docs/Liq duenos ejemplo.xlsx): sus viajes
 * con el saldo de cada uno, los conceptos que se le suman o descuentan y lo
 * que se le paga; lo que no se pague queda pendiente para la siguiente.
 *
 * No depende de exceljs: se prueba aparte (liquidacionDuenos.test.ts) y el
 * Excel lo arma excelLiquidacionDueno.ts.
 */
import type { ConceptoLiquidacion, FilaLiquidacionDueno, FilaRentabilidad, LiquidacionDueno } from "../../api/cliente";

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

/** "2026-07-08" -> "08-JULIO - 2026", como en el titulo del ejemplo. */
export const fechaCuenta = (fecha: string) => {
  const [a, m, d] = fecha.split("-");
  return `${d}-${MESES[Number(m) - 1]} - ${a}`;
};

/** Titulo de la hoja: "CUENTAS MILLER A 08-JULIO - 2026". */
export const tituloCuenta = (nombre: string, fecha: string) => `CUENTAS ${nombre.toUpperCase()} A ${fechaCuenta(fecha)}`;

/** Deja una cuenta escrita como la entiende Excel: sin espacios ni puntos de mil y con punto decimal. */
export const limpiarExpresion = (texto: string) =>
  texto
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,/g, ".");

/**
 * Valor de una cuenta sencilla ("82000/12*2", "(5711800/14)*4"): numeros, + - *
 * / y parentesis. null si no se entiende o da algo que no es un numero.
 */
export function evaluarExpresion(texto: string): number | null {
  const s = limpiarExpresion(texto);
  let i = 0;
  const factor = (): number => {
    if (s[i] === "-" || s[i] === "+") {
      const signo = s[i++] === "-" ? -1 : 1;
      return signo * factor();
    }
    if (s[i] === "(") {
      i++;
      const v = suma();
      if (s[i++] !== ")") throw new Error("parentesis");
      return v;
    }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) throw new Error("numero");
    i += m[0].length;
    return Number(m[0]);
  };
  const producto = (): number => {
    let v = factor();
    while (s[i] === "*" || s[i] === "/") v = s[i++] === "*" ? v * factor() : v / factor();
    return v;
  };
  const suma = (): number => {
    let v = producto();
    while (s[i] === "+" || s[i] === "-") v = s[i++] === "+" ? v + producto() : v - producto();
    return v;
  };
  try {
    const v = suma();
    return i === s.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** La foto de un viaje para la liquidacion: su saldo sin los otros descuentos, que van como conceptos. */
export const filaDeViaje = (f: FilaRentabilidad): FilaLiquidacionDueno => ({
  id: f.id,
  fecha: f.fecha,
  placa: f.placa,
  empresa: f.empresa,
  remision: f.remision,
  manifiesto: f.manifiesto,
  facturaNumero: f.facturaNumero,
  facturaFecha: f.facturaFecha,
  valorEmpresa: f.valorEmpresa,
  retencion: f.retencion,
  reteIca: f.reteIca,
  anticipoRenta: f.anticipoRenta,
  bancaria: f.bancaria,
  supertransporte: f.supertransporte,
  comision: f.comision,
  tLopez: f.tLopez,
  descargue: f.descargue,
  poliza: f.poliza,
  anticipo: f.anticipo,
  saldo: f.saldoBeneficiario + f.otrosDescuentos,
  fechaPagoEmpresa: f.fechaPagoEmpresa,
});

/** Los conceptos que salen solos: el saldo de la liquidacion anterior y los otros descuentos de los viajes. */
export function conceptosAutomaticos(viajes: FilaRentabilidad[], anterior: LiquidacionDueno | null): ConceptoLiquidacion[] {
  const conceptos: ConceptoLiquidacion[] = [];
  if (anterior?.saldoPendiente) {
    conceptos.push({
      descripcion: `SALDO PENDIENTE CUENTAS ${anterior.nombre.toUpperCase()} A ${fechaCuenta(anterior.fecha)}`,
      expresion: "",
      valor: anterior.saldoPendiente,
    });
  }
  for (const v of viajes) {
    if (v.otrosDescuentos) {
      conceptos.push({
        descripcion: `${v.rentOtrosConcepto ?? "Otros descuentos"} ${v.placa} (${v.remision ?? v.manifiesto ?? "sin remision"})`,
        expresion: "",
        valor: -v.otrosDescuentos,
      });
    }
  }
  return conceptos;
}

/** Arma la liquidacion. Sin valor pagado se le paga todo; con total negativo, nada (queda debiendo). */
export function armarLiquidacionDueno(
  viajes: FilaRentabilidad[],
  conceptos: ConceptoLiquidacion[],
  { grupo, nombre, fecha, pagado }: { grupo: string; nombre: string; fecha: string; pagado: number | null }
): LiquidacionDueno {
  const filas = [...viajes].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id).map(filaDeViaje);
  const totalViajes = filas.reduce((s, f) => s + f.saldo, 0);
  const total = Math.round(totalViajes + conceptos.reduce((s, c) => s + c.valor, 0));
  const valorPagado = pagado ?? Math.max(total, 0);
  return { id: null, grupo, nombre, fecha, filas, conceptos, totalViajes, total, pagado: valorPagado, saldoPendiente: total - valorPagado };
}
