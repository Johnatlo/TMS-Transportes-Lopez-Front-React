/**
 * Prestamos a los empleados: el monto, la cuota sugerida y lo descontado mes
 * a mes, con su saldo. Cada mes se decide si se descuenta y cuanto (aqui, en
 * la liquidacion del conductor o en la nomina: es el mismo dato).
 */
import { useState } from "react";
import { apiConductores, apiNomina, hoyColombia, moneda } from "../../api/cliente";
import type { PrestamoEmpleado } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import MiniTabla from "../../componentes/MiniTabla";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { nombreMes } from "../gastos/nombres";
import type { FiltroEmpresa } from "./LiquidacionConductores";

/** Lista de prestamos. */
export default function Prestamos({ mes, empresa }: { mes: string; empresa: FiltroEmpresa }) {
  const carga = useDatos(() => Promise.all([apiConductores.prestamos(), apiNomina.empleados()]), []);
  const [editando, setEditando] = useState<PrestamoEmpleado | "nuevo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (carga.cargando && !carga.datos) return <Cargando que="los prestamos" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;
  const [todos, todosEmpleados] = carga.datos;
  const prestamos = todos.filter((p) => empresa === "TODAS" || p.empresa === empresa);
  const empleados = todosEmpleados.filter((e) => empresa === "TODAS" || e.empresa === empresa);

  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      carga.recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  const columnas: Columna<PrestamoEmpleado>[] = [
    { id: "empleado", titulo: "Empleado", filtrable: true, valor: (p) => p.empleado, celda: (p) => <span className="principal">{p.empleado}</span> },
    { id: "fecha", titulo: "Fecha", valor: (p) => p.fecha, celda: (p) => fechaCorta(p.fecha) },
    { id: "monto", titulo: "Prestado", alinear: "derecha", valor: (p) => p.monto, celda: (p) => moneda(p.monto) },
    { id: "cuota", titulo: "Cuota sugerida", alinear: "derecha", valor: (p) => p.cuota ?? 0, celda: (p) => (p.cuota ? moneda(p.cuota) : "-") },
    {
      id: "descontado",
      titulo: "Descontado",
      alinear: "derecha",
      valor: (p) => p.monto - p.saldo,
      celda: (p) => (
        <>
          {moneda(p.monto - p.saldo)}
          <span className="dato-sec">{p.descuentos.length} mes(es)</span>
        </>
      ),
    },
    { id: "saldo", titulo: "Saldo", alinear: "derecha", valor: (p) => p.saldo, celda: (p) => <strong>{moneda(p.saldo)}</strong> },
    {
      id: "mes",
      titulo: `Descuento de ${nombreMes(mes)}`,
      alinear: "derecha",
      valor: (p) => p.descuentos.find((d) => d.mes === mes)?.valor ?? 0,
      celda: (p) => {
        const d = p.descuentos.find((x) => x.mes === mes);
        return (
          <input
            key={`${p.id}-${d?.valor ?? ""}`}
            type="number"
            min={0}
            style={{ width: "8rem", textAlign: "right" }}
            defaultValue={d?.valor ?? ""}
            placeholder={p.saldo > 0 ? (p.cuota ? `Cuota ${p.cuota}` : "No se descuenta") : "Pagado"}
            aria-label="Descontar este mes"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onBlur={(e) => {
              const v = e.target.value.trim() === "" ? null : Number(e.target.value);
              if (v !== (d?.valor ?? null)) void accion(() => apiConductores.descontar(p.id, mes, v));
            }}
          />
        );
      },
    },
    {
      id: "estado",
      titulo: "Estado",
      filtrable: true,
      valor: (p) => (p.saldo > 0 ? "Debe" : "Pagado"),
      celda: (p) => <Pastilla tono={p.saldo > 0 ? "aviso" : "ok"}>{p.saldo > 0 ? "Debe" : "Pagado"}</Pastilla>,
    },
  ];
  const pestanas: PestanaTabla<PrestamoEmpleado>[] = [
    { id: "debe", etiqueta: "Con saldo", incluye: (p) => p.saldo > 0 },
    { id: "todos", etiqueta: "Todos", incluye: () => true },
  ];

  return (
    <>
      {error && <div className="alert danger">{error}</div>}
      <div className="panel">
        <TablaDatos
          filas={prestamos}
          columnas={columnas}
          clave={(p) => p.id}
          pestanas={pestanas}
          nombreArchivo={`prestamos-${hoyColombia()}`}
          placeholderBusqueda="Buscar empleado..."
          vacio="No hay prestamos."
          acciones={
            <button className="btn-primary boton-con-texto" onClick={() => setEditando("nuevo")}>
              Nuevo prestamo
            </button>
          }
          detalle={(p) => (
            <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
              {p.nota && <div className="dato-sec">{p.nota}</div>}
              <div style={{ maxWidth: 360, marginTop: "0.3rem" }}>
                <MiniTabla
                  filas={p.descuentos}
                  clave={(d) => d.mes}
                  nombre="descuentos"
                  visibles={6}
                  columnas={[
                    { titulo: "Mes", celda: (d) => nombreMes(d.mes) },
                    { titulo: "Descontado", num: true, celda: (d) => moneda(d.valor) },
                  ]}
                  total={["Total", moneda(p.monto - p.saldo)]}
                />
              </div>
              <div className="detalle-tanqueo-pie">
                <button className="btn-secondary" onClick={() => setEditando(p)}>
                  Editar
                </button>
                <button
                  className="btn-link texto-vencido"
                  onClick={() =>
                    window.confirm(`¿Borrar el prestamo de ${p.empleado} por ${moneda(p.monto)} y lo descontado?`) &&
                    accion(() => apiConductores.borrarPrestamo(p.id))
                  }
                >
                  Borrar
                </button>
              </div>
            </div>
          )}
        />
      </div>
      {editando && (
        <FormularioPrestamo
          prestamo={editando === "nuevo" ? null : editando}
          empleados={empleados.filter((e) => !e.fechaRetiro).map((e) => ({ id: e.id, nombre: e.nombre }))}
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

/** Registrar o cambiar un prestamo. */
function FormularioPrestamo({
  prestamo,
  empleados,
  alCerrar,
  alGuardar,
}: {
  prestamo: PrestamoEmpleado | null;
  empleados: Array<{ id: number; nombre: string }>;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [f, setF] = useState({
    empleadoId: prestamo ? String(prestamo.empleadoId) : "",
    fecha: prestamo?.fecha ?? hoyColombia(),
    monto: prestamo ? String(prestamo.monto) : "",
    cuota: prestamo?.cuota ? String(prestamo.cuota) : "",
    nota: prestamo?.nota ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    const d = {
      empleadoId: Number(f.empleadoId),
      fecha: f.fecha,
      monto: Number(f.monto),
      cuota: f.cuota ? Number(f.cuota) : null,
      nota: f.nota.trim() || null,
    };
    try {
      if (prestamo) await apiConductores.actualizarPrestamo(prestamo.id, d);
      else await apiConductores.crearPrestamo(d);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={prestamo ? "Editar prestamo" : "Nuevo prestamo"}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={guardando || !f.empleadoId || !(Number(f.monto) > 0)}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Empleado</label>
          <select value={f.empleadoId} onChange={(e) => setF({ ...f, empleadoId: e.target.value })}>
            <option value="">Elige...</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Fecha</label>
          <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
        </div>
        <div>
          <label>Valor prestado</label>
          <input type="number" min={0} value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
        </div>
        <div>
          <label>Cuota sugerida (opcional)</label>
          <input type="number" min={0} value={f.cuota} onChange={(e) => setF({ ...f, cuota: e.target.value })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Nota (opcional)</label>
          <input value={f.nota} maxLength={300} onChange={(e) => setF({ ...f, nota: e.target.value })} />
        </div>
      </div>
      <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
        La cuota es solo una sugerencia: cada mes se decide si se descuenta y cuanto (en Prestamos, en la liquidacion del conductor o en la nomina).
      </div>
    </Modal>
  );
}
