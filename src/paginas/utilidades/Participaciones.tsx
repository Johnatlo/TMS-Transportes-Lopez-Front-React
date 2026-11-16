/**
 * Participaciones: de quien es cada vehiculo de la flota propia y en que
 * porcentaje (100 % del dueno, o una sociedad), con vigencia. Una nueva
 * participacion empieza en una fecha y la anterior se cierra el dia antes;
 * los meses anteriores no cambian. Aqui tambien se crean los socios. Solo el
 * rol total cambia algo.
 */
import { useState } from "react";
import { apiUtilidades, hoyColombia } from "../../api/cliente";
import type { ParticipacionVehiculo } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";

type Socio = { id: number; nombre: string; activo: boolean };

/** Lista de vehiculos con su participacion. */
export default function Participaciones({ editable }: { editable: boolean }) {
  const carga = useDatos(() => Promise.all([apiUtilidades.participaciones(), apiUtilidades.socios()]), []);
  const [editando, setEditando] = useState<ParticipacionVehiculo | null>(null);
  const [nuevoSocio, setNuevoSocio] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (carga.cargando && !carga.datos) return <Cargando que="las participaciones" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;
  const [vehiculos, socios] = carga.datos;

  /** Ejecuta una accion y recarga. */
  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      carga.recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  const columnas: Columna<ParticipacionVehiculo>[] = [
    { id: "placa", titulo: "Vehiculo", valor: (v) => v.placa, celda: (v) => <span className="principal">{placaConGuion(v.placa)}</span> },
    {
      id: "empresa",
      titulo: "Empresa",
      filtrable: true,
      valor: (v) => (v.empresa === "MYC" ? "T. M&C" : "T. Lopez"),
      celda: (v) => (v.empresa === "MYC" ? "T. M&C" : "T. Lopez"),
    },
    { id: "dueno", titulo: "Dueno en Flota", valor: (v) => v.dueno ?? "", celda: (v) => v.dueno ?? "-" },
    {
      id: "participacion",
      titulo: "Participacion vigente",
      valor: (v) => v.vigentes.map((p) => `${p.socio} ${p.porcentaje}`).join(" "),
      celda: (v) =>
        v.vigentes.length ? v.vigentes.map((p) => `${p.socio} ${p.porcentaje} %`).join(" + ") : <Pastilla tono="aviso">Sin participacion</Pastilla>,
    },
    {
      id: "desde",
      titulo: "Desde",
      valor: (v) => v.vigentes[0]?.desde ?? "",
      celda: (v) => (v.vigentes[0] && v.vigentes[0].desde > "2000-01-01" ? fechaCorta(v.vigentes[0].desde) : "-"),
    },
  ];

  return (
    <>
      {error && <div className="alert danger">{error}</div>}
      <div className="panel">
        <TablaDatos
          filas={vehiculos}
          columnas={columnas}
          clave={(v) => v.vehiculoId}
          nombreArchivo="participaciones"
          placeholderBusqueda="Buscar placa o socio..."
          detalle={(v) => (
            <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
              <div className="dato-sec">Historial</div>
              <table className="tabla tabla-compacta">
                <tbody>
                  {[...v.historial].reverse().map((p) => (
                    <tr key={p.id}>
                      <td>{p.socio}</td>
                      <td className="num">{p.porcentaje} %</td>
                      <td>
                        {p.desde > "2000-01-01" ? `Desde ${fechaCorta(p.desde)}` : "Desde siempre"} {p.hasta ? `hasta ${fechaCorta(p.hasta)}` : "(vigente)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {editable && (
                <div className="detalle-tanqueo-pie">
                  <button className="btn-secondary" onClick={() => setEditando(v)}>
                    Cambiar participacion
                  </button>
                </div>
              )}
            </div>
          )}
        />
      </div>
      <div className="panel" style={{ marginTop: "0.75rem", padding: "0.8rem" }}>
        <h4 style={{ margin: "0 0 0.4rem" }}>Socios</h4>
        <div className="reparto-gasto">
          {socios.map((s) => (
            <span key={s.id} className="reparto-gasto-parte">
              <strong>{s.nombre}</strong>
              {editable ? (
                <button className="btn-link" onClick={() => accion(() => apiUtilidades.activarSocio(s.id, !s.activo))}>
                  {s.activo ? "Activo · desactivar" : "Inactivo · activar"}
                </button>
              ) : (
                <span className="dato-sec">{s.activo ? "Activo" : "Inactivo"}</span>
              )}
            </span>
          ))}
        </div>
        {editable && (
          <div className="detalle-tanqueo-pie">
            <input placeholder="Nombre del socio nuevo" value={nuevoSocio} maxLength={80} onChange={(e) => setNuevoSocio(e.target.value)} />
            <button
              className="btn-secondary"
              disabled={!nuevoSocio.trim()}
              onClick={() => {
                accion(() => apiUtilidades.crearSocio(nuevoSocio));
                setNuevoSocio("");
              }}
            >
              Agregar socio
            </button>
          </div>
        )}
      </div>
      {editando && (
        <FormularioParticipacion
          v={editando}
          socios={socios.filter((s) => s.activo)}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null);
            carga.recargar();
          }}
        />
      )}
    </>
  );
}

/** Nueva participacion de un vehiculo desde una fecha (por defecto, 50/50 si se agrega un segundo socio). */
function FormularioParticipacion({
  v,
  socios,
  alCerrar,
  alGuardar,
}: {
  v: ParticipacionVehiculo;
  socios: Socio[];
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [desde, setDesde] = useState(hoyColombia().slice(0, 8) + "01");
  const [partes, setPartes] = useState(
    v.vigentes.length ? v.vigentes.map((p) => ({ socioId: String(p.socioId), porcentaje: String(p.porcentaje) })) : [{ socioId: "", porcentaje: "100" }],
  );
  const [error, setError] = useState<string | null>(null);
  const suma = partes.reduce((s, p) => s + (Number(p.porcentaje) || 0), 0);
  /** Agrega un socio y reparte en partes iguales (50/50 con dos), que se pueden cambiar. */
  const agregar = () => {
    const n = partes.length + 1;
    const igual = String(Math.round((100 / n) * 10000) / 10000);
    setPartes([...partes.map((p) => ({ ...p, porcentaje: igual })), { socioId: "", porcentaje: igual }]);
  };
  async function guardar() {
    setError(null);
    try {
      await apiUtilidades.guardarParticipacion(
        v.vehiculoId,
        desde,
        partes.map((p) => ({ socioId: Number(p.socioId), porcentaje: Number(p.porcentaje) })),
      );
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }
  return (
    <Modal
      titulo={`Participacion de ${placaConGuion(v.placa)}`}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={Math.abs(suma - 100) > 0.001 || partes.some((p) => !p.socioId) || !desde} onClick={guardar}>
            Guardar
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
      </div>
      <div className="destinos-socios" style={{ marginTop: "0.6rem" }}>
        {partes.map((p, i) => (
          <div key={i} className="linea-abono">
            <select value={p.socioId} onChange={(e) => setPartes(partes.map((x, j) => (j === i ? { ...x, socioId: e.target.value } : x)))} aria-label="Socio">
              <option value="">Socio...</option>
              {socios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              style={{ width: "7rem" }}
              value={p.porcentaje}
              onChange={(e) => setPartes(partes.map((x, j) => (j === i ? { ...x, porcentaje: e.target.value } : x)))}
              aria-label="Porcentaje"
            />
            <span className="dato-sec">%</span>
            {partes.length > 1 && (
              <button className="btn-link" onClick={() => setPartes(partes.filter((_, j) => j !== i))}>
                Quitar
              </button>
            )}
          </div>
        ))}
        <button className="btn-link" onClick={agregar}>
          + Agregar socio (sociedad)
        </button>
      </div>
      <div className={`alert ${Math.abs(suma - 100) > 0.001 ? "warning" : "info"}`} style={{ marginTop: "0.5rem" }}>
        Suma: {suma.toLocaleString("es-CO", { maximumFractionDigits: 4 })} % {Math.abs(suma - 100) > 0.001 ? "(debe ser 100 %)" : ""}. Los meses anteriores a la
        fecha no cambian.
      </div>
    </Modal>
  );
}
