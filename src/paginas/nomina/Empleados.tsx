/**
 * Empleados de las dos empresas: conductores (con su vehiculo por fechas,
 * riesgo ARL IV y su % del producido) y personal de oficina (con a quien se
 * reparte su costo: vehiculos y/o socios, como un gasto).
 */
import { useState } from "react";
import { apiNomina, hoyColombia, moneda } from "../../api/cliente";
import type { DatosEmpleado, Empleado, EmpresaGasto, OpcionesGastos } from "../../api/cliente";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import SelectorDestinos from "../gastos/SelectorDestinos";
import { aDestinos, aSeleccion, SELECCION_VACIA, vistaPrevia } from "../gastos/destinos";
import type { SeleccionDestinos } from "../gastos/destinos";

const EMPRESA: Record<EmpresaGasto, string> = { LOPEZ: "T. Lopez", MYC: "T. M&C" };
const RIESGO = ["", "I", "II", "III", "IV", "V"];

/** Salario del empleado en texto ("Minimo + 200.000"). */
const salarioTexto = (e: Pick<Empleado, "salarioBase" | "salarioAdicional">) =>
  `${e.salarioBase === null ? "Minimo" : moneda(e.salarioBase)}${e.salarioAdicional ? ` + ${moneda(e.salarioAdicional)}` : ""}`;

/** Lista de empleados con su formulario. */
export default function Empleados({
  empleados,
  opciones,
  soloMyc,
  alCambiar,
}: {
  empleados: Empleado[];
  opciones: OpcionesGastos;
  soloMyc: boolean;
  alCambiar: () => void;
}) {
  const [formulario, setFormulario] = useState<{ empleado: Empleado | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hoy = hoyColombia();

  /** Ejecuta una accion y recarga. */
  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  const columnas: Columna<Empleado>[] = [
    {
      id: "nombre",
      titulo: "Empleado",
      valor: (e) => e.nombre,
      celda: (e) => (
        <>
          <span className="principal">{e.nombre}</span>
          <span className="dato-sec">{[e.cedula, e.cargo].filter(Boolean).join(" · ") || "-"}</span>
        </>
      ),
    },
    {
      id: "empresa",
      titulo: "Empresa",
      filtrable: true,
      valor: (e) => EMPRESA[e.empresa],
      celda: (e) => <Pastilla tono={e.empresa === "MYC" ? "morado" : "azul"}>{EMPRESA[e.empresa]}</Pastilla>,
    },
    {
      id: "tipo",
      titulo: "Tipo",
      filtrable: true,
      valor: (e) => (e.tipo === "CONDUCTOR" ? "Conductor" : "Oficina"),
      celda: (e) => (e.tipo === "CONDUCTOR" ? "Conductor" : "Oficina"),
    },
    {
      id: "vehiculo",
      titulo: "Vehiculo / reparto",
      valor: (e) => (e.tipo === "CONDUCTOR" ? (e.placa ?? "") : `${e.destinos.length} destinos`),
      celda: (e) =>
        e.tipo === "CONDUCTOR" ? (
          e.placa ? (
            <strong>{placaConGuion(e.placa)}</strong>
          ) : (
            <span className="texto-vencido">Sin vehiculo</span>
          )
        ) : e.destinos.length ? (
          `${e.destinos.filter((d) => d.tipo === "VEHICULO").length} vehiculos${e.destinos.some((d) => d.tipo === "SOCIO") ? " + socios" : ""}`
        ) : (
          <span className="texto-vencido">Sin reparto</span>
        ),
    },
    { id: "salario", titulo: "Salario", valor: salarioTexto, celda: salarioTexto },
    {
      id: "variable",
      titulo: "% producido",
      valor: (e) => e.pctSalarial + e.pctViaticos,
      celda: (e) => (e.pctSalarial || e.pctViaticos ? `${e.pctSalarial} % + ${e.pctViaticos} % viaticos` : "-"),
    },
    { id: "arl", titulo: "ARL", valor: (e) => e.riesgoArl, celda: (e) => `Riesgo ${RIESGO[e.riesgoArl]}` },
    { id: "ingreso", titulo: "Ingreso", valor: (e) => e.fechaIngreso, celda: (e) => fechaCorta(e.fechaIngreso) },
    { id: "retiro", titulo: "Retiro", valor: (e) => e.fechaRetiro ?? "", celda: (e) => (e.fechaRetiro ? fechaCorta(e.fechaRetiro) : "-") },
  ];
  const activo = (e: Empleado) => !e.fechaRetiro || e.fechaRetiro >= hoy;
  const pestanas: PestanaTabla<Empleado>[] = [
    { id: "activos", etiqueta: "Activos", incluye: activo },
    { id: "conductores", etiqueta: "Conductores", incluye: (e) => activo(e) && e.tipo === "CONDUCTOR" },
    { id: "oficina", etiqueta: "Oficina", incluye: (e) => activo(e) && e.tipo === "OFICINA" },
    { id: "retirados", etiqueta: "Retirados", incluye: (e) => !activo(e) },
  ];

  return (
    <>
      {error && <div className="alert danger">{error}</div>}
      <div className="panel">
        <TablaDatos
          filas={empleados}
          columnas={columnas}
          clave={(e) => e.id}
          pestanas={pestanas}
          nombreArchivo={`empleados-${hoy}`}
          placeholderBusqueda="Buscar nombre, cedula, placa..."
          vacio="Aun no hay empleados. Crea el primero con Nuevo empleado."
          acciones={
            <button className="btn-primary boton-con-texto" onClick={() => setFormulario({ empleado: null })}>
              Nuevo empleado
            </button>
          }
          detalle={(e) => (
            <DetalleEmpleado
              e={e}
              soloLectura={soloMyc && e.empresa !== "MYC"}
              opciones={opciones}
              alEditar={() => setFormulario({ empleado: e })}
              alBorrar={() => window.confirm(`¿Borrar a ${e.nombre}?`) && accion(() => apiNomina.borrarEmpleado(e.id))}
              alAsignar={(vehiculoId, desde) => accion(() => apiNomina.asignarVehiculo(e.id, vehiculoId, desde))}
              alQuitar={(id) => accion(() => apiNomina.quitarAsignacion(e.id, id))}
            />
          )}
        />
      </div>
      {formulario && (
        <FormularioEmpleado
          empleado={formulario.empleado}
          opciones={opciones}
          soloMyc={soloMyc}
          alCerrar={() => setFormulario(null)}
          alGuardar={() => {
            setFormulario(null);
            alCambiar();
          }}
        />
      )}
    </>
  );
}

/** Historial de vehiculos (conductor) o reparto (oficina) y acciones. */
function DetalleEmpleado({
  e,
  soloLectura,
  opciones,
  alEditar,
  alBorrar,
  alAsignar,
  alQuitar,
}: {
  e: Empleado;
  /** M&C ve los empleados de Lopez pero no los cambia. */
  soloLectura: boolean;
  opciones: OpcionesGastos;
  alEditar: () => void;
  alBorrar: () => void;
  alAsignar: (vehiculoId: number, desde: string) => void;
  alQuitar: (asignacionId: number) => void;
}) {
  const [vehiculo, setVehiculo] = useState("");
  const [desde, setDesde] = useState(hoyColombia());
  return (
    <div className="detalle-tanqueo" onClick={(ev) => ev.stopPropagation()}>
      {e.tipo === "CONDUCTOR" ? (
        <>
          <div className="dato-sec">Vehiculos que ha manejado</div>
          {e.vehiculos.length ? (
            <table className="tabla tabla-compacta">
              <tbody>
                {[...e.vehiculos].reverse().map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>{placaConGuion(v.placa)}</strong>
                    </td>
                    <td>
                      Desde {fechaCorta(v.desde)} {v.hasta ? `hasta ${fechaCorta(v.hasta)}` : "(actual)"}
                    </td>
                    <td className="num">
                      <button className="btn-link" onClick={() => window.confirm("¿Quitar esta asignacion?") && alQuitar(v.id)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="dato-sec">Sin vehiculo asignado.</div>
          )}
          {!soloLectura && (
            <div className="detalle-tanqueo-pie">
              <select value={vehiculo} onChange={(ev) => setVehiculo(ev.target.value)} aria-label="Vehiculo">
                <option value="">Pasa al vehiculo...</option>
                {opciones.vehiculos
                  .filter((v) => v.activo)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {placaConGuion(v.placa)}
                    </option>
                  ))}
              </select>
              <label>
                <span className="dato-sec">desde</span> <input type="date" value={desde} onChange={(ev) => setDesde(ev.target.value)} />
              </label>
              <button className="btn-secondary" disabled={!vehiculo || !desde} onClick={() => alAsignar(Number(vehiculo), desde)}>
                Asignar
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="reparto-gasto">
          {e.destinos.map((d) => {
            const nombre =
              d.tipo === "VEHICULO"
                ? placaConGuion(opciones.vehiculos.find((v) => v.id === d.id)?.placa ?? "?")
                : `Socio ${opciones.socios.find((s) => s.id === d.id)?.nombre ?? "?"}`;
            return (
              <span key={`${d.tipo}${d.id}`} className="reparto-gasto-parte">
                <span className="dato-sec">{nombre}</span>
                <strong>{d.modo === "PARTE" ? `${d.valor} parte(s)` : d.modo === "PORCENTAJE" ? `${d.valor} %` : moneda(d.valor)}</strong>
              </span>
            );
          })}
        </div>
      )}
      {e.nota && <div className="dato-sec">{e.nota}</div>}
      {!soloLectura && (
        <div className="detalle-tanqueo-pie">
          <button className="btn-secondary" onClick={alEditar}>
            Editar
          </button>
          <button className="btn-link" onClick={alBorrar}>
            Borrar
          </button>
        </div>
      )}
    </div>
  );
}

/** Formulario de un empleado. */
function FormularioEmpleado({
  empleado,
  opciones,
  soloMyc,
  alCerrar,
  alGuardar,
}: {
  empleado: Empleado | null;
  opciones: OpcionesGastos;
  soloMyc: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [f, setF] = useState({
    empresa: (empleado?.empresa ?? (soloMyc ? "MYC" : "LOPEZ")) as EmpresaGasto,
    tipo: empleado?.tipo ?? ("CONDUCTOR" as Empleado["tipo"]),
    nombre: empleado?.nombre ?? "",
    cedula: empleado?.cedula ?? "",
    cargo: empleado?.cargo ?? "",
    riesgoArl: String(empleado?.riesgoArl ?? 4),
    minimo: empleado ? empleado.salarioBase === null : true,
    salarioBase: empleado?.salarioBase ? String(empleado.salarioBase) : "",
    salarioAdicional: empleado?.salarioAdicional ? String(empleado.salarioAdicional) : "",
    pctSalarial: String(empleado?.pctSalarial ?? 4),
    pctViaticos: String(empleado?.pctViaticos ?? 5),
    auxilio: empleado?.auxilio ?? false,
    fechaIngreso: empleado?.fechaIngreso ?? hoyColombia(),
    fechaRetiro: empleado?.fechaRetiro ?? "",
    nota: empleado?.nota ?? "",
    vehiculoId: "",
  });
  const [destinos, setDestinos] = useState<SeleccionDestinos>(empleado ? aSeleccion(empleado.destinos) : SELECCION_VACIA);
  const [error, setError] = useState<string | null>(null);
  const oficina = f.tipo === "OFICINA";
  /** Al cambiar de tipo se ponen los valores normales de ese tipo. */
  const cambiarTipo = (tipo: Empleado["tipo"]) =>
    setF({ ...f, tipo, riesgoArl: tipo === "OFICINA" ? "1" : "4", pctSalarial: tipo === "OFICINA" ? "0" : "4", pctViaticos: tipo === "OFICINA" ? "0" : "5" });

  async function guardar() {
    setError(null);
    const datos: DatosEmpleado = {
      empresa: f.empresa,
      tipo: f.tipo,
      nombre: f.nombre,
      cedula: f.cedula || null,
      cargo: f.cargo || null,
      riesgoArl: Number(f.riesgoArl),
      salarioBase: f.minimo ? null : Number(f.salarioBase),
      salarioAdicional: Number(f.salarioAdicional) || 0,
      pctSalarial: Number(f.pctSalarial) || 0,
      pctViaticos: Number(f.pctViaticos) || 0,
      auxilio: f.auxilio,
      destinos: oficina ? aDestinos(destinos) : [],
      fechaIngreso: f.fechaIngreso,
      fechaRetiro: f.fechaRetiro || null,
      nota: f.nota || null,
      vehiculoId: !empleado && !oficina && f.vehiculoId ? Number(f.vehiculoId) : null,
    };
    try {
      if (empleado) await apiNomina.actualizarEmpleado(empleado.id, datos);
      else await apiNomina.crearEmpleado(datos);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }
  const sinReparto = oficina && !!vistaPrevia(1, destinos).problema;

  return (
    <Modal
      titulo={empleado ? `Editar ${empleado.nombre}` : "Nuevo empleado"}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={guardar}
            disabled={!f.nombre.trim() || !f.fechaIngreso || sinReparto || (!f.minimo && !Number(f.salarioBase))}
          >
            Guardar
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Empresa</label>
          <select value={f.empresa} disabled={soloMyc} onChange={(e) => setF({ ...f, empresa: e.target.value as EmpresaGasto })}>
            <option value="LOPEZ">Transportes Lopez C SAS</option>
            <option value="MYC">Transportes M&C SAS</option>
          </select>
        </div>
        <div>
          <label>Tipo</label>
          <select value={f.tipo} onChange={(e) => cambiarTipo(e.target.value as Empleado["tipo"])}>
            <option value="CONDUCTOR">Conductor</option>
            <option value="OFICINA">Oficina</option>
          </select>
        </div>
        <div>
          <label>Nombre</label>
          <input value={f.nombre} maxLength={150} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </div>
        <div>
          <label>Cedula (opcional)</label>
          <input value={f.cedula} maxLength={20} onChange={(e) => setF({ ...f, cedula: e.target.value })} />
        </div>
        {oficina && (
          <div>
            <label>Cargo (opcional)</label>
            <input value={f.cargo} maxLength={80} onChange={(e) => setF({ ...f, cargo: e.target.value })} />
          </div>
        )}
        <div>
          <label>Riesgo ARL</label>
          <select value={f.riesgoArl} onChange={(e) => setF({ ...f, riesgoArl: e.target.value })}>
            {[1, 2, 3, 4, 5].map((r) => (
              <option key={r} value={r}>
                Riesgo {RIESGO[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Salario</label>
          <select value={f.minimo ? "MINIMO" : "FIJO"} onChange={(e) => setF({ ...f, minimo: e.target.value === "MINIMO" })}>
            <option value="MINIMO">El minimo de cada ano</option>
            <option value="FIJO">Un salario fijo</option>
          </select>
        </div>
        {!f.minimo && (
          <div>
            <label>Salario mensual</label>
            <input type="number" min={0} value={f.salarioBase} onChange={(e) => setF({ ...f, salarioBase: e.target.value })} />
          </div>
        )}
        <div>
          <label>Adicional al salario (opcional)</label>
          <input type="number" min={0} value={f.salarioAdicional} onChange={(e) => setF({ ...f, salarioAdicional: e.target.value })} placeholder="200000" />
        </div>
        <div>
          <label>% salarial del producido</label>
          <input type="number" min={0} step="any" value={f.pctSalarial} onChange={(e) => setF({ ...f, pctSalarial: e.target.value })} />
        </div>
        <div>
          <label>% viaticos del producido (no salarial)</label>
          <input type="number" min={0} step="any" value={f.pctViaticos} onChange={(e) => setF({ ...f, pctViaticos: e.target.value })} />
        </div>
        <div>
          <label>Auxilio de transporte</label>
          <select value={f.auxilio ? "SI" : "NO"} onChange={(e) => setF({ ...f, auxilio: e.target.value === "SI" })}>
            <option value="NO">No</option>
            <option value="SI">Si (si gana hasta 2 minimos)</option>
          </select>
        </div>
        <div>
          <label>Fecha de ingreso</label>
          <input type="date" value={f.fechaIngreso} onChange={(e) => setF({ ...f, fechaIngreso: e.target.value })} />
        </div>
        <div>
          <label>Fecha de retiro (vacia = activo)</label>
          <input type="date" value={f.fechaRetiro} onChange={(e) => setF({ ...f, fechaRetiro: e.target.value })} />
        </div>
        {!empleado && !oficina && (
          <div>
            <label>Vehiculo (desde el ingreso)</label>
            <select value={f.vehiculoId} onChange={(e) => setF({ ...f, vehiculoId: e.target.value })}>
              <option value="">Sin vehiculo por ahora</option>
              {opciones.vehiculos
                .filter((v) => v.activo)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {placaConGuion(v.placa)}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Nota (opcional)</label>
          <input value={f.nota} maxLength={300} onChange={(e) => setF({ ...f, nota: e.target.value })} />
        </div>
      </div>
      {oficina && (
        <>
          <h4 style={{ margin: "1rem 0 0.4rem" }}>A quien se le descuenta su costo</h4>
          <SelectorDestinos opciones={opciones} monto={1_000_000} valor={destinos} alCambiar={setDestinos} />
          <div className="dato-sec">La vista previa usa 1.000.000 de ejemplo; el valor real es el costo total de su nomina.</div>
        </>
      )}
      {empleado && !oficina && (
        <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
          El vehiculo se cambia en el detalle del empleado (con fecha).
        </div>
      )}
    </Modal>
  );
}
