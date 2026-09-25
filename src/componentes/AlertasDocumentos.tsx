import { useState } from "react";
import { api, soloDia } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import Modal from "./Modal";
import type { AlertaDocumento, OrigenAlerta, ResumenAlertas } from "../api/tipos";

type Grupo = "vencidos" | "porVencer" | "sinFecha";

const GRUPOS: Array<{ id: Grupo; etiqueta: string }> = [
  { id: "vencidos", etiqueta: "Vencidos" },
  { id: "porVencer", etiqueta: "Por vencer" },
  { id: "sinFecha", etiqueta: "Sin fecha" },
];

const TIPOS: Array<AlertaDocumento["tipo"] | "TODOS"> = [
  "TODOS",
  "SOAT",
  "TECNOMECANICA",
  "LICENCIA",
  "POLIZA",
];

/**
 * Llave estable de una alerta: el registro y el campo del que sale. Con el
 * indice de la lista como llave, al refrescar (el documento corregido sale de
 * la lista) React le pasaria el estado de edicion a la fila de abajo.
 */
function llave(a: AlertaDocumento): string {
  return `${a.origen.entidad}-${a.origen.id ?? 0}-${a.origen.campo}`;
}

/**
 * Aplica un cambio al registro del que sale la alerta: la nueva fecha de
 * vencimiento, o `activo: true` para reactivarlo.
 */
async function actualizarOrigen(origen: OrigenAlerta, cambio: Record<string, unknown>): Promise<void> {
  switch (origen.entidad) {
    case "vehiculo":
      await api.actualizarVehiculo(origen.id!, cambio);
      return;
    case "remolque":
      await api.actualizarRemolque(origen.id!, cambio);
      return;
    case "conductor":
      await api.actualizarConductor(origen.id!, cambio);
      return;
    case "empresa":
      // El guardado de parametros ya no borra los campos que no se envian.
      await api.guardarParametros(cambio);
      return;
  }
}

/**
 * Documentos vencidos o por vencer, en una ventana aparte para no ocupar la
 * pantalla de inicio. Se abre desde el boton "Documentos" de la barra
 * superior o desde el indicador del Inicio.
 *
 * Cada fila se puede actualizar ahi mismo: se escribe la nueva fecha de
 * vencimiento y se guarda en el vehiculo, remolque, conductor o empresa.
 */
export default function AlertasDocumentos({
  resumen,
  alCerrar,
  alActualizar,
}: {
  resumen: ResumenAlertas;
  alCerrar: () => void;
  /** Se llama tras guardar una fecha, para volver a pedir las alertas. */
  alActualizar: () => void;
}) {
  // Abre en el grupo mas urgente que tenga algo.
  const [grupo, setGrupo] = useState<Grupo>(
    resumen.vencidos.length > 0 ? "vencidos" : resumen.porVencer.length > 0 ? "porVencer" : "sinFecha"
  );
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("TODOS");
  const [busqueda, setBusqueda] = useState("");
  /** Confirmacion del ultimo guardado (la fila puede desaparecer de la lista). */
  const [ultimoGuardado, setUltimoGuardado] = useState<string | null>(null);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  /** Sube tras cada guardado, para volver a pedir la lista con inactivos. */
  const [recargas, setRecargas] = useState(0);

  // Con inactivos se pide aparte: el resumen del marco (y los contadores de la
  // barra superior) cuentan solo activos. Sin la casilla no se pide nada.
  const conInactivos = useDatos(
    () => (incluirInactivos ? api.getAlertas(resumen.diasAviso, true) : Promise.resolve(null)),
    [incluirInactivos, recargas]
  );
  const fuente = incluirInactivos && conInactivos.datos ? conInactivos.datos : resumen;

  function despuesDeGuardar(mensaje: string) {
    setUltimoGuardado(mensaje);
    setRecargas((n) => n + 1);
    alActualizar();
  }

  const texto = busqueda.trim().toLowerCase();
  const lista = fuente[grupo]
    .filter((a) => tipo === "TODOS" || a.tipo === tipo)
    .filter((a) => !texto || `${a.sujeto} ${a.identificacion ?? ""}`.toLowerCase().includes(texto));

  return (
    <Modal titulo="Documentos vencidos o por vencer" ancho="wide" alCerrar={alCerrar}>
      <p className="section-desc" style={{ marginTop: 0 }}>
        El RNDC valida SOAT, tecnomecanica y licencia contra la fecha de descargue del
        manifiesto, no contra hoy: un documento que vence esta semana ya bloquea viajes de la
        proxima. Se avisa con {resumen.diasAviso} dias de anticipacion. Usa "Actualizar" para
        registrar la nueva fecha cuando se renueve un documento.
      </p>

      {ultimoGuardado && <div className="alert success">✓ {ultimoGuardado}</div>}

      <div className="filtros-catalogo" style={{ marginBottom: "0.8rem" }}>
        {GRUPOS.map((g) => (
          <button
            key={g.id}
            className={grupo === g.id ? "btn-primary" : "btn-secondary"}
            onClick={() => setGrupo(g.id)}
          >
            {g.etiqueta} ({fuente[g.id].length})
          </button>
        ))}
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as (typeof TIPOS)[number])}
          style={{ width: "auto" }}
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t === "TODOS" ? "Todos los documentos" : t}
            </option>
          ))}
        </select>
        <input
          className="search-input"
          placeholder="Buscar placa o nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={incluirInactivos}
            onChange={(e) => setIncluirInactivos(e.target.checked)}
          />
          Incluir inactivos
        </label>
        {incluirInactivos && conInactivos.cargando && <span className="dato-sec-inline">cargando...</span>}
      </div>

      <div className="tabla-alertas" style={{ maxHeight: "55vh", overflowY: "auto" }}>
        <table className="modern">
          <thead>
            <tr>
              <th>Documento</th>
              <th>De</th>
              <th>Vence</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((a) => (
              <FilaAlerta
                key={llave(a)}
                alerta={a}
                alGuardar={(fecha) =>
                  despuesDeGuardar(`${a.tipo} de ${a.sujeto} actualizado: vence el ${soloDia(fecha)}.`)
                }
                alCambiarEstado={(activo) =>
                  despuesDeGuardar(
                    activo
                      ? `${a.sujeto} quedo activo otra vez: ya aparece en el despacho.`
                      : `${a.sujeto} quedo inactivo: ya no aparece en el despacho ni en los contadores. Para verlo, marca "Incluir inactivos".`
                  )
                }
              />
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  Nada en esta categoria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="resumen-catalogo">
        {lista.length} documento(s). Revisados: {fuente.revisados.vehiculos} vehiculos,{" "}
        {fuente.revisados.remolques} remolques y {fuente.revisados.conductores} conductores
        {fuente.incluyeInactivos ? " (activos e inactivos)" : " activos"}.
      </p>
    </Modal>
  );
}

/**
 * Una alerta. Tiene su propio estado de edicion: cada fila se edita por
 * separado sin afectar a las demas.
 */
function FilaAlerta({
  alerta,
  alGuardar,
  alCambiarEstado,
}: {
  alerta: AlertaDocumento;
  alGuardar: (fecha: string) => void;
  /** Se llama tras inactivar (false) o reactivar (true) el registro. */
  alCambiarEstado: (activo: boolean) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dias = alerta.diasRestantes ?? 0;
  const vencido = alerta.severidad === "VENCIDO";
  const texto =
    alerta.fechaVencimiento === null
      ? "sin fecha registrada"
      : vencido
        ? `vencido hace ${Math.abs(dias)} d`
        : dias === 0
          ? "vence hoy"
          : `vence en ${dias} d`;

  function empezar() {
    // Se propone la fecha actual como punto de partida (o vacio si no hay).
    setFecha((alerta.fechaVencimiento ?? "").slice(0, 10));
    setError(null);
    setEditando(true);
  }

  async function guardar() {
    if (!fecha) {
      setError("Escribe la nueva fecha de vencimiento.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await actualizarOrigen(alerta.origen, { [alerta.origen.campo]: fecha });
      setEditando(false);
      alGuardar(fecha);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  // La poliza es de la empresa: no tiene estado activo/inactivo.
  const admiteEstado = alerta.origen.entidad !== "empresa";

  /**
   * Inactivar o reactivar el registro. Inactivar no borra nada: el registro
   * sigue en el historial de viajes, solo deja de ofrecerse en el despacho.
   */
  async function cambiarEstado(activo: boolean) {
    const pregunta = activo
      ? `¿Reactivar ${alerta.sujeto}? Volvera a aparecer en el despacho.`
      : `¿Inactivar ${alerta.sujeto}? Dejara de aparecer en el despacho y en las alertas. ` +
        `No se borra: se puede reactivar despues.`;
    if (!window.confirm(pregunta)) return;
    setGuardando(true);
    setError(null);
    try {
      await actualizarOrigen(alerta.origen, { activo });
      alCambiarEstado(activo);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo cambiar el estado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <tr className={alerta.activo ? undefined : "fila-inactiva-alerta"}>
      <td>{alerta.tipo}</td>
      <td>
        {alerta.sujeto}
        {!alerta.activo && (
          <span className="badge badge-neutral" style={{ marginLeft: 6 }}>
            Inactivo
          </span>
        )}
        {alerta.identificacion && <span className="dato-sec">{alerta.identificacion}</span>}
        {!editando && error && <span className="error-fila">{error}</span>}
      </td>
      {editando ? (
        <td colSpan={3}>
          <div className="edicion-fecha">
            <input
              type="date"
              value={fecha}
              autoFocus
              onChange={(e) => setFecha(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") guardar();
                // Escape cancela la fila sin cerrar toda la ventana.
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setEditando(false);
                }
              }}
            />
            <button className="btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button className="btn-secondary" onClick={() => setEditando(false)} disabled={guardando}>
              Cancelar
            </button>
          </div>
          {error && <span className="error-fila">{error}</span>}
        </td>
      ) : (
        <>
          <td>{soloDia(alerta.fechaVencimiento)}</td>
          <td>
            {/* El estado lleva icono + texto: el color nunca va solo. */}
            <span
              className={`badge ${vencido ? "badge-danger" : alerta.fechaVencimiento === null ? "badge-neutral" : "badge-warning"}`}
            >
              {vencido ? "✖ " : "⚠ "}
              {texto}
            </span>
          </td>
          <td style={{ whiteSpace: "nowrap" }}>
            <button className="btn-secondary" onClick={empezar}>
              Actualizar
            </button>
            {admiteEstado && (
              <button
                className="btn-link"
                onClick={() => cambiarEstado(!alerta.activo)}
                disabled={guardando}
                style={{ marginLeft: 6 }}
              >
                {alerta.activo ? "Inactivar" : "Reactivar"}
              </button>
            )}
          </td>
        </>
      )}
    </tr>
  );
}
