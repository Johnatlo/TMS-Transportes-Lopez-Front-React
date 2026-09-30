import { useEffect, useState } from "react";
import { api, aInputLocal, ErrorApi, fechaHora, moneda } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "./Estado";
import Modal from "./Modal";
import type { Viaje, ViajeRemesa } from "../api/tipos";

/** Solo se cumplen viajes con manifiesto vigente (ver despacho.ts). */
export function esCumplible(v: Pick<Viaje, "estado">): boolean {
  return v.estado === "CONFIRMADO";
}

/** Lo que el usuario escribe para cumplir UNA remesa. */
interface FormularioRemesa {
  kilos: string;
  entradaCargue: string; // formato de <input type="datetime-local">
  entradaDescargue: string;
  enviando: boolean;
  error: string | null;
}

/**
 * Valores iniciales de una remesa: lo cargado y las citas pactadas. La entrada
 * al descargue no puede ser futura, asi que si la cita aun no llega se propone
 * la hora actual.
 */
function formularioInicial(r: ViajeRemesa): FormularioRemesa {
  const ahora = new Date();
  const citaDescargue = new Date(r.fechaHoraDescargue);
  return {
    kilos: r.pesoReal ? String(r.pesoReal) : "",
    entradaCargue: aInputLocal(new Date(r.fechaHoraCargue)),
    entradaDescargue: aInputLocal(citaDescargue > ahora ? ahora : citaDescargue),
    enviando: false,
    error: r.mensajeError,
  };
}

/**
 * Ventana para cumplir un viaje en el RNDC: primero cada remesa (proceso 5) y,
 * cuando todas estan cumplidas, el manifiesto (proceso 6). Es el orden que
 * exige el RNDC [Guia Cumplido de Remesa y Manifiesto, pag. 3].
 *
 * Cada remesa tiene su propio formulario y su propio estado de envio: se
 * guardan en un objeto indexado por el id de la remesa, asi cumplir una no
 * reinicia lo que se escribio en otra.
 */
export default function CumplirViaje({
  viaje: viajeInicial,
  alCerrar,
  alTerminar,
}: {
  viaje: Viaje;
  alCerrar: () => void;
  /** Se llama despues de cada envio, para recargar la lista de fondo. */
  alTerminar: () => void;
}) {
  const [viaje, setViaje] = useState<Viaje>(viajeInicial);
  const carga = useDatos(() => api.getRemesasDeViaje(viaje.id), [viaje.id]);
  const [remesas, setRemesas] = useState<ViajeRemesa[] | null>(null);
  const [formularios, setFormularios] = useState<Record<number, FormularioRemesa>>({});
  const [enviandoManifiesto, setEnviandoManifiesto] = useState(false);
  const [errorManifiesto, setErrorManifiesto] = useState<string | null>(null);

  // Cuando llegan las remesas del servidor se copian al estado local (que se
  // actualiza con cada cumplido) y se arma un formulario para cada pendiente.
  useEffect(() => {
    if (!carga.datos) return;
    setRemesas(carga.datos);
    setFormularios(
      Object.fromEntries(
        carga.datos.filter((r) => r.estado === "CREADA").map((r) => [r.id, formularioInicial(r)])
      )
    );
  }, [carga.datos]);

  const activas = (remesas ?? []).filter((r) => r.estado !== "ANULADA");
  const pendientes = activas.filter((r) => r.estado !== "CUMPLIDA");
  const cumplido = viaje.estado === "CUMPLIDO";

  /** Cambia un campo del formulario de una remesa sin tocar los demas. */
  function cambiar(id: number, cambios: Partial<FormularioRemesa>) {
    setFormularios((previo) => ({ ...previo, [id]: { ...previo[id], ...cambios } }));
  }

  async function cumplirRemesa(r: ViajeRemesa) {
    const f = formularios[r.id];
    cambiar(r.id, { enviando: true, error: null });
    try {
      const resp = await api.cumplirRemesa(r.id, {
        cantidadEntregada: Number(f.kilos),
        // El input da hora local sin zona; new Date() la interpreta como local
        // y toISOString() la lleva a UTC para el backend.
        entradaCargue: new Date(f.entradaCargue).toISOString(),
        entradaDescargue: new Date(f.entradaDescargue).toISOString(),
      });
      setRemesas(resp.remesas);
      setViaje(resp.viaje);
    } catch (exc) {
      if (exc instanceof ErrorApi && exc.cuerpo?.remesas) setRemesas(exc.cuerpo.remesas);
      cambiar(r.id, { error: exc instanceof Error ? exc.message : "No se pudo cumplir la remesa" });
    } finally {
      cambiar(r.id, { enviando: false });
      alTerminar();
    }
  }

  async function cumplirManifiesto() {
    setEnviandoManifiesto(true);
    setErrorManifiesto(null);
    try {
      const r = await api.cumplirManifiesto(viaje.id);
      setViaje(r);
      setRemesas(r.remesas);
    } catch (exc) {
      if (exc instanceof ErrorApi && exc.cuerpo?.id === viaje.id) setViaje(exc.cuerpo as Viaje);
      setErrorManifiesto(exc instanceof Error ? exc.message : "No se pudo cumplir el manifiesto");
    } finally {
      setEnviandoManifiesto(false);
      alTerminar();
    }
  }

  return (
    <Modal
      titulo={`Cumplir viaje #${viaje.id} - ${viaje.consecutivoManifiesto ?? ""}`}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cerrar
          </button>
          {!cumplido && remesas && (
            <button
              className="btn-primary"
              onClick={cumplirManifiesto}
              disabled={pendientes.length > 0 || enviandoManifiesto}
              title={pendientes.length > 0 ? "Primero cumple todas las remesas" : undefined}
            >
              {enviandoManifiesto ? "Cumpliendo en el RNDC..." : "Cumplir manifiesto"}
            </button>
          )}
        </>
      }
    >
      {cumplido ? (
        <div className="alert success">
          Manifiesto cumplido en el RNDC. Radicado <strong>{viaje.radicadoCumplido}</strong>
          {viaje.fechaCumplido ? ` · ${fechaHora(viaje.fechaCumplido)}` : ""}
          {/* Los avisos del viaje son de la expedicion; aqui solo interesa si el
              cumplido ya existia en el RNDC (hecho en el portal). */}
          {viaje.avisos?.startsWith("Ya estaba cumplido") ? (
            <div className="dato-sec">{viaje.avisos}</div>
          ) : null}
        </div>
      ) : (
        <>
          {viaje.plazoCumplido && <AvisoPlazo dias={viaje.plazoCumplido.diasHabilesRestantes} />}
          <div className="alert info">
            Este es el <strong>cumplido normal</strong>: el viaje se hizo como se pacto. Si hubo
            suspension (accidente, varada, siniestro) o hay que pagar adicionales o aplicar
            descuentos, hazlo en el portal del RNDC: la guia del Ministerio aun no publica esos
            campos para el webservice.
          </div>
        </>
      )}

      {carga.cargando && !remesas && <Cargando que="las remesas" />}
      {carga.error && <ErrorCarga mensaje={carga.error} alReintentar={carga.recargar} />}

      {activas.map((r) => (
        <div className="form-section" key={r.id}>
          <div>
            <div className="section-title">Remesa {r.consecutivoRemesa}</div>
            <div className="section-desc">
              Cargados: {r.pesoReal ?? "-"} kg
              <br />
              Cita de descargue: {fechaHora(r.fechaHoraDescargue)}
            </div>
          </div>
          <div>
            {r.estado === "CUMPLIDA" ? (
              <div className="alert success" style={{ margin: 0 }}>
                Cumplida · radicado <strong>{r.radicadoCumplido}</strong>
                <div className="dato-sec">
                  Entregados {r.cantidadEntregada ?? "-"} kg · entrada al cargue{" "}
                  {r.entradaCargue ? fechaHora(r.entradaCargue) : "-"} · entrada al descargue{" "}
                  {r.entradaDescargue ? fechaHora(r.entradaDescargue) : "-"}
                </div>
                {r.mensajeError && <div className="dato-sec">{r.mensajeError}</div>}
              </div>
            ) : formularios[r.id] ? (
              <FormularioCumplido
                f={formularios[r.id]}
                alCambiar={(c) => cambiar(r.id, c)}
                alCumplir={() => cumplirRemesa(r)}
              />
            ) : (
              <div className="alert warning" style={{ margin: 0 }}>
                Esta remesa esta en estado {r.estado} y no se puede cumplir.
              </div>
            )}
          </div>
        </div>
      ))}

      {!cumplido && remesas && (
        <div className="form-section">
          <div>
            <div className="section-title">Manifiesto</div>
            <div className="section-desc">
              Se cumple con el valor y el FOPAT con los que se expidio.
            </div>
          </div>
          <div>
            <div className="dato-sec">
              Valor a pagar {moneda(viaje.valorFleteReal)} · FOPAT {moneda(viaje.retencionFopat)}
            </div>
            {pendientes.length > 0 && (
              <div className="dato-sec">
                Falta{pendientes.length > 1 ? "n" : ""} cumplir{" "}
                {pendientes.map((r) => r.consecutivoRemesa).join(", ")}.
              </div>
            )}
            {(errorManifiesto || (viaje.mensajeError && viaje.mensajeError.startsWith("Cumplido"))) && (
              <div className="alert danger" style={{ whiteSpace: "pre-wrap", marginTop: "0.6rem" }}>
                {errorManifiesto ?? viaje.mensajeError}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function FormularioCumplido({
  f,
  alCambiar,
  alCumplir,
}: {
  f: FormularioRemesa;
  alCambiar: (cambios: Partial<FormularioRemesa>) => void;
  alCumplir: () => void;
}) {
  const ahora = aInputLocal(new Date());
  return (
    <>
      <div className="campos-cumplido">
        <div>
          <label>Kilos entregados</label>
          <input
            type="number"
            min="0"
            value={f.kilos}
            onChange={(e) => alCambiar({ kilos: e.target.value })}
          />
        </div>
        <div>
          <label>Entrada al cargue</label>
          <input
            type="datetime-local"
            max={ahora}
            value={f.entradaCargue}
            onChange={(e) => alCambiar({ entradaCargue: e.target.value })}
          />
        </div>
        <div>
          <label>Entrada al descargue</label>
          <input
            type="datetime-local"
            max={ahora}
            value={f.entradaDescargue}
            onChange={(e) => alCambiar({ entradaDescargue: e.target.value })}
          />
        </div>
      </div>
      <div className="section-desc">
        La llegada y la salida las completa el RNDC con los tiempos del GPS.
      </div>
      {f.error && (
        <div className="alert danger" style={{ whiteSpace: "pre-wrap" }}>
          {f.error}
        </div>
      )}
      <button
        className="btn-primary"
        onClick={alCumplir}
        disabled={f.enviando || !f.kilos || !f.entradaCargue || !f.entradaDescargue}
      >
        {f.enviando ? "Cumpliendo en el RNDC..." : "Cumplir remesa"}
      </button>
    </>
  );
}

/** Aviso del plazo de 5 dias habiles, con el tono segun lo que falte. */
export function AvisoPlazo({ dias }: { dias: number }) {
  if (dias < 0) {
    return (
      <div className="alert danger">
        El plazo para cumplir vencio hace {-dias} dia{dias === -1 ? "" : "s"} habil
        {dias === -1 ? "" : "es"}. Si los manifiestos vencidos pasan del 20% de los del ultimo
        mes, el RNDC bloquea la expedicion.
      </div>
    );
  }
  return (
    <div className={`alert ${dias <= 1 ? "warning" : "info"}`}>
      Quedan {dias} dia{dias === 1 ? "" : "s"} habil{dias === 1 ? "" : "es"} para cumplir
      (5 desde la entrega, sin contar festivos).
    </div>
  );
}
