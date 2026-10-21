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
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiCuadro, moneda } from "../../api/cliente";
import type { AbonoSocio, AnticipoBomba, ResumenBomba } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import ComboBuscable from "../../componentes/ComboBuscable";
import Modal from "../../componentes/Modal";
import Indicador from "../../componentes/Indicador";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla, TonoPastilla } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "./estadosCuadro";
import { deInput, enInput, placaConGuion } from "./facturacion";
import { agruparPorTanqueo, coloresBombas, DIFERENCIA_MINIMA, diferenciaTramo, posiblesVueltas } from "./tanqueos";
import type { EstadoCruce, Tanqueo } from "./tanqueos";
import ImportarAnticipos from "./ImportarAnticipos";
import VentanaCruceBomba from "./VentanaCruceBomba";
import AnticiposEmpresas from "../seguimiento/AnticiposEmpresas";

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
type Ventana = "cruce" | "abonos" | "empresas" | "importar" | "cupo" | null;

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

  // ?anticipo=<id del cuadro>: abre los anticipos de empresas en ese viaje.
  useEffect(() => {
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
          <Indicador dinero titulo="Abonado por el socio" valor={moneda(r.abonadoSocio)} detalle={`${abonos.length} abono(s)`} />
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
        <button className="boton-barra" onClick={() => setVentana("empresas")}>
          Anticipos del Zorro
        </button>
        <button className="boton-barra" style={{ marginLeft: "auto" }} onClick={() => setVentana("importar")}>
          Importar Excel de anticipos
        </button>
        <button className="boton-barra" onClick={() => setVentana("cupo")}>
          Cupo y precios de la bomba
        </button>
      </div>
      <div className="section-desc" style={{ margin: "0.2rem 0 0.6rem" }}>
        Un tanqueo por fila (la ida y su vuelta). Clic en una fila para ver todo: los viajes, el cruce con la bomba, la
        factura y el pago. En verde, los ya cruzados con la relacion de la bomba. Los anticipos se registran en cada viaje
        del Cuadro pagos.
      </div>
      <div className="panel">
        <TablaDatos
          filas={tanqueos}
          columnas={columnas}
          columnasFijas={2}
          clave={(g) => g.clave}
          pestanas={pestanas}
          nombreArchivo="anticipos"
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
      </div>

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
      disabled={!!t.vale}
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
            <th>Vale de la bomba</th>
            <th>Galones</th>
            <th>Precio galon</th>
            <th>Descuento ($)</th>
            <th className="num">Registrado antes</th>
            <th className="num">Diferencia</th>
            <th>Pago a la bomba</th>
          </tr>
        </thead>
        <tbody>
          {g.tramos.map((t) => {
            const d = diferenciaTramo(t);
            return (
              <tr key={t.id}>
                <td>
                  <Pastilla tono={t.tramo === "VUELTA" ? "info" : "neutro"}>{t.tramo === "VUELTA" ? "Vuelta" : "Ida"}</Pastilla>
                </td>
                <td>
                  <Viaje t={t} />
                </td>
                <td className="num">{moneda(t.efectivo)}</td>
                <td className="num">
                  <strong>{moneda(t.combustible)}</strong>
                </td>
                <td>{t.vale ? <span className="codigo">{t.vale}</span> : <span className="dato-sec">{t.combustible > 0 ? "Sin vale" : "-"}</span>}</td>
                <td>{campoCruce(t, "galones")}</td>
                <td>{campoCruce(t, "precioGalon", resumen?.precioGalonBomba)}</td>
                <td>{campoCruce(t, "descuento", t.galones !== null && resumen ? Math.round(t.galones * resumen.descuentoGalonBomba) : undefined)}</td>
                <td className="num">{t.combustibleEntregado === null ? "-" : moneda(t.combustibleEntregado)}</td>
                <td className="num">
                  {t.combustibleEntregado === null ? "-" : <span className={Math.abs(d) >= DIFERENCIA_MINIMA ? "texto-vencido" : "dato-sec"}>{moneda(d)}</span>}
                </td>
                <td>
                  {t.bombaId ? (
                    <input type="date" value={t.fechaPago ?? ""} onChange={(e) => guardar(() => apiCuadro.actualizarTramo(t.id, { fechaPago: e.target.value }))} />
                  ) : (
                    <span className="dato-sec">No es de la bomba</span>
                  )}
                </td>
              </tr>
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
              <input
                type="date"
                value={g.fechaFacturaBomba ?? ""}
                onChange={(e) => guardar(() => apiCuadro.actualizarTanqueo(g.tanqueoId!, { fechaFacturaBomba: e.target.value }))}
              />
            </label>
          </>
        )}
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
      ancho="wide"
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
        Lo que el socio (el Zorro) le paga directamente a la bomba por algunos viajes. Se descuenta de la deuda con la bomba.
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
                      {placaConGuion(v.placa ?? "")} · {v.empresa ?? "-"} {v.fecha ? `(${fechaCorta(v.fecha)})` : ""} · {moneda(v.valor)}
                    </span>
                  ))}
                </td>
                <td>{a.nota ?? "-"}</td>
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

/** Cupo de credito con la bomba y precio / descuento por galon sugeridos para el cruce. */
function VentanaCupo({ resumen, alCerrar, alGuardar }: { resumen: ResumenBomba; alCerrar: () => void; alGuardar: () => void }) {
  const [f, setF] = useState({
    cupoBomba: String(resumen.cupoBomba),
    precioGalonBomba: String(resumen.precioGalonBomba),
    descuentoGalonBomba: String(resumen.descuentoGalonBomba),
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await apiCuadro.guardarParametrosBomba({
        cupoBomba: Number(f.cupoBomba),
        precioGalonBomba: Number(f.precioGalonBomba),
        descuentoGalonBomba: Number(f.descuentoGalonBomba),
      });
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
        <div>
          <label>Descuento por galon sugerido</label>
          <input type="number" min={0} value={f.descuentoGalonBomba} onChange={(e) => setF({ ...f, descuentoGalonBomba: e.target.value })} />
          <span className="dato-sec">Por la sociedad. En el cruce se sugiere galones x este valor, en pesos.</span>
        </div>
      </div>
      <div className="dato-sec" style={{ marginTop: "0.6rem" }}>
        Se sugieren en el cruce de los tramos que no tienen uno propio: combustible = galones x precio - descuento.
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
        El socio le paga directamente a la bomba los anticipos de algunos viajes. Lo abonado se descuenta de la deuda con
        la bomba al cruzar con ella.
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
                `${placaConGuion(v.placa)} · ${fechaCorta(v.fecha)} · ${v.empresa}${v.manifiesto ? ` · ${v.manifiesto}` : ""}`
              }
              placeholder="Busca por placa, fecha o empresa..."
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
