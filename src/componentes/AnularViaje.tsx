import { useState } from "react";
import { api, ErrorApi } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "./Estado";
import Modal from "./Modal";
import type { Viaje, ViajeRemesa } from "../api/tipos";

/** Estados desde los que el backend acepta anular (ver despacho.ts). */
const ESTADOS_ANULABLES = [
  "CONFIRMADO",
  "MANIFIESTO_ERROR",
  "REMESA_ERROR",
  "VALIDACION_ERROR",
  "ANULACION_ERROR",
];

export function esAnulable(v: Pick<Viaje, "estado">): boolean {
  return ESTADOS_ANULABLES.includes(v.estado);
}

/**
 * Ventana para anular un viaje en el RNDC.
 *
 * Primero muestra que se va a anular y en que orden (lo calcula el backend),
 * los motivos que acepta el RNDC y como va el tope mensual. Anular no se puede
 * deshacer y el numero del viaje no se puede volver a usar, por eso se pide
 * una confirmacion explicita.
 */
export default function AnularViaje({
  viaje: viajeInicial,
  alCerrar,
  alTerminar,
}: {
  viaje: Viaje;
  alCerrar: () => void;
  /** Se llama despues de cada intento, para recargar la lista de fondo. */
  alTerminar: () => void;
}) {
  const [viaje, setViaje] = useState<Viaje>(viajeInicial);
  const [remesas, setRemesas] = useState<ViajeRemesa[] | null>(null);
  const previa = useDatos(() => api.getPreviaAnulacion(viaje.id), [viaje.id, viaje.estado]);

  const [motivoManifiesto, setMotivoManifiesto] = useState("");
  const [motivoCumplido, setMotivoCumplido] = useState("D");
  const [motivoRemesa, setMotivoRemesa] = useState("D");
  const [observaciones, setObservaciones] = useState("");
  const [entiendo, setEntiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorPeticion, setErrorPeticion] = useState<string | null>(null);

  const anulado = viaje.estado === "ANULADO";
  const p = previa.datos;
  const pideManifiesto = !!p && p.pasos.some((x) => x.includes("proceso 32"));
  const pideCumplido = !!p && p.pasos.some((x) => x.includes("proceso 54"));
  const pideRemesa = !!p && p.pasos.some((x) => x.includes("proceso 9"));
  const superaTope = !!p?.tope && p.tope.anulados + 1 > p.tope.maximo;

  const listo =
    !!p?.anulable &&
    observaciones.trim().length >= 5 &&
    (!pideManifiesto || !!motivoManifiesto) &&
    entiendo;

  async function anular() {
    setEnviando(true);
    setErrorPeticion(null);
    try {
      const r = await api.anularViaje(viaje.id, {
        motivoManifiesto: pideManifiesto ? motivoManifiesto : undefined,
        motivoCumplido,
        motivoRemesa,
        observaciones: observaciones.trim(),
      });
      setViaje(r);
      setRemesas(r.remesas);
    } catch (exc) {
      // Un paso rechazado devuelve el viaje con su nuevo estado y el error.
      if (exc instanceof ErrorApi && exc.cuerpo?.id === viaje.id) {
        setViaje(exc.cuerpo as Viaje);
        setRemesas(exc.cuerpo.remesas ?? null);
        setEntiendo(false);
      } else {
        setErrorPeticion(exc instanceof Error ? exc.message : "No se pudo anular");
      }
    } finally {
      setEnviando(false);
      alTerminar();
    }
  }

  return (
    <Modal
      titulo={`Anular viaje #${viaje.id} - ${viaje.consecutivoManifiesto ?? ""}`}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            {anulado ? "Cerrar" : "Cancelar"}
          </button>
          {!anulado && (
            <button className="btn-danger" onClick={anular} disabled={!listo || enviando}>
              {enviando ? "Anulando en el RNDC..." : p?.soloLocal ? "Descartar viaje" : "Anular"}
            </button>
          )}
        </>
      }
    >
      {anulado ? (
        <ResultadoAnulado viaje={viaje} remesas={remesas} />
      ) : (
        <>
          {viaje.estado === "ANULACION_ERROR" && viaje.mensajeError && (
            <div className="alert danger" style={{ whiteSpace: "pre-wrap" }}>
              {viaje.mensajeError}
            </div>
          )}
          {errorPeticion && <div className="alert danger">{errorPeticion}</div>}

          {previa.cargando && <Cargando que="la anulacion" />}
          {previa.error && <ErrorCarga mensaje={previa.error} alReintentar={previa.recargar} />}

          {p && !p.anulable && (
            <div className="alert warning">Un viaje en estado {p.estado} no se puede anular.</div>
          )}

          {p && p.anulable && (
            <>
              <div className="form-section">
                <div>
                  <div className="section-title">Que se va a anular</div>
                  <div className="section-desc">
                    En este orden: el RNDC no deja anular una remesa mientras su manifiesto
                    este vigente. Lo que ya se haya anulado en un intento anterior no se repite.
                  </div>
                </div>
                <div>
                  <ol className="pasos-anulacion">
                    {p.pasos.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ol>
                  {p.tope && (
                    <div className={`alert ${superaTope ? "danger" : "info"}`}>
                      {superaTope ? "⚠ " : ""}Manifiestos anulados este mes: {p.tope.anulados} de un
                      maximo de {p.tope.maximo} ({Math.round(p.tope.porcentaje * 100)}% de{" "}
                      {p.tope.expedidos} expedidos desde este sistema).
                      {superaTope &&
                        " Esta anulacion pasaria el tope: el RNDC pedira una manifestacion expresa en el portal y lo reporta a la Superintendencia de Transporte."}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-section">
                <div>
                  <div className="section-title">Motivo</div>
                  <div className="section-desc">
                    Codigos confirmados contra el RNDC. Las observaciones son obligatorias y
                    quedan registradas en el RNDC.
                  </div>
                </div>
                <div>
                  {pideManifiesto && (
                    <>
                      <label>Motivo de anulacion del manifiesto</label>
                      <select value={motivoManifiesto} onChange={(e) => setMotivoManifiesto(e.target.value)}>
                        <option value="" disabled>
                          Selecciona...
                        </option>
                        {Object.entries(p.motivos.manifiesto).map(([k, v]) => (
                          <option key={k} value={k}>
                            {k} - {v}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  {pideCumplido && (
                    <>
                      <label>Motivo de anulacion del cumplido inicial</label>
                      <select value={motivoCumplido} onChange={(e) => setMotivoCumplido(e.target.value)}>
                        {Object.entries(p.motivos.cumplido).map(([k, v]) => (
                          <option key={k} value={k}>
                            {k} - {v}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  {pideRemesa && (
                    <>
                      <label>Motivo de anulacion de la remesa</label>
                      <select value={motivoRemesa} onChange={(e) => setMotivoRemesa(e.target.value)}>
                        {Object.entries(p.motivos.remesa).map(([k, v]) => (
                          <option key={k} value={k}>
                            {k} - {v}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  <label>Observaciones</label>
                  <textarea
                    rows={3}
                    maxLength={200}
                    value={observaciones}
                    placeholder="Ej: se digito mal el peso de la remesa"
                    onChange={(e) => setObservaciones(e.target.value)}
                  />

                  <label className="confirmacion-anular">
                    <input type="checkbox" checked={entiendo} onChange={(e) => setEntiendo(e.target.checked)} />
                    {p.soloLocal
                      ? "Entiendo que el viaje queda descartado y su numero no se vuelve a usar."
                      : "Entiendo que la anulacion en el RNDC no se puede deshacer y que el numero del viaje no se podra volver a usar."}
                  </label>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function ResultadoAnulado({ viaje, remesas }: { viaje: Viaje; remesas: ViajeRemesa[] | null }) {
  return (
    <>
      <div className="alert success">
        ✓ Viaje anulado.
        {viaje.radicadoAnulacion && (
          <>
            {" "}
            Radicado de anulacion del manifiesto: <strong>{viaje.radicadoAnulacion}</strong>
          </>
        )}
      </div>
      {remesas && remesas.length > 0 && (
        <table className="modern">
          <thead>
            <tr>
              <th>Remesa</th>
              <th>Estado</th>
              <th>Anulacion cumplido inicial</th>
              <th>Anulacion remesa</th>
            </tr>
          </thead>
          <tbody>
            {remesas.map((r) => (
              <tr key={r.id}>
                <td>{r.consecutivoRemesa}</td>
                <td>{r.estado}</td>
                <td>{r.radicadoAnulacionCumplido ?? "-"}</td>
                <td>{r.radicadoAnulacion ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {viaje.avisos && <p className="section-desc">Avisos: {viaje.avisos}</p>}
    </>
  );
}
