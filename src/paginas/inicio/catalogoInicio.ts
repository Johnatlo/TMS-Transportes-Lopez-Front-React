/**
 * Catalogo de las tarjetas del Inicio (que hay, su tamano y quien las puede
 * poner) y el inicio por defecto de cada rol. Sin React: se prueba aparte.
 */
import type { Rol } from "../../api/tipos";
import type { TarjetaInicio } from "../../api/cliente";

/** Columnas de la rejilla del Inicio (igual que el backend, inicioUsuario.ts). */
export const COLUMNAS = 12;

/** Grupo de la tarjeta en el catalogo "Agregar al inicio". */
export type GrupoTarjeta = "Operacion";

/** Una tarjeta que se puede poner en el Inicio. */
export interface DefinicionTarjeta {
  id: string;
  titulo: string;
  /** Lo que muestra, para el catalogo. */
  descripcion: string;
  grupo: GrupoTarjeta;
  /** Tamano al agregarla (columnas y filas) y el minimo al encogerla. */
  w: number;
  h: number;
  minW: number;
  minH: number;
  /** Roles que la pueden poner (sin esto, todos). */
  roles?: Rol[];
}

/** Todas las tarjetas, en el orden del catalogo. */
export const CATALOGO: DefinicionTarjeta[] = [
  {
    id: "indicador-transito",
    titulo: "Vehiculos en transito",
    descripcion: "Cuantos van entre la cita de cargue y la de descargue.",
    grupo: "Operacion",
    w: 3,
    h: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "indicador-finalizados",
    titulo: "Viajes finalizados",
    descripcion: "Los ultimos 30 dias, contra los 30 anteriores.",
    grupo: "Operacion",
    w: 3,
    h: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "indicador-proximos",
    titulo: "Proximos viajes",
    descripcion: "Viajes programados que aun no cargan.",
    grupo: "Operacion",
    w: 3,
    h: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "indicador-semana",
    titulo: "Viajes esta semana",
    descripcion: "Expedidos de lunes a hoy, contra la semana pasada.",
    grupo: "Operacion",
    w: 3,
    h: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "documento-vehiculo",
    titulo: "Documento de vehiculo",
    descripcion: "El documento de vehiculo o remolque mas urgente.",
    grupo: "Operacion",
    w: 4,
    h: 1,
    minW: 3,
    minH: 1,
  },
  { id: "documento-conductor", titulo: "Licencia de conductor", descripcion: "La licencia mas urgente.", grupo: "Operacion", w: 4, h: 1, minW: 3, minH: 1 },
  {
    id: "por-cumplir",
    titulo: "Viajes por cumplir",
    descripcion: "Viajes entregados que falta cumplir en el RNDC.",
    grupo: "Operacion",
    w: 4,
    h: 1,
    minW: 3,
    minH: 1,
  },
  {
    id: "hoy",
    titulo: "Hoy: cargues y descargues",
    descripcion: "Las citas de hoy con su vehiculo y conductor.",
    grupo: "Operacion",
    w: 8,
    h: 5,
    minW: 5,
    minH: 3,
  },
  {
    id: "ultimos",
    titulo: "Ultimos viajes",
    descripcion: "Los ultimos manifiestos con su estado y llegada.",
    grupo: "Operacion",
    w: 8,
    h: 5,
    minW: 5,
    minH: 3,
  },
  { id: "semana", titulo: "Viajes por semana", descripcion: "Grafica por dia, contra la semana anterior.", grupo: "Operacion", w: 4, h: 5, minW: 3, minH: 4 },
  {
    id: "mapa",
    titulo: "La flota en el mapa",
    descripcion: "Los vehiculos en camino (posicion estimada; listo para el GPS).",
    grupo: "Operacion",
    w: 4,
    h: 5,
    minW: 3,
    minH: 3,
  },
];

const porId = new Map(CATALOGO.map((t) => [t.id, t]));

/** La definicion de una tarjeta (undefined si ya no existe). */
export function definicion(id: string): DefinicionTarjeta | undefined {
  return porId.get(id);
}

/** Las tarjetas que el rol puede poner en su inicio. */
export function tarjetasDelRol(rol: Rol): DefinicionTarjeta[] {
  return CATALOGO.filter((t) => !t.roles || t.roles.includes(rol));
}

/** Lugar de una tarjeta del catalogo con su tamano por defecto. */
const en = (id: string, x: number, y: number): TarjetaInicio => {
  const d = porId.get(id)!;
  return { id, x, y, w: d.w, h: d.h };
};

/**
 * Inicio por defecto de un rol (el que se ve sin personalizar): los
 * indicadores arriba, los pendientes, y debajo las tablas de hoy y los ultimos
 * viajes con la grafica y el mapa al lado. Hoy es el mismo para los tres roles;
 * las tarjetas de dinero de cada rol llegan con la etapa 4b.
 */
export function inicioDelRol(rol: Rol): TarjetaInicio[] {
  const base = [
    en("indicador-transito", 0, 0),
    en("indicador-finalizados", 3, 0),
    en("indicador-proximos", 6, 0),
    en("indicador-semana", 9, 0),
    en("documento-vehiculo", 0, 2),
    en("documento-conductor", 4, 2),
    en("por-cumplir", 8, 2),
    en("hoy", 0, 3),
    en("semana", 8, 3),
    en("ultimos", 0, 8),
    en("mapa", 8, 8),
  ];
  const permitidas = new Set(tarjetasDelRol(rol).map((t) => t.id));
  return base.filter((t) => permitidas.has(t.id));
}

/**
 * El inicio que se pinta: el guardado del usuario (o el de su rol si no tiene
 * uno). Quita las tarjetas que ya no existen o que su rol no puede ver, y
 * corrige tamanos por debajo del minimo o que se salen de la rejilla.
 */
export function inicioUsable(guardado: TarjetaInicio[] | null | undefined, rol: Rol): TarjetaInicio[] {
  if (!guardado) return inicioDelRol(rol);
  const permitidas = new Set(tarjetasDelRol(rol).map((t) => t.id));
  const vistas = new Set<string>();
  return guardado.flatMap((t) => {
    const d = porId.get(t.id);
    if (!d || !permitidas.has(t.id) || vistas.has(t.id)) return [];
    vistas.add(t.id);
    const w = Math.min(COLUMNAS, Math.max(d.minW, t.w));
    const x = Math.min(Math.max(0, t.x), COLUMNAS - w);
    return [{ id: t.id, x, y: Math.max(0, t.y), w, h: Math.max(d.minH, t.h) }];
  });
}

/** Orden de lectura (de arriba a abajo y de izquierda a derecha): el del celular. */
export function ordenLectura(tarjetas: TarjetaInicio[]): TarjetaInicio[] {
  return [...tarjetas].sort((a, b) => a.y - b.y || a.x - b.x);
}
