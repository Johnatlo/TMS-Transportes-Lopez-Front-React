/**
 * Que puede ver cada rol en el navegador (igual que backend/src/roles.ts; el
 * backend es el que de verdad lo hace cumplir).
 *
 * - TOTAL: todo.
 * - ADMINISTRATIVO: lo operativo del TMS, sin las cuentas de los vehiculos
 *   (Rentabilidad, liquidacion a duenos y reparto de ganancias) ni Usuarios.
 * - MYC: Transportes M&C. Lo del RNDC (despachar, RNDC, plantillas, clientes,
 *   flota, conductores, preoperacional, vehiculos) y las cuentas de sus
 *   vehiculos (Rentabilidad), sin Cuadro pagos, Anticipos, Cartera ni Pago a
 *   terceros.
 */
import type { Rol } from "./api/tipos";

/** Areas del aplicativo. */
export type Area = "RNDC" | "OPERACION" | "CUENTAS" | "ADMINISTRACION" | "USUARIOS";

const AREAS: Record<Rol, Area[]> = {
  TOTAL: ["RNDC", "OPERACION", "CUENTAS", "ADMINISTRACION", "USUARIOS"],
  ADMINISTRATIVO: ["RNDC", "OPERACION", "ADMINISTRACION"],
  MYC: ["RNDC", "CUENTAS"],
};

/** Nombre del rol para mostrarlo. */
export const NOMBRE_ROL: Record<Rol, string> = {
  TOTAL: "Acceso total",
  ADMINISTRATIVO: "Administrativo",
  MYC: "Transportes M&C",
};

/** El rol (o un rol desconocido, como administrativo) tiene esa area. */
export const puede = (rol: Rol | null | undefined, area: Area) => (AREAS[rol ?? "ADMINISTRATIVO"] ?? AREAS.ADMINISTRATIVO).includes(area);

/** Area de cada pantalla (por el comienzo de su ruta). */
const AREA_RUTA: Array<[string, Area]> = [
  ["/dashboard", "RNDC"],
  ["/despacho", "RNDC"],
  ["/historial", "RNDC"],
  ["/cuadro", "OPERACION"],
  ["/anticipos", "OPERACION"],
  ["/papeles", "OPERACION"],
  ["/cartera", "OPERACION"],
  ["/terceros", "OPERACION"],
  ["/rentabilidad", "CUENTAS"],
  ["/preoperacional", "RNDC"],
  ["/vehiculos", "RNDC"],
  ["/plantillas", "RNDC"],
  ["/clientes", "RNDC"],
  ["/flota", "RNDC"],
  ["/conductores", "RNDC"],
  ["/configuracion", "ADMINISTRACION"],
  ["/usuarios", "USUARIOS"],
];

/** El rol puede abrir esa ruta (las que no estan en la lista se dejan pasar). */
export function puedeRuta(rol: Rol | null | undefined, ruta: string): boolean {
  const area = AREA_RUTA.find(([r]) => ruta === r || ruta.startsWith(`${r}/`) || ruta.startsWith(`${r}?`))?.[1];
  return !area || puede(rol, area);
}
