/**
 * Vista Recurrentes del libro de gastos: los gastos que se repiten cada mes o
 * quincena (arriendo, honorarios, servicios). El sistema crea el gasto de
 * cada periodo por pagar con el valor vigente. Cuando el valor cambia se
 * registra desde una fecha: los periodos anteriores conservan el suyo y el
 * historial queda a la vista.
 */
import { useState } from "react";
import { apiGastos, hoyColombia, moneda } from "../../api/cliente";
import type { GastoRecurrente, OpcionesGastos } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import FormularioGasto from "./FormularioGasto";
import { NOMBRE_CATEGORIA, NOMBRE_EMPRESA, NOMBRE_PERIODICIDAD, NOMBRE_TIPO_FACTURA } from "./nombres";

/** Lista de recurrentes con su historial de valores. */
export default function Recurrentes({ opciones, soloMyc, alCambiar }: { opciones: OpcionesGastos; soloMyc: boolean; alCambiar: () => void }) {
  const carga = useDatos(() => apiGastos.recurrentes(), []);
  const [editar, setEditar] = useState<GastoRecurrente | null>(null);
  const [nuevoValor, setNuevoValor] = useState<GastoRecurrente | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (carga.cargando && !carga.datos) return <Cargando que="los gastos recurrentes" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;

  const recargar = () => {
    carga.recargar();
    alCambiar();
  };
  const puedeCambiar = (r: GastoRecurrente) => !soloMyc || r.empresa === "MYC";

  async function terminar(r: GastoRecurrente) {
    if (!window.confirm(`¿Terminar "${r.descripcion}"? No se crean mas pagos desde mañana; los ya creados quedan.`)) return;
    setError(null);
    try {
      await apiGastos.estadoRecurrente(r.id, false, hoyColombia());
      recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  const columnas: Columna<GastoRecurrente>[] = [
    {
      id: "descripcion",
      titulo: "Descripcion",
      valor: (r) => r.descripcion,
      celda: (r) => (
        <>
          <span className="principal">{r.descripcion}</span>
          {r.proveedor && <span className="dato-sec">{r.proveedor}</span>}
        </>
      ),
    },
    {
      id: "empresa",
      titulo: "Empresa",
      filtrable: true,
      valor: (r) => NOMBRE_EMPRESA[r.empresa],
      celda: (r) => <Pastilla tono={r.empresa === "MYC" ? "morado" : "azul"}>{NOMBRE_EMPRESA[r.empresa]}</Pastilla>,
    },
    {
      id: "categoria",
      titulo: "Categoria",
      filtrable: true,
      valor: (r) => NOMBRE_CATEGORIA[r.categoria] ?? r.categoria,
      celda: (r) => NOMBRE_CATEGORIA[r.categoria] ?? r.categoria,
    },
    {
      id: "valor",
      titulo: "Valor actual",
      alinear: "derecha",
      valor: (r) => r.valorActual ?? 0,
      celda: (r) => <strong>{r.valorActual === null ? "-" : moneda(r.valorActual)}</strong>,
    },
    { id: "cada", titulo: "Se repite", valor: (r) => NOMBRE_PERIODICIDAD[r.periodicidad], celda: (r) => NOMBRE_PERIODICIDAD[r.periodicidad] },
    {
      id: "vigencia",
      titulo: "Vigencia",
      valor: (r) => r.desde,
      celda: (r) => `${fechaCorta(r.desde)} - ${r.hasta ? fechaCorta(r.hasta) : "sin fin"}`,
    },
    {
      id: "factura",
      titulo: "Factura",
      valor: (r) => (r.tipoFactura ? NOMBRE_TIPO_FACTURA[r.tipoFactura] : "Sin factura"),
      celda: (r) => (r.tipoFactura ? NOMBRE_TIPO_FACTURA[r.tipoFactura] : "-"),
    },
    {
      id: "pagos",
      titulo: "Pagos creados",
      alinear: "derecha",
      valor: (r) => r.generados,
      celda: (r) => (
        <>
          {r.generados}
          {r.porPagar > 0 && <span className="texto-vencido"> ({r.porPagar} por pagar)</span>}
        </>
      ),
    },
  ];
  const pestanas: PestanaTabla<GastoRecurrente>[] = [
    { id: "activos", etiqueta: "Activos", incluye: (r) => r.activo },
    { id: "terminados", etiqueta: "Terminados", incluye: (r) => !r.activo },
  ];

  return (
    <div className="panel">
      {error && <div className="alert danger">{error}</div>}
      <p className="dato-sec" style={{ margin: 0, padding: "0.75rem 1rem 0" }}>
        Cada mes o quincena el sistema crea el gasto por pagar con el valor vigente (se ven en el libro, en "Por pagar"). Para crear uno nuevo: Nuevo gasto →
        Recurrente.
      </p>
      <TablaDatos
        filas={carga.datos}
        columnas={columnas}
        clave={(r) => r.id}
        pestanas={pestanas}
        nombreArchivo={`gastos-recurrentes-${hoyColombia()}`}
        placeholderBusqueda="Buscar descripcion, proveedor..."
        vacio="No hay gastos recurrentes."
        detalle={(r) => (
          <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
            <div className="dato-sec">
              Historial del valor:{" "}
              {r.valores.map((v, i) => (
                <span key={v.desde}>
                  {i > 0 && " → "}
                  desde {fechaCorta(v.desde)} <strong>{moneda(v.monto)}</strong>
                </span>
              ))}
            </div>
            {puedeCambiar(r) && (
              <div className="detalle-tanqueo-pie">
                {r.activo && (
                  <button className="btn-secondary" onClick={() => setNuevoValor(r)}>
                    Cambiar valor desde una fecha
                  </button>
                )}
                <button className="btn-link" onClick={() => setEditar(r)}>
                  Editar datos
                </button>
                {r.activo ? (
                  <button className="btn-link" onClick={() => terminar(r)}>
                    Terminar
                  </button>
                ) : (
                  <button
                    className="btn-link"
                    onClick={() =>
                      apiGastos.estadoRecurrente(r.id, true, null).then(recargar, (exc) => setError(exc instanceof Error ? exc.message : "No se pudo guardar."))
                    }
                  >
                    Reactivar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      />
      {editar && (
        <FormularioGasto
          opciones={opciones}
          gasto={null}
          base={null}
          recurrente={editar}
          soloMyc={soloMyc}
          alCerrar={() => setEditar(null)}
          alGuardar={() => {
            setEditar(null);
            recargar();
          }}
        />
      )}
      {nuevoValor && (
        <VentanaNuevoValor
          r={nuevoValor}
          alCerrar={() => setNuevoValor(null)}
          alGuardar={() => {
            setNuevoValor(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}

/** El valor de un recurrente cambia desde una fecha (el historial queda). */
function VentanaNuevoValor({ r, alCerrar, alGuardar }: { r: GastoRecurrente; alCerrar: () => void; alGuardar: () => void }) {
  const [desde, setDesde] = useState(hoyColombia());
  const [monto, setMonto] = useState(r.valorActual ? String(r.valorActual) : "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await apiGastos.cambiarValorRecurrente(r.id, desde, Number(monto));
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={`Nuevo valor: ${r.descripcion}`}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={guardando || !desde || !(Number(monto) > 0)}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Nuevo valor</label>
          <input type="number" min={0} step="any" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div>
          <label>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
      </div>
      <p className="dato-sec" style={{ marginTop: "0.5rem" }}>
        Los pagos antes de esa fecha conservan su valor. Los ya creados desde esa fecha que aun no se han pagado toman el nuevo valor.
      </p>
    </Modal>
  );
}
