import { useState } from "react";
import { api, separarAvisos, soloDia, fechaHora } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../componentes/Estado";
import type { AlertaDocumento, Viaje, ViajeRemesa } from "../api/tipos";

/**
 * PANTALLA DE REFERENCIA.
 *
 * Esta es la unica pagina migrada por completo. Sirve de modelo para las
 * demas: muestra como se cargan datos con useDatos, como se maneja estado
 * local, y como se abren los PDF.
 *
 * Equivale a dashboard.component.ts + dashboard.component.html del Angular.
 */
export default function Dashboard() {
  const alertas = useDatos(() => api.getAlertas(30), []);
  const historial = useDatos(() => api.getHistorial(), []);

  // Remesas desplegadas por viaje. Se piden bajo demanda y no de entrada:
  // son varias peticiones y casi nunca se necesitan todas.
  const [remesasPorViaje, setRemesasPorViaje] = useState<Record<number, ViajeRemesa[]>>({});

  async function alternarRemesas(viajeId: number) {
    if (remesasPorViaje[viajeId]) {
      const copia = { ...remesasPorViaje };
      delete copia[viajeId];
      setRemesasPorViaje(copia);
      return;
    }
    const remesas = await api.getRemesasDeViaje(viajeId);
    setRemesasPorViaje({ ...remesasPorViaje, [viajeId]: remesas });
  }

  const viajes = historial.datos ?? [];
  const enCurso = viajes.filter((v) => v.estado !== "CONFIRMADO").slice(0, 10);
  const imprimibles = viajes
    .filter((v) => v.estado === "CONFIRMADO" && v.numeroManifiestoRndc)
    .slice(0, 15);

  const hayAlertas =
    !!alertas.datos && (alertas.datos.vencidos.length > 0 || alertas.datos.porVencer.length > 0);

  return (
    <>

      {/* ---------- Documentos por vencer ---------- */}
      {alertas.cargando && <Cargando que="alertas" />}
      {alertas.error && <ErrorCarga mensaje={alertas.error} alReintentar={alertas.recargar} />}

      {hayAlertas && (
        <div className="panel">
          <h3 className="panel-title">Documentos vencidos o por vencer</h3>
          <p className="section-desc" style={{ margin: "0 0 0.8rem" }}>
            El RNDC valida SOAT, tecnomecanica y licencia contra la fecha de descargue del
            manifiesto, no contra hoy. Un documento que vence esta semana ya bloquea viajes
            de la proxima.
          </p>

          <table className="modern">
            <thead>
              <tr>
                <th>Documento</th>
                <th>De</th>
                <th>Vence</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {[...alertas.datos!.vencidos, ...alertas.datos!.porVencer].map((a, i) => (
                <FilaAlerta key={i} alerta={a} />
              ))}
            </tbody>
          </table>

          {alertas.datos!.sinFecha.length > 0 && (
            <p className="section-desc" style={{ marginTop: "0.7rem" }}>
              Ademas hay {alertas.datos!.sinFecha.length} documento(s) sin fecha registrada. No
              estan vencidos, pero tampoco se puede afirmar que esten vigentes.
            </p>
          )}
        </div>
      )}

      {/* ---------- Viajes con incidencias ---------- */}
      <div className="panel">
        <h3 className="panel-title">Viajes pendientes o con incidencias</h3>
        {historial.cargando && <Cargando que="viajes" />}
        {historial.error && (
          <ErrorCarga mensaje={historial.error} alReintentar={historial.recargar} />
        )}

        {!historial.cargando && (
          <table className="modern">
            <thead>
              <tr>
                <th>Viaje</th>
                <th>Cargue</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {enCurso.map((v) => (
                <tr key={v.id}>
                  <td>#{v.id}</td>
                  <td>{fechaHora(v.fechaHoraCargue)}</td>
                  <td>
                    <span className="badge badge-danger">{v.estado}</span>
                  </td>
                  <td>{v.mensajeError ?? "-"}</td>
                </tr>
              ))}
              {enCurso.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No hay viajes pendientes ni con incidencias. Todo al dia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- Manifiestos para imprimir ---------- */}
      <div className="panel">
        <h3 className="panel-title">Manifiestos para imprimir</h3>
        <p className="section-desc" style={{ margin: "0 0 0.8rem" }}>
          El PDF lo genera el Ministerio con el formato oficial y el codigo QR que revisan las
          autoridades en via. El conductor debe llevarlo durante todo el recorrido.
        </p>

        <table className="modern">
          <thead>
            <tr>
              <th>Viaje</th>
              <th>Cargue</th>
              <th>Consecutivo</th>
              <th>Radicado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {imprimibles.map((v) => (
              <FilaManifiesto
                key={v.id}
                viaje={v}
                remesas={remesasPorViaje[v.id]}
                alAlternar={() => alternarRemesas(v.id)}
              />
            ))}
            {imprimibles.length === 0 && !historial.cargando && (
              <tr>
                <td colSpan={5} className="empty-row">
                  Aun no hay manifiestos radicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FilaAlerta({ alerta }: { alerta: AlertaDocumento }) {
  const dias = alerta.diasRestantes ?? 0;
  const clase = alerta.severidad === "VENCIDO" ? "badge-danger" : "badge-warning";
  const texto =
    alerta.severidad === "VENCIDO"
      ? `vencio hace ${Math.abs(dias)} dia(s)`
      : dias === 0
        ? "vence hoy"
        : `en ${dias} dia(s)`;

  return (
    <tr>
      <td>{alerta.tipo}</td>
      <td>{alerta.sujeto}</td>
      <td>{soloDia(alerta.fechaVencimiento)}</td>
      <td>
        <span className={`badge ${clase}`}>{texto}</span>
      </td>
    </tr>
  );
}

function FilaManifiesto({
  viaje,
  remesas,
  alAlternar,
}: {
  viaje: Viaje;
  remesas?: ViajeRemesa[];
  alAlternar: () => void;
}) {
  const avisos = separarAvisos(viaje.avisos);

  return (
    <>
      <tr>
        <td>#{viaje.id}</td>
        <td>{fechaHora(viaje.fechaHoraCargue)}</td>
        <td>{viaje.consecutivoManifiesto ?? "-"}</td>
        <td>{viaje.numeroManifiestoRndc}</td>
        <td>
          <button
            className="btn-secondary"
            onClick={() => window.open(api.urlPdfManifiesto(viaje.id), "_blank")}
          >
            Manifiesto
          </button>
          <button className="btn-secondary" style={{ marginLeft: "0.35rem" }} onClick={alAlternar}>
            Remesas
          </button>
        </td>
      </tr>

      {avisos.length > 0 && (
        <tr>
          <td colSpan={5} style={{ paddingTop: 0 }}>
            <span className="section-desc">{avisos.join(" · ")}</span>
          </td>
        </tr>
      )}

      {remesas && (
        <tr>
          <td colSpan={5} style={{ background: "rgba(0,0,0,0.02)" }}>
            {remesas.map((r) => (
              <div key={r.id} style={{ padding: "0.25rem 0" }}>
                {r.consecutivoRemesa} — radicado {r.numeroRemesaRndc ?? "pendiente"}
                {r.numeroRemesaRndc && (
                  <button
                    className="btn-link"
                    onClick={() => window.open(api.urlImprimirRemesa(r.id), "_blank")}
                  >
                    Imprimir soporte
                  </button>
                )}
              </div>
            ))}
            {remesas.length === 0 && (
              <span className="section-desc">Este viaje no tiene remesas registradas.</span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
