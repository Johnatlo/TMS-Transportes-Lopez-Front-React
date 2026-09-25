import { useState } from "react";
import { api, ErrorApi, moneda } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando } from "./Estado";
import Modal from "./Modal";
import ComboBuscable from "./ComboBuscable";
import type { Viaje } from "../api/tipos";

/** Estados desde los que el backend acepta reintentar (ver despacho.ts). */
export const ESTADOS_REINTENTABLES = ["VALIDACION_ERROR", "REMESA_ERROR", "MANIFIESTO_ERROR"];

export function esReintentable(v: Pick<Viaje, "estado">): boolean {
  return ESTADOS_REINTENTABLES.includes(v.estado);
}

/** Que significa cada estado para quien despacha. */
const EXPLICACION_ESTADO: Record<string, string> = {
  VALIDACION_ERROR:
    "El sistema detuvo el viaje antes de enviarlo: no se envio nada al RNDC. Corrige el dato y reintenta.",
  REMESA_ERROR:
    "Una remesa fue rechazada. Las que figuran como CREADA ya estan en el RNDC y no se reenvian; solo se envian las pendientes y luego el manifiesto.",
  MANIFIESTO_ERROR:
    "Las remesas ya estan creadas en el RNDC. Al reintentar se envia SOLO el manifiesto, reutilizando esas remesas.",
};

/** Campos del manifiesto que se pueden corregir antes de reintentar. */
type Correccion = {
  vehiculoId: number;
  conductorId: number;
  remolqueId: number | null;
  nitMonitoreoFlota: string | null;
  valorFleteReal: number | null;
  valorAnticipoManifiesto: number;
  consecutivoManifiesto: string;
};

function correccionDe(v: Viaje): Correccion {
  return {
    vehiculoId: v.vehiculoId,
    conductorId: v.conductorId,
    remolqueId: v.remolqueId,
    nitMonitoreoFlota: v.nitMonitoreoFlota,
    valorFleteReal: v.valorFleteReal,
    valorAnticipoManifiesto: v.valorAnticipoManifiesto,
    consecutivoManifiesto: v.consecutivoManifiesto ?? "",
  };
}

/**
 * Ventana para retomar un viaje que quedo a medias.
 *
 * Muestra el error, que remesas ya estan en el RNDC y deja corregir los datos
 * del manifiesto. Lo que se corrija en el Catalogo (por ejemplo el titular del
 * vehiculo) tambien se toma: el backend relee todo al reintentar.
 */
export default function ReintentarViaje({
  viaje: viajeInicial,
  alCerrar,
  alTerminar,
}: {
  viaje: Viaje;
  alCerrar: () => void;
  /** Se llama despues de cada intento, para que la lista de fondo se recargue. */
  alTerminar: () => void;
}) {
  // El viaje cambia despues de cada intento (estado, error), por eso se guarda
  // en estado propio en vez de leerlo siempre de la prop.
  const [viaje, setViaje] = useState<Viaje>(viajeInicial);
  const [original] = useState<Correccion>(() => correccionDe(viajeInicial));
  const [form, setForm] = useState<Correccion>(() => correccionDe(viajeInicial));
  const [enviando, setEnviando] = useState(false);
  const [errorPeticion, setErrorPeticion] = useState<string | null>(null);

  // El segundo argumento de useDatos son las dependencias, como en useEffect:
  // las remesas se vuelven a pedir cuando cambia el estado del viaje.
  const remesas = useDatos(() => api.getRemesasDeViaje(viaje.id), [viaje.id, viaje.estado]);
  const vehiculos = useDatos(() => api.getVehiculos(), []);
  const conductores = useDatos(() => api.getConductores(), []);
  const remolques = useDatos(() => api.getRemolques(), []);
  const empresas = useDatos(() => api.getEmpresasMonitoreo(), []);

  const confirmado = viaje.estado === "CONFIRMADO";
  const fijar = <K extends keyof Correccion>(k: K, v: Correccion[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  /** Solo se manda lo que el usuario cambio. */
  function cambios(): Partial<Correccion> {
    const out: Partial<Correccion> = {};
    for (const k of Object.keys(form) as Array<keyof Correccion>) {
      if (String(form[k] ?? "") !== String(original[k] ?? "")) {
        (out as Record<string, unknown>)[k] = form[k];
      }
    }
    return out;
  }

  async function reintentar() {
    setEnviando(true);
    setErrorPeticion(null);
    try {
      setViaje(await api.reintentarViaje(viaje.id, cambios()));
    } catch (exc) {
      // Si el RNDC o la validacion rechazan, el backend responde 4xx con el
      // viaje actualizado (nuevo estado y error): se muestra ese.
      if (exc instanceof ErrorApi && exc.cuerpo?.id === viaje.id) {
        setViaje(exc.cuerpo as Viaje);
      } else {
        setErrorPeticion(exc instanceof Error ? exc.message : "No se pudo reintentar");
      }
    } finally {
      setEnviando(false);
      alTerminar();
    }
  }

  const activos = <T extends { activo: boolean }>(xs: T[] | null) => (xs ?? []).filter((x) => x.activo);

  return (
    <Modal
      titulo={`Viaje #${viaje.id} - manifiesto ${viaje.consecutivoManifiesto ?? ""}`}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            {confirmado ? "Cerrar" : "Cancelar"}
          </button>
          {!confirmado && (
            <button className="btn-primary" onClick={reintentar} disabled={enviando}>
              {enviando ? "Enviando al RNDC..." : "Reintentar"}
            </button>
          )}
        </>
      }
    >
      {confirmado ? (
        <div className="alert success">
          Manifiesto confirmado por el RNDC. Radicado: <strong>{viaje.numeroManifiestoRndc}</strong>
        </div>
      ) : (
        <>
          <div className="alert info">{EXPLICACION_ESTADO[viaje.estado] ?? viaje.estado}</div>
          {viaje.mensajeError && (
            <div className="alert danger" style={{ whiteSpace: "pre-wrap" }}>
              {viaje.mensajeError}
            </div>
          )}
        </>
      )}
      {errorPeticion && <div className="alert danger">{errorPeticion}</div>}

      <div className="form-section">
        <div>
          <div className="section-title">Remesas del viaje</div>
          <div className="section-desc">
            Las CREADA ya existen en el RNDC y se reutilizan. Sus datos (pesos, citas, clientes)
            no se cambian aqui: una remesa con datos errados se corrige anulandola en el RNDC.
          </div>
        </div>
        <div>
          {remesas.cargando ? (
            <Cargando que="remesas" />
          ) : (
            <table className="modern">
              <thead>
                <tr>
                  <th>Remesa</th>
                  <th>Estado</th>
                  <th>Radicado RNDC</th>
                </tr>
              </thead>
              <tbody>
                {(remesas.datos ?? []).map((r) => (
                  <tr key={r.id}>
                    <td>{r.consecutivoRemesa}</td>
                    <td>
                      <span className={`badge ${r.estado === "CREADA" ? "badge-ok" : r.estado === "ERROR" ? "badge-danger" : "badge-neutral"}`}>
                        {r.estado}
                      </span>
                    </td>
                    <td>{r.numeroRemesaRndc ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {!confirmado && (
        <div className="form-section">
          <div>
            <div className="section-title">Corregir el manifiesto</div>
            <div className="section-desc">
              Cambia solo lo necesario. Si el error es de un dato del catalogo (titular del
              vehiculo, licencia, SOAT...), corrigelo en Catalogo y vuelve aqui: el reintento
              toma los datos actualizados.
            </div>
          </div>
          <div>
            <label>Vehiculo</label>
            <ComboBuscable
              opciones={activos(vehiculos.datos)}
              valor={form.vehiculoId}
              alCambiar={(id) => id !== null && fijar("vehiculoId", id)}
              obtenerId={(v) => v.id}
              obtenerEtiqueta={(v) => `${v.placa}${v.nombreTenedor ? ` - ${v.nombreTenedor}` : ""}`}
            />

            <label>Conductor</label>
            <ComboBuscable
              opciones={activos(conductores.datos)}
              valor={form.conductorId}
              alCambiar={(id) => id !== null && fijar("conductorId", id)}
              obtenerId={(c) => c.id}
              obtenerEtiqueta={(c) => `${c.nombre} (${c.cedula})`}
            />

            <label>Remolque</label>
            <ComboBuscable
              opciones={activos(remolques.datos)}
              valor={form.remolqueId}
              alCambiar={(id) => fijar("remolqueId", id)}
              obtenerId={(r) => r.id}
              obtenerEtiqueta={(r) => r.placa}
            />

            <label>Empresa de monitoreo (GPS)</label>
            <ComboBuscable
              opciones={empresas.datos ?? []}
              valor={form.nitMonitoreoFlota}
              alCambiar={(nit) => fijar("nitMonitoreoFlota", nit)}
              obtenerId={(e) => e.nit}
              obtenerEtiqueta={(e) => `${e.nombre} (${e.nit})`}
            />

            <label>Valor del flete</label>
            <input
              type="number"
              value={form.valorFleteReal ?? ""}
              onChange={(e) =>
                fijar("valorFleteReal", e.target.value === "" ? null : Number(e.target.value))
              }
            />
            <p className="section-desc">Actual: {moneda(original.valorFleteReal)}</p>

            <label>Anticipo</label>
            <input
              type="number"
              value={form.valorAnticipoManifiesto}
              onChange={(e) => fijar("valorAnticipoManifiesto", Number(e.target.value || 0))}
            />

            <label>Numero del manifiesto</label>
            <input
              value={form.consecutivoManifiesto}
              onChange={(e) => fijar("consecutivoManifiesto", e.target.value.toUpperCase())}
            />
            <p className="section-desc">
              Por defecto se reutiliza el mismo numero: un manifiesto rechazado no queda
              registrado. Cambialo solo si el RNDC dice que el consecutivo ya existe.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
