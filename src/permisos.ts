/**
 * Que puede ver cada rol en el navegador (igual que backend/src/roles.ts; el
 * backend es el que de verdad lo hace cumplir).
 *
 * - TOTAL: todo (aprobar el reparto y cambiar fondos, participaciones y socios).
 * - ADMINISTRATIVO: todo menos el reparto de los socios y el cambio de roles.
 * - MYC: Transportes M&C. Todo menos la rentabilidad de los terceros (la
 *   filtra el servidor) y el cambio de roles.
 */
import type { Rol } from "./api/tipos";

/** Areas del aplicativo. */
export type Area = "RNDC" | "OPERACION" | "CUENTAS" | "LIQUIDACION" | "REPARTO" | "GASTOS" | "ADMINISTRACION" | "USUARIOS";

const AREAS: Record<Rol, Area[]> = {
  TOTAL: ["RNDC", "OPERACION", "CUENTAS", "LIQUIDACION", "REPARTO", "GASTOS", "ADMINISTRACION", "USUARIOS"],
  ADMINISTRATIVO: ["RNDC", "OPERACION", "CUENTAS", "LIQUIDACION", "GASTOS", "ADMINISTRACION"],
  MYC: ["RNDC", "OPERACION", "CUENTAS", "LIQUIDACION", "REPARTO", "GASTOS", "ADMINISTRACION"],
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
  ["/gastos", "GASTOS"],
  ["/nomina", "GASTOS"],
  ["/utilidades", "LIQUIDACION"],
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
