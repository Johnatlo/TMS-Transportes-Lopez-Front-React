/**
 * Reporte del mes para un socio (Reparto a socios > Reporte por socio): lo
 * que produjeron sus carros, lo que le toca, el reparto y su cuenta, para
 * mostrarselo o mandarselo en Excel.
 *
 * - Sus carros: los que tiene en Participaciones en el mes, con su parte
 *   (ponderada por los dias), la cascada de cada uno (fletes, descuentos,
 *   gastos, utilidad) y su parte de la utilidad, y el fondo del carro.
 * - El reparto del mes: su parte de lo repartido - 4 x 1000 + su parte de lo
 *   liquidado - lo que el recibio - sus gastos propios = neto.
 * - Su cuenta: mes a mes, saldo anterior + neto - pagos = saldo.
 * - El Excel trae ademas los viajes de sus carros (como el cuadro SWK-973) y
 *   los gastos de cada carro.
 * Todo sale de Rentabilidad y del reparto (si el mes esta aprobado, la foto).
 */
import { useState } from "react";
import { apiUtilidades, moneda } from "../../api/cliente";
import type { UtilidadesMes } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import { placaConGuion } from "../cuadro/facturacion";
import { nombreMes } from "./pasos";

type FilaVehiculo = UtilidadesMes["vehiculos"][number];

/** Un renglon del desglose: "+" suma, "-" resta, "=" total. */
function Renglon({ t, v, signo }: { t: string; v: number; signo: "+" | "-" | "=" | "" }) {
  const texto = signo === "=" || signo === "" ? moneda(v) : v ? `${signo} ${moneda(Math.abs(v))}` : "-";
  return (
    <tr className={signo === "=" ? "desglose-total" : v ? "" : "desglose-cero"}>
      <td>{t}</td>
      <td className="num">{texto}</td>
    </tr>
  );
}

/** Los socios del mes: los que tienen parte en algun carro (con su nombre). */
function sociosDelMes(u: UtilidadesMes): Array<{ socioId: number; nombre: string }> {
  const m = new Map<number, string>();
  for (const v of u.vehiculos) for (const p of v.participaciones) m.set(p.socioId, p.socio);
  for (const s of u.socios) m.set(s.socioId, s.nombre);
  return [...m].map(([socioId, nombre]) => ({ socioId, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** El reporte de un socio en el mes. */
export default function ReporteSocio({ u }: { u: UtilidadesMes }) {
  const socios = sociosDelMes(u);
  const [socioId, setSocioId] = useState<number | null>(socios[0]?.socioId ?? null);
  const cuentas = useDatos(() => apiUtilidades.cuentas(), []);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!socios.length) return <div className="panel vacio">No hay socios con carros en {nombreMes(u.mes)}.</div>;
  const socio = socios.find((s) => s.socioId === socioId) ?? socios[0];
  const parte = (v: FilaVehiculo) => v.participaciones.find((p) => p.socioId === socio.socioId)?.porcentaje ?? 0;
  const carros = u.vehiculos.filter((v) => parte(v) > 0);
  const reparto = u.socios.find((s) => s.socioId === socio.socioId) ?? null;
  const cuenta = (cuentas.datos ?? []).find((c) => c.id === socio.socioId) ?? null;
  const suParte = (v: FilaVehiculo) => Math.round((v.cascada.utilidad * parte(v)) / 100);
  const utilidadSuya = carros.reduce((t, v) => t + suParte(v), 0);
  const mesCuenta = cuenta?.meses.find((m) => m.mes === u.mes) ?? null;

  async function descargar() {
    setDescargando(true);
    setError(null);
    try {
      const { exportarReporteSocio } = await import("./excelReporteSocio");
      const viajes = await apiUtilidades.cuentasVehiculos(u.mes);
      await exportarReporteSocio({
        u,
        socio,
        carros,
        parte,
        reparto,
        cuenta,
        viajes: viajes.vehiculos.filter((v) => carros.some((c) => c.vehiculoId === v.vehiculoId)),
      });
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo armar el Excel.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <>
      <div className="barra-envio" style={{ marginBottom: "0.75rem" }}>
        <select value={socio.socioId} onChange={(e) => setSocioId(Number(e.target.value))} aria-label="Socio">
          {socios.map((s) => (
            <option key={s.socioId} value={s.socioId}>
              {s.nombre}
            </option>
          ))}
        </select>
        <span className="dato-sec">
          {nombreMes(u.mes)}
          {u.aprobado ? " · reparto aprobado" : " · el mes aun no esta aprobado: los valores pueden cambiar"}
        </span>
        <button className="btn-primary" style={{ marginLeft: "auto" }} onClick={descargar} disabled={descargando}>
          {descargando ? "Armando el Excel..." : `Descargar reporte de ${socio.nombre}`}
        </button>
      </div>
      {error && <div className="alert danger">{error}</div>}
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador
          dinero
          titulo="Su parte de la utilidad"
          valor={moneda(utilidadSuya)}
          detalle={`${carros.length} carro(s) en ${nombreMes(u.mes)}`}
          alerta={utilidadSuya < 0}
        />
        <Indicador dinero titulo="Repartido" valor={moneda(reparto?.repartido ?? 0)} detalle="su parte de lo que se reparte" />
        <Indicador
          dinero
          titulo="Neto del mes"
          valor={moneda(reparto?.neto ?? 0)}
          detalle={(reparto?.neto ?? 0) < 0 ? "lo debe el" : "se le debe"}
          alerta={(reparto?.neto ?? 0) < 0}
        />
        <Indicador
          dinero
          titulo="Saldo de su cuenta"
          valor={cuentas.cargando && !cuentas.datos ? "..." : moneda(cuenta?.saldo ?? 0)}
          detalle="hoy, con los meses aprobados y los pagos"
        />
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h4 style={{ margin: "0.8rem 0.9rem 0.4rem" }}>Sus carros en {nombreMes(u.mes)}</h4>
        <div style={{ overflowX: "auto" }}>
          <table className="tabla tabla-compacta">
            <thead>
              <tr>
                <th>Vehiculo</th>
                <th className="num">Su parte</th>
                <th className="num">Viajes</th>
                <th className="num">Fletes</th>
                <th className="num">Descuentos</th>
                <th className="num">Gastos</th>
                <th className="num">Utilidad del carro</th>
                <th className="num">Su utilidad</th>
                <th className="num">Fondo al cierre</th>
              </tr>
            </thead>
            <tbody>
              {carros.map((v) => (
                <tr key={v.vehiculoId}>
                  <td>
                    <strong>{placaConGuion(v.placa)}</strong> <span className="dato-sec">{v.empresa === "MYC" ? "T. M&C" : "T. Lopez"}</span>
                  </td>
                  <td className="num">{parte(v)} %</td>
                  <td className="num">{v.cascada.viajes}</td>
                  <td className="num">{moneda(v.cascada.ingresos)}</td>
                  <td className="num">{moneda(v.cascada.totalDescuentos)}</td>
                  <td className="num">{moneda(v.cascada.totalDirectos + v.cascada.totalConductor + v.cascada.totalGenerales)}</td>
                  <td className="num">{moneda(v.cascada.utilidad)}</td>
                  <td className="num">
                    <strong className={suParte(v) < 0 ? "texto-vencido" : undefined}>{moneda(suParte(v))}</strong>
                  </td>
                  <td className="num">{v.fondo ? moneda(v.fondo.saldoFinal) : "-"}</td>
                </tr>
              ))}
              {!carros.length && (
                <tr>
                  <td colSpan={9} className="dato-sec">
                    No tiene carros en este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cuenta-vehiculo-pie" style={{ marginTop: 0 }}>
        <div className="panel">
          <h4 style={{ marginTop: 0 }}>Reparto de {nombreMes(u.mes)}</h4>
          {reparto ? (
            <table className="tabla tabla-compacta desglose">
              <tbody className="desglose-empresa">
                <tr className="desglose-titulo">
                  <th colSpan={2}>Lo que le toca</th>
                </tr>
                <Renglon t="Su parte de lo repartido" v={reparto.repartido} signo="+" />
                <Renglon t="4 x 1000 de la transferencia" v={reparto.gmf} signo="-" />
                <Renglon t="Su parte de lo liquidado por los viajes" v={reparto.liquidado} signo="+" />
                <Renglon t="Lo que el recibio de los viajes" v={reparto.recibido} signo="-" />
                <Renglon t="Sus gastos propios" v={reparto.totalGastosPropios} signo="-" />
              </tbody>
              <tbody className="desglose-resultado">
                <Renglon t={reparto.neto < 0 ? "Neto del mes (lo debe el)" : "Neto del mes (se le debe)"} v={reparto.neto} signo="=" />
              </tbody>
            </table>
          ) : (
            <div className="dato-sec">Sin reparto en este mes (antes del inicio de los fondos o sin carros).</div>
          )}
        </div>
        <div className="panel">
          <h4 style={{ marginTop: 0 }}>Su cuenta</h4>
          {cuentas.cargando && !cuentas.datos ? (
            <Cargando que="la cuenta del socio" />
          ) : cuentas.error ? (
            <ErrorCarga mensaje={cuentas.error} alReintentar={cuentas.recargar} />
          ) : cuenta && cuenta.meses.length ? (
            <table className="tabla tabla-compacta">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num">Neto</th>
                  <th className="num">Pagos</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {cuenta.meses.slice(-6).map((m) => (
                  <tr key={m.mes} className={m.mes === u.mes ? "fila-cruzada" : undefined}>
                    <td>{nombreMes(m.mes)}</td>
                    <td className="num">{moneda(m.neto)}</td>
                    <td className="num">{moneda(m.pagos)}</td>
                    <td className="num">
                      <strong className={m.saldo < 0 ? "texto-vencido" : undefined}>{moneda(m.saldo)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="dato-sec">Aun no tiene meses aprobados ni pagos.</div>
          )}
          {cuenta && !mesCuenta && (
            <div className="dato-sec" style={{ marginTop: "0.4rem" }}>
              {nombreMes(u.mes)} aun no entra a la cuenta (no esta aprobado).
            </div>
          )}
          <div className="dato-sec" style={{ marginTop: "0.4rem" }}>
            Saldo positivo: se le debe; negativo: lo debe el. Los pagos se registran en la pestana Socios.
          </div>
        </div>
      </div>
    </>
  );
}
