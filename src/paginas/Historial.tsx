import { useState } from "react";
import { api, fechaHora, moneda } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../componentes/Estado";
import ReintentarViaje, { esReintentable } from "../componentes/ReintentarViaje";
import AnularViaje, { esAnulable } from "../componentes/AnularViaje";
import type { Viaje } from "../api/tipos";

/**
 * Historial de despachos. Migrada completa por ser la mas simple: sirve para
 * ver el patron minimo (useDatos + tabla) sin el ruido del Dashboard.
 */
export default function Historial() {
  const { datos, cargando, error, recargar } = useDatos(() => api.getHistorial(), []);
  /** Viaje abierto en la ventana de reintento (null = ventana cerrada). */
  const [reintentando, setReintentando] = useState<Viaje | null>(null);
  /** Viaje abierto en la ventana de anulacion. */
  const [anulando, setAnulando] = useState<Viaje | null>(null);

  if (cargando) return <Cargando que="historial" />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;

  const viajes = datos ?? [];

  return (
    <>
      <div className="panel">
        <div className="tabla-scroll">
          <table className="modern">
            <thead>
              <tr>
                <th>Viaje</th>
                <th>Cargue</th>
                <th>Estado</th>
                <th>Manifiesto</th>
                <th>Flete</th>
                <th>FOPAT</th>
                <th>Error</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {viajes.map((v) => (
                <tr key={v.id}>
                  <td>#{v.id}</td>
                  <td>{fechaHora(v.fechaHoraCargue)}</td>
                  <td>
                    <span className={`badge ${claseEstado(v.estado)}`}>{v.estado}</span>
                  </td>
                  <td>
                    {v.consecutivoManifiesto ?? "-"}
                    {v.numeroManifiestoRndc && (
                      <span className="dato-sec">Radicado {v.numeroManifiestoRndc}</span>
                    )}
                    {v.radicadoAnulacion && (
                      <span className="dato-sec">Anulado: radicado {v.radicadoAnulacion}</span>
                    )}
                  </td>
                  <td>{moneda(v.valorFleteReal)}</td>
                  <td>{moneda(v.retencionFopat)}</td>
                  {/* El error completo se ve en la ventana; aqui solo el comienzo. */}
                  <td style={{ whiteSpace: "normal", maxWidth: 360 }}>
                    {v.mensajeError ? (
                      <span className="dato-sec" title={v.mensajeError}>
                        {v.codigoError ? `${v.codigoError}: ` : ""}
                        {v.mensajeError.slice(0, 110)}
                        {v.mensajeError.length > 110 ? "..." : ""}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {esReintentable(v) && (
                      <button className="btn-primary" onClick={() => setReintentando(v)}>
                        Reintentar
                      </button>
                    )}
                    {esAnulable(v) && (
                      <button
                        className="btn-secondary"
                        style={{ marginLeft: "0.35rem" }}
                        onClick={() => setAnulando(v)}
                      >
                        {v.estado === "ANULACION_ERROR" ? "Reintentar anulacion" : "Anular"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {viajes.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    Aun no hay despachos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reintentando && (
        <ReintentarViaje
          viaje={reintentando}
          alCerrar={() => setReintentando(null)}
          alTerminar={recargar}
        />
      )}
      {anulando && (
        <AnularViaje viaje={anulando} alCerrar={() => setAnulando(null)} alTerminar={recargar} />
      )}
    </>
  );
}

function claseEstado(estado: string): string {
  if (estado === "CONFIRMADO") return "badge-ok";
  if (estado === "ANULADO") return "badge-neutral";
  return "badge-danger";
}
