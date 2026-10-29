/**
 * Documentos de un viaje expedido: PDF oficial del manifiesto (con o sin logo)
 * y remesas imprimibles. Si el RNDC no deja imprimir o expedir el manifiesto,
 * el manifiesto de contingencia.
 */
import { useState } from "react";
import { api, fechaHora } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "./Estado";
import Modal from "./Modal";
import type { Viaje } from "../api/tipos";

/**
 * Documentos que el conductor debe llevar en el viaje: el manifiesto
 * electronico de carga (PDF oficial del RNDC, con el logo de la empresa) y la
 * remesa de cada carga.
 *
 * El manifiesto es el documento que exige la autoridad en via: el policia
 * escanea su QR para verificar que es el original del RNDC. El logo se
 * estampa lejos del QR, que queda intacto.
 *
 * Contingencia: si el RNDC no entrega el PDF (o el viaje no se ha podido
 * expedir), se ofrece el manifiesto de contingencia de la empresa. El viaje
 * queda con alerta hasta que se imprime el oficial.
 */
export function DocumentosViaje({ viaje, alCambiar }: { viaje: Viaje; alCambiar?: () => void }) {
  const remesas = useDatos(() => api.getRemesasDeViaje(viaje.id), [viaje.id]);
  const abrir = (url: string) => window.open(url, "_blank");
  /** Error del RNDC al pedir el PDF oficial (se ofrece la contingencia). */
  const [errorPdf, setErrorPdf] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const anulado = viaje.estado === "ANULADO";
  const delPortal = viaje.origen === "PORTAL";

  /**
   * Pide el PDF oficial antes de abrirlo para saber si el RNDC lo entrego. La
   * pestana se abre de una vez (si no, el navegador la bloquea) y se llena
   * cuando llega el PDF; si falla, se cierra y se muestra el error.
   */
  async function imprimirOficial(original = false) {
    setErrorPdf(null);
    setPidiendo(true);
    const pestana = window.open("", "_blank");
    try {
      const r = await fetch(api.urlPdfManifiesto(viaje.id, original), { credentials: "include" });
      if (!r.ok) {
        const cuerpo = await r.json().catch(() => null);
        throw new Error(cuerpo?.error ?? `El RNDC no entrego el PDF (error ${r.status}).`);
      }
      const url = URL.createObjectURL(await r.blob());
      if (pestana) pestana.location.href = url;
      else window.open(url, "_blank");
      // Con el oficial impreso, la contingencia (si la habia) deja de estar pendiente.
      if (viaje.contingenciaEn) alCambiar?.();
    } catch (exc) {
      pestana?.close();
      setErrorPdf(exc instanceof Error ? exc.message : "No se pudo traer el PDF del RNDC.");
    } finally {
      setPidiendo(false);
    }
  }

  /** Abre el manifiesto de contingencia (marca el viaje para la alerta). */
  function imprimirContingencia(motivo: string | null) {
    abrir(api.urlManifiestoContingencia(viaje.id, motivo));
    alCambiar?.();
  }

  const avisoContingencia = viaje.contingenciaEn && (
    <div className="alert warning">
      Se imprimio un manifiesto de contingencia el {fechaHora(viaje.contingenciaEn)}
      {viaje.contingenciaMotivo ? ` (${viaje.contingenciaMotivo})` : ""}. Sigue con alerta hasta que se imprima el oficial.
    </div>
  );

  if (!viaje.numeroManifiestoRndc) {
    return (
      <div className="documentos-viaje">
        {avisoContingencia}
        <p className="section-desc">
          Este viaje no tiene manifiesto radicado en el RNDC: no hay manifiesto oficial que imprimir.
          {!anulado &&
            !delPortal &&
            " Si la plataforma del RNDC esta caida y el carro tiene que salir, imprime el manifiesto de contingencia y reintenta expedirlo apenas el RNDC responda."}
        </p>
        {!anulado && !delPortal && (
          <button
            className="btn-secondary"
            onClick={() =>
              imprimirContingencia(viaje.mensajeError ? `No se pudo expedir: ${viaje.mensajeError.slice(0, 200)}` : "No se pudo expedir en el RNDC")
            }
          >
            Imprimir manifiesto de contingencia
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="documentos-viaje">
      {avisoContingencia}
      <div className="documento-fila">
        <div>
          <strong>Manifiesto electronico de carga {viaje.consecutivoManifiesto}</strong>
          <span className="dato-sec">
            PDF oficial del RNDC · radicado {viaje.numeroManifiestoRndc} · con el logo de la empresa
          </span>
        </div>
        <div className="documento-acciones">
          <button className="btn-primary" disabled={pidiendo} onClick={() => imprimirOficial()}>
            {pidiendo ? "Pidiendo al RNDC..." : "🖨 Imprimir manifiesto"}
          </button>
          <button
            className="btn-link"
            title="El PDF tal como lo entrega el RNDC, sin el logo"
            disabled={pidiendo}
            onClick={() => imprimirOficial(true)}
          >
            sin logo
          </button>
        </div>
      </div>
      {errorPdf && (
        <div className="alert danger">
          No se pudo imprimir el manifiesto oficial: {errorPdf}
          {!delPortal && (
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn-secondary" onClick={() => imprimirContingencia(`No se pudo imprimir el oficial: ${errorPdf.slice(0, 200)}`)}>
                Imprimir manifiesto de contingencia
              </button>
              <button className="btn-link" onClick={() => imprimirOficial()}>
                Reintentar el oficial
              </button>
            </div>
          )}
        </div>
      )}

      {remesas.cargando && <Cargando que="remesas" />}
      {remesas.error && <ErrorCarga mensaje={remesas.error} alReintentar={remesas.recargar} />}
      {(remesas.datos ?? [])
        .filter((r) => r.numeroRemesaRndc && r.estado !== "ANULADA")
        .map((r) => (
          <div className="documento-fila" key={r.id}>
            <div>
              <strong>Remesa {r.consecutivoRemesa}</strong>
              <span className="dato-sec">Radicado {r.numeroRemesaRndc} · generada por la empresa</span>
            </div>
            <div className="documento-acciones">
              {r.plantillaId ? (
                <button className="btn-secondary" onClick={() => abrir(api.urlImprimirRemesa(r.id))}>
                  🖨 Imprimir remesa
                </button>
              ) : (
                // La remesa impresa se arma con la plantilla; las del portal se imprimen alla.
                <span className="dato-sec">Expedida en el portal: imprimela desde el portal del RNDC.</span>
              )}
            </div>
          </div>
        ))}

      <p className="section-desc" style={{ marginBottom: 0 }}>
        Al imprimir, revisa que el codigo QR del manifiesto salga completo y nitido: es lo que
        escanea la policia para verificar el documento.
      </p>
    </div>
  );
}

/** Los mismos documentos en una ventana, para abrirlos desde una lista. */
export default function VentanaDocumentosViaje({
  viaje,
  alCerrar,
  alCambiar,
}: {
  viaje: Viaje;
  alCerrar: () => void;
  /** Se imprimio de contingencia o el oficial (cambia la alerta del viaje). */
  alCambiar?: () => void;
}) {
  return (
    <Modal
      titulo={`Documentos del viaje #${viaje.id}`}
      alCerrar={alCerrar}
      pie={
        <button className="btn-secondary" onClick={alCerrar}>
          Cerrar
        </button>
      }
    >
      <DocumentosViaje viaje={viaje} alCambiar={alCambiar} />
    </Modal>
  );
}
