import type { ReactNode } from "react";
import { useContador } from "../ganchos/useContador";

/**
 * Tarjeta de indicador (Inicio, Cartera, Anticipos): titulo, valor grande y,
 * opcional, un icono, la variacion frente al periodo anterior (con signo y
 * flecha, no solo color) y un detalle al lado.
 *
 * `dinero` usa la letra de montos; `alerta` pinta el valor en rojo (mismo tamano).
 * Los valores numericos cuentan hasta su cifra al aparecer (useContador).
 */
export default function Indicador({
  icono,
  titulo,
  valor,
  variacion: v,
  detalle,
  dinero,
  alerta,
}: {
  icono?: ReactNode;
  titulo: string;
  valor: number | string;
  variacion?: number | null;
  detalle?: string;
  dinero?: boolean;
  alerta?: boolean;
}) {
  const numero = useContador(typeof valor === "number" ? valor : 0);
  const clases = ["indicador-valor", dinero && "indicador-dinero", alerta && "indicador-alerta"].filter(Boolean).join(" ");
  return (
    <div className="indicador">
      <div className="indicador-titulo">
        {icono && <span className="indicador-icono">{icono}</span>}
        {titulo}
      </div>
      <div className="indicador-fila">
        <span className={clases}>
          {typeof valor !== "number" ? valor : numero === valor ? valor.toLocaleString("es-CO") : numero.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
        </span>
        {v !== undefined && v !== null && (
          // Signo + flecha ademas del color: la variacion no depende solo del color.
          <span className={`variacion ${v >= 0 ? "sube" : "baja"}`}>
            {v >= 0 ? "▲ +" : "▼ "}
            {v}%
          </span>
        )}
        {detalle && <span className="indicador-periodo">{detalle}</span>}
      </div>
    </div>
  );
}
