import { useState } from "react";
import type { ReactElement } from "react";
import { api, soloFecha } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../componentes/Estado";
import Modal from "../componentes/Modal";
import FormularioGenerico, {
  type Modelo,
  type SeccionFormulario,
} from "../componentes/FormularioGenerico";
import type { Conductor, ParametrosEmpresa, Vehiculo } from "../api/tipos";

type Pestana = "vehiculos" | "remolques" | "conductores" | "terceros" | "empresa";

const PESTANAS: Array<{ id: Pestana; etiqueta: string }> = [
  { id: "vehiculos", etiqueta: "Vehiculos" },
  { id: "remolques", etiqueta: "Remolques" },
  { id: "conductores", etiqueta: "Conductores" },
  { id: "terceros", etiqueta: "Clientes" },
  { id: "empresa", etiqueta: "Empresa" },
];

export default function Catalogo() {
  const [pestana, setPestana] = useState<Pestana>("vehiculos");
  const [busqueda, setBusqueda] = useState("");

  const vehiculos = useDatos(() => api.getVehiculos(), []);
  const remolques = useDatos(() => api.getRemolques(), []);
  const conductores = useDatos(() => api.getConductores(), []);
  const terceros = useDatos(() => api.getTerceros(), []);

  const [modal, setModal] = useState(false);
  const [modelo, setModelo] = useState<Modelo>({});
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  /** Aviso del backend sobre la coordenada de la sede recien guardada. */
  const [avisoCoordenada, setAvisoCoordenada] = useState<string | null>(null);

  function cambiarPestana(p: Pestana) {
    setPestana(p);
    setBusqueda("");
  }

  function abrirModal() {
    setModelo({});
    setErrorGuardar(null);
    setModal(true);
  }

  async function guardar() {
    setGuardando(true);
    setErrorGuardar(null);
    try {
      if (pestana === "vehiculos") {
        await api.crearVehiculo(modelo);
        vehiculos.recargar();
      } else if (pestana === "remolques") {
        await api.crearRemolque(modelo);
        remolques.recargar();
      } else if (pestana === "conductores") {
        await api.crearConductor(modelo);
        conductores.recargar();
      } else if (pestana === "terceros") {
        // El backend revisa la coordenada y devuelve un aviso si algo no cuadra.
        // No rechaza el tercero: puede que la sede aun no la tenga en el portal.
        const creado = await api.crearTercero(modelo);
        setAvisoCoordenada(creado.avisoCoordenada ?? null);
        terceros.recargar();
      }
      setModal(false);
    } catch (exc) {
      setErrorGuardar(exc instanceof Error ? exc.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  const texto = busqueda.toLowerCase();

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
            <input
              className="search-input"
              placeholder="Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <button className="btn-icon-round" title="Agregar" onClick={abrirModal}>
              +
            </button>
          </div>
        )}

        {/* ---------- VEHICULOS ---------- */}
        {pestana === "vehiculos" && (
          <Tabla
            estado={vehiculos}
            columnas={["Placa", "Configuracion", "Vence SOAT", "Vence tecno.", "Estado"]}
            filas={(vehiculos.datos ?? [])
              .filter((v) => v.placa.toLowerCase().includes(texto))
              .map((v) => (
                <tr key={v.id}>
                  <td>{v.placa}</td>
                  <td>{v.configuracion ?? "-"}</td>
                  <td>{soloFecha(v.fechaVencSoat)}</td>
                  <td>{soloFecha(v.fechaVencTecnomecanica)}</td>
                  <td>
                    <EstadoDocumentos vigente={documentosVigentes(v)} />
                  </td>
                </tr>
              ))}
          />
        )}

        {/* ---------- REMOLQUES ---------- */}
        {pestana === "remolques" && (
          <Tabla
            estado={remolques}
            columnas={["Placa", "Ejes", "Vence SOAT", "Vence tecno."]}
            filas={(remolques.datos ?? [])
              .filter((r) => r.placa.toLowerCase().includes(texto))
              .map((r) => (
                <tr key={r.id}>
                  <td>{r.placa}</td>
                  <td>{r.numEjes ?? "-"}</td>
                  <td>{soloFecha(r.fechaVencSoat)}</td>
                  <td>{soloFecha(r.fechaVencTecnomecanica)}</td>
                </tr>
              ))}
          />
        )}

        {/* ---------- CONDUCTORES ---------- */}
        {pestana === "conductores" && (
          <Tabla
            estado={conductores}
            columnas={["Conductor", "Cedula", "Vence licencia", "Estado"]}
            filas={(conductores.datos ?? [])
              .filter((c) => c.nombre.toLowerCase().includes(texto) || c.cedula.includes(texto))
              .map((c) => (
                <tr key={c.id}>
                  <td style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span
                      className="avatar-circle"
                      style={{ width: 28, height: 28, fontSize: "0.68rem" }}
                    >
                      {iniciales(c.nombre)}
                    </span>
                    {c.nombre}
                  </td>
                  <td>{c.cedula}</td>
                  <td>{soloFecha(c.fechaVencLicencia)}</td>
                  <td>
                    <EstadoDocumentos vigente={licenciaVigente(c)} />
                  </td>
                </tr>
              ))}
          />
        )}

        {/* ---------- TERCEROS ---------- */}
        {pestana === "terceros" && (
          <Tabla
            estado={terceros}
            columnas={["NIT", "Nombre", "Sede", "Municipio", "Coordenadas"]}
            filas={(terceros.datos ?? [])
              .filter((t) => t.nombre.toLowerCase().includes(texto) || t.nit.includes(texto))
              .map((t) => (
                <tr key={t.id}>
                  <td>{t.nit}</td>
                  <td>{t.nombre}</td>
                  <td>{t.codSede}</td>
                  <td>
                    {t.ciudad ?? "-"}
                    {t.codMunicipioRndc ? ` (${t.codMunicipioRndc})` : ""}
                  </td>
                  <td>
                    {t.latitud !== null && t.longitud !== null ? (
                      <span className="badge badge-ok">si</span>
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

        {/* ---------- EMPRESA ---------- */}
        {pestana === "empresa" && <PanelEmpresa />}
      </div>

      {modal && (
        <Modal
          titulo={TITULOS[pestana]}
          alCerrar={() => setModal(false)}
          pie={
            <>
              <button className="btn-secondary" onClick={() => setModal(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </>
          }
        >
          {errorGuardar && <div className="alert danger">{errorGuardar}</div>}
          <FormularioGenerico
            secciones={SECCIONES[pestana]}
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
  );
}

function EstadoDocumentos({ vigente }: { vigente: boolean }) {
  return (
    <span className={`badge ${vigente ? "badge-ok" : "badge-danger"}`}>
      {vigente ? "Al dia" : "Revisar"}
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
    <div className="form-section">
      <div>
        <div className="section-title">Datos de la empresa</div>
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
  );
}

// ---------------------------------------------------------------------------
// Reglas de presentacion
// ---------------------------------------------------------------------------

function documentosVigentes(v: Vehiculo): boolean {
  const hoy = new Date();
  const soatOk = !v.fechaVencSoat || new Date(v.fechaVencSoat) >= hoy;
  const tecnoOk = !v.fechaVencTecnomecanica || new Date(v.fechaVencTecnomecanica) >= hoy;
  return soatOk && tecnoOk;
}

function licenciaVigente(c: Conductor): boolean {
  return !c.fechaVencLicencia || new Date(c.fechaVencLicencia) >= new Date();
}

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const TITULOS: Record<Pestana, string> = {
  vehiculos: "Nuevo vehiculo",
  remolques: "Nuevo remolque",
  conductores: "Nuevo conductor",
  terceros: "Nuevo cliente",
  empresa: "",
};

const SECCIONES: Record<Pestana, SeccionFormulario[]> = {
  vehiculos: [
    {
      titulo: "Identificacion",
      descripcion: "Datos basicos del vehiculo.",
      campos: [
        { key: "placa", label: "Placa", tipo: "text", placeholder: "ABC123" },
        { key: "marca", label: "Marca", tipo: "text" },
      ],
    },
    {
      titulo: "Configuracion",
      descripcion:
        "La configuracion combinada la usa SICETAC para cotizar. Si no la sabes, dejala vacia y corre 'npm run verificar': la consulta en el RNDC.",
      campos: [
        {
          key: "configuracion",
          label: "Configuracion combinada",
          tipo: "select",
          opciones: [
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
          ],
        },
        { key: "capacidadKg", label: "Capacidad de carga (kg)", tipo: "number" },
        { key: "pesoVehiculoVacio", label: "Peso del vehiculo vacio (kg)", tipo: "number" },
        {
          key: "codTipoCarroceria",
          label: "Cod. tipo de carroceria",
          tipo: "text",
          placeholder: "0",
        },
      ],
    },
    {
      titulo: "Tenedor / propietario",
      descripcion:
        "Es el TITULAR DEL MANIFIESTO: a quien se le paga el flete. No es tu cliente. Si el vehiculo esta en leasing va el locatario, nunca el banco.",
      campos: [
        {
          key: "codTipoIdTenedor",
          label: "Tipo de identificacion",
          tipo: "select",
          opciones: [
            { value: "N", label: "NIT" },
            { value: "C", label: "Cedula de ciudadania" },
            { value: "E", label: "Cedula de extranjeria" },
          ],
        },
        { key: "numIdTenedor", label: "Numero de identificacion", tipo: "text" },
      ],
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
  ],

  remolques: [
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
  ],

  conductores: [
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
  ],

  terceros: [
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
            "De aqui salen el origen y el destino del manifiesto. Sin este codigo el despacho se detiene.",
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
  ],

  empresa: [],
};
