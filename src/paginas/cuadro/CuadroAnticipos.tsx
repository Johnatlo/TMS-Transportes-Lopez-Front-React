/**
 * Pantalla Anticipos (como el Excel "cuadro de anticipos"): un solo cuadro
 * con todos los anticipos de efectivo y combustible, uno por tanqueo (lo que
 * se entrego de una vez en la bomba: la ida y, si la hay, su vuelta).
 *
 * - Arriba: deuda con la bomba, pagado, abonado por el socio (el Zorro) y cupo
 *   de credito disponible.
 * - Pestanas como en el Cuadro pagos: sin cruzar, cruzados, con diferencia,
 *   deuda con la bomba, pagados, ida y vuelta, vueltas pendientes, posibles
 *   vueltas y solo efectivo. Filtros por placa, bomba y empresa del vehiculo.
 * - Clic en un tanqueo lo despliega: la ida y la vuelta con su viaje, el
 *   cruce (vale, galones, precio, descuento, diferencia), la factura y el
 *   pago a la bomba, y la posible vuelta (indicio) para juntarla con un clic.
 * - Cada bomba tiene su color; los tanqueos cruzados con la bomba van en verde.
 * - Botones: cruce con la bomba (la relacion quincenal de vales, en PDF,
 *   Excel o a mano), abonos del socio y anticipos de empresas.
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiCuadro, moneda } from "../../api/cliente";
import type { AbonoSocio, AnticipoBomba, ResumenBomba } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import CampoFecha from "../../componentes/CampoFecha";
import ComboBuscable from "../../componentes/ComboBuscable";
import Modal from "../../componentes/Modal";
import Indicador from "../../componentes/Indicador";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla, TonoPastilla } from "../../componentes/TablaDatos";
import MenuMas from "../../componentes/MenuMas";
import { fechaCorta, hoyColombia } from "./estadosCuadro";
import { deInput, enInput, placaConGuion } from "./facturacion";
import { agruparPorTanqueo, coloresBombas, DIFERENCIA_MINIMA, diferenciaTramo, faltaCruzar, posiblesVueltas } from "./tanqueos";
import type { EstadoCruce, Tanqueo } from "./tanqueos";
import ImportarAnticipos from "./ImportarAnticipos";
import VentanaCruceBomba from "./VentanaCruceBomba";
import ReporteBomba from "./ReporteBomba";
import { descargarAnticipos } from "./excelAnticipos";
import AnticiposEmpresas from "../seguimiento/AnticiposEmpresas";
import VistaTramos from "./VistaTramos";

/** Como se ven los anticipos: un tramo por fila (como el cuadro de la empresa) o un tanqueo por fila. */
type Vista = "tramos" | "tanqueos";
const CLAVE_VISTA = "anticipos.vista";

/** La vista que el usuario dejo la ultima vez (por tramo si no hay o no se puede leer). */
function vistaGuardada(): Vista {
  try {
    return localStorage.getItem(CLAVE_VISTA) === "tanqueos" ? "tanqueos" : "tramos";
  } catch {
    return "tramos";
  }
}

/** "LOPEZ", "M&C" o "TERCERO" para la columna Empresa del vehiculo. */
const flotaTexto = (f: string | null) => (f === "LOPEZ" ? "LOPEZ" : f === "MYC" ? "M&C" : f === "TERCERO" ? "TERCERO" : "-");

const CRUCE: Record<EstadoCruce, { etiqueta: string; tono: TonoPastilla }> = {
  CRUZADO: { etiqueta: "Cruzado", tono: "ok" },
  DIFERENCIA: { etiqueta: "Con diferencia", tono: "aviso" },
  SIN_CRUZAR: { etiqueta: "Sin cruzar", tono: "neutro" },
  SOLO_EFECTIVO: { etiqueta: "Solo efectivo", tono: "info" },
};

/** Viaje de un tramo: empresa y manifiesto, o la vuelta que espera el proximo viaje. */
function Viaje({ t }: { t: AnticipoBomba | null }) {
  if (!t) return <span className="dato-sec">-</span>;
  if (!t.cuadroViajeId) return <span className="texto-vencido">Pendiente: proximo viaje de {placaConGuion(t.placa ?? "")}</span>;
  return (
    <>
      <span className="principal">{t.empresa ?? "-"}</span>
      <span className="dato-sec">
        {t.manifiesto ? `Manifiesto ${t.manifiesto}` : "Sin manifiesto"}
        {t.fechaViaje ? ` · ${fechaCorta(t.fechaViaje)}` : ""}
      </span>
    </>
  );
}

/** Ventana abierta desde la barra. */
type Ventana = "cruce" | "abonos" | "empresas" | "importar" | "cupo" | "reportes" | null;

/**
 * Pantalla Anticipos. Los anticipos se registran en cada viaje del Cuadro
 * pagos (o se cargan del Excel); aqui se ven todos en un solo cuadro.
 */
export default function CuadroAnticipos() {
  const carga = useDatos(() => Promise.all([apiCuadro.cuadroAnticipos(), apiCuadro.resumenBomba(), apiCuadro.abonosSocio()]), []);
  const [tramos, setTramos] = useState<AnticipoBomba[] | null>(null);
  const [resumen, setResumen] = useState<ResumenBomba | null>(null);
  const [abonos, setAbonos] = useState<AbonoSocio[]>([]);
  const [ventana, setVentana] = useState<Ventana>(null);
  const [error, setError] = useState<string | null>(null);
  const [parametros, setParametros] = useSearchParams();
  /** Viaje cuyo anticipo del Zorro se abre (desde la alerta de la campana). */
  const [anticipoViaje, setAnticipoViaje] = useState<number | null>(null);
  const [vista, setVista] = useState<Vista>(vistaGuardada);
  /** Cambia la vista y la recuerda en este navegador. */
  const elegirVista = (v: Vista) => {
    setVista(v);
    try {
      localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      // Sin almacenamiento: solo dura mientras la pagina este abierta.
    }
  };

  // ?anticipo=<id del cuadro>: abre los anticipos de empresas en ese viaje.
  useEffect(() => {
    if (parametros.get("cruce")) {
      setVentana("cruce");
      setParametros({}, { replace: true });
      return;
    }
    const id = Number(parametros.get("anticipo"));
    if (!id) return;
    setAnticipoViaje(id);
    setVentana("empresas");
    setParametros({}, { replace: true });
  }, [parametros, setParametros]);

  useEffect(() => {
    if (!carga.datos) return;
    setTramos(carga.datos[0]);
    setResumen(carga.datos[1]);
    setAbonos(carga.datos[2]);
  }, [carga.datos]);

  const tanqueos = useMemo(() => agruparPorTanqueo(tramos ?? []), [tramos]);
  const colores = useMemo(() => coloresBombas((tramos ?? []).map((t) => t.bomba)), [tramos]);

  /** Guarda un cambio de un tramo o tanqueo y refresca el cuadro y las cuentas. */
  async function guardar(accion: () => Promise<AnticipoBomba[]>) {
    setError(null);
    try {
      setTramos(await accion());
      setResumen(await apiCuadro.resumenBomba());
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  if (carga.cargando && !tramos) return <Cargando que="los anticipos" />;
  if (carga.error) return <ErrorCarga mensaje={carga.error} alReintentar={carga.recargar} />;
  if (!tramos) return null;

  const Bomba = ({ nombre }: { nombre: string | null }) =>
    nombre ? <Pastilla tono={colores.get(nombre) ?? "neutro"}>{nombre}</Pastilla> : <span className="dato-sec">Solo efectivo</span>;

  const columnas: Columna<Tanqueo>[] = [
    { id: "fecha", titulo: "Fecha", valor: (g) => g.fecha, celda: (g) => fechaCorta(g.fecha) },
    { id: "placa", titulo: "Placa", filtrable: true, valor: (g) => placaConGuion(g.placa), celda: (g) => <span className="principal">{placaConGuion(g.placa)}</span> },
    { id: "ida", titulo: "Ida", valor: (g) => g.ida.empresa ?? "", celda: (g) => <Viaje t={g.ida} /> },
    {
      id: "vuelta",
      titulo: "Vuelta",
      valor: (g) => (g.vuelta ? g.vuelta.empresa ?? "Pendiente" : ""),
      celda: (g) => (g.vuelta ? <Viaje t={g.vuelta} /> : posiblesVueltas(g, tanqueos).length ? <Pastilla tono="aviso">Posible vuelta</Pastilla> : <span className="dato-sec">-</span>),
    },
    { id: "eds", titulo: "EDS", filtrable: true, valor: (g) => g.bomba ?? "Solo efectivo", celda: (g) => <Bomba nombre={g.bomba} /> },
    { id: "efectivo", titulo: "Efectivo", alinear: "derecha", valor: (g) => g.efectivo, celda: (g) => moneda(g.efectivo) },
    { id: "combustible", titulo: "Combust.", alinear: "derecha", valor: (g) => g.combustible, celda: (g) => moneda(g.combustible) },
    { id: "total", titulo: "Total", alinear: "derecha", valor: (g) => g.total, celda: (g) => <strong>{moneda(g.total)}</strong> },
    {
      id: "factura",
      titulo: "Factura bomba",
      filtrable: true,
      valor: (g) => g.facturaBomba ?? "Sin factura",
      celda: (g) => (
        <>
          <span className="codigo">{g.facturaBomba ?? "-"}</span>
          {g.fechaFacturaBomba && <span className="dato-sec">{fechaCorta(g.fechaFacturaBomba)}</span>}
        </>
      ),
    },
    {
      id: "cruce",
      titulo: "Cruce",
      filtrable: true,
      valor: (g) => CRUCE[g.cruce].etiqueta,
      celda: (g) => (
        <>
          <Pastilla tono={CRUCE[g.cruce].tono}>{CRUCE[g.cruce].etiqueta}</Pastilla>
          {g.cruce === "DIFERENCIA" && <span className="dato-sec texto-vencido">{moneda(g.diferencia)}</span>}
        </>
      ),
    },
    {
      id: "pago",
      titulo: "Pago a la bomba",
      valor: (g) => g.fechaPago ?? "",
      celda: (g) =>
        !g.bombaId ? (
          <span className="dato-sec">-</span>
        ) : g.pagado ? (
          fechaCorta(g.fechaPago)
        ) : (
          <span className="texto-vencido">Se debe</span>
        ),
    },
    { id: "flota", titulo: "Empresa del vehiculo", filtrable: true, valor: (g) => flotaTexto(g.flota), celda: (g) => flotaTexto(g.flota) },
  ];

  const pestanas: PestanaTabla<Tanqueo>[] = [
    { id: "todos", etiqueta: "Todos", incluye: () => true },
    { id: "sinCruzar", etiqueta: "Sin cruzar", incluye: (g) => g.cruce === "SIN_CRUZAR" },
    { id: "cruzados", etiqueta: "Cruzados", incluye: (g) => g.cruce === "CRUZADO" || g.cruce === "DIFERENCIA" },
    { id: "diferencia", etiqueta: "Con diferencia", incluye: (g) => g.cruce === "DIFERENCIA" },
    { id: "deuda", etiqueta: "Deuda con la bomba", incluye: (g) => !!g.bombaId && !g.pagado },
    { id: "pagados", etiqueta: "Pagados a la bomba", incluye: (g) => g.pagado },
    { id: "idaYVuelta", etiqueta: "Ida y vuelta", incluye: (g) => !!g.vuelta },
    { id: "pendientes", etiqueta: "Vueltas pendientes", incluye: (g) => !!g.vuelta && !g.vuelta.cuadroViajeId },
    { id: "posibles", etiqueta: "Posible vuelta", incluye: (g) => posiblesVueltas(g, tanqueos).length > 0 },
    { id: "efectivo", etiqueta: "Solo efectivo", incluye: (g) => g.cruce === "SOLO_EFECTIVO" },
  ];

  const r = resumen;
  return (
    <>
      {r && (
        <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
          <Indicador dinero titulo="Deuda con la bomba" valor={moneda(r.pendiente)} detalle={`de ${moneda(r.deuda)} entregado`} />
          <Indicador dinero titulo="Pagado a la bomba" valor={moneda(r.pagado)} />
          <Indicador
            dinero
            titulo="Abonado por el socio"
            valor={moneda(r.abonadoSocio)}
            detalle={r.abonadoPorCruzar > 0 ? `${moneda(r.abonadoPorCruzar)} por cruzar` : `${abonos.length} abono(s)`}
          />
          <Indicador
            dinero
            titulo="Cupo disponible"
            valor={moneda(r.cupoDisponible)}
            detalle={`de ${moneda(r.cupoBomba)}`}
            alerta={r.cupoDisponible < r.cupoBomba * 0.1}
          />
        </div>
      )}
      {error && <div className="alert danger">{error}</div>}
      <div className="barra-envio">
        <button className="btn-primary boton-con-texto" onClick={() => setVentana("cruce")}>
          Cruce con la bomba
        </button>
        <button className="boton-barra" onClick={() => setVentana("abonos")}>
          Abonos a la bomba ({abonos.length})
        </button>
        <button className="boton-barra" onClick={() => setVentana("reportes")}>
          Reportes
        </button>
        <div className="selector-vista" role="group" aria-label="Vista de los anticipos">
          <button type="button" className={vista === "tramos" ? "activo" : ""} onClick={() => elegirVista("tramos")}>
            Por tramo
          </button>
          <button type="button" className={vista === "tanqueos" ? "activo" : ""} onClick={() => elegirVista("tanqueos")}>
            Por tanqueo
          </button>
        </div>
        <MenuMas
          opciones={[
            { etiqueta: "Anticipos del Zorro", alElegir: () => setVentana("empresas") },
            { etiqueta: "Cupo y precios de la bomba", alElegir: () => setVentana("cupo") },
            { etiqueta: "Importar Excel de anticipos", alElegir: () => setVentana("importar") },
          ]}
        />
      </div>
      <div className="section-desc" style={{ margin: "0.2rem 0 0.6rem" }}>
        {vista === "tramos"
          ? "Un anticipo por fila, como el cuadro de la empresa: la ida y la vuelta por separado. Si quedo mal marcado, cambia Ida / Vuelta en la fila; la ultima columna sugiere su pareja y la junta con un clic. "
          : "Un tanqueo por fila (la ida y su vuelta). "}
        Clic en una fila para ver el cruce con la bomba, la factura y el pago. En verde, los ya cruzados: con sus vales de la
        bomba, con factura y pago a la bomba, o marcados a mano. Los anticipos se registran en cada viaje del Cuadro pagos.
      </div>
      <div className="panel">
        {vista === "tramos" ? (
          <VistaTramos
            tramos={tramos}
            tanqueos={tanqueos}
            cruce={CRUCE}
            Bomba={Bomba}
            flotaTexto={flotaTexto}
            guardar={guardar}
            detalle={(g) => <DetalleTanqueo g={g} posibles={posiblesVueltas(g, tanqueos)} abonos={abonos} resumen={r} Bomba={Bomba} guardar={guardar} />}
          />
        ) : (
        <TablaDatos
          filas={tanqueos}
          columnas={columnas}
          columnasFijas={2}
          clave={(g) => g.clave}
          pestanas={pestanas}
          nombreArchivo="anticipos"
          alExportar={(visibles) => descargarAnticipos(visibles, `anticipos-${hoyColombia()}`)}
          placeholderBusqueda="Buscar placa, empresa, bomba, factura..."
          vacio="No hay anticipos con estos criterios."
          claseFila={(g) => (g.cruce === "CRUZADO" ? "fila-cruzada" : g.cruce === "DIFERENCIA" ? "fila-diferencia" : undefined)}
          detalle={(g) => (
            <DetalleTanqueo
              g={g}
              posibles={posiblesVueltas(g, tanqueos)}
              abonos={abonos}
              resumen={r}
              Bomba={Bomba}
              guardar={guardar}
            />
          )}
        />
        )}
      </div>

      {ventana === "reportes" && <ReporteBomba alCerrar={() => setVentana(null)} />}
      {ventana === "cruce" && <VentanaCruceBomba tramos={tramos} alCerrar={() => setVentana(null)} alCambiar={() => carga.recargar()} />}
      {ventana === "abonos" && (
        <VentanaAbonos
          abonos={abonos}
          alCerrar={() => setVentana(null)}
          alCambiar={async (lista) => {
            setAbonos(lista);
            setResumen(await apiCuadro.resumenBomba());
          }}
        />
      )}
      {ventana === "empresas" && (
        <Modal ancho="pantalla" titulo="Anticipos del Zorro (se abonan a la bomba)" alCerrar={() => setVentana(null)}>
          <AnticiposEmpresas destino="BOMBA" abrirViaje={anticipoViaje} />
        </Modal>
      )}
      {ventana === "cupo" && r && (
        <VentanaCupo
          resumen={r}
          alCerrar={() => setVentana(null)}
          alGuardar={async () => {
            setVentana(null);
            setResumen(await apiCuadro.resumenBomba());
          }}
        />
      )}
      {ventana === "importar" && <ImportarAnticipos alCerrar={() => setVentana(null)} alCambiar={() => carga.recargar()} />}
    </>
  );
}

/**
 * Lo que se ve al desplegar un tanqueo: cada tramo (ida y vuelta) con su
 * viaje, valores, cruce y pago; la factura de la bomba; los abonos del socio
 * en esos viajes y la posible vuelta para juntarla.
 */
function DetalleTanqueo({
  g,
  posibles,
  abonos,
  resumen,
  Bomba,
  guardar,
}: {
  g: Tanqueo;
  posibles: Tanqueo[];
  abonos: AbonoSocio[];
  resumen: ResumenBomba | null;
  Bomba: (p: { nombre: string | null }) => JSX.Element;
  guardar: (accion: () => Promise<AnticipoBomba[]>) => Promise<void>;
}) {
  const viajes = new Set(g.tramos.map((t) => t.cuadroViajeId).filter(Boolean));
  /** Tramo con diferencia que se esta corrigiendo. */
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null);
  const abonosDeEstos = abonos.flatMap((a) => a.viajes.filter((v) => viajes.has(v.cuadroViajeId)).map((v) => ({ ...v, socio: a.socio, fecha: a.fecha })));

  // Cruce por galones (sin vale): combustible = galones x precio - descuento.
  const campoCruce = (t: AnticipoBomba, campo: "galones" | "precioGalon" | "descuento", sugerido?: number) => (
    <input
      key={`${t.id}-${campo}-${t[campo]}`}
      type="number"
      min={0}
      step={campo === "galones" ? "0.001" : "1"}
      style={{ width: "6.5rem" }}
      defaultValue={enInput(t[campo])}
      placeholder={sugerido === undefined ? "" : String(sugerido)}
      disabled={t.cruzadoCombustible}
      onBlur={(e) => deInput(e.target.value) !== t[campo] && guardar(() => apiCuadro.actualizarTramo(t.id, { [campo]: e.target.value }))}
    />
  );

  return (
    <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
      <table className="tabla tabla-compacta">
        <thead>
          <tr>
            <th>Tramo</th>
            <th>Viaje</th>
            <th className="num">Efectivo</th>
            <th className="num">Combustible</th>
            <th>Vales de la bomba</th>
            <th>Galones</th>
            <th>Precio galon</th>
            <th>Descuento ($)</th>
            <th className="num">Registrado antes</th>
            <th className="num">Diferencia</th>
            <th>Pago a la bomba</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {g.tramos.map((t) => {
            const d = diferenciaTramo(t);
            const falta = faltaCruzar(t);
            const conDiferencia = Math.abs(d) >= DIFERENCIA_MINIMA;
            return (
              <Fragment key={t.id}>
              <tr>
                <td>
                  <select
                    className={`selector-tramo ${t.tramo === "VUELTA" ? "es-vuelta" : "es-ida"}`}
                    value={t.tramo}
                    onChange={(e) => guardar(() => apiCuadro.actualizarTramo(t.id, { tramo: e.target.value }))}
                    aria-label="Ida o vuelta"
                  >
                    <option value="IDA">Ida</option>
                    <option value="VUELTA">Vuelta</option>
                  </select>
                </td>
                <td>
                  <Viaje t={t} />
                </td>
                <td className="num">{moneda(t.efectivo)}</td>
                <td className="num">
                  <strong>{moneda(t.combustible)}</strong>
                </td>
                <td>
                  {/* Un vale para el combustible y otro para el efectivo (la bomba da los dos). */}
                  {/* Los vales armados a mano no traen numero: salen como "cruzado a mano". */}
                  {t.cruzadoCombustible ? (
                    <span className="codigo">Comb. {t.vale ?? "cruzado a mano"}</span>
                  ) : (
                    falta.combustible && <span className="dato-sec">Combustible sin vale</span>
                  )}
                  {t.cruzadoEfectivo ? (
                    <span className="dato-sec codigo">Efect. {t.valeEfectivo ?? "cruzado a mano"}</span>
                  ) : (
                    falta.efectivo && <span className="dato-sec">Efectivo sin vale</span>
                  )}
                  {!t.cruzadoCombustible && !t.cruzadoEfectivo && !falta.combustible && !falta.efectivo && "-"}
                </td>
                <td>{campoCruce(t, "galones")}</td>
                <td>{campoCruce(t, "precioGalon", resumen?.precioGalonBomba)}</td>
                <td>{campoCruce(t, "descuento", t.galones !== null ? Math.round(t.galones * t.descuentoGalon) : undefined)}</td>
                <td className="num">
                  {t.combustibleEntregado === null && t.efectivoEntregado === null && "-"}
                  {t.combustibleEntregado !== null && <span>Comb. {moneda(t.combustibleEntregado)}</span>}
                  {t.efectivoEntregado !== null && <span className="dato-sec">Efect. {moneda(t.efectivoEntregado)}</span>}
                </td>
                <td className="num">
                  {t.combustibleEntregado === null && t.efectivoEntregado === null ? "-" : <span className={conDiferencia ? "texto-vencido" : "dato-sec"}>{moneda(d)}</span>}
                </td>
                <td>
                  {t.bombaId ? (
                    <CampoFecha valor={t.fechaPago} alGuardar={(f) => guardar(() => apiCuadro.actualizarTramo(t.id, { fechaPago: f }))} />
                  ) : (
                    <span className="dato-sec">No es de la bomba</span>
                  )}
                </td>
                <td className="num">
                  {conDiferencia && (
                    <button className="boton-suave" onClick={() => setCorrigiendo(corrigiendo === t.id ? null : t.id)}>
                      {corrigiendo === t.id ? "Cerrar" : "Corregir"}
                    </button>
                  )}
                </td>
              </tr>
              {corrigiendo === t.id && (
                <tr>
                  <td colSpan={12}>
                    <CorregirTramo
                      t={t}
                      guardar={async (accion) => {
                        await guardar(accion);
                        setCorrigiendo(null);
                      }}
                    />
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="detalle-tanqueo-pie">
        <div>
          <span className="dato-sec">Bomba</span> <Bomba nombre={g.bomba} />
        </div>
        {g.tanqueoId && (
          <>
            <label>
              <span className="dato-sec">Factura de la bomba</span>
              <input
                key={`f-${g.facturaBomba}`}
                defaultValue={g.facturaBomba ?? ""}
                placeholder="AE5044797"
                style={{ width: "9rem" }}
                onBlur={(e) =>
                  e.target.value.trim() !== (g.facturaBomba ?? "") &&
                  guardar(() => apiCuadro.actualizarTanqueo(g.tanqueoId!, { facturaBomba: e.target.value }))
                }
              />
            </label>
            <label>
              <span className="dato-sec">Fecha factura</span>
              <CampoFecha valor={g.fechaFacturaBomba} alGuardar={(f) => guardar(() => apiCuadro.actualizarTanqueo(g.tanqueoId!, { fechaFacturaBomba: f }))} />
            </label>
          </>
        )}
        {g.bombaId &&
          (g.cruzadoManual ? (
            <button
              className="btn-link"
              onClick={() =>
                window.confirm("¿Quitar el cruce a mano? El tanqueo vuelve a depender de sus vales.") &&
                guardar(async () => {
                  let lista: AnticipoBomba[] = [];
                  for (const t of g.tramos) lista = await apiCuadro.actualizarTramo(t.id, { cruzadoManual: null });
                  return lista;
                })
              }
            >
              Quitar cruce a mano ({fechaCorta(g.ida.cruzadoManual)})
            </button>
          ) : (
            g.cruce !== "CRUZADO" && (
              <button
                className="btn-secondary"
                onClick={() =>
                  window.confirm(`¿Marcar este tanqueo como cruzado con la bomba (${g.tramos.length > 1 ? "la ida y la vuelta" : "el tramo"})?`) &&
                  guardar(async () => {
                    let lista: AnticipoBomba[] = [];
                    for (const t of g.tramos) lista = await apiCuadro.actualizarTramo(t.id, { cruzadoManual: hoyColombia() });
                    return lista;
                  })
                }
              >
                Marcar cruzado
              </button>
            )
          ))}
        {g.vuelta && g.tanqueoId && (
          <button
            className="btn-link"
            onClick={() => window.confirm("¿Separar la vuelta? Queda como un tanqueo aparte.") && guardar(() => apiCuadro.separarVuelta(g.tanqueoId!))}
          >
            Separar la vuelta
          </button>
        )}
      </div>

      {posibles.length > 0 && (
        <div className="alert warning" style={{ marginTop: "0.5rem" }}>
          <strong>Posible vuelta:</strong> el mismo dia {placaConGuion(g.placa)} tiene otro(s) tanqueo(s) sin juntar.
          {posibles.map((p) => (
            <div key={p.clave} className="linea-posible">
              <Bomba nombre={p.bomba} /> {p.ida.empresa ?? "-"} {p.ida.fechaViaje ? `(viaje del ${fechaCorta(p.ida.fechaViaje)})` : ""} · {moneda(p.total)}
              <button className="btn-link" onClick={() => guardar(() => apiCuadro.juntarTanqueos(g.tanqueoId!, p.tanqueoId!))}>
                Juntar: este es la vuelta
              </button>
              <button className="btn-link" onClick={() => guardar(() => apiCuadro.juntarTanqueos(p.tanqueoId!, g.tanqueoId!))}>
                Juntar: este es la ida
              </button>
            </div>
          ))}
        </div>
      )}

      {abonosDeEstos.length > 0 && (
        <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
          Abonos a la bomba en estos viajes:{" "}
          {abonosDeEstos.map((a, i) => (
            <span key={i}>
              {i > 0 && " · "}
              {a.socio} {fechaCorta(a.fecha)} {moneda(a.valor)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Corregir un tramo cuyo cruce con la bomba no coincide: aceptar lo que cobro
 * la bomba, o escribir a mano el efectivo y el combustible acordados. En los
 * dos casos la diferencia queda resuelta.
 */
function CorregirTramo({ t, guardar }: { t: AnticipoBomba; guardar: (accion: () => Promise<AnticipoBomba[]>) => Promise<void> }) {
  const [efectivo, setEfectivo] = useState(String(t.efectivo));
  const [combustible, setCombustible] = useState(String(t.combustible));
  const [guardando, setGuardando] = useState(false);
  const enviar = async (datos: Record<string, unknown>) => {
    setGuardando(true);
    await guardar(() => apiCuadro.actualizarTramo(t.id, datos));
    setGuardando(false);
  };
  return (
    <div className="detalle-tanqueo">
      <div className="dato-sec" style={{ marginBottom: "0.4rem" }}>
        Lo registrado no coincide con lo que cobro la bomba
        {t.combustibleEntregado !== null && ` (combustible: registrado ${moneda(t.combustibleEntregado)}, bomba ${moneda(t.combustible)})`}
        {t.efectivoEntregado !== null && ` (efectivo: registrado ${moneda(t.efectivoEntregado)}, bomba ${moneda(t.efectivo)})`}.
      </div>
      <div className="detalle-tanqueo-pie" style={{ marginTop: 0 }}>
        <button className="btn-primary" disabled={guardando} onClick={() => enviar({ aceptarBomba: true })}>
          Aceptar lo de la bomba
        </button>
        <label>
          <span className="dato-sec">Efectivo</span>
          <input type="number" min={0} value={efectivo} onChange={(e) => setEfectivo(e.target.value)} />
        </label>
        <label>
          <span className="dato-sec">Combustible</span>
          <input type="number" min={0} value={combustible} onChange={(e) => setCombustible(e.target.value)} />
        </label>
        <button
          className="btn-secondary"
          disabled={guardando || efectivo.trim() === "" || combustible.trim() === ""}
          onClick={() => enviar({ efectivo: Number(efectivo), combustible: Number(combustible), aceptarBomba: true })}
        >
          Guardar estos valores (quedan como los acordados)
        </button>
      </div>
    </div>
  );
}

/** Abonos del socio: la lista y el boton para registrar uno nuevo. */
function VentanaAbonos({ abonos, alCerrar, alCambiar }: { abonos: AbonoSocio[]; alCerrar: () => void; alCambiar: (lista: AbonoSocio[]) => void }) {
  const [nuevo, setNuevo] = useState(false);
  if (nuevo) {
    return (
      <VentanaAbono
        alCerrar={() => setNuevo(false)}
        alGuardar={(lista) => {
          setNuevo(false);
          alCambiar(lista);
        }}
      />
    );
  }
  return (
    <Modal
      ancho="pantalla"
      titulo="Abonos a la bomba"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cerrar
          </button>
          <button className="btn-primary" onClick={() => setNuevo(true)}>
            Registrar abono bomba
          </button>
        </>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.6rem" }}>
        Lo que el socio (el Zorro) le paga directamente a la bomba por algunos viajes. Solo se descuenta de la deuda con la bomba
        cuando se cruza: al usarlo en el pago a la bomba o marcandolo aqui como cruzado.
      </div>
      {abonos.length === 0 ? (
        <div className="alert info">Aun no hay abonos a la bomba.</div>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Socio</th>
              <th className="num">Abonado</th>
              <th>Viajes</th>
              <th>Nota</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {abonos.map((a) => (
              <tr key={a.id}>
                <td>{fechaCorta(a.fecha)}</td>
                <td>{a.socio}</td>
                <td className="num">
                  <strong>{moneda(a.valor)}</strong>
                </td>
                <td>
                  {a.viajes.map((v) => (
                    <span key={v.cuadroViajeId} className="dato-sec">
                      {v.remesa ? `Remesa ${v.remesa} · ` : ""}
                      {placaConGuion(v.placa ?? "")} · {v.empresa ?? "-"} {v.fecha ? `(${fechaCorta(v.fecha)})` : ""} · {moneda(v.valor)}
                    </span>
                  ))}
                </td>
                <td>{a.nota ?? "-"}</td>
                <td>
                  <EstadoCruceAbono abono={a} alCambiar={alCambiar} />
                </td>
                <td className="num">
                  <button
                    className="btn-link"
                    onClick={async () => {
                      if (!window.confirm(`¿Borrar el abono de ${a.socio} por ${moneda(a.valor)}?`)) return;
                      alCambiar(await apiCuadro.borrarAbono(a.id));
                    }}
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

/**
 * Estado del abono: cruzado (con su fecha) o por cruzar, con el boton para
 * cambiarlo a mano. Los usados en un pago a la bomba quedan cruzados con el pago.
 */
function EstadoCruceAbono({ abono, alCambiar }: { abono: AbonoSocio; alCambiar: (lista: AbonoSocio[]) => void }) {
  const [fecha, setFecha] = useState(hoyColombia());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  /** Lo marca cruzado (desde la fecha elegida) o lo devuelve a por cruzar. */
  async function cambiar(cruzado: boolean) {
    setGuardando(true);
    setError(null);
    try {
      alCambiar(await apiCuadro.cruzarAbono(abono.id, cruzado, cruzado ? fecha : undefined));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo cambiar.");
    } finally {
      setGuardando(false);
    }
  }
  if (abono.pagoId) return <Pastilla tono="ok">{`Cruzado en el pago${abono.cruzadoFecha ? ` del ${fechaCorta(abono.cruzadoFecha)}` : ""}`}</Pastilla>;
  return (
    <div className="estado-abono">
      {abono.cruzado ? (
        <>
          <Pastilla tono="ok">{`Cruzado ${abono.cruzadoFecha ? fechaCorta(abono.cruzadoFecha) : ""}`}</Pastilla>
          <button className="btn-link" disabled={guardando} onClick={() => cambiar(false)}>
            Pasar a por cruzar
          </button>
        </>
      ) : (
        <>
          <Pastilla tono="aviso">Por cruzar</Pastilla>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha del cruce" />
          <button className="btn-link" disabled={guardando || !fecha} onClick={() => cambiar(true)}>
            Marcar cruzado
          </button>
        </>
      )}
      {error && <span className="texto-vencido">{error}</span>}
    </div>
  );
}

/**
 * Cupo de credito con la bomba, precio por galon sugerido y la matriz del
 * descuento por galon de cada bomba (solo Chuzaca lo tiene), que rige desde una
 * fecha: los anticipos de antes y los ya cruzados no cambian.
 */
function VentanaCupo({ resumen, alCerrar, alGuardar }: { resumen: ResumenBomba; alCerrar: () => void; alGuardar: () => void }) {
  const [f, setF] = useState({
    cupoBomba: String(resumen.cupoBomba),
    precioGalonBomba: String(resumen.precioGalonBomba),
  });
  /** Desde que fecha rige el descuento: se ve el de ese dia. */
  const [desde, setDesde] = useState(hoyColombia());
  const descuentos = useDatos(() => apiCuadro.descuentosGalon(desde), [desde]);
  /** Lo escrito por bomba (vacio = sin cambio). */
  const [escritos, setEscritos] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await apiCuadro.guardarParametrosBomba({
        cupoBomba: Number(f.cupoBomba),
        precioGalonBomba: Number(f.precioGalonBomba),
      });
      const cambios = (descuentos.datos ?? [])
        .filter((d) => escritos[d.bombaId] !== undefined && escritos[d.bombaId].trim() !== "")
        .map((d) => ({ bombaId: d.bombaId, descuentoGalon: Number(escritos[d.bombaId]) }));
      if (cambios.length) await apiCuadro.guardarDescuentosGalon(desde, cambios);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }
  return (
    <Modal
      titulo="Cupo y precios de la bomba"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Cupo de credito con la bomba</label>
          <input type="number" min={0} value={f.cupoBomba} onChange={(e) => setF({ ...f, cupoBomba: e.target.value })} />
          <span className="dato-sec">{moneda(Number(f.cupoBomba) || 0)}</span>
        </div>
        <div>
          <label>Precio por galon sugerido</label>
          <input type="number" min={0} value={f.precioGalonBomba} onChange={(e) => setF({ ...f, precioGalonBomba: e.target.value })} />
        </div>
      </div>

      <h4>Descuento por galon de cada bomba</h4>
      <div className="campos-cuadro">
        <div>
          <label>Los cambios rigen desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => {
              if (!e.target.value) return;
              setDesde(e.target.value);
              setEscritos({});
            }}
          />
        </div>
      </div>
      {descuentos.cargando && !descuentos.datos && <Cargando que="los descuentos" />}
      {descuentos.error && <div className="alert danger">{descuentos.error}</div>}
      {descuentos.datos && (
        <table className="tabla tabla-compacta" style={{ maxWidth: 560 }}>
          <thead>
            <tr>
              <th>Bomba</th>
              <th className="num">Descuento por galon el {fechaCorta(desde)}</th>
              <th>Nuevo</th>
            </tr>
          </thead>
          <tbody>
            {descuentos.datos.map((d) => (
              <tr key={d.bombaId}>
                <td>
                  {d.bomba}
                  {d.ciudad && <span className="dato-sec">{d.ciudad}</span>}
                </td>
                <td className="num">{d.descuentoGalon ? moneda(d.descuentoGalon) : "-"}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    aria-label={`Descuento por galon de ${d.bomba}`}
                    placeholder="Sin cambio"
                    value={escritos[d.bombaId] ?? ""}
                    onChange={(e) => setEscritos({ ...escritos, [d.bombaId]: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="dato-sec" style={{ marginTop: "0.6rem" }}>
        Solo Chuzaca lleva descuento (en las demas, 0). En el cruce se sugiere combustible = galones x precio - galones x descuento
        de su bomba, vigente en la fecha del anticipo. El nuevo valor rige para los anticipos desde la fecha elegida; los
        anteriores y los ya cruzados conservan su descuento.
      </div>
    </Modal>
  );
}

/** Una linea del abono: viaje y valor. */
interface LineaAbono {
  cuadroViajeId: number | null;
  valor: string;
}

/**
 * Abono del socio directamente a la bomba: quien, cuando y cuanto a cada viaje
 * (los que se cargaron con el). El total es la suma de los viajes.
 */
function VentanaAbono({ alCerrar, alGuardar }: { alCerrar: () => void; alGuardar: (abonos: AbonoSocio[]) => void }) {
  const viajes = useDatos(() => apiCuadro.listar(), []);
  const [socio, setSocio] = useState("EL ZORRO");
  const [fecha, setFecha] = useState(hoyColombia());
  const [nota, setNota] = useState("");
  const [lineas, setLineas] = useState<LineaAbono[]>([{ cuadroViajeId: null, valor: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const opciones = (viajes.datos ?? []).filter((v) => !v.anulado);
  const total = lineas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const completas = lineas.filter((l) => l.cuadroViajeId && Number(l.valor) > 0);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      alGuardar(
        await apiCuadro.registrarAbono({
          socio,
          fecha,
          nota,
          viajes: completas.map((l) => ({ cuadroViajeId: l.cuadroViajeId!, valor: Number(l.valor) })),
        })
      );
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }
  const cambiar = (i: number, c: Partial<LineaAbono>) => setLineas(lineas.map((l, j) => (j === i ? { ...l, ...c } : l)));

  return (
    <Modal
      titulo="Abono del socio a la bomba"
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <span className="dato-sec" style={{ marginRight: "auto" }}>
            Total abonado: <strong>{moneda(total)}</strong>
          </span>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={guardando || !socio.trim() || !fecha || completas.length === 0}>
            {guardando ? "Guardando..." : "Guardar abono"}
          </button>
        </>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.6rem" }}>
        El socio le paga directamente a la bomba los anticipos de algunos viajes. Al registrarlo queda por cruzar: no se
        descuenta de la deuda con la bomba hasta que se cruce (en el pago a la bomba o marcandolo como cruzado).
      </div>
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Socio</label>
          <input value={socio} onChange={(e) => setSocio(e.target.value.toUpperCase())} />
        </div>
        <div>
          <label>Fecha del abono</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label>Nota (opcional)</label>
          <input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} />
        </div>
      </div>
      <h4 style={{ margin: "1rem 0 0.4rem" }}>Viajes a los que corresponde</h4>
      {viajes.cargando && !viajes.datos && <Cargando que="los viajes" />}
      {lineas.map((l, i) => (
        <div key={i} className="linea-abono">
          <div style={{ flex: 1 }}>
            <ComboBuscable
              opciones={opciones}
              valor={l.cuadroViajeId}
              alCambiar={(id) => cambiar(i, { cuadroViajeId: id })}
              obtenerId={(v) => v.id}
              obtenerEtiqueta={(v) =>
                `${v.remesa ? `Remesa ${v.remesa} · ` : ""}${placaConGuion(v.placa)} · ${fechaCorta(v.fecha)} · ${v.empresa}${
                  v.manifiesto ? ` · Manif. ${v.manifiesto}` : ""
                }`
              }
              placeholder="Busca por remesa, placa, fecha o empresa..."
            />
          </div>
          <input type="number" min={0} placeholder="Valor" style={{ width: "10rem" }} value={l.valor} onChange={(e) => cambiar(i, { valor: e.target.value })} />
          <button className="btn-link" onClick={() => setLineas(lineas.length > 1 ? lineas.filter((_, j) => j !== i) : [{ cuadroViajeId: null, valor: "" }])}>
            Quitar
          </button>
        </div>
      ))}
      <button className="btn-link" onClick={() => setLineas([...lineas, { cuadroViajeId: null, valor: "" }])}>
        + Agregar otro viaje
      </button>
    </Modal>
  );
}
