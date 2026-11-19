/** Nombres para mostrar del libro de gastos (empresas, categorias, formas, periodicidad y tipo de factura). */
import type { EmpresaGasto, FormaGasto, Periodicidad, TipoFactura } from "../../api/cliente";

export const NOMBRE_EMPRESA: Record<EmpresaGasto, string> = { LOPEZ: "T. Lopez", MYC: "T. M&C" };

export const NOMBRE_CATEGORIA: Record<string, string> = {
  NOMINA: "Nomina",
  OFICINA: "Oficina",
  SERVICIOS: "Servicios",
  CREDITO: "Credito",
  VEHICULO: "Vehiculo",
  SEGUROS: "Seguros",
  IMPUESTOS: "Impuestos",
  SOCIO: "Gasto adicional del socio",
  OTROS: "Otros",
};

/** Como se lleva el gasto (lo que se elige arriba en el formulario). */
export const NOMBRE_FORMA: Record<FormaGasto, string> = {
  UNICO: "Pago unico",
  DIFERIDO: "Diferido en cuotas",
  RECURRENTE: "Recurrente",
};

export const NOMBRE_PERIODICIDAD: Record<Periodicidad, string> = { MENSUAL: "cada mes", QUINCENAL: "cada quincena" };

export const NOMBRE_TIPO_FACTURA: Record<TipoFactura, string> = { CREDITO: "Credito", DEBITO: "Debito" };

/** "2026-11" -> "Noviembre 2026". */
export const nombreMes = (mes: string) => {
  const t = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return t[0].toUpperCase() + t.slice(1);
};
