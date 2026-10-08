/**
 * Pantalla Plantillas: lista de plantillas de viaje y actualizacion de tarifas por ruta.
 */
import { useState } from "react";
import { api, moneda, soloFecha } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../componentes/Estado";
import Modal from "../componentes/Modal";
import FormularioPlantilla from "./FormularioPlantilla";
import TablaDatos from "../componentes/TablaDatos";
import type { PlantillaViaje, RutaConTarifa } from "../api/tipos";

/**
 * Pantalla Plantillas: lista de plantillas de viaje (nombre, ruta,
 * contratante, mercancia y tarifa); crear, editar y eliminar (desactivar), y
 * actualizar tarifas por ruta.
 */
export default function Plantillas() {
  const plantillas = useDatos(() => api.getPlantillas(), []);
  const [modalNueva, setModalNueva] = useState(false);
  /** Plantilla abierta para editar, o null si no hay ninguna. */
  const [editando, setEditando] = useState<PlantillaViaje | null>(null);
  const [modalTarifas, setModalTarifas] = useState(false);

  const [borrandoId, setBorrandoId] = useState<number | null>(null);

  async function eliminar(id: number, nombre: string) {
    if (!window.confirm(`¿Eliminar la plantilla "${nombre}"? Dejara de aparecer para despachar, pero el historial de viajes que ya la uso no se toca.`)) {
      return;
    }
    setBorrandoId(id);
    try {
      await api.eliminarPlantilla(id);
      plantillas.recargar();
    } finally {
      setBorrandoId(null);
    }
  }


  return (
    <>
      <div className="panel">
        {plantillas.cargando && !plantillas.datos && <Cargando que="plantillas" />}
        {plantillas.error && (
          <ErrorCarga mensaje={plantillas.error} alReintentar={plantillas.recargar} />
        )}

        {plantillas.datos && (
          <TablaDatos
            filas={plantillas.datos}
            clave={(p) => p.id}
            nombreArchivo="plantillas"
            placeholderBusqueda="Buscar plantilla, ruta, cliente..."
            vacio="No hay plantillas con estos criterios."
            acciones={
              <>
                <button className="boton-barra" onClick={() => setModalTarifas(true)}>
                  Actualizar tarifas
                </button>
                <button className="btn-icon-round" title="Nueva plantilla" onClick={() => setModalNueva(true)}>
                  +
                </button>
              </>
            }
            columnas={[
              { id: "nombre", titulo: "Nombre", valor: (p) => p.nombre, celda: (p) => <span className="principal">{p.nombre}</span> },
              {
                id: "ruta",
                titulo: "Ruta",
                valor: (p) => (p.municipioOrigen && p.municipioDestino ? `${p.municipioOrigen} → ${p.municipioDestino}` : "Sin ruta"),
                celda: (p) => (p.municipioOrigen && p.municipioDestino ? `${p.municipioOrigen} → ${p.municipioDestino}` : "Sin ruta"),
              },
              {
                id: "contratante",
                titulo: "Contratante",
                filtrable: true,
                valor: (p) => p.contratante?.nombre ?? "-",
                celda: (p) => p.contratante?.nombre ?? "-",
              },
              {
                id: "mercancia",
                titulo: "Mercancia",
                filtrable: true,
                valor: (p) => p.tipoMercancia ?? "",
                celda: (p) => p.tipoMercancia ?? "-",
              },
              { id: "tarifa", titulo: "Tarifa", alinear: "derecha", valor: (p) => p.valorFleteBase ?? 0, celda: (p) => moneda(p.valorFleteBase) },
              {
                id: "acciones",
                titulo: "",
                etiquetaMovil: null,
                celda: (p) => (
                  <>
                    <button className="btn-link" onClick={() => setEditando(p)}>
                      Editar
                    </button>{" "}
                    <button className="btn-link" onClick={() => eliminar(p.id, p.nombre)} disabled={borrandoId === p.id}>
                      {borrandoId === p.id ? "Eliminando..." : "Eliminar"}
                    </button>
                  </>
                ),
              },
            ]}
          />
        )}
      </div>

      {modalNueva && (
        <FormularioPlantilla
          alCerrar={() => setModalNueva(false)}
          alGuardar={() => {
            setModalNueva(false);
            plantillas.recargar();
          }}
        />
      )}

      {/*
        key={editando.id} hace que React cree un formulario NUEVO al cambiar de
        plantilla, en vez de reutilizar el anterior con su estado viejo: el
        estado inicial de useState solo se toma al crear el componente.
      */}
      {editando && (
        <FormularioPlantilla
          key={editando.id}
          plantilla={editando}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null);
            plantillas.recargar();
          }}
        />
      )}

      {modalTarifas && (
        <ModalTarifas
          alCerrar={() => setModalTarifas(false)}
          alActualizar={() => plantillas.recargar()}
        />
      )}
    </>
  );
}

/**
 * Actualizacion masiva de tarifas por ruta.
 *
 * Va en dos tiempos a proposito: primero se elige la ruta, luego se MUESTRA que
 * plantillas se van a tocar, y solo despues aparece el campo del nuevo valor.
 * Saltarse la previsualizacion es como se le cambia sin querer la tarifa a un
 * cliente con precio negociado.
 */
function ModalTarifas({
  alCerrar,
  alActualizar,
}: {
  alCerrar: () => void;
  alActualizar: () => void;
}) {
  const rutas = useDatos(() => api.getRutasConTarifas(), []);
  const [ruta, setRuta] = useState<RutaConTarifa | null>(null);
  const [afectadas, setAfectadas] = useState<
    Array<{ id: number; nombre: string; valorFleteBase: number | null }>
  >([]);
  const [nuevoFlete, setNuevoFlete] = useState<number | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function seleccionar(r: RutaConTarifa) {
    setRuta(r);
    setResultado(null);
    setNuevoFlete(r.fleteMaximo ?? null);
    setAfectadas(await api.previsualizarTarifa(r.codMunicipioOrigen, r.codMunicipioDestino));
  }

  /** true si las plantillas de la ruta hoy tienen tarifas distintas entre si. */
  const hayDispersion =
    !!ruta &&
    ruta.fleteMinimo !== null &&
    ruta.fleteMaximo !== null &&
    ruta.fleteMinimo !== ruta.fleteMaximo;

  async function aplicar() {
    if (!ruta || !nuevoFlete || nuevoFlete <= 0) return;
    setAplicando(true);
    try {
      const r = await api.actualizarTarifaRuta(
        ruta.codMunicipioOrigen,
        ruta.codMunicipioDestino,
        nuevoFlete
      );
      setResultado(`Se actualizaron ${r.actualizadas} plantilla(s) a ${moneda(r.valorFleteBase)}.`);
      rutas.recargar();
      alActualizar();
      await seleccionar(ruta);
    } catch (exc) {
      setResultado(exc instanceof Error ? exc.message : "No se pudo actualizar la tarifa.");
    } finally {
      setAplicando(false);
    }
  }

  return (
    <Modal titulo="Actualizar tarifas por ruta" ancho="wide" alCerrar={alCerrar}>
      <div className="form-section">
        <div>
          <div className="section-title">Rutas con plantillas activas</div>
          <div className="section-desc">
            Agrupa las plantillas por su ruta (municipio origen y destino), la misma con la que
            se consulta SICETAC. Elige una para ver cuales se veran afectadas antes de cambiar
            nada.
          </div>
        </div>
        <div>
          {resultado && <div className="alert success">{resultado}</div>}
          {rutas.cargando && <Cargando que="rutas" />}
          {rutas.error && <ErrorCarga mensaje={rutas.error} alReintentar={rutas.recargar} />}

          {!rutas.cargando && (
            <div className="tabla-scroll">
              <table className="modern">
                <thead>
                  <tr>
                    <th>Ruta</th>
                    <th>Plantillas</th>
                    <th>Tarifa actual</th>
                    <th>Actualizada</th>
                  </tr>
                </thead>
                <tbody>
                  {(rutas.datos ?? []).map((r) => (
                    <tr
                      key={`${r.codMunicipioOrigen}-${r.codMunicipioDestino}`}
                      onClick={() => seleccionar(r)}
                      style={{
                        cursor: "pointer",
                        background:
                          ruta?.codMunicipioOrigen === r.codMunicipioOrigen &&
                          ruta?.codMunicipioDestino === r.codMunicipioDestino
                            ? "rgba(0,0,0,0.04)"
                            : undefined,
                      }}
                    >
                      <td>
                        {r.municipioOrigen} → {r.municipioDestino}
                      </td>
                      <td>
                        {r.plantillas}
                        {r.sinTarifa > 0 && ` (${r.sinTarifa} sin tarifa)`}
                      </td>
                      <td>
                        {r.fleteMinimo === null
                          ? "-"
                          : r.fleteMinimo === r.fleteMaximo
                            ? moneda(r.fleteMinimo)
                            : `${moneda(r.fleteMinimo)} a ${moneda(r.fleteMaximo)}`}
                      </td>
                      <td>{soloFecha(r.ultimaActualizacion)}</td>
                    </tr>
                  ))}
                  {(rutas.datos ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty-row">
                        No hay rutas. Revisa que las plantillas tengan su ruta (Editar → Partes).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {ruta && (
            <div style={{ marginTop: "1rem" }}>
              <div className="section-title">
                {ruta.municipioOrigen} → {ruta.municipioDestino}
              </div>

              {hayDispersion && (
                <div className="alert warning">
                  Las plantillas de esta ruta hoy tienen tarifas distintas entre si. Al aplicar el
                  nuevo valor todas quedaran iguales.
                </div>
              )}

              <div className="tabla-scroll">
                <table className="modern">
                  <thead>
                    <tr>
                      <th>Plantilla</th>
                      <th>Tarifa actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {afectadas.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nombre}</td>
                        <td>{p.valorFleteBase ? moneda(p.valorFleteBase) : "sin tarifa"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label style={{ marginTop: "0.8rem" }}>Nueva tarifa para esta ruta</label>
              <input
                type="number"
                value={nuevoFlete ?? ""}
                onChange={(e) => setNuevoFlete(e.target.value === "" ? null : Number(e.target.value))}
              />

              <button
                className="btn-primary"
                style={{ marginTop: "0.6rem" }}
                onClick={aplicar}
                disabled={aplicando || !nuevoFlete || nuevoFlete <= 0}
              >
                {aplicando
                  ? "Aplicando..."
                  : `Aplicar a las ${afectadas.length} plantilla(s)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
