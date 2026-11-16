/**
 * Socios y su cuenta (solo rol total): los de la empresa y los externos (los
 * que solo estan en una sociedad de un vehiculo). Para cada uno: lo que se le
 * repartio en cada mes aprobado, los pagos que se le han hecho y el saldo por
 * pagar. Los pagos llevan fecha, valor, nota y el link del soporte (Drive);
 * el sistema no guarda datos bancarios. Un pago negativo es lo que el socio
 * le devolvio a la empresa.
 */
import { useState } from "react";
import { apiUtilidades, hoyColombia, moneda } from "../../api/cliente";
import type { CuentaSocio, DatosSocio } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { nombreMes } from "./pasos";

/** Lista de socios con su cuenta. */
export default function Socios() {
  const carga = useDatos(() => apiUtilidades.cuentas(), []);
  const [formulario, setFormulario] = useState<{ socio: CuentaSocio | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (carga.cargando && !carga.datos) return <Cargando que="los socios" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;

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

  const columnas: Columna<CuentaSocio>[] = [
    {
      id: "nombre",
      titulo: "Socio",
      valor: (s) => s.nombre,
      celda: (s) => (
        <>
          <span className="principal">{s.nombre}</span>
          <span className="dato-sec">{[s.documento, s.nota].filter(Boolean).join(" · ") || "-"}</span>
        </>
      ),
    },
    {
      id: "tipo",
      titulo: "Tipo",
      filtrable: true,
      valor: (s) => (s.externo ? "Externo" : "De la empresa"),
      celda: (s) => (s.externo ? <Pastilla tono="morado">Externo</Pastilla> : <Pastilla tono="azul">De la empresa</Pastilla>),
    },
    { id: "meses", titulo: "Meses repartidos", alinear: "derecha", valor: (s) => s.meses.length, celda: (s) => s.meses.length || "-" },
    { id: "repartido", titulo: "Repartido", alinear: "derecha", valor: (s) => Math.round(s.repartido), celda: (s) => moneda(s.repartido) },
    { id: "pagado", titulo: "Pagado", alinear: "derecha", valor: (s) => Math.round(s.pagado), celda: (s) => moneda(s.pagado) },
    {
      id: "saldo",
      titulo: "Saldo",
      alinear: "derecha",
      valor: (s) => Math.round(s.saldo),
      celda: (s) => (
        <strong className={s.saldo < 0 ? "texto-vencido" : undefined} title={s.saldo < 0 ? "Lo que el socio debe" : "Lo que falta por pagarle"}>
          {moneda(s.saldo)}
        </strong>
      ),
    },
    { id: "estado", titulo: "Estado", filtrable: true, valor: (s) => (s.activo ? "Activo" : "Inactivo"), celda: (s) => (s.activo ? "Activo" : "Inactivo") },
  ];
  const pestanas: PestanaTabla<CuentaSocio>[] = [
    { id: "activos", etiqueta: "Activos", incluye: (s) => s.activo },
    { id: "externos", etiqueta: "Externos", incluye: (s) => s.activo && s.externo },
    { id: "saldo", etiqueta: "Con saldo", incluye: (s) => Math.abs(s.saldo) >= 1 },
    { id: "inactivos", etiqueta: "Inactivos", incluye: (s) => !s.activo },
  ];

  return (
    <>
      <div className="section-desc" style={{ marginBottom: "0.5rem" }}>
        Repartido = la utilidad del socio en los meses con reparto aprobado (despues de sus gastos propios). Saldo = repartido - pagado: lo que falta por
        pagarle (en rojo, lo que el debe). Los socios externos no hacen parte de la empresa: solo tienen participacion en una sociedad.
      </div>
      {error && <div className="alert danger">{error}</div>}
      <div className="panel">
        <TablaDatos
          filas={carga.datos}
          columnas={columnas}
          clave={(s) => s.id}
          pestanas={pestanas}
          nombreArchivo={`socios-${hoyColombia()}`}
          placeholderBusqueda="Buscar socio..."
          acciones={
            <button className="btn-primary boton-con-texto" onClick={() => setFormulario({ socio: null })}>
              Nuevo socio
            </button>
          }
          detalle={(s) => (
            <DetalleSocio
              s={s}
              alEditar={() => setFormulario({ socio: s })}
              alActivar={() => accion(() => apiUtilidades.activarSocio(s.id, !s.activo))}
              alPagar={(d) => accion(() => apiUtilidades.registrarPago(s.id, d))}
              alBorrarPago={(id) => window.confirm("¿Borrar este pago?") && accion(() => apiUtilidades.borrarPago(id))}
            />
          )}
        />
      </div>
      {formulario && (
        <FormularioSocio
          socio={formulario.socio}
          alCerrar={() => setFormulario(null)}
          alGuardar={() => {
            setFormulario(null);
            carga.recargar();
          }}
        />
      )}
    </>
  );
}

/** Lo repartido por mes, los pagos y el formulario de pago de un socio. */
function DetalleSocio({
  s,
  alEditar,
  alActivar,
  alPagar,
  alBorrarPago,
}: {
  s: CuentaSocio;
  alEditar: () => void;
  alActivar: () => void;
  alPagar: (d: { fecha: string; monto: number; nota: string | null; soporteUrl: string | null }) => void;
  alBorrarPago: (id: number) => void;
}) {
  const [fecha, setFecha] = useState(hoyColombia());
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [soporte, setSoporte] = useState("");
  return (
    <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
      <div className="detalle-nomina">
        <div>
          <h5>Repartido por mes (aprobados)</h5>
          {s.meses.length ? (
            s.meses.map((m) => (
              <div key={m.mes} className="concepto-nomina">
                <span>
                  {nombreMes(m.mes)}
                  {m.gastosPropios ? <span className="dato-sec"> (gastos propios {moneda(m.gastosPropios)})</span> : null}
                </span>
                <span className={m.total < 0 ? "texto-vencido" : undefined}>{moneda(m.total)}</span>
              </div>
            ))
          ) : (
            <span className="dato-sec">Aun no hay meses aprobados con participacion de este socio.</span>
          )}
          <div className="concepto-nomina">
            <strong>Total repartido</strong>
            <strong>{moneda(s.repartido)}</strong>
          </div>
        </div>
        <div>
          <h5>Pagos</h5>
          {s.pagos.length ? (
            s.pagos.map((p) => (
              <div key={p.id} className="concepto-nomina">
                <span>
                  {fechaCorta(p.fecha)} {p.nota && <span className="dato-sec">{p.nota}</span>}{" "}
                  {p.soporteUrl && (
                    <a href={p.soporteUrl} target="_blank" rel="noreferrer">
                      soporte
                    </a>
                  )}
                </span>
                <span>
                  {moneda(p.monto)}{" "}
                  <button className="btn-link" onClick={() => alBorrarPago(p.id)}>
                    Borrar
                  </button>
                </span>
              </div>
            ))
          ) : (
            <span className="dato-sec">Sin pagos registrados.</span>
          )}
          <div className="concepto-nomina">
            <strong>Total pagado</strong>
            <strong>{moneda(s.pagado)}</strong>
          </div>
          <div className="concepto-nomina">
            <strong>Saldo</strong>
            <strong className={s.saldo < 0 ? "texto-vencido" : undefined}>{moneda(s.saldo)}</strong>
          </div>
        </div>
        <div>
          <h5>Registrar un pago</h5>
          <div className="campos-cuadro" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label>Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <label>Valor (negativo si el devolvio)</label>
              <input type="number" step="any" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Nota (opcional)</label>
              <input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Reparto de octubre" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Link del soporte (opcional)</label>
              <input type="url" value={soporte} maxLength={500} onChange={(e) => setSoporte(e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
          </div>
          <button
            className="btn-secondary"
            style={{ marginTop: "0.4rem" }}
            disabled={!fecha || !Number(monto)}
            onClick={() => {
              alPagar({ fecha, monto: Number(monto), nota: nota.trim() || null, soporteUrl: soporte.trim() || null });
              setMonto("");
              setNota("");
              setSoporte("");
            }}
          >
            Registrar pago
          </button>
        </div>
      </div>
      <div className="detalle-tanqueo-pie">
        <button className="btn-secondary" onClick={alEditar}>
          Editar datos
        </button>
        <button className="btn-link" onClick={alActivar}>
          {s.activo ? "Desactivar" : "Activar"}
        </button>
      </div>
    </div>
  );
}

/** Formulario para crear o cambiar un socio. */
function FormularioSocio({ socio, alCerrar, alGuardar }: { socio: CuentaSocio | null; alCerrar: () => void; alGuardar: () => void }) {
  const [d, setD] = useState<DatosSocio>({
    nombre: socio?.nombre ?? "",
    externo: socio?.externo ?? true,
    documento: socio?.documento ?? "",
    nota: socio?.nota ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  async function guardar() {
    setError(null);
    try {
      const datos = { ...d, documento: d.documento?.trim() || null, nota: d.nota?.trim() || null };
      if (socio) await apiUtilidades.actualizarSocio(socio.id, datos);
      else await apiUtilidades.crearSocio(datos);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }
  return (
    <Modal
      titulo={socio ? `Editar ${socio.nombre}` : "Nuevo socio"}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!d.nombre.trim()} onClick={guardar}>
            Guardar
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Nombre</label>
          <input value={d.nombre} maxLength={80} onChange={(e) => setD({ ...d, nombre: e.target.value })} />
        </div>
        <div>
          <label>Tipo</label>
          <select value={d.externo ? "EXTERNO" : "EMPRESA"} onChange={(e) => setD({ ...d, externo: e.target.value === "EXTERNO" })}>
            <option value="EXTERNO">Externo (solo en una sociedad)</option>
            <option value="EMPRESA">De la empresa</option>
          </select>
        </div>
        <div>
          <label>Documento (opcional)</label>
          <input value={d.documento ?? ""} maxLength={20} onChange={(e) => setD({ ...d, documento: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Nota (opcional)</label>
          <input value={d.nota ?? ""} maxLength={300} onChange={(e) => setD({ ...d, nota: e.target.value })} placeholder="Socio de la SPI-982 con Mauricio" />
        </div>
      </div>
      <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
        Despues de crearlo, registra su porcentaje en el vehiculo desde la pestana Participaciones.
      </div>
    </Modal>
  );
}
