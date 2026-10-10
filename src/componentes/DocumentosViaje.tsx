/**
 * Documentos de un viaje expedido: PDF oficial del manifiesto (con o sin logo)
 * y remesas imprimibles.
 */
import { api } from "../api/cliente";
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
 */
export function DocumentosViaje({ viaje }: { viaje: Viaje }) {
  const remesas = useDatos(() => api.getRemesasDeViaje(viaje.id), [viaje.id]);
  const abrir = (url: string) => window.open(url, "_blank");

  if (!viaje.numeroManifiestoRndc) {
    return (
      <p className="section-desc">
        Este viaje no tiene manifiesto radicado en el RNDC: no hay documentos para imprimir.
      </p>
    );
  }

  return (
    <div className="documentos-viaje">
      <div className="documento-fila">
        <div>
          <strong>Manifiesto electronico de carga {viaje.consecutivoManifiesto}</strong>
          <span className="dato-sec">
            PDF oficial del RNDC · radicado {viaje.numeroManifiestoRndc} · con el logo de la empresa
          </span>
        </div>
        <div className="documento-acciones">
          <button className="btn-primary" onClick={() => abrir(api.urlPdfManifiesto(viaje.id))}>
            🖨 Imprimir manifiesto
          </button>
          <button
            className="btn-link"
            title="El PDF tal como lo entrega el RNDC, sin el logo"
            onClick={() => abrir(api.urlPdfManifiesto(viaje.id, true))}
          >
            sin logo
          </button>
        </div>
      </div>

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
}: {
  viaje: Viaje;
  alCerrar: () => void;
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
      <DocumentosViaje viaje={viaje} />
    </Modal>
  );
}
