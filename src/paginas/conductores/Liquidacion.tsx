/**
 * Liquidacion de los conductores del mes (la que hace el gerente general):
 * por conductor, el producido conductor de sus viajes (sobre el que van el %
 * salarial y el de viaticos), lo de la nomina (sueldo, % y salud y pension),
 * el rojo de sus cuentas de viaje y lo que se descuenta de sus prestamos.
 * Total a pagar = neto de la nomina + rojo - prestamos.
 *
 * No espera la nomina: si la del mes aun no existe, SOFI hace el calculo
 * provisional con las mismas reglas (ver nomina.provisional en el backend).
 * "Liquidar" guarda la fecha en que el gerente lo liquida, aparte de la
 * nomina. La "Hoja para el conductor" es lo que se le envia: sus viajes con
 * anticipo, gastos y rojo, y el resumen (la parte gris del cuadro SWK-973);
 * se imprime o se guarda en PDF. Una liquidacion hecha se muestra como quedo
 * (la foto guardada), y sus cuentas de viaje y prestamos de ese mes no cambian
 * sin quitarla antes.
 *
 * Viajes del cierre: "Quitar de este mes" saca un viaje que ya se le pago el
 * mes anterior (por ejemplo el 28/10, que antes del corte del 27 al 26 entro
 * en octubre) o lo pasa al siguiente; "Traer viajes del cierre" trae a este
 * mes viajes de la ultima semana del anterior o de la primera del siguiente.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { apiConductores, hoyColombia, moneda } from "../../api/cliente";
import type { LiquidacionConductor, PrestamoLinea, ViajeConductor } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import LinksViaje from "../../componentes/LinksViaje";
import MiniTabla from "../../componentes/MiniTabla";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import { nombreMes } from "../gastos/nombres";
import { Saldo } from "./CuentasViaje";
import { textoPeriodo } from "./calculos";
import type { FiltroEmpresa } from "./LiquidacionConductores";

/** Liquidacion de todos los conductores de un mes. */
export default function Liquidacion({ mes, empresa, irACuentas }: { mes: string; empresa: FiltroEmpresa; irACuentas: () => void }) {
  const carga = useDatos(() => Promise.all([apiConductores.liquidacion(mes), apiConductores.viajes(mes)]), [mes]);
  const [error, setError] = useState<string | null>(null);
  if (carga.cargando && !carga.datos) return <Cargando que="la liquidacion" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;
  const [liq, viajes] = carga.datos;
  // El rol total filtra por la empresa del conductor (M&C ya llega solo con los suyos).
  const filas = liq.conductores.filter((c) => empresa === "TODAS" || c.empresa === empresa);
  const total = (f: (c: LiquidacionConductor) => number | null) => filas.reduce((s, c) => s + (f(c) ?? 0), 0);

  /** Ejecuta un cambio y recarga. */
  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      carga.recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  const columnas: Columna<LiquidacionConductor>[] = [
    {
      id: "conductor",
      titulo: "Conductor",
      valor: (c) => c.nombre,
      celda: (c) => (
        <>
          <span className="principal">{c.nombre}</span>
          <span className="dato-sec">
            {c.viajes} viaje(s){c.viajesSinCuenta ? ` · ${c.viajesSinCuenta} sin cuenta` : ""}
          </span>
        </>
      ),
    },
    { id: "producido", titulo: "Producido conductor", alinear: "derecha", valor: (c) => c.producido, celda: (c) => moneda(c.producido) },
    {
      id: "porcentaje",
      titulo: "% (salarial + viaticos)",
      alinear: "derecha",
      valor: (c) => c.salarial + c.viaticos,
      celda: (c) => (
        <>
          {moneda(c.salarial + c.viaticos)}
          <span className="dato-sec">
            {c.pctSalarial} % + {c.pctViaticos} %
          </span>
        </>
      ),
    },
    {
      id: "nomina",
      titulo: "Neto nomina",
      alinear: "derecha",
      valor: (c) => c.netoNomina ?? 0,
      celda: (c) =>
        c.netoNomina === null ? (
          <span className="texto-aviso" title="Faltan los parametros de nomina del ano (Nomina > Parametros)">
            Sin parametros
          </span>
        ) : (
          <>
            {moneda(c.netoNomina)}
            {c.nomina?.provisional && (
              <span className="dato-sec" title="Aun no hay nomina del mes: calculo de SOFI con su sueldo y su producido">
                provisional
              </span>
            )}
          </>
        ),
    },
    { id: "cuentas", titulo: "Rojo (cuentas de viaje)", alinear: "derecha", valor: (c) => c.saldoCuentas, celda: (c) => <Saldo valor={c.saldoCuentas} /> },
    { id: "prestamos", titulo: "Prestamos", alinear: "derecha", valor: (c) => c.prestamos, celda: (c) => (c.prestamos ? `- ${moneda(c.prestamos)}` : "-") },
    {
      id: "total",
      titulo: "Total a pagar",
      alinear: "derecha",
      valor: (c) => c.totalAPagar ?? 0,
      celda: (c) =>
        c.totalAPagar === null ? (
          "-"
        ) : (
          <strong className={c.totalAPagar < 0 ? "texto-vencido" : undefined} title={c.totalAPagar < 0 ? "El conductor queda debiendo" : undefined}>
            {moneda(c.totalAPagar)}
          </strong>
        ),
    },
    {
      id: "estado",
      titulo: "Estado",
      filtrable: true,
      valor: (c) => (c.pagada ? "Liquidada" : "Por liquidar"),
      celda: (c) =>
        c.pagada ? (
          <>
            <Pastilla tono="ok">Liquidada</Pastilla>
            <span className="dato-sec">{fechaCorta(c.pagada.fechaPago)}</span>
          </>
        ) : (
          <Pastilla tono="aviso">Por liquidar</Pastilla>
        ),
    },
  ];

  return (
    <>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador
          dinero
          titulo={`Producido conductor de ${nombreMes(mes)}`}
          valor={moneda(total((c) => c.producido))}
          detalle={`${filas.length} conductor(es)`}
        />
        <Indicador dinero titulo="Rojo de las cuentas de viaje" valor={moneda(total((c) => c.saldoCuentas))} detalle="+ se les debe / - deben" />
        <Indicador dinero titulo="Total a pagar" valor={moneda(total((c) => c.totalAPagar))} detalle={`${filas.filter((c) => c.pagada).length} liquidado(s)`} />
        <Indicador
          titulo="Viajes sin conductor"
          valor={liq.viajesSinConductor}
          detalle="registralos en Nomina > Empleados"
          alerta={liq.viajesSinConductor > 0}
        />
      </div>
      {error && <div className="alert danger">{error}</div>}
      {liq.viajesSinConductor > 0 && (
        <div className="alert warning">
          {liq.viajesSinConductor} viaje(s) del mes no tienen conductor y no entran a ninguna liquidacion. SOFI busca a quien manejo cada viaje (Cuadro o
          manifiesto) en Nomina &gt; Empleados por cedula o nombre y, si no esta, al asignado al vehiculo en esa fecha.
          {(liq.motivosSinConductor ?? []).length > 0 && (
            <ul className="motivos-sin-conductor">
              {liq.motivosSinConductor!.slice(0, 8).map((m) => (
                <li key={m.motivo}>
                  {m.motivo}: {m.viajes} viaje(s)
                </li>
              ))}
              {liq.motivosSinConductor!.length > 8 && <li>y {liq.motivosSinConductor!.length - 8} motivo(s) mas</li>}
            </ul>
          )}
        </div>
      )}
      <div className="panel">
        <TablaDatos
          filas={filas}
          columnas={columnas}
          clave={(c) => c.empleadoId}
          nombreArchivo={`liquidacion-conductores-${mes}`}
          placeholderBusqueda="Buscar conductor..."
          vacio="No hay conductores con viajes, nomina o prestamos en ese mes."
          detalle={(c) => (
            <DetalleLiquidacion c={c} mes={mes} viajes={viajes.filter((v) => v.empleadoId === c.empleadoId)} irACuentas={irACuentas} accion={accion} />
          )}
        />
      </div>
    </>
  );
}

/** Un renglon del desglose. */
const Renglon = ({ t, v, signo = "", total = false }: { t: string; v: number; signo?: string; total?: boolean }) => (
  <tr className={total ? "desglose-total" : v ? "" : "desglose-cero"}>
    <td>{t}</td>
    <td className="num">{v ? `${signo}${moneda(v)}` : "-"}</td>
  </tr>
);

/** El desglose de la liquidacion de un conductor, sus prestamos y sus viajes. */
function DetalleLiquidacion({
  c,
  mes,
  viajes,
  irACuentas,
  accion,
}: {
  c: LiquidacionConductor;
  mes: string;
  viajes: ViajeConductor[];
  irACuentas: () => void;
  accion: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [fechaPago, setFechaPago] = useState(hoyColombia());
  const [verHoja, setVerHoja] = useState(false);
  const [moviendo, setMoviendo] = useState<ViajeConductor | null>(null);
  const [trayendo, setTrayendo] = useState(false);
  const n = c.nomina;
  return (
    <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
      {c.congelada && (
        <div className="alert info" style={{ marginBottom: "0.6rem" }}>
          Liquidada: estos son los valores del momento en que se liquido. Para cambiar sus cuentas de viaje o prestamos de este mes, quita primero la
          liquidacion.
        </div>
      )}
      <div className="desglose-cascada">
        <table className="tabla tabla-compacta desglose">
          <tbody className="desglose-empresa">
            <tr className="desglose-titulo">
              <th colSpan={2}>Producido conductor ({c.viajes} viajes)</th>
            </tr>
            <Renglon t="Producido conductor (va al %)" v={c.producido} />
            {(c.integro ?? 0) > 0 && <Renglon t="Viajes integros (se pagan completos)" v={c.integro} />}
            <Renglon t={`${c.pctSalarial} % salarial (genera prestaciones)`} v={c.salarial} />
            <Renglon t={`${c.pctViaticos} % viaticos (no es salario)`} v={c.viaticos} />
            {c.viajesSinProducido > 0 && (
              <tr>
                <td colSpan={2} className="texto-aviso">
                  {c.viajesSinProducido} viaje(s) sin producido conductor: no suman.
                </td>
              </tr>
            )}
          </tbody>
          <tbody className="desglose-dueno">
            <tr className="desglose-titulo">
              <th colSpan={2}>
                {n
                  ? n.provisional
                    ? `Nomina provisional de ${nombreMes(mes)} (calculo de SOFI, 30 dias)`
                    : `Nomina ${fechaCorta(n.desde)} - ${fechaCorta(n.hasta)} (${n.estado === "APROBADA" ? "aprobada" : "borrador"})`
                  : "Nomina"}
              </th>
            </tr>
            {n ? (
              <>
                <Renglon t="Sueldo basico" v={n.basico} />
                <Renglon t="Auxilio de transporte" v={n.auxilio} />
                <Renglon t="Devengado (con el %)" v={n.devengado} total />
                <Renglon t="Salud" v={n.salud} signo="- " />
                <Renglon t="Pension" v={n.pension} signo="- " />
                <Renglon t="Neto de la nomina" v={n.neto} total />
              </>
            ) : (
              <tr>
                <td colSpan={2} className="texto-aviso">
                  Faltan los parametros de nomina de {mes.slice(0, 4)}: agregalos en Nomina &gt; Parametros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <table className="tabla tabla-compacta desglose">
          <tbody className="desglose-anticipo">
            <tr className="desglose-titulo">
              <th colSpan={2}>Rojo (cuentas de viaje)</th>
            </tr>
            <tr className="desglose-total">
              <td>{c.saldoCuentas >= 0 ? "Se le debe (gastos - lo recibido)" : "Debe (recibio mas de lo que gasto)"}</td>
              <td className="num">
                <Saldo valor={c.saldoCuentas} />
              </td>
            </tr>
            {c.viajesSinCuenta > 0 && (
              <tr>
                <td colSpan={2}>
                  <span className="texto-aviso">{c.viajesSinCuenta} viaje(s) sin cuenta de viaje. </span>
                  <button className="btn-link" onClick={irACuentas}>
                    Llenarlas
                  </button>
                </td>
              </tr>
            )}
          </tbody>
          <tbody className="desglose-tercero">
            <tr className="desglose-titulo">
              <th colSpan={2}>Prestamos (lo que se descuenta este mes)</th>
            </tr>
            {c.prestamosDetalle.length ? (
              c.prestamosDetalle.map((p) => <FilaPrestamo key={p.prestamoId} p={p} mes={mes} accion={accion} />)
            ) : (
              <tr className="desglose-cero">
                <td colSpan={2}>Sin prestamos.</td>
              </tr>
            )}
          </tbody>
          <tbody className="desglose-resultado">
            <tr className="desglose-total">
              <td>Total a pagar (neto + rojo - prestamos)</td>
              <td className="num">{c.totalAPagar === null ? "-" : moneda(c.totalAPagar)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="detalle-tanqueo-pie">
        {c.pagada ? (
          <>
            <Pastilla tono="ok">
              Liquidado el {fechaCorta(c.pagada.fechaPago)} por {moneda(c.pagada.total)}
            </Pastilla>
            <button className="btn-secondary" onClick={() => setVerHoja(true)}>
              Hoja para el conductor
            </button>
            <button
              className="btn-link"
              onClick={() => window.confirm("¿Quitar la liquidacion?") && accion(() => apiConductores.quitarPago(c.empleadoId, mes))}
            >
              Quitar liquidacion
            </button>
          </>
        ) : (
          <>
            <button className="btn-secondary" onClick={() => setVerHoja(true)} disabled={c.totalAPagar === null}>
              Hoja para el conductor
            </button>
            <label>
              <span className="dato-sec">Fecha de liquidacion</span> <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
            </label>
            <button
              className="btn-primary"
              disabled={c.totalAPagar === null}
              title={c.totalAPagar === null ? "Faltan los parametros de nomina del ano" : "Guarda la liquidacion con esta fecha (aparte de la nomina)"}
              onClick={() => accion(() => apiConductores.pagar(c.empleadoId, mes, fechaPago))}
            >
              Liquidar
            </button>
          </>
        )}
      </div>
      {verHoja && <HojaConductor c={c} mes={mes} viajes={viajes} alCerrar={() => setVerHoja(false)} />}
      {viajes.length > 0 && (
        <div style={{ marginTop: "0.8rem" }}>
          <h5 style={{ margin: "0 0 0.3rem" }}>Sus viajes</h5>
          <MiniTabla
            filas={viajes}
            clave={(v) => v.cuadroViajeId}
            nombre="viajes"
            visibles={5}
            columnas={[
              { titulo: "Fecha", celda: (v) => fechaCorta(v.fecha) },
              { titulo: "Placa", celda: (v) => <strong>{placaConGuion(v.placa)}</strong> },
              { titulo: "Cliente", celda: (v) => v.cliente },
              { titulo: "Remision", celda: (v) => <span className="codigo">{v.remision ?? v.manifiesto ?? "-"}</span> },
              {
                titulo: "Producido",
                num: true,
                celda: (v) =>
                  v.producido === null ? (
                    <span className="texto-aviso">Sin valor</span>
                  ) : (
                    <>
                      {moneda(v.producido)}
                      {v.integro && <span className="dato-sec">integro</span>}
                    </>
                  ),
              },
              { titulo: "Recibio", num: true, celda: (v) => moneda(v.recibido) },
              { titulo: "Gastos", num: true, celda: (v) => (v.cuenta ? moneda(v.cuenta.total) : "-") },
              { titulo: "Saldo", num: true, celda: (v) => (v.cuenta ? <Saldo valor={v.cuenta.saldo} /> : <Pastilla tono="aviso">Sin cuenta</Pastilla>) },
              { titulo: "Soportes", celda: (v) => <LinksViaje remisionUrl={v.remisionUrl} facturaUrl={v.facturaUrl} /> },
              {
                titulo: "Mes",
                celda: (v) =>
                  v.mesMovido ? (
                    <span title={v.notaMovido ?? undefined}>
                      <Pastilla tono="info">traido</Pastilla>
                      {!c.congelada && (
                        <button className="btn-link" onClick={() => accion(() => apiConductores.moverDeMes(v.cuadroViajeId, { mes: null }))}>
                          Devolver
                        </button>
                      )}
                    </span>
                  ) : c.congelada ? (
                    "-"
                  ) : (
                    <button className="btn-link" onClick={() => setMoviendo(v)}>
                      Quitar de este mes
                    </button>
                  ),
              },
            ]}
          />
        </div>
      )}
      {!c.congelada && (
        <button className="btn-link" style={{ marginTop: "0.5rem" }} onClick={() => setTrayendo(true)}>
          Traer viajes del cierre (ultima semana del mes anterior o primera del siguiente)
        </button>
      )}
      {moviendo && <QuitarDelMes viaje={moviendo} mes={mes} accion={accion} alCerrar={() => setMoviendo(null)} />}
      {trayendo && <TraerDelCierre c={c} mes={mes} accion={accion} alCerrar={() => setTrayendo(false)} />}
    </div>
  );
}

/** Mes anterior o siguiente ("AAAA-MM"). */
function mesVecino(mes: string, paso: 1 | -1): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + paso, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Saca un viaje de la liquidacion de este mes: al mes anterior (ya se le
 * pago ahi; no se le vuelve a pagar) o al siguiente. Con una nota del porque.
 */
function QuitarDelMes({
  viaje,
  mes,
  accion,
  alCerrar,
}: {
  viaje: ViajeConductor;
  mes: string;
  accion: (fn: () => Promise<unknown>) => Promise<void>;
  alCerrar: () => void;
}) {
  const anterior = mesVecino(mes, -1);
  const siguiente = mesVecino(mes, 1);
  const [destino, setDestino] = useState(anterior);
  const [nota, setNota] = useState("");
  return (
    <Modal
      titulo={`Quitar de ${nombreMes(mes)} · ${placaConGuion(viaje.placa)} ${fechaCorta(viaje.fecha)}`}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={async () => {
              await accion(() => apiConductores.moverDeMes(viaje.cuadroViajeId, { mes: destino, nota: nota || undefined }));
              alCerrar();
            }}
          >
            Quitar de {nombreMes(mes)}
          </button>
        </>
      }
    >
      <p className="dato-sec" style={{ marginTop: 0 }}>
        {viaje.cliente} · {viaje.remision ? `remision ${viaje.remision}` : (viaje.manifiesto ?? "")}. El viaje no se borra del Cuadro ni de la rentabilidad:
        solo deja de contar en esta liquidacion.
      </p>
      <label className="opcion-radio">
        <input type="radio" checked={destino === anterior} onChange={() => setDestino(anterior)} />
        Ya se le liquido en {nombreMes(anterior)} (no se le vuelve a pagar)
      </label>
      <label className="opcion-radio">
        <input type="radio" checked={destino === siguiente} onChange={() => setDestino(siguiente)} />
        Pasarlo a la liquidacion de {nombreMes(siguiente)}
      </label>
      <label className="campo-ancho" style={{ marginTop: "0.6rem" }}>
        <span>Nota (opcional)</span>
        <input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: se pago en la liquidacion de octubre" />
      </label>
    </Modal>
  );
}

/**
 * Viajes del conductor cerca del cierre que cuentan en otro mes (la ultima
 * semana del periodo anterior o la primera del siguiente, o los que se
 * sacaron de este): "Traer" los pasa a la liquidacion de este mes.
 */
function TraerDelCierre({
  c,
  mes,
  accion,
  alCerrar,
}: {
  c: LiquidacionConductor;
  mes: string;
  accion: (fn: () => Promise<unknown>) => Promise<void>;
  alCerrar: () => void;
}) {
  const carga = useDatos(() => apiConductores.viajesCercanos(mes), [mes]);
  const suyos = (carga.datos ?? []).filter((v) => v.empleadoId === c.empleadoId);
  return (
    <Modal
      titulo={`Traer viajes a ${nombreMes(mes)} · ${c.nombre}`}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <button className="btn-secondary" onClick={alCerrar}>
          Cerrar
        </button>
      }
    >
      {carga.cargando && !carga.datos ? (
        <Cargando que="los viajes del cierre" />
      ) : carga.error ? (
        <ErrorCarga mensaje={carga.error} alReintentar={carga.recargar} />
      ) : suyos.length === 0 ? (
        <p className="dato-sec">No hay viajes de {c.nombre} cerca del cierre que cuenten en otro mes.</p>
      ) : (
        <MiniTabla
          filas={suyos}
          clave={(v) => v.cuadroViajeId}
          nombre="viajes"
          visibles={20}
          columnas={[
            { titulo: "Fecha", celda: (v) => fechaCorta(v.fecha) },
            { titulo: "Placa", celda: (v) => <strong>{placaConGuion(v.placa)}</strong> },
            { titulo: "Cliente", celda: (v) => v.cliente },
            { titulo: "Producido", num: true, celda: (v) => (v.producido === null ? "-" : moneda(v.producido)) },
            { titulo: "Cuenta en", celda: (v) => (v.mesConductor ? nombreMes(v.mesConductor) : "-") },
            {
              titulo: "",
              celda: (v) => (
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    await accion(() => apiConductores.moverDeMes(v.cuadroViajeId, { mes, nota: `Traido a ${nombreMes(mes)}` }));
                    carga.recargar();
                  }}
                >
                  Traer a {nombreMes(mes)}
                </button>
              ),
            },
          ]}
        />
      )}
    </Modal>
  );
}

/**
 * La hoja que se le envia al conductor (la parte gris del cuadro SWK-973):
 * sus viajes con el flete conductor, lo que recibio (anticipos y
 * transferencias), lo que gasto y el rojo; y el resumen de su liquidacion: el
 * %, el rojo, el sueldo, el seguro (salud y pension), los prestamos y el total.
 * "Imprimir" la imprime o la guarda en PDF (solo la hoja, en blanco y negro).
 */
function HojaConductor({ c, mes, viajes, alCerrar }: { c: LiquidacionConductor; mes: string; viajes: ViajeConductor[]; alCerrar: () => void }) {
  const n = c.nomina;
  const suma = (f: (v: ViajeConductor) => number) => viajes.reduce((s, v) => s + f(v), 0);
  const rojo = (v: ViajeConductor) => v.cuenta?.saldo ?? 0;
  const hoja = (
    <div className="hoja-conductor">
      <header className="hoja-conductor-cabeza">
        <div>
          <strong>{c.nombre}</strong>
          <span className="dato-sec">
            Liquidacion de {nombreMes(mes)} ({textoPeriodo(mes)})
          </span>
        </div>
        <span className="dato-sec">{c.pagada ? `Liquidado el ${fechaCorta(c.pagada.fechaPago)}` : "Sin liquidar aun"}</span>
      </header>
      <table className="tabla tabla-compacta">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Placa</th>
            <th>Cliente</th>
            <th>Remision</th>
            <th className="num">Flete conductor</th>
            <th className="num">Anticipos</th>
            <th className="num">Gastos</th>
            <th className="num">Rojo</th>
          </tr>
        </thead>
        <tbody>
          {viajes.map((v) => (
            <tr key={v.cuadroViajeId}>
              <td>{fechaCorta(v.fecha)}</td>
              <td>{placaConGuion(v.placa)}</td>
              <td>{v.cliente}</td>
              <td>{v.remision ?? v.manifiesto ?? "-"}</td>
              <td className="num">{v.producido === null ? "-" : moneda(v.producido)}</td>
              <td className="num">{moneda(v.recibido)}</td>
              <td className="num">{v.cuenta ? moneda(v.cuenta.total) : "Sin cuenta"}</td>
              <td className="num">{v.cuenta ? moneda(rojo(v)) : "-"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              <strong>Total ({viajes.length} viajes)</strong>
            </td>
            <td className="num">{moneda(suma((v) => v.producido ?? 0))}</td>
            <td className="num">{moneda(suma((v) => v.recibido))}</td>
            <td className="num">{moneda(suma((v) => v.cuenta?.total ?? 0))}</td>
            <td className="num">
              <strong>{moneda(suma(rojo))}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
      <table className="tabla tabla-compacta hoja-conductor-resumen">
        <tbody>
          <tr>
            <td>
              % del flete conductor ({c.pctSalarial} % salarial + {c.pctViaticos} % viaticos)
              {(c.integro ?? 0) > 0 && " y viajes integros"}
            </td>
            <td className="num">{moneda(c.salarial + c.viaticos)}</td>
          </tr>
          <tr>
            <td>Rojo (gastos - anticipos)</td>
            <td className="num">{moneda(c.saldoCuentas)}</td>
          </tr>
          <tr>
            <td>Sueldo{n?.provisional ? " (provisional)" : ""}</td>
            <td className="num">{moneda(n?.basico ?? 0)}</td>
          </tr>
          {(n?.auxilio ?? 0) > 0 && (
            <tr>
              <td>Auxilio de transporte</td>
              <td className="num">{moneda(n?.auxilio ?? 0)}</td>
            </tr>
          )}
          <tr>
            <td>Seguro (salud y pension)</td>
            <td className="num">- {moneda((n?.salud ?? 0) + (n?.pension ?? 0))}</td>
          </tr>
          {c.prestamos > 0 && (
            <tr>
              <td>Prestamo</td>
              <td className="num">- {moneda(c.prestamos)}</td>
            </tr>
          )}
          <tr className="hoja-conductor-total">
            <td>Total a pagar</td>
            <td className="num">{c.totalAPagar === null ? "-" : moneda(c.totalAPagar)}</td>
          </tr>
        </tbody>
      </table>
      {c.viajesSinCuenta > 0 && <p className="texto-aviso">{c.viajesSinCuenta} viaje(s) sin cuenta de viaje: su rojo aun no cuenta.</p>}
    </div>
  );
  return (
    <>
      <Modal
        titulo={`Hoja para el conductor · ${c.nombre}`}
        ancho="wide"
        alCerrar={alCerrar}
        pie={
          <>
            <button className="btn-secondary" onClick={alCerrar}>
              Cerrar
            </button>
            <button className="btn-primary" onClick={() => window.print()}>
              Imprimir o guardar PDF
            </button>
          </>
        }
      >
        {hoja}
      </Modal>
      {/* Copia para imprimir: suelta en la pagina (la ventana la recortaria); al imprimir sale solo ella, en blanco y negro. */}
      {createPortal(<div className="hoja-impresion">{hoja}</div>, document.body)}
    </>
  );
}

/** Un prestamo: saldo y cuanto se descuenta este mes (vacio = no se descuenta). */
export function FilaPrestamo({ p, mes, accion }: { p: PrestamoLinea; mes: string; accion: (fn: () => Promise<unknown>) => Promise<void> }) {
  return (
    <tr>
      <td>
        Prestamo del {fechaCorta(p.fecha)} por {moneda(p.monto)}
        <span className="dato-sec">
          Saldo {moneda(p.saldo)}
          {p.cuota ? ` · cuota ${moneda(p.cuota)}` : ""}
        </span>
      </td>
      <td className="num">
        <input
          key={`${p.prestamoId}-${p.descuento}`}
          type="number"
          min={0}
          style={{ width: "8rem", textAlign: "right" }}
          defaultValue={p.descuento ?? ""}
          placeholder={p.cuota ? `Cuota ${p.cuota}` : "No se descuenta"}
          aria-label="Descontar este mes"
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          onBlur={(e) => {
            const v = e.target.value.trim() === "" ? null : Number(e.target.value);
            if (v !== p.descuento) void accion(() => apiConductores.descontar(p.prestamoId, mes, v));
          }}
        />
      </td>
    </tr>
  );
}
