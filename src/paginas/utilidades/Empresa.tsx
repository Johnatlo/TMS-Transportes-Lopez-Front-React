/**
 * Rentabilidad de la empresa en el mes: la ganancia de los viajes de terceros
 * (de Rentabilidad) menos los gastos que asume la empresa (los que en el libro
 * van a "Empresa", no a un carro ni a un socio). No se reparte entre socios.
 * Transportes M&C no ve la de los terceros (se la quita el servidor).
 */
import { moneda } from "../../api/cliente";
import type { UtilidadesMes } from "../../api/cliente";
import Indicador from "../../componentes/Indicador";
import TablaDatos from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import { nombreMes } from "./pasos";

type ViajeTercero = UtilidadesMes["empresa"]["detalleTerceros"][number];

/** Rentabilidad de la empresa del mes. */
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
    { id: "cliente", titulo: "Cliente", filtrable: true, valor: (v) => v.cliente, celda: (v) => v.cliente },
    { id: "flete", titulo: "Flete", alinear: "derecha", valor: (v) => Math.round(v.flete), celda: (v) => moneda(v.flete) },
    { id: "saldoEmpresa", titulo: "Saldo empresa", alinear: "derecha", valor: (v) => Math.round(v.saldoEmpresa), celda: (v) => moneda(v.saldoEmpresa) },
    { id: "saldoTercero", titulo: "Saldo tercero", alinear: "derecha", valor: (v) => Math.round(v.saldoTercero), celda: (v) => moneda(v.saldoTercero) },
    { id: "renta", titulo: "Anticipo de renta", alinear: "derecha", valor: (v) => Math.round(v.anticipoRenta), celda: (v) => moneda(v.anticipoRenta) },
    {
      id: "ganancia",
      titulo: "Ganancia",
      alinear: "derecha",
      valor: (v) => Math.round(v.ganancia),
      celda: (v) => <strong className={v.ganancia < 0 ? "texto-vencido" : undefined}>{moneda(v.ganancia)}</strong>,
    },
  ];
  return (
    <>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        {verTerceros && (
          <Indicador
            dinero
            titulo="Ganancia de viajes de terceros"
            valor={moneda(e.gananciaTerceros)}
            detalle={`${e.viajesTerceros} viajes en ${nombreMes(u.mes)}`}
          />
        )}
        <Indicador dinero titulo="Gastos de la empresa" valor={moneda(e.totalGastos)} detalle={`${e.gastos.length} gasto(s) que asume la empresa`} />
        {verTerceros && (
          <Indicador dinero titulo="Rentabilidad de la empresa" valor={moneda(e.utilidad)} detalle="no se reparte entre socios" alerta={e.utilidad < 0} />
        )}
      </div>
      <div className="section-desc" style={{ marginBottom: "0.5rem" }}>
        Es de la empresa y no se reparte: el reparto entre socios es solo de los vehiculos que tienen dueno o socios. Un gasto va aqui cuando en el libro se
        marca "Empresa" como destino.
      </div>
      <h4 style={{ margin: "0.6rem 0 0.4rem" }}>Gastos que asume la empresa</h4>
      <div className="panel" style={{ padding: "0.6rem 0.8rem" }}>
        {e.gastos.length ? (
          e.gastos.map((g, i) => (
            <div key={i} className="concepto-nomina">
              <span>
                {g.descripcion} <span className="dato-sec">{g.empresa === "MYC" ? "T. M&C" : "T. Lopez"}</span>
              </span>
              <span>{g.monto < 0 ? `+ ${moneda(-g.monto)}` : `- ${moneda(g.monto)}`}</span>
            </div>
          ))
        ) : (
          <span className="dato-sec">Ningun gasto de la empresa en el mes.</span>
        )}
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
              placeholderBusqueda="Buscar placa, tercero o cliente..."
              vacio="No hay viajes de terceros en el mes."
            />
          </div>
        </>
      )}
    </>
  );
}
