import { useState } from "react";
import { api, fechaHora, moneda } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../componentes/Estado";
import ReintentarViaje, { esReintentable } from "../componentes/ReintentarViaje";
import AnularViaje, { esAnulable } from "../componentes/AnularViaje";
import CumplirViaje, { esCumplible } from "../componentes/CumplirViaje";
import VentanaDocumentosViaje from "../componentes/DocumentosViaje";
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
  /** Viaje cuyos documentos (manifiesto y remesas) se van a imprimir. */
  const [imprimiendo, setImprimiendo] = useState<Viaje | null>(null);
  /** Viaje abierto en la ventana de cumplido. */
  const [cumpliendo, setCumpliendo] = useState<Viaje | null>(null);

  // Solo la primera carga muestra "Cargando". Las recargas (despues de cumplir,
  // anular o reintentar) dejan la tabla y la ventana abierta en pantalla: si se
  // desmontaran, la ventana volveria a abrir con los datos viejos del viaje.
  if (cargando && !datos) return <Cargando que="historial" />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;

  const viajes = datos ?? [];

  return (
    <>
      <div className="panel">
        <div className="tabla-scroll">
          {/* En el celular cada fila se ve como tarjeta (ver .tabla-viajes en
              estilos.css); data-label es el titulo de cada dato en la tarjeta. */}
          <table className="modern tabla-viajes">
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
                  <td className="celda-viaje">
                    #{v.id}
                    {v.creadoPorNombre && <span className="dato-sec">por {v.creadoPorNombre}</span>}
                  </td>
                  <td data-label="Cargue">{fechaHora(v.fechaHoraCargue)}</td>
                  <td data-label="Estado">
                    <span className={`badge ${claseEstado(v.estado)}`}>{v.estado}</span>
                    {v.plazoCumplido && <PlazoCumplido dias={v.plazoCumplido.diasHabilesRestantes} />}
                    {v.estado === "CUMPLIDO" && v.cumplidoPorNombre && (
                      <span className="dato-sec">por {v.cumplidoPorNombre}</span>
                    )}
                  </td>
                  <td data-label="Manifiesto">
                    {v.consecutivoManifiesto ?? "-"}
                    {v.numeroManifiestoRndc && (
                      <span className="dato-sec">Radicado {v.numeroManifiestoRndc}</span>
                    )}
                    {v.radicadoAnulacion && (
                      <span className="dato-sec">Anulado: radicado {v.radicadoAnulacion}</span>
                    )}
                    {v.estado === "ANULADO" && v.anuladoPorNombre && (
                      <span className="dato-sec">
                        Anulado por {v.anuladoPorNombre}
                        {v.fechaAnulacion ? ` · ${fechaHora(v.fechaAnulacion)}` : ""}
                      </span>
                    )}
                  </td>
                  <td data-label="Flete">{moneda(v.valorFleteReal)}</td>
                  <td data-label="FOPAT">{moneda(v.retencionFopat)}</td>
                  {/* El error completo se ve en la ventana; aqui solo el comienzo. */}
                  <td className={`celda-error ${v.mensajeError ? "" : "sin-error"}`}>
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
                  <td className="celda-acciones">
                    {(v.estado === "CONFIRMADO" || v.estado === "CUMPLIDO") && (
                      <button className="btn-primary" onClick={() => setImprimiendo(v)}>
                        🖨 Imprimir
                      </button>
                    )}
                    {esCumplible(v) && (
                      <button
                        className="btn-secondary"
                        style={{ marginLeft: "0.35rem" }}
                        onClick={() => setCumpliendo(v)}
                      >
                        Cumplir
                      </button>
                    )}
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
      {imprimiendo && (
        <VentanaDocumentosViaje viaje={imprimiendo} alCerrar={() => setImprimiendo(null)} />
      )}
      {anulando && (
        <AnularViaje viaje={anulando} alCerrar={() => setAnulando(null)} alTerminar={recargar} />
      )}
      {cumpliendo && (
        <CumplirViaje viaje={cumpliendo} alCerrar={() => setCumpliendo(null)} alTerminar={recargar} />
      )}
    </>
  );
}

/** Dias habiles que quedan para cumplir, en la columna de estado. */
function PlazoCumplido({ dias }: { dias: number }) {
  if (dias < 0) return <span className="plazo-cumplido vencido">Cumplido vencido ({-dias} d)</span>;
  if (dias <= 1) return <span className="plazo-cumplido pronto">Cumplir: queda{dias === 1 ? " 1 dia" : "n 0 dias"}</span>;
  return <span className="plazo-cumplido ok">Cumplir en {dias} dias habiles</span>;
}

function claseEstado(estado: string): string {
  if (estado === "CONFIRMADO" || estado === "CUMPLIDO") return "badge-ok";
  if (estado === "ANULADO") return "badge-neutral";
  return "badge-danger";
}
