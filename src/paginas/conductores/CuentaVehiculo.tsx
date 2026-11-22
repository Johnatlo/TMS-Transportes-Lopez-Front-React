/**
 * Cuenta del vehiculo (lo que era el cuadro SWK-973 en Excel): arriba cada
 * carro de la flota propia con lo que produjo y lo que le queda en el mes
 * (clic para verlo); abajo, del carro elegido:
 * - Sus viajes: flete de la empresa, descuentos, producido (flete -
 *   descuentos), anticipo, saldo al dueno con su fecha de pago y, del
 *   conductor, su flete conductor (integro o no), lo que gana (el % o el
 *   integro), lo que gasto y el rojo.
 * - El resumen del mes: la cascada de Utilidades (fletes, descuentos,
 *   anticipos y gastos directos, nomina del conductor, generales y lo que
 *   queda), con los colores de Rentabilidad.
 * - Lo de cada conductor por los viajes de este carro.
 * Todo sale de lo que ya esta en el sistema (Rentabilidad, Cuentas de viaje,
 * Gastos y Nomina); si el mes esta aprobado en Utilidades, es la foto aprobada.
 */
import { useState } from "react";
import { apiConductores, moneda } from "../../api/cliente";
import type { CuentaVehiculo as Cuenta, ViajeCuentaVehiculo } from "../../api/cliente";
import type { FiltroEmpresa } from "./LiquidacionConductores";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import LinksViaje from "../../componentes/LinksViaje";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import DesgloseVehiculo from "../utilidades/DesgloseVehiculo";
import { DESCUENTOS } from "../utilidades/pasos";
import { Saldo } from "./CuentasViaje";

/** Gastos del carro en el mes: anticipos y directos, conductor y generales. */
const gastosDe = (c: Cuenta) => c.cascada.totalDirectos + c.cascada.totalConductor + c.cascada.totalGenerales;

/** Cuentas de los vehiculos del mes. */
export default function CuentaVehiculo({ mes, empresa }: { mes: string; empresa: FiltroEmpresa }) {
  const carga = useDatos(() => apiConductores.cuentasVehiculos(mes), [mes]);
  const [placa, setPlaca] = useState<string | null>(null);
  if (carga.cargando && !carga.datos) return <Cargando que="las cuentas de los vehiculos" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;
  const lista = carga.datos.vehiculos.filter((v) => empresa === "TODAS" || v.empresa === empresa);
  if (!lista.length) return <div className="panel vacio">No hay viajes ni gastos de la flota propia en ese mes.</div>;
  const v = lista.find((x) => x.placa === placa) ?? lista[0];
  const c = v.cascada;

  const columnas: Columna<ViajeCuentaVehiculo>[] = [
    { id: "fecha", titulo: "Fecha", valor: (t) => t.fecha, celda: (t) => fechaCorta(t.fecha) },
    {
      id: "remision",
      titulo: "Remision",
      valor: (t) => t.remision ?? t.manifiesto ?? "",
      celda: (t) => (
        <>
          <span className="codigo">{t.remision ?? t.manifiesto ?? "-"}</span> <LinksViaje remisionUrl={t.remisionUrl} facturaUrl={t.facturaUrl} />
        </>
      ),
    },
    { id: "cliente", titulo: "Empresa", valor: (t) => t.cliente, celda: (t) => t.cliente, filtrable: true },
    { id: "peso", titulo: "Peso (kg)", alinear: "derecha", valor: (t) => t.pesoKg, celda: (t) => (t.pesoKg ? t.pesoKg.toLocaleString("es-CO") : "-") },
    { id: "flete", titulo: "Flete empresa", alinear: "derecha", valor: (t) => t.flete, celda: (t) => moneda(t.flete) },
    {
      id: "descuentos",
      titulo: "Descuentos",
      alinear: "derecha",
      valor: (t) => t.descuentos,
      celda: (t) => (
        <span
          title={DESCUENTOS.filter(([k]) => t.detalleDescuentos[k])
            .map(([k, n]) => `${n}: ${moneda(t.detalleDescuentos[k])}`)
            .join("\n")}
        >
          {moneda(t.descuentos)}
        </span>
      ),
    },
    { id: "producido", titulo: "Producido", alinear: "derecha", valor: (t) => t.producido, celda: (t) => <strong>{moneda(t.producido)}</strong> },
    {
      id: "anticipo",
      titulo: "Anticipo",
      alinear: "derecha",
      valor: (t) => t.anticipo,
      celda: (t) =>
        t.conCuenta ? (
          <span className="dato-sec" title="Tiene cuenta de viaje: cuenta lo gastado (va en los gastos del carro)">
            en la cuenta
          </span>
        ) : (
          moneda(t.anticipo)
        ),
    },
    { id: "saldo", titulo: "Saldo", alinear: "derecha", valor: (t) => t.saldo, celda: (t) => moneda(t.saldo) },
    {
      id: "pago",
      titulo: "Pago saldo",
      valor: (t) => t.fechaPagoSaldo ?? "",
      celda: (t) => (t.fechaPagoSaldo ? fechaCorta(t.fechaPagoSaldo) : <Pastilla tono="aviso">Pendiente</Pastilla>),
    },
    {
      id: "conductor",
      titulo: "Conductor",
      valor: (t) => t.conductor ?? "",
      celda: (t) => t.conductor ?? <span className="dato-sec">Sin asignar</span>,
      filtrable: true,
    },
    {
      id: "fleteConductor",
      titulo: "Flete conductor",
      alinear: "derecha",
      valor: (t) => t.fleteConductor,
      celda: (t) =>
        t.fleteConductor === null ? (
          <span className="texto-aviso">Sin valor</span>
        ) : (
          <>
            {moneda(t.fleteConductor)}
            {t.integro && <span className="dato-sec">integro</span>}
          </>
        ),
    },
    {
      id: "porcentaje",
      titulo: "% / integro",
      alinear: "derecha",
      valor: (t) => t.pagoConductor,
      celda: (t) => (t.pagoConductor === null ? "-" : moneda(t.pagoConductor)),
    },
    {
      id: "gastos",
      titulo: "Gastos viaje",
      alinear: "derecha",
      valor: (t) => t.gastosViaje,
      celda: (t) => (t.gastosViaje === null ? "-" : moneda(t.gastosViaje)),
    },
    {
      id: "rojo",
      titulo: "Rojo",
      alinear: "derecha",
      valor: (t) => t.rojo,
      celda: (t) => (t.rojo === null ? <Pastilla tono="aviso">Sin cuenta</Pastilla> : <Saldo valor={t.rojo} />),
    },
  ];

  return (
    <>
      <div className="tarjetas-vehiculo">
        {lista.map((x) => (
          <button
            key={x.vehiculoId}
            type="button"
            className={`tarjeta-vehiculo${x.vehiculoId === v.vehiculoId ? " activo" : ""}`}
            onClick={() => setPlaca(x.placa)}
          >
            <strong>{placaConGuion(x.placa)}</strong>
            <span className="dato-sec">
              {x.cascada.viajes} viajes{x.dueno ? ` · ${x.dueno}` : ""}
            </span>
            <span className={x.cascada.utilidad < 0 ? "texto-vencido" : "texto-ok"}>Queda {moneda(x.cascada.utilidad)}</span>
          </button>
        ))}
      </div>
      {!carga.datos.aprobado && (
        <div className="dato-sec" style={{ margin: "0 0 0.6rem" }}>
          El mes aun no esta aprobado en Utilidades: los valores cambian si se registran viajes, pagos o gastos.
        </div>
      )}
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador dinero titulo={`Fletes de ${placaConGuion(v.placa)}`} valor={moneda(c.ingresos)} detalle={`${c.viajes} viajes`} />
        <Indicador dinero titulo="Descuentos" valor={moneda(c.totalDescuentos)} detalle="retencion, ICA, renta, comision..." />
        <Indicador dinero titulo="Producido" valor={moneda(c.ingresos - c.totalDescuentos)} detalle="fletes - descuentos" />
        <Indicador dinero titulo="Gastos del carro" valor={moneda(gastosDe(v))} detalle="anticipos, arreglos, conductor y generales" />
        <Indicador dinero titulo="Queda" valor={moneda(c.utilidad)} detalle="lo que deja el carro en el mes" alerta={c.utilidad < 0} />
      </div>
      <div className="panel">
        <TablaDatos
          filas={v.viajes}
          columnas={columnas}
          clave={(t) => t.id}
          nombreArchivo={`cuenta-${v.placa}-${mes}`}
          placeholderBusqueda="Buscar remision, empresa, conductor..."
          vacio="Ese vehiculo no tiene viajes en el mes."
        />
      </div>
      <div className="cuenta-vehiculo-pie">
        <div className="panel">
          <h4 style={{ marginTop: 0 }}>Resumen del mes</h4>
          <DesgloseVehiculo v={{ cascada: c, detalleViajes: [] }} />
        </div>
        <div className="panel">
          <h4 style={{ marginTop: 0 }}>Conductores de {placaConGuion(v.placa)}</h4>
          {v.conductores.length ? (
            <table className="tabla tabla-compacta desglose">
              <thead>
                <tr>
                  <th>Conductor</th>
                  <th className="num">Viajes</th>
                  <th className="num">% / integro</th>
                  <th className="num">Rojo</th>
                  <th className="num">Por estos viajes</th>
                </tr>
              </thead>
              <tbody>
                {v.conductores.map((k) => (
                  <tr key={k.nombre}>
                    <td>{k.nombre}</td>
                    <td className="num">{k.viajes}</td>
                    <td className="num">{moneda(k.pagoConductor)}</td>
                    <td className="num">
                      <Saldo valor={k.rojo} />
                    </td>
                    <td className="num">
                      <strong>{moneda(k.alConductor)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="dato-sec">Sin conductor asignado en los viajes del mes (asignalo en Nomina &gt; Empleados).</div>
          )}
          <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
            Lo que gana por los viajes (el % o el integro) + el rojo de sus cuentas de viaje. El sueldo, los aportes y los prestamos van en la liquidacion del
            conductor; su costo para el carro esta en el resumen (nomina del conductor).
          </div>
        </div>
      </div>
    </>
  );
}
