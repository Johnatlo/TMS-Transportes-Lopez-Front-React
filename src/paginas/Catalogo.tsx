import { useState } from "react";
import type { ReactElement } from "react";
import { api, hoyColombia, soloDia } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../componentes/Estado";
import Modal from "../componentes/Modal";
import FormularioGenerico, {
  type Modelo,
  type SeccionFormulario,
} from "../componentes/FormularioGenerico";
import ComboBuscable from "../componentes/ComboBuscable";
import type { EmpresaMonitoreo, ParametrosEmpresa, Vehiculo } from "../api/tipos";

type Pestana =
  | "vehiculos"
  | "remolques"
  | "conductores"
  | "terceros"
  | "monitoreo"
  | "empresa";

const PESTANAS: Array<{ id: Pestana; etiqueta: string }> = [
  { id: "vehiculos", etiqueta: "Vehiculos" },
  { id: "remolques", etiqueta: "Remolques" },
  { id: "conductores", etiqueta: "Conductores" },
  { id: "terceros", etiqueta: "Clientes" },
  { id: "monitoreo", etiqueta: "Monitoreo" },
  { id: "empresa", etiqueta: "Empresa" },
];

/** Pestanas cuyos registros se pueden desactivar (y por eso tienen filtro). */
const CON_ESTADO: Pestana[] = ["vehiculos", "remolques", "conductores"];

/**
 * El formulario se abre en uno de dos modos. Guardar el registro original (y
 * no solo su id) permite comparar al guardar y mandar solo lo que cambio.
 */
type Edicion = { modo: "crear" } | { modo: "editar"; id: number; original: Modelo };

export default function Catalogo() {
  const [pestana, setPestana] = useState<Pestana>("vehiculos");
  const [busqueda, setBusqueda] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [soloTitularEmpresa, setSoloTitularEmpresa] = useState(false);

  const vehiculos = useDatos(() => api.getVehiculos(), []);
  const remolques = useDatos(() => api.getRemolques(), []);
  const conductores = useDatos(() => api.getConductores(), []);
  const terceros = useDatos(() => api.getTerceros(), []);
  const monitoreo = useDatos(() => api.getEmpresasMonitoreo(), []);
  // Solo para el NIT de la empresa: con el se marcan los vehiculos cuyo
  // titular es la propia empresa.
  const parametros = useDatos(() => api.getParametros(), []);
  const nitEmpresa = parametros.datos?.nitEmpresa ?? null;

  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [modelo, setModelo] = useState<Modelo>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  /** Aviso del backend sobre la coordenada de la sede recien guardada. */
  const [avisoCoordenada, setAvisoCoordenada] = useState<string | null>(null);

  function cambiarPestana(p: Pestana) {
    setPestana(p);
    setBusqueda("");
    setSoloTitularEmpresa(false);
  }

  function abrirNuevo() {
    setEdicion({ modo: "crear" });
    setModelo({});
    setErrorGuardar(null);
  }

  /**
   * Abre el formulario con los datos del registro. Se trabaja sobre una COPIA
   * (aModelo crea un objeto nuevo): si se editara el objeto de la lista, la
   * tabla cambiaria mientras se escribe, aun si luego se cancela.
   */
  function abrirEdicion(registro: object & { id: number }) {
    const copia = aModelo(registro);
    setEdicion({ modo: "editar", id: registro.id, original: copia });
    setModelo(copia);
    setErrorGuardar(null);
  }

  const cambiosPendientes =
    edicion?.modo === "editar" ? soloCambios(edicion.original, modelo) : modelo;
  const hayCambios = Object.keys(cambiosPendientes).length > 0;

  async function guardar() {
    if (!edicion) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      if (edicion.modo === "editar") {
        await actualizar(pestana, edicion.id, cambiosPendientes);
      } else {
        await crear(pestana, modelo);
      }
      setEdicion(null);
    } catch (exc) {
      setErrorGuardar(exc instanceof Error ? exc.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function crear(p: Pestana, datos: Modelo) {
    if (p === "vehiculos") {
      await api.crearVehiculo(datos);
      vehiculos.recargar();
    } else if (p === "remolques") {
      await api.crearRemolque(datos);
      remolques.recargar();
    } else if (p === "conductores") {
      await api.crearConductor(datos);
      conductores.recargar();
    } else if (p === "monitoreo") {
      await api.crearEmpresaMonitoreo({ nit: datos.nit ?? "", nombre: datos.nombre ?? "" });
      monitoreo.recargar();
    } else if (p === "terceros") {
      // El backend revisa la coordenada y devuelve un aviso si algo no cuadra.
      // No rechaza el tercero: puede que la sede aun no la tenga en el portal.
      const creado = await api.crearTercero(datos);
      setAvisoCoordenada(creado.avisoCoordenada ?? null);
      terceros.recargar();
    }
  }

  async function actualizar(p: Pestana, id: number, cambios: Modelo) {
    if (p === "vehiculos") {
      await api.actualizarVehiculo(id, cambios);
      vehiculos.recargar();
    } else if (p === "remolques") {
      await api.actualizarRemolque(id, cambios);
      remolques.recargar();
    } else if (p === "conductores") {
      await api.actualizarConductor(id, cambios);
      conductores.recargar();
    } else if (p === "monitoreo") {
      await api.actualizarEmpresaMonitoreo(id, cambios);
      monitoreo.recargar();
      // El nombre de la EMF se muestra en la tabla de vehiculos.
      vehiculos.recargar();
    } else if (p === "terceros") {
      const guardado = await api.actualizarTercero(id, cambios);
      setAvisoCoordenada(guardado.avisoCoordenada ?? null);
      terceros.recargar();
    }
  }

  const texto = busqueda.trim().toLowerCase();
  const visibleSegunEstado = (activo: boolean) => verInactivos || activo;
  const empresasGps = monitoreo.datos ?? [];

  // --- Listas ya filtradas. Se calculan en cada render a partir de los datos
  // y de los filtros: no hace falta guardarlas en otro estado.
  const listaVehiculos = (vehiculos.datos ?? [])
    .filter((v) => visibleSegunEstado(v.activo))
    .filter((v) => !soloTitularEmpresa || titularEsEmpresa(v, nitEmpresa))
    .filter((v) =>
      coincide(texto, v.placa, v.marca, v.numIdTenedor, v.nombreTenedor, v.placaRemolque)
    );
  const listaRemolques = (remolques.datos ?? [])
    .filter((r) => visibleSegunEstado(r.activo))
    .filter((r) => coincide(texto, r.placa));
  const listaConductores = (conductores.datos ?? [])
    .filter((c) => visibleSegunEstado(c.activo))
    .filter((c) => coincide(texto, c.nombre, c.cedula, c.licencia));
  const listaTerceros = (terceros.datos ?? []).filter((t) =>
    coincide(texto, t.nombre, t.nit, t.ciudad, t.codSede, t.direccion)
  );
  const listaMonitoreo = empresasGps.filter((e) => coincide(texto, e.nombre, e.nit));

  const conTitularEmpresa = (vehiculos.datos ?? []).filter(
    (v) => v.activo && titularEsEmpresa(v, nitEmpresa)
  ).length;

  return (
    <>
      {avisoCoordenada && (
        <div className="alert warning">
          {avisoCoordenada}
          <button type="button" className="btn-link" onClick={() => setAvisoCoordenada(null)}>
            Entendido
          </button>
        </div>
      )}

      <div className="panel">
        <div className="toolbar" style={{ borderBottom: "none", paddingBottom: 0 }}>
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              className={pestana === p.id ? "btn-primary" : "btn-secondary"}
              onClick={() => cambiarPestana(p.id)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        {pestana !== "empresa" && (
          <div className="toolbar">
            <div className="filtros-catalogo">
              <input
                className="search-input"
                placeholder="Buscar..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {CON_ESTADO.includes(pestana) && (
                <label>
                  <input
                    type="checkbox"
                    checked={verInactivos}
                    onChange={(e) => setVerInactivos(e.target.checked)}
                  />
                  Mostrar inactivos
                </label>
              )}
              {pestana === "vehiculos" && conTitularEmpresa > 0 && (
                <label>
                  <input
                    type="checkbox"
                    checked={soloTitularEmpresa}
                    onChange={(e) => setSoloTitularEmpresa(e.target.checked)}
                  />
                  Solo titular = empresa ({conTitularEmpresa})
                </label>
              )}
            </div>
            <button className="btn-icon-round" title="Agregar" onClick={abrirNuevo}>
              +
            </button>
          </div>
        )}

        {pestana !== "empresa" && (
          <p className="resumen-catalogo" style={{ margin: "0 0 0.6rem" }}>
            Haz clic en una fila para ver y editar todos sus datos.
          </p>
        )}

        {/* ---------- VEHICULOS ---------- */}
        {pestana === "vehiculos" && (
          <>
            {conTitularEmpresa > 0 && (
              <div className="alert warning">
                {conTitularEmpresa} vehiculo(s) activo(s) tienen como titular del manifiesto el NIT
                de la empresa. Con ese titular el RNDC exige valor a pagar 0 (MAN006). Si son
                flota propia, pon la cedula del propietario como titular.
              </div>
            )}
            <Tabla
              estado={vehiculos}
              columnas={[
                "Placa",
                "Marca",
                "Config.",
                "Titular del manifiesto",
                "Remolque hab.",
                "Peso vacio",
                "Capacidad",
                "FOPAT",
                "Proveedor GPS",
                "Vence SOAT",
                "Vence tecno.",
                "Estado",
              ]}
              filas={listaVehiculos.map((v) => (
                <tr
                  key={v.id}
                  className={`fila-clic ${v.activo ? "" : "fila-inactiva"}`}
                  onClick={() => abrirEdicion(v)}
                >
                  <td>
                    <strong>{v.placa}</strong>
                  </td>
                  <td>{v.marca ?? "-"}</td>
                  <td>
                    {v.configuracion ?? "-"}
                    {!configuracionValida(v.configuracion) && (
                      <span className="badge badge-warning" style={{ marginLeft: 4 }}>
                        revisar
                      </span>
                    )}
                  </td>
                  <td>
                    {v.nombreTenedor ?? <span className="dato-sec">(sin nombre)</span>}
                    <span className="dato-sec">
                      {v.codTipoIdTenedor} {v.numIdTenedor ?? "-"}
                      {titularEsEmpresa(v, nitEmpresa) && (
                        <span className="badge badge-warning" style={{ marginLeft: 4 }}>
                          empresa
                        </span>
                      )}
                    </span>
                  </td>
                  <td>{v.placaRemolque ?? "-"}</td>
                  <td>{kg(v.pesoVehiculoVacio)}</td>
                  <td>{kg(v.capacidadKg)}</td>
                  <td>{v.aplicaFopat ? "Si" : "No"}</td>
                  {/* El combo edita en linea: sin stopPropagation, abrir el
                      desplegable tambien abriria la ventana de edicion. */}
                  <td style={{ minWidth: 220 }} onClick={(e) => e.stopPropagation()}>
                    <SelectorGps
                      vehiculo={v}
                      empresas={empresasGps}
                      alGuardar={vehiculos.recargar}
                    />
                  </td>
                  <td>
                    <Vencimiento fecha={v.fechaVencSoat} />
                  </td>
                  <td>
                    <Vencimiento fecha={v.fechaVencTecnomecanica} />
                  </td>
                  <td>
                    <EstadoRegistro
                      activo={v.activo}
                      vigente={vigente(v.fechaVencSoat) && vigente(v.fechaVencTecnomecanica)}
                    />
                  </td>
                </tr>
              ))}
            />
          </>
        )}

        {/* ---------- REMOLQUES ---------- */}
        {pestana === "remolques" && (
          <Tabla
            estado={remolques}
            columnas={["Placa", "Ejes", "Capacidad", "Vence SOAT", "Vence tecno.", "Estado"]}
            filas={listaRemolques.map((r) => (
              <tr
                key={r.id}
                className={`fila-clic ${r.activo ? "" : "fila-inactiva"}`}
                onClick={() => abrirEdicion(r)}
              >
                <td>
                  <strong>{r.placa}</strong>
                </td>
                <td>{r.numEjes ?? "-"}</td>
                <td>{kg(r.capacidadKg)}</td>
                <td>
                  <Vencimiento fecha={r.fechaVencSoat} />
                </td>
                <td>
                  <Vencimiento fecha={r.fechaVencTecnomecanica} />
                </td>
                <td>
                  <EstadoRegistro
                    activo={r.activo}
                    vigente={vigente(r.fechaVencSoat) && vigente(r.fechaVencTecnomecanica)}
                  />
                </td>
              </tr>
            ))}
          />
        )}

        {/* ---------- CONDUCTORES ---------- */}
        {pestana === "conductores" && (
          <Tabla
            estado={conductores}
            columnas={["Conductor", "Identificacion", "Licencia", "Categoria", "Vence licencia", "Estado"]}
            filas={listaConductores.map((c) => (
              <tr
                key={c.id}
                className={`fila-clic ${c.activo ? "" : "fila-inactiva"}`}
                onClick={() => abrirEdicion(c)}
              >
                <td>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span
                      className="avatar-circle"
                      style={{ width: 28, height: 28, fontSize: "0.68rem" }}
                    >
                      {iniciales(c.nombre)}
                    </span>
                    {c.nombre}
                  </span>
                </td>
                <td>
                  {c.codTipoId} {c.cedula}
                </td>
                <td>{c.licencia ?? "-"}</td>
                <td>{c.categoriaLicencia ?? "-"}</td>
                <td>
                  <Vencimiento fecha={c.fechaVencLicencia} />
                </td>
                <td>
                  <EstadoRegistro activo={c.activo} vigente={vigente(c.fechaVencLicencia)} />
                </td>
              </tr>
            ))}
          />
        )}

        {/* ---------- TERCEROS ---------- */}
        {pestana === "terceros" && (
          <Tabla
            estado={terceros}
            columnas={["Identificacion", "Nombre", "Sede", "Direccion", "Telefono", "Municipio", "Coordenadas"]}
            filas={listaTerceros.map((t) => (
              <tr key={t.id} className="fila-clic" onClick={() => abrirEdicion(t)}>
                <td>
                  {t.codTipoId} {t.nit}
                </td>
                <td>{t.nombre}</td>
                <td>{t.codSede}</td>
                <td>{t.direccion ?? "-"}</td>
                <td>{t.telefono ?? "-"}</td>
                <td>
                  {t.ciudad ?? "-"}
                  {t.codMunicipioRndc ? (
                    <span className="dato-sec">{t.codMunicipioRndc}</span>
                  ) : (
                    // Sin codigo DIVIPOLA no se puede precargar la ruta de la plantilla.
                    <span className="badge badge-warning" style={{ marginLeft: 4 }}>
                      sin codigo
                    </span>
                  )}
                </td>
                <td>
                  {t.latitud !== null && t.longitud !== null ? (
                    <span className="dato-sec">
                      {t.latitud}, {t.longitud}
                    </span>
                  ) : (
                    // Sin coordenadas el RNDC no puede verificar el GPS del
                    // cargue contra la sede.
                    <span className="badge badge-warning">faltan</span>
                  )}
                </td>
              </tr>
            ))}
          />
        )}

        {/* ---------- EMPRESAS DE MONITOREO ---------- */}
        {pestana === "monitoreo" && (
          <>
            <p className="section-desc" style={{ margin: "0 0 0.8rem" }}>
              Son las empresas del desplegable "Empresa de Monitoreo para este manifiesto" del
              portal del RNDC. El manifiesto exige una, y su NIT debe estar registrado alla.
            </p>
            <Tabla
              estado={monitoreo}
              columnas={["NIT", "Nombre", "Vehiculos que la usan", ""]}
              filas={listaMonitoreo.map((e) => (
                <tr key={e.id} className="fila-clic" onClick={() => abrirEdicion(e)}>
                  <td>{e.nit}</td>
                  <td>{e.nombre}</td>
                  <td>
                    {(vehiculos.datos ?? []).filter((v) => v.activo && v.nitMonitoreoFlota === e.nit).length}
                  </td>
                  <td>
                    <button
                      className="btn-link"
                      onClick={async (ev) => {
                        // El boton esta dentro de una fila clicable.
                        ev.stopPropagation();
                        if (!window.confirm(`¿Quitar ${e.nombre} del catalogo?`)) return;
                        await api.eliminarEmpresaMonitoreo(e.id);
                        monitoreo.recargar();
                      }}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            />
          </>
        )}

        {/* ---------- EMPRESA ---------- */}
        {pestana === "empresa" && <PanelEmpresa />}
      </div>

      {edicion && (
        <Modal
          titulo={tituloModal(pestana, edicion, modelo)}
          ancho="wide"
          alCerrar={() => setEdicion(null)}
          pie={
            <>
              <button className="btn-secondary" onClick={() => setEdicion(null)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={guardar}
                disabled={guardando || (edicion.modo === "editar" && !hayCambios)}
              >
                {guardando
                  ? "Guardando..."
                  : edicion.modo === "editar"
                    ? "Guardar cambios"
                    : "Guardar"}
              </button>
            </>
          }
        >
          {errorGuardar && <div className="alert danger">{errorGuardar}</div>}
          {pestana === "vehiculos" && titularEsEmpresa(modelo as Vehiculo, nitEmpresa) && (
            <div className="alert warning">
              El titular es el NIT de la empresa: el RNDC exigira valor a pagar 0 (MAN006). Para
              flota propia usa la cedula del propietario.
            </div>
          )}
          <FormularioGenerico
            secciones={seccionesDe(pestana, empresasGps, edicion.modo === "editar")}
            modelo={modelo}
            alCambiar={setModelo}
          />
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Piezas de apoyo
// ---------------------------------------------------------------------------

function Tabla({
  estado,
  columnas,
  filas,
}: {
  estado: { cargando: boolean; error: string | null; recargar: () => void };
  columnas: string[];
  filas: ReactElement[];
}) {
  if (estado.cargando) return <Cargando />;
  if (estado.error) return <ErrorCarga mensaje={estado.error} alReintentar={estado.recargar} />;

  return (
    <>
      <div className="tabla-scroll">
        <table className="modern">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas}
            {filas.length === 0 && (
              <tr>
                <td colSpan={columnas.length} className="empty-row">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="resumen-catalogo">{filas.length} registro(s)</p>
    </>
  );
}

function EstadoRegistro({ activo, vigente }: { activo: boolean; vigente: boolean }) {
  if (!activo) return <span className="badge badge-neutral">Inactivo</span>;
  return (
    <span className={`badge ${vigente ? "badge-ok" : "badge-danger"}`}>
      {vigente ? "Al dia" : "Revisar"}
    </span>
  );
}

/** Fecha de vencimiento, en rojo si ya paso. */
function Vencimiento({ fecha }: { fecha: string | null }) {
  if (!fecha) return <span className="dato-sec">-</span>;
  return (
    <span style={vigente(fecha) ? undefined : { color: "var(--color-danger-text)", fontWeight: 600 }}>
      {soloDia(fecha)}
    </span>
  );
}

/**
 * Parametros de la empresa: poliza, FOPAT y tarifa de retefuente.
 * Es una sola fila, no una lista, asi que se edita en linea.
 */
function PanelEmpresa() {
  const { datos, cargando, error, recargar } = useDatos(() => api.getParametros(), []);
  const [borrador, setBorrador] = useState<ParametrosEmpresa | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const p = borrador ?? datos;

  if (cargando) return <Cargando que="parametros" />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;
  if (!p) return null;

  const fijar = (cambios: Partial<ParametrosEmpresa>) => {
    setBorrador({ ...p, ...cambios });
    setGuardado(false);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarParametros(p);
      setGuardado(true);
      setBorrador(null);
      recargar();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className="form-section">
        <div>
          <div className="section-title">Identificacion</div>
          <div className="section-desc">
            Vienen de la configuracion del servidor (.env), no se editan aqui. El NIT es el que
            se envia al RNDC en cada documento.
          </div>
        </div>
        <div>
          <label>Nombre</label>
          <input value={p.nombreEmpresa ?? ""} disabled />
          <label>NIT (sin digito de verificacion)</label>
          <input value={p.nitEmpresa ?? ""} disabled />
          <label>Ambiente del RNDC</label>
          <input value={p.ambienteRndc ?? ""} disabled />
        </div>
      </div>

      <div className="form-section">
        <div>
          <div className="section-title">Poliza, FOPAT y retenciones</div>
          <div className="section-desc">
            Se aplican a todas las plantillas y a todos los viajes. Solo hay que tocarlos cuando
            se renueve la poliza o cambie la normativa.
          </div>
        </div>
        <div>
          {p.avisoPoliza && <div className="alert warning">{p.avisoPoliza}</div>}
          {guardado && <div className="alert success">Parametros guardados.</div>}

          <label>Tomador de la poliza de carga</label>
          <input
            value={p.tomadorPolizaCarga}
            onChange={(e) => fijar({ tomadorPolizaCarga: e.target.value })}
          />

          <label>Numero de poliza</label>
          <input
            value={p.numeroPolizaTransporte ?? ""}
            onChange={(e) => fijar({ numeroPolizaTransporte: e.target.value })}
          />

          <label>Compania aseguradora</label>
          <input
            value={p.companiaSeguro ?? ""}
            onChange={(e) => fijar({ companiaSeguro: e.target.value })}
          />

          <label>Vencimiento de la poliza</label>
          <input
            type="date"
            value={(p.fechaVencimientoPolizaCarga ?? "").slice(0, 10)}
            onChange={(e) => fijar({ fechaVencimientoPolizaCarga: e.target.value })}
          />
          <p className="section-desc">
            La poliza no se envia al RNDC. Se guarda para tu control, y el sistema avisa 30 dias
            antes del vencimiento.
          </p>

          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={p.aplicaFopat}
              onChange={(e) => fijar({ aplicaFopat: e.target.checked })}
            />
            Toda la flota supera 10,5 toneladas (aplica FOPAT)
          </label>
          <p className="section-desc">
            El FOPAT es el 0,1% del valor a pagar de cada manifiesto. Si algun vehiculo no llega a
            ese peso, desmarca esto y ajusta ese vehiculo en particular.
          </p>

          <label>Retencion en la fuente por defecto (%)</label>
          <input
            type="number"
            step="0.1"
            // Se guarda como fraccion (0.01) pero se edita como porcentaje (1).
            value={p.tarifaRetencionFuente * 100}
            onChange={(e) => fijar({ tarifaRetencionFuente: Number(e.target.value) / 100 })}
          />
          <p className="section-desc">
            Se usa al crear plantillas nuevas. Confirmala con tu contador.
          </p>

          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar parametros"}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Reglas de presentacion
// ---------------------------------------------------------------------------

/** Columnas DATE: el input type="date" solo acepta "AAAA-MM-DD". */
const CAMPOS_FECHA = ["fechaVencSoat", "fechaVencTecnomecanica", "fechaVencLicencia"];

/** Copia del registro lista para el formulario. */
function aModelo(registro: object): Modelo {
  const m: Modelo = { ...registro };
  for (const k of CAMPOS_FECHA) {
    if (typeof m[k] === "string") m[k] = m[k].slice(0, 10);
  }
  // Las coordenadas se editan como texto para no perder decimales.
  for (const k of ["latitud", "longitud"]) {
    if (typeof m[k] === "number") m[k] = String(m[k]);
  }
  return m;
}

/**
 * Solo lo que cambio respecto al original. Mandar el registro completo
 * revalidaria campos que nadie toco (por ejemplo una configuracion vieja) y
 * haria fallar una edicion que no tenia nada que ver.
 */
function soloCambios(original: Modelo, actual: Modelo): Modelo {
  const cambios: Modelo = {};
  for (const [k, v] of Object.entries(actual)) {
    const antes = original[k] ?? "";
    const ahora = v ?? "";
    if (String(antes) !== String(ahora)) cambios[k] = v;
  }
  return cambios;
}

/** Busca el texto en cualquiera de los campos (sin distinguir mayusculas). */
function coincide(texto: string, ...campos: Array<string | null | undefined>): boolean {
  if (!texto) return true;
  return campos.some((c) => (c ?? "").toLowerCase().includes(texto));
}

/**
 * Misma regla que mismaIdentificacion() del backend: iguales, o distintos solo
 * por el digito de verificacion al final.
 */
function titularEsEmpresa(v: Pick<Vehiculo, "numIdTenedor">, nitEmpresa: string | null): boolean {
  const a = (v.numIdTenedor ?? "").replace(/\D/g, "");
  const b = (nitEmpresa ?? "").replace(/\D/g, "");
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length === b.length + 1) return a.slice(0, -1) === b;
  if (b.length === a.length + 1) return b.slice(0, -1) === a;
  return false;
}

const CONFIGURACIONES = [
  { value: "3S3", label: "3S3 - Tractocamion 3 ejes + semirremolque 3 ejes" },
  { value: "3S2", label: "3S2 - Tractocamion 3 ejes + semirremolque 2 ejes" },
  { value: "2S3", label: "2S3 - Tractocamion 2 ejes + semirremolque 3 ejes" },
  { value: "2S2", label: "2S2 - Tractocamion 2 ejes + semirremolque 2 ejes" },
  { value: "3", label: "3 - Camion 3 ejes" },
  { value: "2", label: "2 - Camion 2 ejes (PBV > 10.500 kg)" },
  { value: "2L1", label: "2L1 - Camion 2 ejes liviano (9.001-10.500 kg)" },
  { value: "2L2", label: "2L2 - Camion 2 ejes liviano (8.001-9.000 kg)" },
  { value: "2L3", label: "2L3 - Camion 2 ejes liviano (7.500-8.000 kg)" },
  { value: "V2", label: "V2 - Volqueta 2 ejes" },
  { value: "V3", label: "V3 - Volqueta 3 ejes" },
  { value: "V4", label: "V4 - Volqueta 4 ejes" },
];

function configuracionValida(c: string | null): boolean {
  return !!c && CONFIGURACIONES.some((o) => o.value === c);
}

/** Vigente si no tiene fecha o si vence hoy o despues (comparando el dia, no la hora). */
function vigente(fecha: string | null): boolean {
  return !fecha || fecha.slice(0, 10) >= hoyColombia();
}

function kg(valor: number | null): string {
  return valor === null ? "-" : `${valor.toLocaleString("es-CO")} kg`;
}

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const NOMBRES: Record<Pestana, string> = {
  vehiculos: "vehiculo",
  remolques: "remolque",
  conductores: "conductor",
  terceros: "cliente",
  monitoreo: "empresa de monitoreo",
  empresa: "",
};

function tituloModal(p: Pestana, edicion: Edicion, modelo: Modelo): string {
  if (edicion.modo === "crear") return `Nuevo ${NOMBRES[p]}`;
  const nombre = modelo.placa ?? modelo.nombre ?? "";
  return `Editar ${NOMBRES[p]} ${nombre}`.trim();
}

// ---------------------------------------------------------------------------
// Formularios. Los mismos sirven para crear y para editar; al editar se agrega
// el estado (activo/inactivo), que al crear no tiene sentido.
// ---------------------------------------------------------------------------

function seccionEstado(que: string): SeccionFormulario {
  return {
    titulo: "Estado",
    descripcion: `Un ${que} inactivo no aparece en el despacho, pero se conserva para el historial de viajes.`,
    campos: [{ key: "activo", label: "Activo", tipo: "checkbox" }],
  };
}

function seccionesDe(
  p: Pestana,
  empresas: EmpresaMonitoreo[],
  edicion: boolean
): SeccionFormulario[] {
  switch (p) {
    case "vehiculos":
      return [...seccionesVehiculo(empresas), ...(edicion ? [seccionEstado("vehiculo")] : [])];
    case "remolques":
      return [...SECCIONES_REMOLQUE, ...(edicion ? [seccionEstado("remolque")] : [])];
    case "conductores":
      return [...SECCIONES_CONDUCTOR, ...(edicion ? [seccionEstado("conductor")] : [])];
    case "terceros":
      return SECCIONES_TERCERO;
    case "monitoreo":
      return SECCIONES_MONITOREO;
    default:
      return [];
  }
}

/**
 * El formulario de vehiculos incluye el proveedor de GPS, cuyas opciones salen
 * del catalogo de empresas de monitoreo y por eso no pueden ser fijas.
 */
function seccionesVehiculo(empresas: EmpresaMonitoreo[]): SeccionFormulario[] {
  return [
    {
      titulo: "Identificacion",
      descripcion: "Datos basicos del vehiculo.",
      campos: [
        { key: "placa", label: "Placa", tipo: "text", placeholder: "ABC123" },
        { key: "marca", label: "Marca", tipo: "text" },
        {
          key: "placaRemolque",
          label: "Remolque habitual (placa)",
          tipo: "text",
          ayuda: "Solo de referencia: el remolque se elige en cada despacho.",
        },
      ],
    },
    {
      titulo: "Configuracion y pesos",
      descripcion:
        "La configuracion combinada (cabezote + remolque) la usa SICETAC para las vias y el piso. No es el codigo del RUNT (50-55).",
      campos: [
        {
          key: "configuracion",
          label: "Configuracion combinada",
          tipo: "select",
          opciones: CONFIGURACIONES,
        },
        { key: "capacidadKg", label: "Capacidad de carga (kg)", tipo: "number" },
        { key: "pesoVehiculoVacio", label: "Peso del vehiculo vacio (kg)", tipo: "number" },
        {
          key: "codTipoCarroceria",
          label: "Cod. tipo de carroceria",
          tipo: "text",
          placeholder: "0",
        },
        {
          key: "aplicaFopat",
          label: "Aplica FOPAT (peso bruto vehicular mayor a 10,5 t)",
          tipo: "checkbox",
        },
      ],
    },
    {
      titulo: "Titular del manifiesto",
      descripcion:
        "Es a quien se le paga el flete y lo que viaja en el manifiesto (CODIDTITULARMANIFIESTO / NUMIDTITULARMANIFIESTO). No es tu cliente. En la flota propia va la cedula del propietario, no el NIT de la empresa. Si el vehiculo esta en leasing va el locatario, nunca el banco. Debe existir como tercero en el RNDC.",
      campos: [
        {
          key: "codTipoIdTenedor",
          label: "Tipo de identificacion",
          tipo: "select",
          opciones: [
            { value: "C", label: "Cedula de ciudadania" },
            { value: "N", label: "NIT" },
            { value: "E", label: "Cedula de extranjeria" },
          ],
        },
        { key: "numIdTenedor", label: "Numero de identificacion", tipo: "text" },
        {
          key: "nombreTenedor",
          label: "Nombre del titular",
          tipo: "text",
          ayuda: "Solo para reconocerlo aqui; al RNDC viajan el tipo y el numero.",
        },
      ],
    },
    {
      titulo: "Propietario",
      descripcion: "Segun la tarjeta de propiedad. Es informativo y puede ser distinto del titular.",
      campos: [{ key: "propietarioNit", label: "Identificacion del propietario", tipo: "text" }],
    },
    {
      titulo: "Documentos",
      descripcion:
        "El RNDC los valida contra la fecha de descargue del manifiesto, no contra hoy.",
      campos: [
        { key: "fechaVencSoat", label: "Vencimiento SOAT", tipo: "date" },
        { key: "fechaVencTecnomecanica", label: "Vencimiento tecnomecanica", tipo: "date" },
      ],
    },
    {
      titulo: "Monitoreo",
      descripcion:
        "Proveedor de GPS del vehiculo. Se precarga en cada despacho y se puede cambiar para un viaje puntual.",
      campos: [
        {
          key: "nitMonitoreoFlota",
          label: "Empresa de monitoreo",
          tipo: "select",
          opciones: empresas.map((e) => ({ value: e.nit, label: `${e.nombre} (${e.nit})` })),
        },
      ],
    },
  ];
}

const SECCIONES_REMOLQUE: SeccionFormulario[] = [
  {
    titulo: "Datos del remolque",
    descripcion:
      "Los vehiculos intercambian de remolque entre viajes, por eso es un catalogo aparte.",
    campos: [
      { key: "placa", label: "Placa del remolque", tipo: "text", placeholder: "R37108" },
      { key: "numEjes", label: "Numero de ejes", tipo: "number", placeholder: "3" },
      { key: "capacidadKg", label: "Capacidad de carga (kg)", tipo: "number" },
    ],
  },
  {
    titulo: "Documentos",
    campos: [
      { key: "fechaVencSoat", label: "Vencimiento SOAT", tipo: "date" },
      { key: "fechaVencTecnomecanica", label: "Vencimiento tecnomecanica", tipo: "date" },
    ],
  },
];

const SECCIONES_CONDUCTOR: SeccionFormulario[] = [
  {
    titulo: "Datos del conductor",
    campos: [
      {
        key: "codTipoId",
        label: "Tipo de identificacion",
        tipo: "select",
        opciones: [
          { value: "C", label: "Cedula de ciudadania" },
          { value: "E", label: "Cedula de extranjeria" },
          { value: "P", label: "Pasaporte" },
        ],
      },
      { key: "cedula", label: "Numero de identificacion", tipo: "text" },
      { key: "nombre", label: "Nombre completo", tipo: "text" },
    ],
  },
  {
    titulo: "Licencia",
    descripcion:
      "Debe estar vigente en una fecha posterior al descargue de los viajes que vaya a hacer.",
    campos: [
      { key: "licencia", label: "Numero de licencia", tipo: "text" },
      { key: "categoriaLicencia", label: "Categoria", tipo: "text", placeholder: "C3" },
      { key: "fechaVencLicencia", label: "Vencimiento licencia", tipo: "date" },
    ],
  },
];

const SECCIONES_TERCERO: SeccionFormulario[] = [
  {
    titulo: "Datos del cliente",
    campos: [
      {
        key: "codTipoId",
        label: "Tipo de identificacion",
        tipo: "select",
        opciones: [
          { value: "N", label: "NIT" },
          { value: "C", label: "Cedula de ciudadania" },
        ],
      },
      { key: "nit", label: "NIT / Numero de identificacion", tipo: "text" },
      { key: "nombre", label: "Nombre / Razon social", tipo: "text" },
      { key: "direccion", label: "Direccion", tipo: "text" },
      { key: "telefono", label: "Telefono", tipo: "text" },
    ],
  },
  {
    titulo: "Sede",
    descripcion:
      "Cada sede es un sitio de cargue o descargue distinto. Si el cliente tiene varias, se crea una entrada por cada una.",
    campos: [
      {
        key: "codSede",
        label: 'Cod. de sede RNDC (por defecto "0")',
        tipo: "text",
        placeholder: "0",
      },
      { key: "ciudad", label: "Municipio", tipo: "text" },
      {
        key: "codMunicipioRndc",
        label: "Cod. municipio (DIVIPOLA, 8 digitos)",
        tipo: "text",
        placeholder: "11001000",
        ayuda:
          "Con este codigo se precarga la ruta de las plantillas. Cambiarlo no toca las plantillas ya creadas.",
      },
    ],
  },
  {
    titulo: "Coordenadas de la sede",
    descripcion:
      "El RNDC compara el GPS del vehiculo contra este punto para verificar que estuvo en el sitio durante el cargue. Copialas del portal, con minimo 6 decimales.",
    campos: [
      { key: "latitud", label: "Latitud", tipo: "text", placeholder: "4.648284" },
      { key: "longitud", label: "Longitud", tipo: "text", placeholder: "-74.066982" },
    ],
  },
];

const SECCIONES_MONITOREO: SeccionFormulario[] = [
  {
    titulo: "Empresa de monitoreo de flota",
    descripcion:
      "Copia el nombre y el NIT tal como aparecen en el desplegable del portal del RNDC.",
    campos: [
      { key: "nombre", label: "Nombre", tipo: "text", placeholder: "SAT CONTROL S.A.S" },
      {
        key: "nit",
        label: "NIT",
        tipo: "text",
        ayuda:
          "Es lo que viaja en el manifiesto (NITMONITOREOFLOTA). Solo digitos. Si lo cambias, los vehiculos que tenian el NIT anterior quedan sin proveedor asignado.",
      },
    ],
  },
];

/**
 * Cambia en linea el proveedor de GPS de un vehiculo ya registrado. Es lo que
 * permite completar la flota que ya estaba cargada sin reimportarla.
 */
function SelectorGps({
  vehiculo,
  empresas,
  alGuardar,
}: {
  vehiculo: Vehiculo;
  empresas: EmpresaMonitoreo[];
  alGuardar: () => void;
}) {
  const actual = empresas.find((e) => e.nit === vehiculo.nitMonitoreoFlota) ?? null;
  return (
    <ComboBuscable
      opciones={empresas}
      valor={actual?.id ?? null}
      alCambiar={async (id) => {
        const nit = empresas.find((e) => e.id === id)?.nit ?? null;
        await api.fijarMonitoreoVehiculo(vehiculo.id, nit);
        alGuardar();
      }}
      obtenerId={(e) => e.id}
      obtenerEtiqueta={(e) => e.nombre}
      placeholder="Sin asignar"
    />
  );
}
