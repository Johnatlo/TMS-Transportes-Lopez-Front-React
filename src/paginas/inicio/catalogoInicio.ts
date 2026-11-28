/**
 * Catalogo de las tarjetas del Inicio (que hay, su tamano y quien las puede
 * poner) y el inicio por defecto de cada rol. Sin React: se prueba aparte.
 */
import type { Rol } from "../../api/tipos";
import type { ParteResumen, TarjetaInicio } from "../../api/cliente";

/** Columnas de la rejilla del Inicio (igual que el backend, inicioUsuario.ts). */
export const COLUMNAS = 12;

/** Grupo de la tarjeta en el catalogo "Agregar al inicio" (en el orden de GRUPOS). */
export type GrupoTarjeta = "Sofi" | "Operacion" | "Dinero" | "Pendientes";
export const GRUPOS: GrupoTarjeta[] = ["Sofi", "Operacion", "Dinero", "Pendientes"];

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
  /** Partes del resumen del Inicio que necesita (GET /api/inicio/resumen). */
  partes?: ParteResumen[];
  /** Pestana de la barra lateral que, arrastrada al Inicio, agrega esta tarjeta. */
  ruta?: string;
}

/** Los roles que ven dinero: cifras, rentabilidad y reparto (las administrativas no). */
const DINERO: Rol[] = ["TOTAL", "MYC"];

/** Una tabla de pendientes de un modulo (6 x 5, se arrastra desde su pestana). */
const tabla = (id: string, titulo: string, descripcion: string, ruta: string): DefinicionTarjeta => ({
  id,
  titulo,
  descripcion,
  grupo: "Pendientes",
  w: 6,
  h: 5,
  minW: 4,
  minH: 3,
  ruta,
});

/** Todas las tarjetas, en el orden del catalogo. */
export const CATALOGO: DefinicionTarjeta[] = [
  {
    id: "sofi",
    titulo: "Sofi te cuenta",
    descripcion: "Lo pendiente en orden: documentos por vencer, papeles, facturacion e incidencias del sistema.",
    grupo: "Sofi",
    w: 6,
    h: 7,
    minW: 4,
    minH: 4,
    partes: ["sofi"],
  },
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
  {
    id: "cifras-mes",
    titulo: "Cifras del mes",
    descripcion: "Viajes y fletes del mes contra el mes anterior, facturado, cobrado y por cobrar.",
    grupo: "Dinero",
    w: 6,
    h: 4,
    minW: 4,
    minH: 3,
    roles: DINERO,
    partes: ["cifras"],
  },
  {
    id: "dias-cobro",
    titulo: "Dias de cobro",
    descripcion: "La cartera vencida y lo que vence en los proximos 15 dias, por dia.",
    grupo: "Dinero",
    w: 4,
    h: 5,
    minW: 3,
    minH: 3,
    partes: ["cobros"],
  },
  {
    id: "rentabilidad-mes",
    titulo: "Rentabilidad del mes",
    descripcion: "Lo que van dejando los carros (y la empresa) este mes, y los que mas y menos dejan.",
    grupo: "Dinero",
    w: 6,
    h: 4,
    minW: 4,
    minH: 3,
    roles: DINERO,
    partes: ["rentabilidad"],
    ruta: "/rentabilidad",
  },
  {
    id: "reparto-mes",
    titulo: "Reparto a socios",
    descripcion: "El reparto del mes anterior: lo de cada socio y si ya se aprobo.",
    grupo: "Dinero",
    w: 4,
    h: 4,
    minW: 3,
    minH: 3,
    roles: DINERO,
    partes: ["reparto"],
    ruta: "/reparto",
  },
  tabla("tabla-por-facturar", "Cuadro pagos: por facturar", "Viajes listos para facturar y enviados sin factura.", "/cuadro"),
  tabla("tabla-anticipos", "Anticipos sin cruzar", "Tanqueos que aun no se cruzan con los vales de la bomba.", "/anticipos"),
  tabla("tabla-cartera", "Cartera vencida", "Facturas vencidas por cliente, de la mas vieja a la mas nueva.", "/cartera"),
  tabla("tabla-rndc", "RNDC: contingencias y por cumplir", "Manifiestos de contingencia y viajes entregados sin cumplir.", "/historial"),
  tabla("tabla-gastos", "Gastos del mes", "Los gastos registrados este mes y su total.", "/gastos"),
  tabla("tabla-sin-cuenta", "Cuentas conductores: sin cuenta", "Viajes del periodo de los conductores sin cuenta de viaje.", "/cuentas-conductores"),
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

/** La tarjeta que agrega una pestana de la barra lateral arrastrada al Inicio (si el rol la ve). */
export function tarjetaDeRuta(ruta: string, rol: Rol): DefinicionTarjeta | undefined {
  return tarjetasDelRol(rol).find((t) => t.ruta === ruta);
}

/** Las partes del resumen que piden las tarjetas puestas (sin repetir). */
export function partesDe(tarjetas: TarjetaInicio[]): ParteResumen[] {
  return [...new Set(tarjetas.flatMap((t) => porId.get(t.id)?.partes ?? []))].sort();
}

/** Lugar de una tarjeta del catalogo con su tamano por defecto. */
const en = (id: string, x: number, y: number): TarjetaInicio => {
  const d = porId.get(id)!;
  return { id, x, y, w: d.w, h: d.h };
};

/** Los cuatro indicadores de operacion (fila 0). */
const INDICADORES = [en("indicador-transito", 0, 0), en("indicador-finalizados", 3, 0), en("indicador-proximos", 6, 0), en("indicador-semana", 9, 0)];

/**
 * Inicio por defecto de un rol (el que se ve sin personalizar):
 * - Administrativas: la operacion, los pendientes (documentos, cumplidos y
 *   Sofi te cuenta) y el Cuadro pagos por facturar.
 * - Total: lo mismo con las cifras del mes, la rentabilidad y los dias de cobro.
 * - M&C: la operacion, lo suyo (cifras y rentabilidad de sus carros) y Sofi.
 */
export function inicioDelRol(rol: Rol): TarjetaInicio[] {
  let base: TarjetaInicio[];
  if (rol === "TOTAL") {
    base = [
      ...INDICADORES,
      en("cifras-mes", 0, 2),
      en("rentabilidad-mes", 6, 2),
      en("sofi", 0, 6),
      { ...en("tabla-por-facturar", 6, 6), h: 7 },
      en("hoy", 0, 13),
      en("dias-cobro", 8, 13),
      en("ultimos", 0, 18),
      en("mapa", 8, 18),
    ];
  } else if (rol === "MYC") {
    base = [
      ...INDICADORES,
      en("cifras-mes", 0, 2),
      en("rentabilidad-mes", 6, 2),
      en("sofi", 0, 6),
      { ...en("reparto-mes", 6, 6), w: 6, h: 7 },
      en("hoy", 0, 13),
      en("semana", 8, 13),
      en("ultimos", 0, 18),
      en("mapa", 8, 18),
    ];
  } else {
    base = [
      ...INDICADORES,
      en("documento-vehiculo", 0, 2),
      en("documento-conductor", 4, 2),
      en("por-cumplir", 8, 2),
      en("sofi", 0, 3),
      { ...en("tabla-por-facturar", 6, 3), h: 7 },
      en("hoy", 0, 10),
      en("semana", 8, 10),
      en("ultimos", 0, 15),
      en("mapa", 8, 15),
    ];
  }
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
