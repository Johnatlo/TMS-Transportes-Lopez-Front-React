/**
 * Destinos de un gasto en el formulario: los vehiculos marcados (una parte
 * cada uno) y las partes directas a socios. Sin React: se prueba aparte
 * (destinos.test.ts). El reparto de verdad lo hace el backend al guardar;
 * aqui solo se arma lo que se envia y una vista previa.
 */
import type { DestinoGasto, EmpresaGasto, OpcionesGastos } from "../../api/cliente";

/** Parte directa a un socio en el formulario (el valor como texto mientras se escribe). */
export interface ParteSocio {
  socioId: number | null;
  /** FIJO: pesos; PORCENTAJE: % del gasto; PARTE: partes iguales con los vehiculos marcados. */
  modo: DestinoGasto["modo"];
  valor: string;
}

/** Lo que se elige en el formulario. */
export interface SeleccionDestinos {
  vehiculos: number[];
  socios: ParteSocio[];
}

export const SELECCION_VACIA: SeleccionDestinos = { vehiculos: [], socios: [] };

/** Ids de los vehiculos activos de una empresa (o de las dos): los atajos "Lopez", "M&C" y "Todos". */
export function vehiculosDe(opciones: OpcionesGastos, empresa: EmpresaGasto | "TODOS"): number[] {
  return opciones.vehiculos.filter((v) => v.activo && (empresa === "TODOS" || v.empresa === empresa)).map((v) => v.id);
}

/** La seleccion del formulario como destinos para enviar (se omiten las partes de socio incompletas). */
export function aDestinos(s: SeleccionDestinos): DestinoGasto[] {
  return [
    ...s.socios.filter((p) => p.socioId && Number(p.valor) > 0).map((p) => ({ tipo: "SOCIO" as const, id: p.socioId!, modo: p.modo, valor: Number(p.valor) })),
    ...s.vehiculos.map((id) => ({ tipo: "VEHICULO" as const, id, modo: "PARTE" as const, valor: 1 })),
  ];
}

/** Los destinos guardados de vuelta a la seleccion del formulario (para editar o duplicar). */
export function aSeleccion(destinos: DestinoGasto[]): SeleccionDestinos {
  return {
    vehiculos: destinos.filter((d) => d.tipo === "VEHICULO").map((d) => d.id),
    socios: destinos.filter((d) => d.tipo === "SOCIO").map((d) => ({ socioId: d.id, modo: d.modo, valor: String(d.valor) })),
  };
}

/**
 * Vista previa: cuanto va directo a socios, cuanto queda para repartir y
 * cuanto le toca a cada parte (vehiculo marcado o socio "por partes").
 * `problema` dice por que no se puede guardar todavia.
 */
export function vistaPrevia(
  monto: number,
  s: SeleccionDestinos,
): { directo: number; resto: number; partes: number; porParte: number; problema: string | null } {
  const socios = s.socios.filter((p) => p.socioId && Number(p.valor) > 0);
  const directo = socios.reduce((t, p) => t + (p.modo === "FIJO" ? Number(p.valor) : p.modo === "PORCENTAJE" ? (monto * Number(p.valor)) / 100 : 0), 0);
  const partes = s.vehiculos.length + socios.filter((p) => p.modo === "PARTE").reduce((t, p) => t + Number(p.valor), 0);
  const resto = monto - directo;
  let problema: string | null = null;
  if (!(monto > 0)) problema = "Escribe el valor.";
  else if (!socios.length && !s.vehiculos.length) problema = "Marca los vehiculos o agrega un socio.";
  else if (resto < -0.005) problema = "Las partes directas suman mas que el valor.";
  else if (resto > 0.005 && partes === 0) problema = "Falta repartir el resto: marca vehiculos.";
  return { directo, resto, partes, porParte: partes > 0 ? resto / partes : 0, problema };
}
