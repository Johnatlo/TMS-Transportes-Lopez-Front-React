/**
 * Pantalla Gastos: el libro unico de gastos de Transportes Lopez y
 * Transportes M&C (fase 1 del modulo de gastos, prorrateo y reparto).
 *
 * - Libro: cada gasto con su empresa, categoria, causacion (a que mes
 *   corresponde), pago y a quien se reparte. Clic en un gasto muestra cuanto
 *   le toco a cada vehiculo o socio. Exportar saca lo que esta en pantalla.
 * - Por vehiculo: lo que le toco a cada vehiculo y socio en un mes.
 * - Creditos: tabla de amortizacion y pago de cuotas (ver Creditos.tsx).
 * - El rol total cierra meses (sus gastos ya no cambian) y fija la fecha
 *   desde la que se registran. Transportes M&C solo ve lo de su empresa.
 */
import { useMemo, useState } from "react";
import { apiGastos, hoyColombia, moneda } from "../../api/cliente";
import type { DatosGasto, EmpresaGasto, Gasto, OpcionesGastos } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { useSesion } from "../../ganchos/useSesion";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import CampoFecha from "../../componentes/CampoFecha";
import Indicador from "../../componentes/Indicador";
import MenuMas from "../../componentes/MenuMas";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import Creditos from "./Creditos";
import SelectorDestinos from "./SelectorDestinos";
import { aDestinos, aSeleccion, SELECCION_VACIA, vistaPrevia } from "./destinos";
import type { SeleccionDestinos } from "./destinos";

export const NOMBRE_EMPRESA: Record<EmpresaGasto, string> = { LOPEZ: "T. Lopez", MYC: "T. M&C" };
export const NOMBRE_CATEGORIA: Record<string, string> = {
  NOMINA: "Nomina",
  OFICINA: "Oficina",
  SERVICIOS: "Servicios",
  CREDITO: "Credito",
  VEHICULO: "Vehiculo",
  SEGUROS: "Seguros",
  IMPUESTOS: "Impuestos",
  SOCIO: "Gasto adicional del socio",
  OTROS: "Otros",
};

/** "2026-11" -> "Noviembre 2026". */
const nombreMes = (mes: string) => {
  const t = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return t[0].toUpperCase() + t.slice(1);
};

/** A quien va el gasto, en pocas palabras ("CELSO + 13 vehiculos"). */
function resumenDestino(g: Gasto): string {
  const vehiculos = g.destinos.filter((d) => d.tipo === "VEHICULO").length;
  const socios = [...new Set(g.reparto.filter((r) => r.socio).map((r) => r.socio as string))];
  const unico = vehiculos === 1 ? g.reparto.find((r) => r.placa)?.placa : null;
  const empresa = g.destinos.some((d) => d.tipo === "EMPRESA") ? "Empresa" : "";
  return [...socios, unico ? placaConGuion(unico) : vehiculos ? `${vehiculos} vehiculos` : "", empresa].filter(Boolean).join(" + ") || "-";
}

type Vista = "libro" | "vehiculos" | "creditos";

/** Pantalla de gastos. */
export default function Gastos() {
  const { usuario } = useSesion();
  const total = usuario?.rol === "TOTAL";
  const carga = useDatos(() => Promise.all([apiGastos.opciones(), apiGastos.listar()]), []);
  const [vista, setVista] = useState<Vista>("libro");
  const [formulario, setFormulario] = useState<{ gasto: Gasto | null; base: Gasto | null } | null>(null);
  const [cierres, setCierres] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (carga.cargando && !carga.datos) return <Cargando que="los gastos" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;
  const [opciones, lista] = carga.datos;
  const vigentes = lista.filter((g) => !g.anulado);
  const mesActual = hoyColombia().slice(0, 7);
  const delMes = vigentes.flatMap((g) => g.causaciones.filter((c) => c.fecha.startsWith(mesActual)).map((c) => (g.tipo === "INGRESO" ? -c.monto : c.monto)));
  const porPagar = vigentes.filter((g) => g.tipo === "GASTO" && !g.fechaPago);

  /** Ejecuta una accion sobre un gasto y recarga el libro. */
  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      carga.recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  const columnas: Columna<Gasto>[] = [
    { id: "causacion", titulo: "Causacion", valor: (g) => g.causaDesde, celda: (g) => fechaCorta(g.causaDesde) },
    {
      id: "empresa",
      titulo: "Empresa",
      filtrable: true,
      valor: (g) => NOMBRE_EMPRESA[g.empresa],
      celda: (g) => <Pastilla tono={g.empresa === "MYC" ? "morado" : "azul"}>{NOMBRE_EMPRESA[g.empresa]}</Pastilla>,
    },
    {
      id: "categoria",
      titulo: "Categoria",
      filtrable: true,
      valor: (g) => NOMBRE_CATEGORIA[g.categoria] ?? g.categoria,
      celda: (g) => NOMBRE_CATEGORIA[g.categoria] ?? g.categoria,
    },
    {
      id: "descripcion",
      titulo: "Descripcion",
      valor: (g) => g.descripcion,
      celda: (g) => (
        <>
          <span className="principal">{g.descripcion}</span>
          {g.causaHasta ? (
            <span className="dato-sec">Causado por dias hasta {fechaCorta(g.causaHasta)}</span>
          ) : (
            g.causaCuotas > 1 && <span className="dato-sec">Se causa en {g.causaCuotas} cuotas mensuales</span>
          )}
        </>
      ),
    },
    {
      id: "valor",
      titulo: "Valor",
      alinear: "derecha",
      valor: (g) => (g.tipo === "INGRESO" ? -g.monto : g.monto),
      celda: (g) => (
        <strong className={g.tipo === "INGRESO" ? "texto-ok" : undefined}>{g.tipo === "INGRESO" ? `+ ${moneda(g.monto)}` : moneda(g.monto)}</strong>
      ),
    },
    { id: "destino", titulo: "Se reparte a", valor: resumenDestino, celda: resumenDestino },
    {
      id: "pago",
      titulo: "Pago",
      valor: (g) => g.fechaPago ?? "",
      celda: (g) => (g.fechaPago ? fechaCorta(g.fechaPago) : <span className="texto-vencido">{g.tipo === "INGRESO" ? "Por recibir" : "Por pagar"}</span>),
    },
    {
      id: "soporte",
      titulo: "Soporte",
      valor: (g) => g.soporteUrl ?? "",
      celda: (g) =>
        g.soporteUrl ? (
          <a href={g.soporteUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            Abrir
          </a>
        ) : (
          <span className="dato-sec">-</span>
        ),
    },
    { id: "registro", titulo: "Registro", valor: (g) => g.creadoPor ?? "", celda: (g) => <span className="dato-sec">{g.creadoPor ?? "-"}</span> },
  ];

  const pestanas: PestanaTabla<Gasto>[] = [
    { id: "todos", etiqueta: "Todos", incluye: (g) => !g.anulado },
    { id: "lopez", etiqueta: "T. Lopez", incluye: (g) => !g.anulado && g.empresa === "LOPEZ" },
    { id: "myc", etiqueta: "T. M&C", incluye: (g) => !g.anulado && g.empresa === "MYC" },
    { id: "porPagar", etiqueta: "Por pagar", incluye: (g) => !g.anulado && g.tipo === "GASTO" && !g.fechaPago },
    { id: "ingresos", etiqueta: "Ingresos", incluye: (g) => !g.anulado && g.tipo === "INGRESO" },
    { id: "creditos", etiqueta: "Cuotas de creditos", incluye: (g) => !g.anulado && g.origen === "CREDITO" },
    { id: "anulados", etiqueta: "Anulados", incluye: (g) => g.anulado },
  ];

  return (
    <>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador dinero titulo={`Gastos de ${nombreMes(mesActual)}`} valor={moneda(delMes.reduce((s, x) => s + x, 0))} detalle="por fecha de causacion" />
        <Indicador
          dinero
          titulo="Por pagar"
          valor={moneda(porPagar.reduce((s, g) => s + g.monto, 0))}
          detalle={`${porPagar.length} gasto(s) sin fecha de pago`}
          alerta={porPagar.length > 0}
        />
        <Indicador
          titulo="Se registra desde"
          valor={fechaCorta(opciones.corte)}
          detalle={opciones.cerrados.length ? `${opciones.cerrados.length} mes(es) cerrado(s)` : "sin meses cerrados"}
        />
      </div>
      {error && <div className="alert danger">{error}</div>}
      <div className="barra-envio">
        <button className="btn-primary boton-con-texto" onClick={() => setFormulario({ gasto: null, base: null })}>
          Nuevo gasto
        </button>
        <div className="selector-vista" role="group" aria-label="Vista">
          {(
            [
              ["libro", "Libro de gastos"],
              ["vehiculos", "Por vehiculo"],
              ["creditos", "Creditos"],
            ] as Array<[Vista, string]>
          ).map(([id, etiqueta]) => (
            <button key={id} type="button" className={vista === id ? "activo" : ""} onClick={() => setVista(id)}>
              {etiqueta}
            </button>
          ))}
        </div>
        {total && <MenuMas opciones={[{ etiqueta: "Cierre de meses y fecha de inicio", alElegir: () => setCierres(true) }]} />}
      </div>

      {vista === "libro" && (
        <div className="panel">
          <TablaDatos
            filas={lista}
            columnas={columnas}
            clave={(g) => g.id}
            pestanas={pestanas}
            nombreArchivo={`gastos-${hoyColombia()}`}
            fechaMes={(g) => g.causaDesde}
            placeholderBusqueda="Buscar descripcion, categoria, placa..."
            vacio="No hay gastos con estos criterios."
            claseFila={(g) => (g.anulado ? "fila-inactiva" : undefined)}
            detalle={(g) => (
              <DetalleGasto
                g={g}
                soloLectura={usuario?.rol === "MYC" && g.empresa !== "MYC"}
                cerrados={opciones.cerrados}
                alEditar={() => setFormulario({ gasto: g, base: null })}
                alDuplicar={() => setFormulario({ gasto: null, base: g })}
                alAnular={() => window.confirm(`¿Anular "${g.descripcion}"? Deja de contar en los repartos.`) && accion(() => apiGastos.anular(g.id))}
                alPagar={(fecha) => accion(() => apiGastos.pago(g.id, { fechaPago: fecha || null }))}
              />
            )}
          />
        </div>
      )}
      {vista === "vehiculos" && <PorVehiculo gastos={vigentes} opciones={opciones} />}
      {vista === "creditos" && <Creditos opciones={opciones} alCambiar={carga.recargar} />}

      {formulario && (
        <FormularioGasto
          opciones={opciones}
          gasto={formulario.gasto}
          base={formulario.base}
          soloMyc={usuario?.rol === "MYC"}
          alCerrar={() => setFormulario(null)}
          alGuardar={() => {
            setFormulario(null);
            carga.recargar();
          }}
        />
      )}
      {cierres && <VentanaCierres opciones={opciones} alCerrar={() => setCierres(false)} alCambiar={carga.recargar} />}
    </>
  );
}

/** Lo que le toco a cada vehiculo o socio, las causaciones y las acciones del gasto. */
function DetalleGasto({
  g,
  soloLectura,
  cerrados,
  alEditar,
  alDuplicar,
  alAnular,
  alPagar,
}: {
  g: Gasto;
  /** M&C ve los gastos de Lopez pero no los cambia. */
  soloLectura: boolean;
  cerrados: string[];
  alEditar: () => void;
  alDuplicar: () => void;
  alAnular: () => void;
  alPagar: (fecha: string) => void;
}) {
  // Suma por vehiculo o socio de todas las causaciones.
  const porDestino = new Map<string, { nombre: string; monto: number }>();
  for (const r of g.reparto) {
    const clave = r.vehiculoId ? `v${r.vehiculoId}` : r.socioId ? `s${r.socioId}` : "empresa";
    const previo = porDestino.get(clave) ?? { nombre: r.placa ? placaConGuion(r.placa) : r.socioId ? `Socio ${r.socio ?? ""}` : "Empresa", monto: 0 };
    previo.monto += r.monto;
    porDestino.set(clave, previo);
  }
  const cerrado = g.causaciones.some((c) => cerrados.includes(c.fecha.slice(0, 7)));
  return (
    <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
      <div className="reparto-gasto">
        {[...porDestino.values()].map((d) => (
          <span key={d.nombre} className="reparto-gasto-parte">
            <span className="dato-sec">{d.nombre}</span>
            <strong>{moneda(d.monto)}</strong>
          </span>
        ))}
        {g.anulado && <span className="dato-sec">Anulado: no se reparte.</span>}
      </div>
      {g.causaCuotas > 1 && (
        <div className="dato-sec" style={{ marginTop: "0.4rem" }}>
          Causaciones: {g.causaciones.map((c) => `${fechaCorta(c.fecha)} ${moneda(c.monto)}`).join(" · ")}
        </div>
      )}
      {soloLectura && (
        <div className="dato-sec" style={{ marginTop: "0.4rem" }}>
          Gasto de Transportes Lopez: solo se consulta.
        </div>
      )}
      {!g.anulado && !soloLectura && (
        <div className="detalle-tanqueo-pie">
          <label>
            <span className="dato-sec">Fecha de pago</span>
            <CampoFecha valor={g.fechaPago} alGuardar={alPagar} />
          </label>
          {cerrado && <Pastilla tono="neutro">Mes cerrado</Pastilla>}
          {g.origen === "MANUAL" && !cerrado && (
            <button className="btn-secondary" onClick={alEditar}>
              Editar
            </button>
          )}
          {g.origen === "MANUAL" && (
            <button className="btn-link" onClick={alDuplicar}>
              Duplicar (otro mes)
            </button>
          )}
          {g.origen === "MANUAL" && !cerrado && (
            <button className="btn-link" onClick={alAnular}>
              Anular
            </button>
          )}
          {g.origen === "CREDITO" && <span className="dato-sec">Cuota de un credito: se cambia en Creditos.</span>}
          {g.origen === "NOMINA" && <span className="dato-sec">Sale de la nomina: para cambiarlo, reabre la nomina en Nomina.</span>}
        </div>
      )}
    </div>
  );
}

/** Formulario para crear, editar o duplicar un gasto. */
function FormularioGasto({
  opciones,
  gasto,
  base,
  soloMyc,
  alCerrar,
  alGuardar,
}: {
  opciones: OpcionesGastos;
  /** Gasto que se edita (null = nuevo). */
  gasto: Gasto | null;
  /** Gasto del que se copia todo menos las fechas (duplicar). */
  base: Gasto | null;
  /** Transportes M&C solo registra en su empresa. */
  soloMyc: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const origen = gasto ?? base;
  const [f, setF] = useState({
    empresa: (origen?.empresa ?? (soloMyc ? "MYC" : "LOPEZ")) as EmpresaGasto,
    tipo: origen?.tipo ?? ("GASTO" as Gasto["tipo"]),
    categoria: origen?.categoria ?? "OFICINA",
    descripcion: origen?.descripcion ?? "",
    monto: origen ? String(origen.monto) : "",
    causaDesde: gasto?.causaDesde ?? hoyColombia(),
    causaCuotas: String(gasto?.causaCuotas ?? base?.causaCuotas ?? 1),
    fechaPago: gasto?.fechaPago ?? "",
    soporteUrl: gasto?.soporteUrl ?? "",
  });
  const [destinos, setDestinos] = useState<SeleccionDestinos>(origen ? aSeleccion(origen.destinos) : SELECCION_VACIA);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const monto = Number(f.monto) || 0;
  const previa = vistaPrevia(monto, destinos);
  const listo = !!f.descripcion.trim() && !!f.causaDesde && !previa.problema;

  async function guardar() {
    setGuardando(true);
    setError(null);
    const datos: DatosGasto = {
      empresa: f.empresa,
      tipo: f.tipo,
      categoria: f.categoria,
      descripcion: f.descripcion,
      monto,
      causaDesde: f.causaDesde,
      causaCuotas: Number(f.causaCuotas) || 1,
      fechaPago: f.fechaPago || null,
      soporteUrl: f.soporteUrl.trim() || null,
      destinos: aDestinos(destinos),
    };
    try {
      if (gasto) await apiGastos.actualizar(gasto.id, datos);
      else await apiGastos.crear(datos);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={gasto ? "Editar gasto" : base ? "Duplicar gasto" : "Nuevo gasto"}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={!listo || guardando}>
            {guardando ? "Guardando..." : "Guardar"}
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
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Gasto["tipo"] })}>
            <option value="GASTO">Gasto</option>
            <option value="INGRESO">Ingreso (por ejemplo, lo que paga la otra empresa)</option>
          </select>
        </div>
        <div>
          <label>Categoria</label>
          <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            {opciones.categorias.map((c) => (
              <option key={c} value={c}>
                {NOMBRE_CATEGORIA[c] ?? c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Valor</label>
          <input type="number" min={0} step="any" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
        </div>
      </div>
      <div className="campos-cuadro" style={{ marginTop: "0.6rem" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Descripcion</label>
          <input
            value={f.descripcion}
            maxLength={300}
            onChange={(e) => setF({ ...f, descripcion: e.target.value })}
            placeholder="Honorarios contadora, luz oficina, poliza colectiva..."
          />
        </div>
        <div>
          <label>Fecha de causacion (a que periodo corresponde)</label>
          <input type="date" min={opciones.corte} value={f.causaDesde} onChange={(e) => setF({ ...f, causaDesde: e.target.value })} />
        </div>
        <div>
          <label>Se causa en (cuotas mensuales)</label>
          <input type="number" min={1} max={120} value={f.causaCuotas} onChange={(e) => setF({ ...f, causaCuotas: e.target.value })} />
        </div>
        <div>
          <label>Fecha de pago (vacia = por pagar)</label>
          <input type="date" value={f.fechaPago} onChange={(e) => setF({ ...f, fechaPago: e.target.value })} />
        </div>
        <div>
          <label>Link del soporte (Drive, opcional)</label>
          <input
            type="url"
            value={f.soporteUrl}
            maxLength={500}
            onChange={(e) => setF({ ...f, soporteUrl: e.target.value })}
            placeholder="https://drive.google.com/..."
          />
        </div>
      </div>
      {Number(f.causaCuotas) > 1 && monto > 0 && (
        <div className="dato-sec" style={{ marginTop: "0.3rem" }}>
          Se paga una vez y se causa en {f.causaCuotas} meses: {moneda(monto / Number(f.causaCuotas))} por mes desde {fechaCorta(f.causaDesde)}.
        </div>
      )}
      <h4 style={{ margin: "1rem 0 0.4rem" }}>A quien se le descuenta</h4>
      <SelectorDestinos opciones={opciones} monto={monto} valor={destinos} alCambiar={setDestinos} />
    </Modal>
  );
}

/** Fila de la vista por vehiculo. */
interface FilaVehiculo {
  clave: string;
  nombre: string;
  empresa: string;
  dueno: string;
  gastos: number;
  ingresos: number;
  cantidad: number;
  detalle: Array<{ descripcion: string; categoria: string; monto: number; tipo: Gasto["tipo"] }>;
}

/** Lo que le toco a cada vehiculo y socio en un mes (por fecha de causacion). */
function PorVehiculo({ gastos, opciones }: { gastos: Gasto[]; opciones: OpcionesGastos }) {
  const meses = useMemo(() => [...new Set(gastos.flatMap((g) => g.reparto.map((r) => r.fecha.slice(0, 7))))].sort().reverse(), [gastos]);
  const [mes, setMes] = useState(meses.includes(hoyColombia().slice(0, 7)) ? hoyColombia().slice(0, 7) : (meses[0] ?? hoyColombia().slice(0, 7)));
  const filas = useMemo(() => {
    const mapa = new Map<string, FilaVehiculo>();
    for (const g of gastos) {
      for (const r of g.reparto.filter((x) => x.fecha.startsWith(mes))) {
        const v = opciones.vehiculos.find((x) => x.id === r.vehiculoId);
        const clave = r.vehiculoId ? `v${r.vehiculoId}` : r.socioId ? `s${r.socioId}` : "empresa";
        const fila = mapa.get(clave) ?? {
          clave,
          nombre: r.placa ? placaConGuion(r.placa) : r.socioId ? `Socio ${r.socio ?? ""}` : "Empresa",
          empresa: v ? NOMBRE_EMPRESA[v.empresa] : "-",
          dueno: v?.dueno ?? (r.socio ? r.socio : "-"),
          gastos: 0,
          ingresos: 0,
          cantidad: 0,
          detalle: [],
        };
        if (g.tipo === "INGRESO") fila.ingresos += r.monto;
        else fila.gastos += r.monto;
        fila.cantidad += 1;
        fila.detalle.push({ descripcion: g.descripcion, categoria: NOMBRE_CATEGORIA[g.categoria] ?? g.categoria, monto: r.monto, tipo: g.tipo });
        mapa.set(clave, fila);
      }
    }
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [gastos, mes, opciones]);

  const columnas: Columna<FilaVehiculo>[] = [
    { id: "nombre", titulo: "Vehiculo / socio", valor: (f) => f.nombre, celda: (f) => <span className="principal">{f.nombre}</span> },
    { id: "empresa", titulo: "Empresa", filtrable: true, valor: (f) => f.empresa, celda: (f) => f.empresa },
    { id: "dueno", titulo: "Dueno", filtrable: true, valor: (f) => f.dueno, celda: (f) => f.dueno },
    { id: "cantidad", titulo: "Gastos", alinear: "derecha", valor: (f) => f.cantidad, celda: (f) => f.cantidad },
    { id: "gastos", titulo: "Total gastos", alinear: "derecha", valor: (f) => Math.round(f.gastos), celda: (f) => <strong>{moneda(f.gastos)}</strong> },
    { id: "ingresos", titulo: "Ingresos", alinear: "derecha", valor: (f) => Math.round(f.ingresos), celda: (f) => (f.ingresos ? moneda(f.ingresos) : "-") },
    { id: "neto", titulo: "Neto", alinear: "derecha", valor: (f) => Math.round(f.gastos - f.ingresos), celda: (f) => moneda(f.gastos - f.ingresos) },
  ];

  return (
    <div className="panel">
      <TablaDatos
        filas={filas}
        columnas={columnas}
        clave={(f) => f.clave}
        nombreArchivo={`gastos-por-vehiculo-${mes}`}
        placeholderBusqueda="Buscar placa o socio..."
        vacio="No hay gastos causados en ese mes."
        acciones={
          <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
            {(meses.includes(mes) ? meses : [mes, ...meses]).map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>
        }
        detalle={(f) => (
          <table className="tabla tabla-compacta">
            <tbody>
              {f.detalle.map((d, i) => (
                <tr key={i}>
                  <td>{d.descripcion}</td>
                  <td className="dato-sec">{d.categoria}</td>
                  <td className="num">{d.tipo === "INGRESO" ? `+ ${moneda(d.monto)}` : moneda(d.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      />
    </div>
  );
}

/** Cierre de meses y fecha desde la que se registran gastos (solo el rol total). */
function VentanaCierres({ opciones, alCerrar, alCambiar }: { opciones: OpcionesGastos; alCerrar: () => void; alCambiar: () => void }) {
  const [cerrados, setCerrados] = useState(opciones.cerrados);
  const [corte, setCorte] = useState(opciones.corte);
  const [error, setError] = useState<string | null>(null);
  // Meses desde el corte hasta el actual.
  const meses: string[] = [];
  for (let m = opciones.corte.slice(0, 7); m <= hoyColombia().slice(0, 7);) {
    meses.push(m);
    const [a, n] = m.split("-").map(Number);
    m = n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, "0")}`;
  }
  /** Ejecuta un cambio y avisa a la pantalla. */
  async function hacer(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }
  return (
    <Modal
      titulo="Cierre de meses"
      alCerrar={alCerrar}
      pie={
        <button className="btn-primary" onClick={alCerrar}>
          Listo
        </button>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="section-desc" style={{ marginBottom: "0.6rem" }}>
        Con el mes cerrado sus gastos no se pueden crear, cambiar ni anular (el reparto queda como esta). La fecha de pago y el link del soporte si se pueden
        completar.
      </div>
      <table className="tabla">
        <tbody>
          {meses.reverse().map((m) => (
            <tr key={m}>
              <td>{nombreMes(m)}</td>
              <td>{cerrados.includes(m) ? <Pastilla tono="neutro">Cerrado</Pastilla> : <Pastilla tono="ok">Abierto</Pastilla>}</td>
              <td className="num">
                <button className="btn-link" onClick={() => hacer(async () => setCerrados(await apiGastos.cerrarMes(m, !cerrados.includes(m))))}>
                  {cerrados.includes(m) ? "Abrir" : "Cerrar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="detalle-tanqueo-pie">
        <label>
          <span className="dato-sec">Se registran gastos desde</span>
          <input type="date" value={corte} onChange={(e) => setCorte(e.target.value)} />
        </label>
        <button
          className="btn-secondary"
          disabled={!corte || corte === opciones.corte}
          onClick={() => hacer(async () => void (await apiGastos.fijarCorte(corte)))}
        >
          Guardar fecha
        </button>
      </div>
    </Modal>
  );
}
