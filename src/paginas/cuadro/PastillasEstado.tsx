import type { FilaCuadro } from "../../api/cliente";
import { Pastilla } from "../../componentes/TablaDatos";
import {
  ETIQUETA_ESTADO_FACTURA,
  etiquetaEstadoCuadro,
  muestraFactura,
  tonoEstadoCuadro,
  tonoEstadoFactura,
} from "./estadosCuadro";

/**
 * Estado de un viaje del cuadro: la pastilla de los papeles y, al lado, la de
 * la factura si ya se facturo. "Todo pagado" y "Anulado" van solos.
 */
export default function PastillasEstado({ f }: { f: Pick<FilaCuadro, "estado" | "estadoFactura" | "todoPagado"> }) {
  return (
    <span className="pastillas-estado">
      <Pastilla tono={tonoEstadoCuadro(f)}>{etiquetaEstadoCuadro(f)}</Pastilla>
      {muestraFactura(f) && <Pastilla tono={tonoEstadoFactura(f.estadoFactura)}>{ETIQUETA_ESTADO_FACTURA[f.estadoFactura]}</Pastilla>}
    </span>
  );
}
