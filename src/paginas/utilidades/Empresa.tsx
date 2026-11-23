/**
 * Estado de resultados de la empresa en el mes (lo que es de la empresa y no
 * se reparte entre socios), con los colores del desglose de Rentabilidad:
 *   + rentabilidad de los viajes de terceros (antes del anticipo de renta)
 *   + reconocidos de todos los carros (convenio entre empresas: son de la
 *     empresa, con los descuentos de su factura)
 *   + T. Lopez cobrado en los viajes
 *   - gastos que asume la empresa (los que en el libro van a "Empresa")
 *   = utilidad de la empresa.
 * El anticipo de renta va aparte: es impuesto pagado por adelantado que se
 * cruza en la declaracion (el de terceros y reconocidos lo asume la empresa;
 * el de los carros de socios se les descuenta a ellos).
 * Transportes M&C no ve lo de los terceros (se lo quita el servidor).
 */
import { moneda } from "../../api/cliente";
import type { UtilidadesMes } from "../../api/cliente";
import Indicador from "../../componentes/Indicador";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import { nombreMes } from "./pasos";
import LinksViaje from "../../componentes/LinksViaje";

type ViajeTercero = UtilidadesMes["empresa"]["detalleTerceros"][number];
type Reconocido = UtilidadesMes["empresa"]["detalleReconocidos"][number];

/** Un renglon del estado de resultados: "+" suma, "-" resta, "=" total. */
function Renglon({ t, v, signo }: { t: React.ReactNode; v: number; signo: "+" | "-" | "=" | "" }) {
  const texto = signo === "=" || signo === "" ? moneda(v) : v ? `${signo} ${moneda(Math.abs(v))}` : "-";
  return (
    <tr className={signo === "=" ? "desglose-total" : v ? "" : "desglose-cero"}>
      <td>{t}</td>
      <td className="num">{texto}</td>
    </tr>
  );
}

/** Titulo de un bloque. */
const Titulo = ({ t }: { t: string }) => (
  <tr className="desglose-titulo">
    <th colSpan={2}>{t}</th>
  </tr>
);

/** Estado de resultados de la empresa del mes. */
export default function Empresa({ u, verTerceros }: { u: UtilidadesMes; verTerceros: boolean }) {
  const e = u.empresa;
  const columnas: Columna<ViajeTercero>[] = [
    { id: "fecha", titulo: "Fecha", valor: (v) => v.fecha, celda: (v) => fechaCorta(v.fecha) },
    {
      id: "placa",
      titulo: "Vehiculo",
      valor: (v) => v.placa,
      celda: (v) => (
        <>
          <span className="principal">{placaConGuion(v.placa)}</span>
          <span className="dato-sec">{v.tercero ?? "-"}</span>
        </>
      ),
    },
    {
      id: "cliente",
      titulo: "Cliente",
      filtrable: true,
      valor: (v) => v.cliente,
      buscar: (v) => `${v.remision ?? ""} ${v.manifiesto ?? ""}`,
      celda: (v) => (
        <>
          <span>{v.cliente}</span>
          <LinksViaje remisionUrl={v.remisionUrl} facturaUrl={v.facturaUrl} />
        </>
      ),
    },
    { id: "flete", titulo: "Flete", alinear: "derecha", valor: (v) => Math.round(v.flete), celda: (v) => moneda(v.flete) },
    { id: "saldoEmpresa", titulo: "Saldo empresa", alinear: "derecha", valor: (v) => Math.round(v.saldoEmpresa), celda: (v) => moneda(v.saldoEmpresa) },
    { id: "saldoTercero", titulo: "Saldo tercero", alinear: "derecha", valor: (v) => Math.round(v.saldoTercero), celda: (v) => moneda(v.saldoTercero) },
    {
      id: "rentabilidad",
      titulo: "Rentabilidad",
      alinear: "derecha",
      valor: (v) => Math.round(v.rentabilidad),
      celda: (v) => (
        <>
          <strong className={v.rentabilidad < 0 ? "texto-vencido" : undefined}>{moneda(v.rentabilidad)}</strong>
          {v.sinPactar && <Pastilla tono="aviso">Sin pactar</Pastilla>}
        </>
      ),
    },
    { id: "renta", titulo: "Anticipo de renta", alinear: "derecha", valor: (v) => Math.round(v.anticipoRenta), celda: (v) => moneda(v.anticipoRenta) },
  ];
  const columnasReconocidos: Columna<Reconocido>[] = [
    { id: "fecha", titulo: "Fecha", valor: (v) => v.fecha, celda: (v) => fechaCorta(v.fecha) },
    { id: "placa", titulo: "Vehiculo", valor: (v) => v.placa, celda: (v) => <span className="principal">{placaConGuion(v.placa)}</span> },
    {
      id: "cliente",
      titulo: "Cliente",
      valor: (v) => v.cliente,
      buscar: (v) => v.manifiesto ?? "",
      celda: (v) => (
        <>
          <span>{v.cliente}</span>
          <LinksViaje remisionUrl={v.remisionUrl} facturaUrl={v.facturaUrl} />
        </>
      ),
    },
    { id: "flete", titulo: "Flete", alinear: "derecha", valor: (v) => Math.round(v.flete), celda: (v) => moneda(v.flete) },
    { id: "descuentos", titulo: "Retencion, ICA y Super", alinear: "derecha", valor: (v) => Math.round(v.descuentos), celda: (v) => moneda(v.descuentos) },
    { id: "ingreso", titulo: "Para la empresa", alinear: "derecha", valor: (v) => Math.round(v.ingreso), celda: (v) => <strong>{moneda(v.ingreso)}</strong> },
    { id: "renta", titulo: "Anticipo de renta", alinear: "derecha", valor: (v) => Math.round(v.anticipoRenta), celda: (v) => moneda(v.anticipoRenta) },
  ];
  const sinPactar = e.detalleTerceros.filter((v) => v.sinPactar);
  return (
    <>
      {verTerceros && sinPactar.length > 0 && (
        <div className="alert warning" style={{ marginBottom: "0.75rem" }}>
          {sinPactar.length} viaje(s) de terceros sin valor pactado en Pago a terceros: su rentabilidad no es real (sale todo el flete como si fuera de la
          empresa, {moneda(sinPactar.reduce((t, v) => t + v.rentabilidad, 0))}). Pacta el valor con el tercero para que cuadre.
        </div>
      )}
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador
          dinero
          titulo="Ingresos de la empresa"
          valor={moneda(e.ingresos)}
          detalle={verTerceros ? "terceros, reconocidos y T. Lopez" : "reconocidos y T. Lopez"}
        />
        <Indicador dinero titulo="Gastos de la empresa" valor={moneda(e.totalGastos)} detalle={`${e.gastos.length} gasto(s) que asume la empresa`} />
        <Indicador
          dinero
          titulo="Utilidad de la empresa"
          valor={moneda(e.utilidad)}
          detalle={verTerceros ? `${nombreMes(u.mes)} · no se reparte entre socios` : "sin los viajes de terceros"}
          alerta={e.utilidad < 0}
        />
        <Indicador dinero titulo="Anticipo de renta del mes" valor={moneda(e.anticipoRenta.total)} detalle="se cruza en la declaracion (no es gasto)" />
      </div>

      <div className="cuenta-vehiculo-pie" style={{ marginTop: 0 }}>
        <div className="panel">
          <h4 style={{ marginTop: 0 }}>Estado de resultados de {nombreMes(u.mes)}</h4>
          <table className="tabla tabla-compacta desglose">
            <tbody className="desglose-empresa">
              <Titulo t="1. Ingresos de la empresa" />
              {verTerceros && <Renglon t={`Rentabilidad de ${e.viajesTerceros} viajes de terceros`} v={e.gananciaTerceros} signo="+" />}
              <Renglon t={`Reconocidos (${e.detalleReconocidos.length})`} v={e.reconocidos} signo="+" />
              <Renglon t="T. Lopez cobrado en los viajes" v={e.tLopez} signo="+" />
              <Renglon t="Total ingresos" v={e.ingresos} signo="=" />
            </tbody>
            <tbody className="desglose-generales">
              <Titulo t="2. Gastos de la empresa" />
              {e.gastos.length ? (
                e.gastos.map((g, i) => (
                  <Renglon
                    key={i}
                    t={
                      <>
                        {g.descripcion} <span className="dato-sec">{g.empresa === "MYC" ? "T. M&C" : "T. Lopez"}</span>
                      </>
                    }
                    v={g.monto < 0 ? -g.monto : g.monto}
                    signo={g.monto < 0 ? "+" : "-"}
                  />
                ))
              ) : (
                <tr className="desglose-cero">
                  <td colSpan={2}>Ningun gasto de la empresa en el mes.</td>
                </tr>
              )}
              <Renglon t="Total gastos" v={e.totalGastos} signo="=" />
            </tbody>
            <tbody className="desglose-resultado">
              <Titulo t="3. Utilidad de la empresa" />
              <Renglon t="Ingresos - gastos" v={e.utilidad} signo="=" />
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h4 style={{ marginTop: 0 }}>Anticipo de renta</h4>
          <table className="tabla tabla-compacta desglose">
            <tbody className="desglose-anticipo">
              <Titulo t="Impuesto pagado por adelantado" />
              <Renglon t="Lo asume la empresa (terceros y reconocidos)" v={e.anticipoRenta.asumido} signo="" />
              <Renglon t="Se les descuenta a los socios (sus carros)" v={e.anticipoRenta.descontadoSocios} signo="" />
              <Renglon t="Total del mes (se cruza en la declaracion)" v={e.anticipoRenta.total} signo="=" />
            </tbody>
            <tbody className="desglose-resultado">
              <Titulo t="Plata que le queda a la empresa" />
              <Renglon t="Utilidad - anticipo que asume la empresa" v={e.despuesDeAnticipo} signo="=" />
            </tbody>
          </table>
          <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
            El anticipo de renta no es un gasto: se descuenta del impuesto de renta en la declaracion del ano.
          </div>
          <h4 style={{ margin: "1rem 0 0.4rem" }}>T. Lopez por vehiculo</h4>
          {e.detalleTLopez.length ? (
            <table className="tabla tabla-compacta">
              <tbody>
                {e.detalleTLopez.map((t) => (
                  <tr key={t.placa}>
                    <td>
                      <strong>{placaConGuion(t.placa)}</strong> <span className="dato-sec">{t.viajes} viaje(s)</span>
                    </td>
                    <td className="num">{moneda(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="dato-sec">No se cobro T. Lopez en los viajes del mes.</span>
          )}
        </div>
      </div>

      <h4 style={{ margin: "1rem 0 0.4rem" }}>Reconocidos del mes</h4>
      <div className="panel">
        <TablaDatos
          filas={e.detalleReconocidos}
          columnas={columnasReconocidos}
          clave={(v) => v.id}
          nombreArchivo={`reconocidos-empresa-${u.mes}`}
          placeholderBusqueda="Buscar placa, cliente o manifiesto..."
          vacio="No hay reconocidos en el mes."
        />
      </div>
      {verTerceros && (
        <>
          <h4 style={{ margin: "1rem 0 0.4rem" }}>Viajes de terceros</h4>
          <div className="panel">
            <TablaDatos
              filas={e.detalleTerceros}
              columnas={columnas}
              clave={(v) => v.id}
              nombreArchivo={`rentabilidad-empresa-${u.mes}`}
              placeholderBusqueda="Buscar placa, tercero, cliente, remision o manifiesto..."
              vacio="No hay viajes de terceros en el mes."
            />
          </div>
        </>
      )}
    </>
  );
}
