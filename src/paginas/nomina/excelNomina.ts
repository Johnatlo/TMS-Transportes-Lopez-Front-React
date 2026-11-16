/**
 * Excel de una nomina con las mismas columnas del "Modelo Nomina" que se
 * llevaba a mano (empleado y empleador), pero con los aportes ya redondeados
 * una sola vez y el costo del empleador sin contar dos veces pension, ARL y
 * caja. Una fila por empleado y la fila de totales que agrega descargarTabla.
 */
import type { LineaNomina, Nomina } from "../../api/cliente";

/** Nombre de la empresa como en el Excel de nomina. */
const EMPRESA = { LOPEZ: "Transportes Lopez C SAS", MYC: "Transportes M&C SAS" } as const;

/** Columnas del Excel: titulo y valor de cada linea. */
export const COLUMNAS_EXCEL: Array<[string, (l: LineaNomina) => string | number | null, boolean?]> = [
  ["Empresa", (l) => EMPRESA[l.empresa]],
  ["Empleado", (l) => l.nombre],
  ["Tipo", (l) => (l.tipo === "CONDUCTOR" ? "Conductor" : (l.cargo ?? "Oficina"))],
  ["Vehiculo", (l) => l.placa],
  ["Dias", (l) => l.dias, true],
  ["Producido", (l) => l.producido, true],
  ["Salario basico", (l) => l.calculo.basico, true],
  ["Auxilio de transporte", (l) => l.calculo.auxilio, true],
  ["Sueldo variable", (l) => l.calculo.variable, true],
  ["Total salarial", (l) => l.calculo.salarial, true],
  ["Viaticos", (l) => l.calculo.viaticos, true],
  ["Devengado", (l) => l.calculo.devengado, true],
  ["Salud empleado", (l) => l.calculo.saludEmpleado, true],
  ["Pension empleado", (l) => l.calculo.pensionEmpleado, true],
  ["Total a pagar", (l) => l.calculo.neto, true],
  ["Pension empleador", (l) => l.calculo.pensionEmpleador, true],
  ["Salud empleador", (l) => l.calculo.saludEmpleador, true],
  ["ARL", (l) => l.calculo.arl, true],
  ["Caja", (l) => l.calculo.caja, true],
  ["Prima", (l) => l.calculo.prima, true],
  ["Cesantias", (l) => l.calculo.cesantias, true],
  ["Int. cesantias", (l) => l.calculo.interesesCesantias, true],
  ["Vacaciones", (l) => l.calculo.vacaciones, true],
  ["Ajuste", (l) => l.calculo.ajuste, true],
  ["Nota del ajuste", (l) => l.notaAjuste],
  ["Costo empleador", (l) => l.calculo.costoEmpleador, true],
  ["Costo total", (l) => l.calculo.costoTotal, true],
  ["Pension total (PILA)", (l) => l.calculo.pensionEmpleado + l.calculo.pensionEmpleador, true],
];

/** Descarga el Excel de la nomina. */
export async function exportarNomina(n: Nomina): Promise<void> {
  const { descargarTabla } = await import("../../componentes/excelTabla");
  await descargarTabla(
    COLUMNAS_EXCEL.map(([titulo, valor, derecha]) => ({ titulo, valores: n.lineas.map(valor), derecha })),
    `Nomina ${n.desde.slice(5).split("-").reverse().join("-")} a ${n.hasta.slice(5).split("-").reverse().join("-")}`,
    `nomina-${n.desde}-a-${n.hasta}`,
  );
}
