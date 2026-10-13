/**
 * Acceso a la plataforma GPS del vehiculo elegido en el despacho: link (abre
 * en otra pestana), usuario y clave con boton de copiar. Sirve para revisar a
 * que hora salio del sitio de cargue mientras se planilla.
 */
import { useState } from "react";
import { api } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";

/** Solo se enlaza un http(s): el backend ya lo exige, esto es una segunda barrera. */
const esLinkSeguro = (url: string | null): url is string => !!url && /^https?:\/\//i.test(url);

/** Boton que copia un texto al portapapeles y dice "Copiado" un momento. */
function Copiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="btn-link"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        } catch {
          /* sin permiso de portapapeles: el texto se puede seleccionar a mano */
        }
      }}
    >
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}

/**
 * Panel con el acceso al GPS del vehiculo. La clave se muestra oculta hasta
 * pulsar "Ver". Si no hay nada guardado, explica donde agregarlo.
 */
export default function AccesoGps({ vehiculoId }: { vehiculoId: number }) {
  const acceso = useDatos(() => api.getAccesoGps(vehiculoId), [vehiculoId]);
  const [verClave, setVerClave] = useState(false);
  const a = acceso.datos;
  if (acceso.cargando && !a) return <div className="acceso-gps dato-sec">Buscando el acceso al GPS...</div>;
  if (acceso.error) return <div className="acceso-gps dato-sec">No se pudo leer el acceso al GPS: {acceso.error}</div>;
  if (!a) return null;

  const sinDatos = !a.url && !a.usuario && !a.clave;
  return (
    <div className="acceso-gps">
      <div className="acceso-gps-titulo">
        <strong>GPS de {a.placa}</strong>
        {a.proveedor && <span className="dato-sec"> · {a.proveedor}</span>}
        {esLinkSeguro(a.url) && (
          <a className="btn-secondary boton-con-texto" href={a.url} target="_blank" rel="noopener noreferrer">
            Abrir plataforma GPS ↗
          </a>
        )}
      </div>
      {sinDatos ? (
        <div className="dato-sec">
          Este vehiculo no tiene guardado el acceso a su GPS. Agregalo en Flota → editar vehiculo → Acceso al GPS (y el
          link general en Flota → Monitoreo).
        </div>
      ) : (
        <div className="acceso-gps-datos">
          <span>
            Usuario: <span className="codigo">{a.usuario ?? "-"}</span> {a.usuario && <Copiar texto={a.usuario} />}
          </span>
          <span>
            Clave:{" "}
            {a.clave ? (
              <>
                <span className="codigo">{verClave ? a.clave : "••••••••"}</span>{" "}
                <button type="button" className="btn-link" onClick={() => setVerClave(!verClave)}>
                  {verClave ? "Ocultar" : "Ver"}
                </button>{" "}
                <Copiar texto={a.clave} />
              </>
            ) : (
              "-"
            )}
          </span>
        </div>
      )}
      {a.aviso && <div className="dato-sec texto-vencido">{a.aviso}</div>}
    </div>
  );
}
