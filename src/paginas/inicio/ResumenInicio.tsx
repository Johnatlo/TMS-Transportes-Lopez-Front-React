/**
 * Resumen del Inicio (GET /api/inicio/resumen) para las tarjetas de "Sofi te
 * cuenta" y de dinero: se pide una sola vez con las partes que necesitan las
 * tarjetas puestas, y cada tarjeta lo toma con useResumen().
 */
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { auth } from "../../api/cliente";
import type { ParteResumen, ResumenInicio } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";

/** El resumen y su estado de carga. */
export interface EstadoResumen {
  resumen: ResumenInicio | null;
  /** Pidiendo (las tarjetas cuya parte aun no llega muestran el esqueleto). */
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}

const Contexto = createContext<EstadoResumen>({ resumen: null, cargando: false, error: null, recargar: () => {} });

/** El resumen del Inicio (dentro de <ProveedorResumen>). */
export const useResumen = () => useContext(Contexto);

/**
 * Pide el resumen con las partes de las tarjetas puestas. Si cambian (se
 * agrega una tarjeta de dinero), lo vuelve a pedir; mientras llega, las
 * tarjetas siguen mostrando lo anterior. Sin partes no pide nada.
 */
export function ProveedorResumen({ partes, children }: { partes: ParteResumen[]; children: ReactNode }) {
  const clave = partes.join(",");
  const { datos, cargando, error, recargar } = useDatos<ResumenInicio | null>(
    () => (partes.length ? auth.resumenInicio(partes) : Promise.resolve(null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clave],
  );
  return <Contexto.Provider value={{ resumen: datos, cargando, error, recargar }}>{children}</Contexto.Provider>;
}
