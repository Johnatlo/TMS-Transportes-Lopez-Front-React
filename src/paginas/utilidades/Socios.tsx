/**
 * Socios y su cuenta: los de la empresa y los externos (los que solo estan en
 * una sociedad de un vehiculo). La cuenta va mes a mes: saldo anterior + el
 * neto del reparto aprobado del mes - los pagos = saldo, que pasa al mes
 * siguiente. Asi, si un mes al socio no le alcanza para sus gastos, queda
 * debiendo y se le descuenta despues. Los pagos llevan fecha, valor, nota y el
 * link del soporte (Drive); el sistema no guarda datos bancarios. Un pago
 * negativo es lo que el socio le devolvio a la empresa. Solo el rol total
 * crea socios y registra pagos.
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
export default function Socios({ editable }: { editable: boolean }) {
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
    {
      id: "inicial",
      titulo: "Saldo inicial",
      alinear: "derecha",
      valor: (s) => Math.round(s.saldoInicial),
      celda: (s) => (s.saldoInicial ? moneda(s.saldoInicial) : "-"),
    },
    {
      id: "neto",
      titulo: "Neto de los repartos",
      alinear: "derecha",
      valor: (s) => Math.round(s.meses.reduce((t, m) => t + m.neto, 0)),
      celda: (s) => moneda(s.meses.reduce((t, m) => t + m.neto, 0)),
    },
    {
      id: "pagado",
      titulo: "Pagado",
      alinear: "derecha",
      valor: (s) => Math.round(s.pagos.reduce((t, p) => t + p.monto, 0)),
      celda: (s) => moneda(s.pagos.reduce((t, p) => t + p.monto, 0)),
    },
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
        Saldo = saldo inicial + el neto de cada reparto aprobado - los pagos: lo que falta por pagarle (en rojo, lo que el debe; se le descuenta de los repartos
        siguientes). Los socios externos no hacen parte de la empresa: solo tienen participacion en una sociedad.
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
            editable ? (
              <button className="btn-primary boton-con-texto" onClick={() => setFormulario({ socio: null })}>
                Nuevo socio
              </button>
            ) : undefined
          }
          detalle={(s) => (
            <DetalleSocio
              s={s}
              editable={editable}
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
  editable,
  alEditar,
  alActivar,
  alPagar,
  alBorrarPago,
}: {
  s: CuentaSocio;
  editable: boolean;
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
          <h5>Cuenta mes a mes</h5>
          <div className="concepto-nomina">
            <span>Saldo inicial</span>
            <span>{moneda(s.saldoInicial)}</span>
          </div>
          {s.meses.length ? (
            s.meses.map((m) => (
              <div key={m.mes} className="cuenta-mes">
                <div className="concepto-nomina">
                  <strong>{nombreMes(m.mes)}</strong>
                  <strong className={m.saldo < 0 ? "texto-vencido" : undefined}>{moneda(m.saldo)}</strong>
                </div>
                <span className="dato-sec">
                  Venia {moneda(m.saldoAnterior)} · reparto {moneda(m.neto)}
                  {m.detalle &&
                    ` (repartido ${moneda(m.detalle.repartido)}, 4x1000 ${moneda(m.detalle.gmf)}, viajes ${moneda(m.detalle.liquidado - m.detalle.recibido)}, gastos propios ${moneda(m.detalle.totalGastosPropios)})`}
                  {m.pagos ? ` · pagos ${moneda(m.pagos)}` : ""}
                </span>
              </div>
            ))
          ) : (
            <span className="dato-sec">Aun no hay meses aprobados ni pagos de este socio.</span>
          )}
          <div className="concepto-nomina">
            <strong>Saldo hoy</strong>
            <strong className={s.saldo < 0 ? "texto-vencido" : undefined}>{moneda(s.saldo)}</strong>
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
                  {editable && (
                    <button className="btn-link" onClick={() => alBorrarPago(p.id)}>
                      Borrar
                    </button>
                  )}
                </span>
              </div>
            ))
          ) : (
            <span className="dato-sec">Sin pagos registrados.</span>
          )}
          <div className="concepto-nomina">
            <strong>Total pagado</strong>
            <strong>{moneda(s.pagos.reduce((t, p) => t + p.monto, 0))}</strong>
          </div>
        </div>
        {editable && (
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
        )}
      </div>
      {editable && (
        <div className="detalle-tanqueo-pie">
          <button className="btn-secondary" onClick={alEditar}>
            Editar datos
          </button>
          <button className="btn-link" onClick={alActivar}>
            {s.activo ? "Desactivar" : "Activar"}
          </button>
        </div>
      )}
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
    saldoInicial: socio?.saldoInicial ?? 0,
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
        <div>
          <label>Saldo inicial (lo que se le debia; negativo si el debia)</label>
          <input type="number" step="any" value={d.saldoInicial} onChange={(e) => setD({ ...d, saldoInicial: Number(e.target.value) || 0 })} />
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
