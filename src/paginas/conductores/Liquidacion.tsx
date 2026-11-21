/**
 * Liquidacion de los conductores del mes: por conductor, el producido
 * conductor de sus viajes (sobre el que van el 4 % salarial y el 5 % de
 * viaticos), lo de la nomina que cubre ese producido (sueldo, % y aportes),
 * el saldo de sus cuentas de viaje y lo que se descuenta de sus prestamos.
 * Total a pagar = neto de la nomina + saldo de las cuentas - prestamos. Lo
 * descontado de los prestamos es el mismo dato que en la nomina. Una
 * liquidacion pagada se muestra como se pago (la foto guardada), y sus cuentas
 * de viaje y prestamos de ese mes no cambian sin quitar antes la marca.
 */
import { useState } from "react";
import { apiConductores, hoyColombia, moneda } from "../../api/cliente";
import type { LiquidacionConductor, PrestamoLinea, ViajeConductor } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import LinksViaje from "../../componentes/LinksViaje";
import MiniTabla from "../../componentes/MiniTabla";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import { nombreMes } from "../gastos/nombres";
import { Saldo } from "./CuentasViaje";
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
      celda: (c) => (c.netoNomina === null ? <span className="texto-aviso">Sin nomina</span> : moneda(c.netoNomina)),
    },
    { id: "cuentas", titulo: "Cuentas de viaje", alinear: "derecha", valor: (c) => c.saldoCuentas, celda: (c) => <Saldo valor={c.saldoCuentas} /> },
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
      valor: (c) => (c.pagada ? "Pagada" : "Por pagar"),
      celda: (c) =>
        c.pagada ? (
          <>
            <Pastilla tono="ok">Pagada</Pastilla>
            <span className="dato-sec">{fechaCorta(c.pagada.fechaPago)}</span>
          </>
        ) : (
          <Pastilla tono="aviso">Por pagar</Pastilla>
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
        <Indicador dinero titulo="Saldo de cuentas de viaje" valor={moneda(total((c) => c.saldoCuentas))} detalle="+ se les debe / - deben" />
        <Indicador dinero titulo="Total a pagar" valor={moneda(total((c) => c.totalAPagar))} detalle={`${filas.filter((c) => c.pagada).length} pagada(s)`} />
        <Indicador
          titulo="Viajes sin conductor"
          valor={liq.viajesSinConductor}
          detalle="asigna el vehiculo en Nomina > Empleados"
          alerta={liq.viajesSinConductor > 0}
        />
      </div>
      {error && <div className="alert danger">{error}</div>}
      {liq.viajesSinConductor > 0 && (
        <div className="alert warning">
          {liq.viajesSinConductor} viaje(s) del mes no tienen conductor: su vehiculo no esta asignado a ningun conductor en esa fecha (Nomina &gt; Empleados).
          No entran a ninguna liquidacion hasta asignarlo.
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
  const n = c.nomina;
  return (
    <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
      {c.congelada && (
        <div className="alert info" style={{ marginBottom: "0.6rem" }}>
          Pagada: estos son los valores del momento del pago. Para cambiar sus cuentas de viaje o prestamos de este mes, quita primero la marca de pagada.
        </div>
      )}
      <div className="desglose-cascada">
        <table className="tabla tabla-compacta desglose">
          <tbody className="desglose-empresa">
            <tr className="desglose-titulo">
              <th colSpan={2}>Producido conductor ({c.viajes} viajes)</th>
            </tr>
            <Renglon t="Producido conductor" v={c.producido} />
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
                {n ? `Nomina ${fechaCorta(n.desde)} - ${fechaCorta(n.hasta)} (${n.estado === "APROBADA" ? "aprobada" : "borrador"})` : "Nomina"}
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
                  Aun no hay nomina que cubra el producido de {nombreMes(mes)}: creala en Nomina.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <table className="tabla tabla-compacta desglose">
          <tbody className="desglose-anticipo">
            <tr className="desglose-titulo">
              <th colSpan={2}>Cuentas de viaje</th>
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
              <td>Total a pagar (neto + cuentas - prestamos)</td>
              <td className="num">{c.totalAPagar === null ? "-" : moneda(c.totalAPagar)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="detalle-tanqueo-pie">
        {c.pagada ? (
          <>
            <Pastilla tono="ok">
              Pagada el {fechaCorta(c.pagada.fechaPago)} por {moneda(c.pagada.total)}
            </Pastilla>
            <button
              className="btn-link"
              onClick={() => window.confirm("¿Quitar la marca de pagada?") && accion(() => apiConductores.quitarPago(c.empleadoId, mes))}
            >
              Quitar pago
            </button>
          </>
        ) : (
          <>
            <label>
              <span className="dato-sec">Fecha de pago</span> <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
            </label>
            <button
              className="btn-primary"
              disabled={c.totalAPagar === null}
              title={c.totalAPagar === null ? "Falta la nomina del mes" : undefined}
              onClick={() => accion(() => apiConductores.pagar(c.empleadoId, mes, fechaPago))}
            >
              Marcar pagada
            </button>
          </>
        )}
      </div>
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
              { titulo: "Producido", num: true, celda: (v) => (v.producido === null ? <span className="texto-aviso">Sin valor</span> : moneda(v.producido)) },
              { titulo: "Recibio", num: true, celda: (v) => moneda(v.recibido) },
              { titulo: "Gastos", num: true, celda: (v) => (v.cuenta ? moneda(v.cuenta.total) : "-") },
              { titulo: "Saldo", num: true, celda: (v) => (v.cuenta ? <Saldo valor={v.cuenta.saldo} /> : <Pastilla tono="aviso">Sin cuenta</Pastilla>) },
              { titulo: "Soportes", celda: (v) => <LinksViaje remisionUrl={v.remisionUrl} facturaUrl={v.facturaUrl} /> },
            ]}
          />
        </div>
      )}
    </div>
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
