/**
 * Cruce con la bomba (quincenal). La bomba manda una relacion de vales por
 * cada factura (AE5044797) con los tanqueos de ese periodo; aqui se compara
 * con lo registrado en el TMS y se cruza.
 *
 * - Lista de facturas ya cruzadas: total, vales, fecha de pago (al pagarle a
 *   la bomba) y borrar (deshace el cruce).
 * - Nueva relacion: desde el PDF o el Excel de la bomba (se leen los vales y
 *   el sistema propone el tanqueo de cada uno) o armada a mano (se eligen los
 *   tanqueos de un periodo). Se revisa vale por vale y se guarda.
 * - Pago de la quincena: se pagan varias facturas de una vez (6 o 7) y se
 *   descuentan los abonos de los socios; "Exportar Excel" saca el reporte
 *   VALES (como docs/Vales Coesco EJEMPLO.pdf) y "Registrar pago" deja las
 *   facturas pagadas y los abonos usados.
 * - La bomba da combustible y efectivo: cada vale es de uno de los dos y se
 *   compara con ese valor del tanqueo. Los que no coinciden tienen "Corregir":
 *   cambiar el valor o el tipo del vale (si se leyo mal) o lo registrado en
 *   el TMS (si se registro mal).
 */
import { Fragment, useMemo, useState } from "react";
import { apiCuadro, moneda } from "../../api/cliente";
import type { AbonoSocio, AnticipoBomba, EstadoVale, PagoBomba, RelacionBomba, TipoVale, ValeBomba, ValePropuesto } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import CampoFecha from "../../componentes/CampoFecha";
import Modal from "../../componentes/Modal";
import { Pastilla } from "../../componentes/TablaDatos";
import type { TonoPastilla } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "./estadosCuadro";
import { placaConGuion } from "./facturacion";
import { leerPdf, valesDesdeFilas, valesDesdePdf } from "./relacionBomba";
import { descargarVales, filasVales } from "./excelVales";
import { leerHojas } from "../seguimiento/cargaExcel";

const ESTADO_VALE: Record<EstadoVale, { etiqueta: string; tono: TonoPastilla }> = {
  COINCIDE: { etiqueta: "Coincide", tono: "ok" },
  DIFERENCIA: { etiqueta: "Valor distinto", tono: "aviso" },
  SIN_TANQUEO: { etiqueta: "No esta en el TMS", tono: "error" },
};

/** Diferencia de valor que se toma como la misma (redondeos de la bomba). */
const TOLERANCIA = 1000;

/** Lo que el tramo tiene registrado del tipo del vale. */
const montoDe = (t: AnticipoBomba, tipo: TipoVale) => (tipo === "EFECTIVO" ? t.efectivo : t.combustible);

/** El tramo aun puede tomar un vale de ese tipo (tiene ese valor y no tiene vale). */
const libreParaTipo = (t: AnticipoBomba, tipo: TipoVale) =>
  t.bombaId !== null && montoDe(t, tipo) > 0 && !(tipo === "EFECTIVO" ? t.cruzadoEfectivo : t.cruzadoCombustible);

/** Estado de un vale frente al tramo elegido. */
const estadoDe = (valor: number, t: AnticipoBomba | undefined, tipo: TipoVale): EstadoVale =>
  !t ? "SIN_TANQUEO" : Math.abs(montoDe(t, tipo) - valor) <= TOLERANCIA ? "COINCIDE" : "DIFERENCIA";

/** Texto de un tramo en la lista para elegir el de un vale. */
const etiquetaTramo = (t: AnticipoBomba, tipo: TipoVale) =>
  `${fechaCorta(t.fecha)} · ${t.bomba ?? "-"} · ${t.tramo === "VUELTA" ? "vuelta" : "ida"} · ${t.empresa ?? "vuelta pendiente"} · ${tipo === "EFECTIVO" ? "efectivo" : "combustible"} ${moneda(montoDe(t, tipo))}`;

/** Ventana del cruce: facturas cruzadas y nueva relacion. */
export default function VentanaCruceBomba({
  tramos,
  alCerrar,
  alCambiar,
}: {
  tramos: AnticipoBomba[];
  alCerrar: () => void;
  alCambiar: () => void;
}) {
  const relaciones = useDatos(() => apiCuadro.relacionesBomba(), []);
  // Abonos del socio y pagos ya hechos (para el pago de la quincena).
  const extra = useDatos(() => Promise.all([apiCuadro.abonosSocio(), apiCuadro.pagosBomba()]), []);
  const [lista, setLista] = useState<RelacionBomba[] | null>(null);
  const [pagos, setPagos] = useState<PagoBomba[] | null>(null);
  const [nueva, setNueva] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const datos = lista ?? relaciones.datos;
  const abonos = extra.datos?.[0] ?? [];
  const listaPagos = pagos ?? extra.datos?.[1] ?? [];

  /** Registra o deshace un pago y vuelve a pedir las facturas (cambian sus fechas de pago). */
  async function cambiarPagos(accion: () => Promise<PagoBomba[]>) {
    setError(null);
    try {
      setPagos(await accion());
      setLista(await apiCuadro.relacionesBomba());
      extra.recargar();
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar el pago.");
    }
  }

  /** Descarga el Excel VALES de unas facturas y unos abonos. */
  async function exportar(rels: RelacionBomba[], abs: AbonoSocio[], fechaPago: string | null, numero: number | null) {
    const filas = filasVales(rels, tramos, fechaPago);
    await descargarVales(
      {
        numero,
        fecha: hoyColombia(),
        estaciones: ["COESCO", ...[...new Set(filas.map((f) => f.eds).filter(Boolean))].sort()],
        filas,
        abonos: abs.map((a) => ({ etiqueta: `${a.socio} ${fechaCorta(a.fecha)}`, valor: a.valor })),
      },
      `vales-bomba-${fechaPago ?? hoyColombia()}`
    );
  }

  async function cambiar(accion: () => Promise<RelacionBomba[]>) {
    setError(null);
    try {
      setLista(await accion());
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  if (nueva) {
    return (
      <NuevaRelacion
        tramos={tramos}
        alCorregirTms={alCambiar}
        alCerrar={() => setNueva(false)}
        alGuardar={(l) => {
          setLista(l);
          setNueva(false);
          alCambiar();
        }}
      />
    );
  }

  return (
    <Modal
      ancho="pantalla"
      titulo="Cruce con la bomba"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cerrar
          </button>
          <button className="btn-primary" onClick={() => setNueva(true)}>
            Cruzar una relacion de la bomba
          </button>
        </>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.6rem" }}>
        La bomba manda cada quincena la relacion de vales de su factura (los tanqueos de ese periodo). Al cruzarla, cada
        vale queda con su tanqueo, el combustible pasa a ser lo que cobra la bomba y el tanqueo se pinta de verde en el
        cuadro. Escribe cuando vence cada factura (avisa 5 dias antes en la campana) y, cuando se le pague a la bomba, la
        fecha de pago.
      </div>
      {error && <div className="alert danger">{error}</div>}
      {!datos && relaciones.cargando && <Cargando que="las facturas de la bomba" />}
      {relaciones.error && !datos && <ErrorCarga mensaje={relaciones.error} alReintentar={relaciones.recargar} />}
      {datos && datos.length === 0 && <div className="alert info">Aun no se ha cruzado ninguna relacion de la bomba.</div>}
      {datos && datos.length > 0 && (
        <table className="tabla">
          <thead>
            <tr>
              <th>Factura</th>
              <th>Fecha</th>
              <th className="num">Vales</th>
              <th className="num">Total</th>
              <th>Sin tanqueo</th>
              <th>Vence</th>
              <th>Fecha de pago a la bomba</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {datos.map((r) => {
              const sinTanqueo = r.vales.filter((v) => !v.tramoId).length;
              return (
                <tr key={r.id}>
                  <td>
                    <span className="principal codigo">{r.numero}</span>
                    {r.nota && <span className="dato-sec">{r.nota}</span>}
                  </td>
                  <td>{fechaCorta(r.fecha)}</td>
                  <td className="num">{r.vales.length}</td>
                  <td className="num">
                    <strong>{moneda(r.total)}</strong>
                  </td>
                  <td>{sinTanqueo ? <Pastilla tono="error">{sinTanqueo} vale(s)</Pastilla> : <Pastilla tono="ok">Todos</Pastilla>}</td>
                  <td>
                    <CampoFecha
                      className={!r.fechaPago && r.fechaVencimiento && r.fechaVencimiento < hoyColombia() ? "texto-vencido" : undefined}
                      valor={r.fechaVencimiento}
                      alGuardar={(f) => cambiar(() => apiCuadro.vencimientoRelacionBomba(r.id, f))}
                    />
                  </td>
                  <td>
                    {r.pagoId ? (
                      <span>
                        {fechaCorta(r.fechaPago)} <span className="dato-sec">Pago No. {r.pagoId}</span>
                      </span>
                    ) : (
                      <CampoFecha valor={r.fechaPago} alGuardar={(f) => cambiar(() => apiCuadro.pagarRelacionBomba(r.id, f))} />
                    )}
                  </td>
                  <td className="num">
                    <button
                      className="btn-link"
                      onClick={() =>
                        window.confirm(`¿Borrar la factura ${r.numero}? Sus tanqueos vuelven a quedar sin cruzar.`) &&
                        cambiar(() => apiCuadro.borrarRelacionBomba(r.id))
                      }
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {datos && datos.some((r) => !r.pagoId && !r.fechaPago) && (
        <PagoQuincena
          facturas={datos.filter((r) => !r.pagoId && !r.fechaPago)}
          abonos={abonos.filter((a) => !a.pagoId)}
          alExportar={(rels, abs, fecha) => exportar(rels, abs, fecha, null)}
          alRegistrar={(d) => cambiarPagos(() => apiCuadro.registrarPagoBomba(d))}
        />
      )}

      {listaPagos.length > 0 && datos && (
        <>
          <h4 style={{ margin: "1.2rem 0 0.4rem" }}>Pagos a la bomba</h4>
          <table className="tabla">
            <thead>
              <tr>
                <th>No.</th>
                <th>Fecha</th>
                <th>Facturas</th>
                <th className="num">Total facturas</th>
                <th className="num">Abonos de socios</th>
                <th className="num">Pagado</th>
                <th>Referencia</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listaPagos.map((p) => {
                const rels = datos.filter((r) => p.relaciones.includes(r.id));
                return (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{fechaCorta(p.fecha)}</td>
                    <td className="codigo">{rels.map((r) => r.numero).join(", ")}</td>
                    <td className="num">{moneda(p.totalFacturas)}</td>
                    <td className="num">{p.totalAbonos ? `- ${moneda(p.totalAbonos)}` : "-"}</td>
                    <td className="num">
                      <strong>{moneda(p.valorPagado)}</strong>
                    </td>
                    <td>{p.referencia ?? "-"}</td>
                    <td className="num">
                      <button
                        className="boton-suave"
                        onClick={() => exportar(rels, abonos.filter((a) => p.abonos.includes(a.id)), p.fecha, p.id)}
                      >
                        Exportar Excel
                      </button>{" "}
                      <button
                        className="btn-link"
                        onClick={() =>
                          window.confirm(`¿Deshacer el pago No. ${p.id}? Sus facturas vuelven a quedar sin pagar y los abonos libres.`) &&
                          cambiarPagos(() => apiCuadro.borrarPagoBomba(p.id))
                        }
                      >
                        Deshacer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}

/**
 * Pago de la quincena: las facturas sin pagar (se marcan las que se pagan,
 * casi siempre todas) menos los abonos de los socios que aun no se han
 * descontado. Exportar saca el Excel VALES; Registrar deja todo pagado.
 */
function PagoQuincena({
  facturas,
  abonos,
  alExportar,
  alRegistrar,
}: {
  facturas: RelacionBomba[];
  abonos: AbonoSocio[];
  alExportar: (rels: RelacionBomba[], abs: AbonoSocio[], fecha: string) => Promise<void>;
  alRegistrar: (d: { relaciones: number[]; abonos: number[]; fecha: string; referencia: string }) => Promise<void>;
}) {
  const [marcadas, setMarcadas] = useState<Set<number>>(() => new Set(facturas.map((r) => r.id)));
  const [usados, setUsados] = useState<Set<number>>(() => new Set(abonos.map((a) => a.id)));
  const [fecha, setFecha] = useState(hoyColombia());
  const [referencia, setReferencia] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const alternar = (conjunto: Set<number>, poner: (s: Set<number>) => void, id: number) => {
    const n = new Set(conjunto);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    poner(n);
  };
  const rels = facturas.filter((r) => marcadas.has(r.id));
  const abs = abonos.filter((a) => usados.has(a.id));
  // Lo mismo que el Excel: total de las facturas menos los abonos (nunca negativo).
  const total = rels.reduce((s, x) => s + x.total, 0);
  const totalAbonos = abs.reduce((s, a) => s + a.valor, 0);
  const r = { total, totalAbonos, aPagar: Math.max(0, total - totalAbonos) };
  const accion = async (fn: () => Promise<void>) => {
    setTrabajando(true);
    await fn();
    setTrabajando(false);
  };

  return (
    <div className="detalle-tanqueo" style={{ marginTop: "1rem" }}>
      <h4 style={{ margin: "0 0 0.4rem" }}>Pago de la quincena</h4>
      <div className="dato-sec" style={{ marginBottom: "0.5rem" }}>
        Marca las facturas que se le pagan a la bomba y los abonos de los socios que se descuentan. Exporta el Excel para
        revisarlo y, cuando se haga la transferencia, registra el pago.
      </div>
      <div className="campos-cuadro" style={{ alignItems: "flex-start" }}>
        <div>
          <label>Facturas ({rels.length} de {facturas.length})</label>
          {facturas.map((x) => (
            <label key={x.id} className="check-linea" style={{ margin: "0.15rem 0" }}>
              <input type="checkbox" checked={marcadas.has(x.id)} onChange={() => alternar(marcadas, setMarcadas, x.id)} />
              <span className="codigo">{x.numero}</span> {fechaCorta(x.fecha)} · {moneda(x.total)}
            </label>
          ))}
        </div>
        <div>
          <label>Abonos de los socios</label>
          {abonos.length === 0 && <div className="dato-sec">No hay abonos sin descontar.</div>}
          {abonos.map((a) => (
            <label key={a.id} className="check-linea" style={{ margin: "0.15rem 0" }}>
              <input type="checkbox" checked={usados.has(a.id)} onChange={() => alternar(usados, setUsados, a.id)} />
              {a.socio} {fechaCorta(a.fecha)} · {moneda(a.valor)}
            </label>
          ))}
        </div>
        <div>
          <label>Fecha del pago</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <label style={{ marginTop: "0.4rem" }}>Referencia (opcional)</label>
          <input value={referencia} maxLength={80} onChange={(e) => setReferencia(e.target.value)} placeholder="CoescoLopez1raQuincSe" />
        </div>
      </div>
      <div className="barra-envio" style={{ marginTop: "0.6rem", marginBottom: 0 }}>
        <span>
          Facturas <strong>{moneda(r.total)}</strong> · abonos <strong>- {moneda(r.totalAbonos)}</strong> · a pagar{" "}
          <strong style={{ fontSize: "1.1em" }}>{moneda(r.aPagar)}</strong>
        </span>
        <button className="boton-barra" style={{ marginLeft: "auto" }} disabled={trabajando || rels.length === 0} onClick={() => accion(() => alExportar(rels, abs, fecha))}>
          Exportar Excel
        </button>
        <button
          className="btn-primary"
          disabled={trabajando || rels.length === 0 || !fecha}
          onClick={() =>
            window.confirm(`¿Registrar el pago a la bomba por ${moneda(r.aPagar)}? Las ${rels.length} facturas quedan pagadas el ${fechaCorta(fecha)}.`) &&
            accion(() => alRegistrar({ relaciones: rels.map((x) => x.id), abonos: abs.map((a) => a.id), fecha, referencia }))
          }
        >
          Registrar pago
        </button>
      </div>
    </div>
  );
}

/** Vale en revision: el propuesto y el tramo que se eligio. */
type ValeRevision = ValePropuesto;

/** Nueva relacion: leer el archivo (o armarla a mano), revisar vale por vale y guardar. */
function NuevaRelacion({
  tramos,
  alCorregirTms,
  alCerrar,
  alGuardar,
}: {
  tramos: AnticipoBomba[];
  /** Se corrigio un valor de un tanqueo en el TMS (para refrescar el cuadro). */
  alCorregirTms: () => void;
  alCerrar: () => void;
  alGuardar: (l: RelacionBomba[]) => void;
}) {
  // Copia local: al corregir un tanqueo en el TMS se actualiza aqui mismo.
  const [lista, setLista] = useState(tramos);
  /** Vale que se esta corrigiendo (indice). */
  const [corrigiendo, setCorrigiendo] = useState<number | null>(null);
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(hoyColombia());
  const [vence, setVence] = useState("");
  const [nota, setNota] = useState("");
  const [vales, setVales] = useState<ValeRevision[] | null>(null);
  const [aMano, setAMano] = useState(false);
  const [yaExiste, setYaExiste] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Pide al servidor el tanqueo de cada vale leido. */
  async function proponer(leidos: ValeBomba[], num: string) {
    const r = await apiCuadro.previaRelacionBomba(num, leidos);
    setVales(r.vales);
    setYaExiste(r.yaExiste);
  }

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setTrabajando(true);
    try {
      const r = /\.pdf$/i.test(archivo.name) ? valesDesdePdf(await leerPdf(archivo)) : valesDesdeFilas((await leerHojas(archivo))[0].filas);
      if (r.vales.length === 0) throw new Error("No se encontraron vales en el archivo.");
      if (r.numero) setNumero(r.numero);
      if (r.fecha) setFecha(r.fecha);
      await proponer(r.vales, r.numero ?? numero);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo leer el archivo.");
    } finally {
      setTrabajando(false);
    }
  }

  async function guardar() {
    if (!vales) return;
    setError(null);
    setTrabajando(true);
    try {
      alGuardar(
        await apiCuadro.guardarRelacionBomba({
          numero,
          fecha,
          fechaVencimiento: vence,
          nota,
          vales: vales.map(({ tipo, eds, vale, fecha: f, hora, placa, galones, valor, tramoId }) => ({ tipo, eds, vale, fecha: f, hora, placa, galones, valor, tramoId })),
        })
      );
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setTrabajando(false);
    }
  }

  // Tramos que pueden tomar algun vale (de combustible o de efectivo).
  const libres = useMemo(() => lista.filter((t) => libreParaTipo(t, "COMBUSTIBLE") || libreParaTipo(t, "EFECTIVO")), [lista]);
  const elegidos = new Set((vales ?? []).filter((v) => v.tramoId).map((v) => `${v.tramoId}|${v.tipo}`));
  const totalRelacion = (vales ?? []).reduce((s, v) => s + v.valor, 0);
  const totalTms = (vales ?? []).reduce((s, v) => s + (v.combustibleTramo ?? 0), 0);
  /** Cambia un vale (tramo, valor o tipo) y recalcula lo registrado y su estado. */
  const cambiarVale = (i: number, cambios: Partial<ValeRevision>) =>
    setVales((vs) =>
      (vs ?? []).map((v, j) => {
        if (j !== i) return v;
        const nuevo = { ...v, ...cambios };
        const t = lista.find((x) => x.id === nuevo.tramoId);
        return { ...nuevo, combustibleTramo: t ? montoDe(t, nuevo.tipo) : null, estado: estadoDe(nuevo.valor, t, nuevo.tipo) };
      })
    );

  /** Corrige en el TMS lo registrado en el tanqueo del vale (efectivo o combustible). */
  async function corregirTms(i: number, valor: number) {
    const v = vales?.[i];
    if (!v?.tramoId) return;
    setError(null);
    try {
      const nuevos = await apiCuadro.actualizarTramo(v.tramoId, { [v.tipo === "EFECTIVO" ? "efectivo" : "combustible"]: valor });
      setLista(nuevos);
      const t = nuevos.find((x) => x.id === v.tramoId);
      setVales((vs) => (vs ?? []).map((x) => {
        if (x.tramoId !== v.tramoId) return x;
        const tx = nuevos.find((n) => n.id === x.tramoId);
        return { ...x, combustibleTramo: tx ? montoDe(tx, x.tipo) : null, estado: estadoDe(x.valor, tx, x.tipo) };
      }));
      if (t) alCorregirTms();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo corregir el tanqueo.");
    }
  }

  return (
    <Modal
      ancho="pantalla"
      titulo="Cruzar una relacion de la bomba"
      alCerrar={alCerrar}
      pie={
        <>
          {vales && (
            <span className="dato-sec" style={{ marginRight: "auto" }}>
              Relacion <strong>{moneda(totalRelacion)}</strong> · registrado en el TMS <strong>{moneda(totalTms)}</strong>
              {totalRelacion !== totalTms && <span className="texto-vencido"> · diferencia {moneda(totalRelacion - totalTms)}</span>}
            </span>
          )}
          <button className="btn-secondary" onClick={alCerrar}>
            Volver
          </button>
          {vales && (
            <button className="btn-primary" onClick={guardar} disabled={trabajando || !numero.trim() || !fecha || vales.length === 0 || yaExiste}>
              {trabajando ? "Guardando..." : "Guardar el cruce"}
            </button>
          )}
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      {yaExiste && <div className="alert danger">La factura {numero} ya se cruzo. Borrala en la lista si quieres cargarla de nuevo.</div>}
      <div className="campos-cuadro">
        <div>
          <label>Factura de la bomba</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value.toUpperCase())} placeholder="AE5044797" />
        </div>
        <div>
          <label>Fecha de la factura</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label>Vence (para pagarla a tiempo)</label>
          <input type="date" value={vence} onChange={(e) => setVence(e.target.value)} />
        </div>
        <div>
          <label>Nota (opcional)</label>
          <input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Quincena 16-30 sep" />
        </div>
      </div>

      {!vales && !aMano && (
        <div className="barra-envio" style={{ marginTop: "0.8rem" }}>
          <label className="boton-barra" style={{ cursor: "pointer" }}>
            {trabajando ? "Leyendo..." : "Elegir la relacion (PDF o Excel)"}
            <input
              type="file"
              accept=".pdf,.xlsx"
              style={{ display: "none" }}
              disabled={trabajando}
              onChange={(e) => {
                leer(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button className="boton-barra" onClick={() => setAMano(true)}>
            Armarla a mano
          </button>
        </div>
      )}

      {aMano && !vales && (
        <ArmarAMano
          libres={libres}
          alListo={(vs) => {
            setAMano(false);
            setYaExiste(false);
            setVales(vs);
          }}
        />
      )}

      {vales && (
        <table className="tabla" style={{ marginTop: "0.8rem" }}>
          <thead>
            <tr>
              <th>Vale</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Placa</th>
              <th>EDS</th>
              <th className="num">Galones</th>
              <th className="num">Valor de la bomba</th>
              <th>Tanqueo del TMS</th>
              <th className="num">Registrado</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {vales.map((v, i) => {
              const opciones = lista.filter(
                (t) =>
                  t.placa?.replace(/[^A-Z0-9]/gi, "").toUpperCase() === v.placa &&
                  (t.id === v.tramoId || (libreParaTipo(t, v.tipo) && !elegidos.has(`${t.id}|${v.tipo}`)))
              );
              return (
                <Fragment key={i}>
                <tr className={v.estado === "COINCIDE" ? "fila-cruzada" : undefined}>
                  <td className="codigo">{v.vale ?? "-"}</td>
                  <td>
                    <Pastilla tono={v.tipo === "EFECTIVO" ? "turquesa" : "azul"}>{v.tipo === "EFECTIVO" ? "Efectivo" : "Combustible"}</Pastilla>
                  </td>
                  <td>
                    {fechaCorta(v.fecha)}
                    {v.hora && <span className="dato-sec">{v.hora}</span>}
                  </td>
                  <td>{placaConGuion(v.placa)}</td>
                  <td>{v.eds || "-"}</td>
                  <td className="num">{v.galones ?? "-"}</td>
                  <td className="num">
                    <strong>{moneda(v.valor)}</strong>
                  </td>
                  <td>
                    <select value={v.tramoId ?? ""} onChange={(e) => cambiarVale(i, { tramoId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Ninguno</option>
                      {opciones.map((t) => (
                        <option key={t.id} value={t.id}>
                          {etiquetaTramo(t, v.tipo)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">{v.combustibleTramo === null ? "-" : moneda(v.combustibleTramo)}</td>
                  <td>
                    <Pastilla tono={ESTADO_VALE[v.estado].tono}>{ESTADO_VALE[v.estado].etiqueta}</Pastilla>
                  </td>
                  <td className="num">
                    {v.estado !== "COINCIDE" && (
                      <button className="boton-suave" onClick={() => setCorrigiendo(corrigiendo === i ? null : i)}>
                        {corrigiendo === i ? "Cerrar" : "Corregir"}
                      </button>
                    )}
                  </td>
                </tr>
                {corrigiendo === i && (
                  <tr className="fila-detalle">
                    <td colSpan={11}>
                      <CorregirVale
                        vale={v}
                        alCambiarVale={(c) => cambiarVale(i, c)}
                        alCorregirTms={(valor) => corregirTms(i, valor)}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
      {vales && (
        <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
          Al guardar, cada tanqueo elegido queda cruzado: su combustible o su efectivo pasa a ser el valor de la bomba (lo
          registrado antes se guarda para ver la diferencia). Los que no coinciden tienen "Corregir". Los vales sin tanqueo
          quedan en la factura para reclamarlos o registrarlos.
        </div>
      )}
    </Modal>
  );
}

/** Relacion armada a mano: los tanqueos de un periodo, marcando los que trae la factura. */
function ArmarAMano({ libres, alListo }: { libres: AnticipoBomba[]; alListo: (vales: ValeRevision[]) => void }) {
  const hoy = hoyColombia();
  const [desde, setDesde] = useState(`${hoy.slice(0, 8)}${Number(hoy.slice(8)) > 15 ? "16" : "01"}`);
  const [hasta, setHasta] = useState(hoy);
  const [bomba, setBomba] = useState("");
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const bombas = [...new Set(libres.map((t) => t.bomba).filter((b): b is string => !!b))].sort();
  const enPeriodo = libres.filter((t) => t.fecha >= desde && t.fecha <= hasta && (!bomba || t.bomba === bomba)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  // Lo que dio la bomba: el combustible y el efectivo que aun no tienen vale.
  const deLaBomba = (t: AnticipoBomba) => (libreParaTipo(t, "COMBUSTIBLE") ? t.combustible : 0) + (libreParaTipo(t, "EFECTIVO") ? t.efectivo : 0);
  const total = enPeriodo.filter((t) => marcados.has(t.id)).reduce((s, t) => s + deLaBomba(t), 0);
  const alternar = (id: number) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div style={{ marginTop: "0.8rem" }}>
      <div className="campos-cuadro">
        <div>
          <label>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label>Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div>
          <label>Bomba</label>
          <select value={bomba} onChange={(e) => setBomba(e.target.value)}>
            <option value="">Todas</option>
            {bombas.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="barra-envio">
        <button className="boton-barra" onClick={() => setMarcados(new Set(enPeriodo.map((t) => t.id)))}>
          Marcar todos ({enPeriodo.length})
        </button>
        <button className="boton-barra" onClick={() => setMarcados(new Set())}>
          Ninguno
        </button>
        <span className="dato-sec" style={{ marginLeft: "auto" }}>
          Marcados: <strong>{moneda(total)}</strong> (comparalo con el total de la factura)
        </span>
        <button
          className="btn-primary"
          disabled={marcados.size === 0}
          onClick={() =>
            alListo(
              enPeriodo
                .filter((t) => marcados.has(t.id))
                .flatMap((t) =>
                  (["COMBUSTIBLE", "EFECTIVO"] as const)
                    .filter((tipo) => libreParaTipo(t, tipo))
                    .map((tipo) => ({
                      tipo,
                      eds: t.bomba ?? "",
                      vale: null,
                      fecha: t.fecha,
                      hora: null,
                      placa: (t.placa ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase(),
                      galones: tipo === "EFECTIVO" ? null : t.galones,
                      valor: montoDe(t, tipo),
                      tramoId: t.id,
                      estado: "COINCIDE" as const,
                      combustibleTramo: montoDe(t, tipo),
                    }))
                )
            )
          }
        >
          Usar los marcados
        </button>
      </div>
      <table className="tabla">
        <thead>
          <tr>
            <th />
            <th>Fecha</th>
            <th>Placa</th>
            <th>Bomba</th>
            <th>Viaje</th>
            <th className="num">Combustible</th>
          </tr>
        </thead>
        <tbody>
          {enPeriodo.map((t) => (
            <tr key={t.id} className="fila-clic" onClick={() => alternar(t.id)}>
              <td>
                <input type="checkbox" checked={marcados.has(t.id)} readOnly />
              </td>
              <td>{fechaCorta(t.fecha)}</td>
              <td>{placaConGuion(t.placa ?? "")}</td>
              <td>{t.bomba}</td>
              <td>
                {t.empresa ?? "Vuelta pendiente"} <span className="dato-sec">{t.tramo === "VUELTA" ? "Vuelta" : "Ida"}</span>
              </td>
              <td className="num">{moneda(t.combustible)}</td>
            </tr>
          ))}
          {enPeriodo.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-row">
                No hay tanqueos sin cruzar en ese periodo.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Corregir un vale que no coincide: el tipo y el valor del vale (si se leyo
 * mal del archivo) o lo registrado en el TMS en su tanqueo (si se registro
 * mal); esto ultimo se guarda de una vez en el tanqueo.
 */
function CorregirVale({
  vale,
  alCambiarVale,
  alCorregirTms,
}: {
  vale: ValeRevision;
  alCambiarVale: (c: Partial<ValeRevision>) => void;
  alCorregirTms: (valor: number) => Promise<void>;
}) {
  const [valorVale, setValorVale] = useState(String(vale.valor));
  const [valorTms, setValorTms] = useState(vale.combustibleTramo === null ? "" : String(vale.combustibleTramo));
  const [guardando, setGuardando] = useState(false);
  const que = vale.tipo === "EFECTIVO" ? "efectivo" : "combustible";
  return (
    <div className="detalle-tanqueo">
      <div className="campos-cuadro">
        <div>
          <label>Tipo del vale</label>
          <select value={vale.tipo} onChange={(e) => alCambiarVale({ tipo: e.target.value as TipoVale, tramoId: null })}>
            <option value="COMBUSTIBLE">Combustible</option>
            <option value="EFECTIVO">Efectivo</option>
          </select>
        </div>
        <div>
          <label>Valor de la bomba (si se leyo mal)</label>
          <input
            type="number"
            min={0}
            value={valorVale}
            onChange={(e) => setValorVale(e.target.value)}
            onBlur={() => Number(valorVale) > 0 && Number(valorVale) !== vale.valor && alCambiarVale({ valor: Math.round(Number(valorVale)) })}
          />
        </div>
        {vale.tramoId && (
          <div>
            <label>Registrado en el TMS ({que})</label>
            <div className="linea-abono" style={{ margin: 0 }}>
              <input type="number" min={0} value={valorTms} onChange={(e) => setValorTms(e.target.value)} />
              <button
                className="btn-secondary"
                disabled={guardando || valorTms.trim() === "" || Number(valorTms) === vale.combustibleTramo}
                onClick={async () => {
                  setGuardando(true);
                  await alCorregirTms(Math.round(Number(valorTms)));
                  setGuardando(false);
                }}
              >
                {guardando ? "Guardando..." : "Guardar en el TMS"}
              </button>
              <button className="btn-link" onClick={() => setValorTms(String(vale.valor))}>
                Usar el de la bomba
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="dato-sec">
        {vale.tramoId
          ? `Si el valor de la bomba esta bien y en el TMS se registro mal, corrige lo registrado (se guarda de una vez en el tanqueo). Si el vale es de otro tanqueo, eligelo en la lista.`
          : `Este vale no tiene tanqueo: eligelo en la lista (misma placa) o dejalo sin tanqueo para reclamarlo o registrarlo en el viaje.`}
      </div>
    </div>
  );
}
