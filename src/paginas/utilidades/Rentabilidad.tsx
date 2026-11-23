/**
 * Rentabilidad: cuanto deja cada carro y cuanto deja la empresa, mes a mes.
 * Lee lo que calculan los demas modulos (Liquidacion de viajes, Gastos,
 * Nomina, Cuentas conductores); no calcula nada aparte.
 *
 * - Consolidado: los carros de T. Lopez, los de T. M&C y la empresa, con el
 *   total del mes (lo de los carros es de sus duenos y socios; lo de la
 *   empresa no se reparte).
 * - Empresa: el estado de resultados (terceros + reconocidos + T. Lopez -
 *   gastos de la empresa) y el anticipo de renta aparte (ver Empresa.tsx).
 * - Vehiculos: la cascada de cada carro (fletes, descuentos, directos,
 *   conductor, generales y utilidad); clic para ver cada paso.
 * - Cuenta del vehiculo: lo que era el cuadro SWK-973, viaje por viaje (ver
 *   CuentaVehiculo.tsx).
 * El rol total ve todo y filtra los carros por empresa. M&C solo ve la cuenta
 * de sus vehiculos (y de los visibles para todos): ni la empresa, ni el
 * consolidado, ni la cascada de los demas carros. Las administrativas no
 * entran a Rentabilidad.
 * El reparto entre socios esta en Reparto a socios.
 */
import { useState } from "react";
import { apiUtilidades, hoyColombia, moneda } from "../../api/cliente";
import type { UtilidadesMes } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { useSesion } from "../../ganchos/useSesion";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import TablaDatos from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { placaConGuion } from "../cuadro/facturacion";
import type { FiltroEmpresa } from "../conductores/LiquidacionConductores";
import CuentaVehiculo from "./CuentaVehiculo";
import DesgloseVehiculo from "./DesgloseVehiculo";
import Empresa from "./Empresa";
import { exportarCascada, exportarDetalle } from "./excelUtilidades";
import { mesAnterior, nombreMes } from "./pasos";

type Vista = "consolidado" | "empresa" | "vehiculos" | "cuenta";
type FilaVehiculo = UtilidadesMes["vehiculos"][number];

const VISTAS: Array<[Vista, string]> = [
  ["consolidado", "Consolidado"],
  ["empresa", "Empresa"],
  ["vehiculos", "Vehiculos"],
  ["cuenta", "Cuenta del vehiculo"],
];

/** Pantalla de rentabilidad. */
export default function Rentabilidad() {
  const { usuario } = useSesion();
  const soloMyc = usuario?.rol === "MYC";
  const [mes, setMes] = useState(mesAnterior(hoyColombia().slice(0, 7)));
  const vistas = soloMyc ? VISTAS.filter(([id]) => id === "cuenta") : VISTAS;
  const [vista, setVista] = useState<Vista>(soloMyc ? "cuenta" : "consolidado");
  const [empresa, setEmpresa] = useState<FiltroEmpresa>("TODAS");
  // La cuenta del vehiculo carga lo suyo; lo demas, el mes de Utilidades.
  const carga = useDatos(() => (vista === "cuenta" ? Promise.resolve(null) : apiUtilidades.mes(mes)), [mes, vista === "cuenta"]);
  // Meses para elegir: los 18 ultimos.
  const meses: string[] = [];
  for (let m = hoyColombia().slice(0, 7), i = 0; i < 18; i++, m = mesAnterior(m)) meses.push(m);
  const conFiltro = !soloMyc && (vista === "vehiculos" || vista === "cuenta");

  const u = carga.datos;
  return (
    <>
      <div className="barra-envio" style={{ marginBottom: "0.75rem" }}>
        <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
          {meses.map((m) => (
            <option key={m} value={m}>
              {nombreMes(m)}
            </option>
          ))}
        </select>
        <div className="selector-vista" role="group" aria-label="Vista">
          {vistas.map(([id, etiqueta]) => (
            <button key={id} type="button" className={vista === id ? "activo" : ""} onClick={() => setVista(id)}>
              {etiqueta}
            </button>
          ))}
        </div>
        {conFiltro && (
          <div className="selector-vista" role="group" aria-label="Empresa">
            {(
              [
                ["TODAS", "Todos los vehiculos"],
                ["LOPEZ", "T. Lopez"],
                ["MYC", "T. M&C"],
              ] as Array<[FiltroEmpresa, string]>
            ).map(([id, etiqueta]) => (
              <button key={id} type="button" className={empresa === id ? "activo" : ""} onClick={() => setEmpresa(id)}>
                {etiqueta}
              </button>
            ))}
          </div>
        )}
      </div>
      {vista === "cuenta" ? (
        <CuentaVehiculo mes={mes} empresa={empresa} />
      ) : carga.cargando && !u ? (
        <Cargando que="la rentabilidad" />
      ) : carga.error || !u ? (
        <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />
      ) : (
        <>
          {vista === "consolidado" && <Consolidado u={u} verTerceros />}
          {vista === "empresa" && <Empresa u={u} verTerceros />}
          {vista === "vehiculos" && <Vehiculos u={u} empresa={empresa} />}
        </>
      )}
    </>
  );
}

/** Lo de un grupo en el consolidado. */
interface Linea {
  nombre: string;
  detalle: string;
  ingresos: number;
  costos: number;
  utilidad: number;
  tono: string;
}

/** Los carros de T. Lopez, los de T. M&C y la empresa, con el total del mes. */
function Consolidado({ u, verTerceros }: { u: UtilidadesMes; verTerceros: boolean }) {
  const carros = (emp: string): Linea => {
    const vs = u.vehiculos.filter((v) => v.empresa === emp);
    const s = (f: (c: FilaVehiculo["cascada"]) => number) => vs.reduce((t, v) => t + f(v.cascada), 0);
    return {
      nombre: emp === "MYC" ? "Carros de T. M&C" : "Carros de T. Lopez",
      detalle: `${vs.length} carros · ${s((c) => c.viajes)} viajes · de sus duenos y socios`,
      ingresos: s((c) => c.ingresos),
      costos: s((c) => c.totalDescuentos + c.totalDirectos + c.totalConductor + c.totalGenerales),
      utilidad: s((c) => c.utilidad),
      tono: emp === "MYC" ? "desglose-dueno" : "desglose-empresa",
    };
  };
  const e = u.empresa;
  const lineas: Linea[] = [
    carros("LOPEZ"),
    carros("MYC"),
    {
      nombre: "Empresa",
      detalle: verTerceros ? "terceros, reconocidos y T. Lopez - gastos · no se reparte" : "reconocidos y T. Lopez - gastos (sin terceros)",
      ingresos: e.ingresos,
      costos: e.totalGastos,
      utilidad: e.utilidad,
      tono: "desglose-anticipo",
    },
  ];
  const total = lineas.reduce((t, l) => t + l.utilidad, 0);
  const deCarros = lineas[0].utilidad + lineas[1].utilidad;
  return (
    <>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador dinero titulo="Utilidad de los carros" valor={moneda(deCarros)} detalle="de sus duenos y socios (se reparte)" alerta={deCarros < 0} />
        <Indicador dinero titulo="Utilidad de la empresa" valor={moneda(e.utilidad)} detalle="no se reparte" alerta={e.utilidad < 0} />
        <Indicador dinero titulo="Total del mes" valor={moneda(total)} detalle={nombreMes(u.mes)} alerta={total < 0} />
        <Indicador dinero titulo="Anticipo de renta" valor={moneda(e.anticipoRenta.total)} detalle="se cruza en la declaracion (no es gasto)" />
      </div>
      <div className="panel">
        <table className="tabla tabla-compacta desglose">
          <thead>
            <tr>
              <th />
              <th className="num">Ingresos</th>
              <th className="num">Descuentos, costos y gastos</th>
              <th className="num">Utilidad</th>
            </tr>
          </thead>
          {lineas.map((l) => (
            <tbody key={l.nombre} className={l.tono}>
              <tr>
                <td>
                  <strong>{l.nombre}</strong>
                  <span className="dato-sec" style={{ display: "block" }}>
                    {l.detalle}
                  </span>
                </td>
                <td className="num">{moneda(l.ingresos)}</td>
                <td className="num">- {moneda(l.costos)}</td>
                <td className="num">
                  <strong className={l.utilidad < 0 ? "texto-vencido" : undefined}>{moneda(l.utilidad)}</strong>
                </td>
              </tr>
            </tbody>
          ))}
          <tbody className="desglose-resultado">
            <tr className="desglose-total">
              <td>Total del mes</td>
              <td className="num">{moneda(lineas.reduce((t, l) => t + l.ingresos, 0))}</td>
              <td className="num">- {moneda(lineas.reduce((t, l) => t + l.costos, 0))}</td>
              <td className="num">{moneda(total)}</td>
            </tr>
          </tbody>
        </table>
        <div className="dato-sec" style={{ padding: "0.5rem 0.8rem" }}>
          Lo de los carros sale de su cascada (pestana Vehiculos) y se reparte en Reparto a socios. Lo de la empresa sale de su estado de resultados (pestana
          Empresa).
        </div>
      </div>
    </>
  );
}

/** Cascada por vehiculo (filtrada por empresa). */
function Vehiculos({ u, empresa }: { u: UtilidadesMes; empresa: FiltroEmpresa }) {
  const filas = u.vehiculos.filter((v) => empresa === "TODAS" || v.empresa === empresa);
  const s = (f: (c: FilaVehiculo["cascada"]) => number) => filas.reduce((t, v) => t + f(v.cascada), 0);
  const num = (titulo: string, f: (c: FilaVehiculo["cascada"]) => number, fuerte = false): Columna<FilaVehiculo> => ({
    id: titulo,
    titulo,
    alinear: "derecha",
    valor: (v) => Math.round(f(v.cascada)),
    celda: (v) => {
      const x = f(v.cascada);
      const texto = x === 0 ? "-" : moneda(x);
      return fuerte ? <strong className={x < 0 ? "texto-vencido" : undefined}>{texto}</strong> : texto;
    },
  });
  const columnas: Columna<FilaVehiculo>[] = [
    {
      id: "placa",
      titulo: "Vehiculo",
      valor: (v) => v.placa,
      celda: (v) => (
        <>
          <span className="principal">{placaConGuion(v.placa)}</span>
          <span className="dato-sec">
            {v.participaciones.map((p) => (p.porcentaje === 100 ? p.socio : `${p.socio} ${p.porcentaje} %`)).join(" + ") || "Sin participacion"}
          </span>
        </>
      ),
    },
    {
      id: "empresa",
      titulo: "Empresa",
      filtrable: true,
      valor: (v) => (v.empresa === "MYC" ? "T. M&C" : "T. Lopez"),
      celda: (v) => (v.empresa === "MYC" ? "T. M&C" : "T. Lopez"),
    },
    { id: "viajes", titulo: "Viajes", alinear: "derecha", valor: (v) => v.cascada.viajes, celda: (v) => v.cascada.viajes },
    num("1. Fletes", (c) => c.ingresos),
    num("2. Descuentos", (c) => c.totalDescuentos),
    num("3. Directos", (c) => c.totalDirectos),
    num("4. Conductor", (c) => c.totalConductor),
    num("5. Generales", (c) => c.totalGenerales),
    num("6. Utilidad", (c) => c.utilidad, true),
  ];
  return (
    <>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador dinero titulo="Ingresos por fletes" valor={moneda(s((c) => c.ingresos))} detalle={`${s((c) => c.viajes)} viajes de la flota propia`} />
        <Indicador dinero titulo="Descuentos y costos directos" valor={moneda(s((c) => c.totalDescuentos + c.totalDirectos))} detalle="pasos 2 y 3" />
        <Indicador dinero titulo="Nomina y gastos generales" valor={moneda(s((c) => c.totalConductor + c.totalGenerales))} detalle="pasos 4 y 5" />
        <Indicador dinero titulo="Utilidad neta" valor={moneda(s((c) => c.utilidad))} detalle={nombreMes(u.mes)} alerta={s((c) => c.utilidad) < 0} />
      </div>
      <div className="panel">
        <TablaDatos
          filas={filas}
          columnas={columnas}
          clave={(v) => v.vehiculoId}
          nombreArchivo={`rentabilidad-vehiculos-${u.mes}`}
          alExportar={() => exportarCascada(u)}
          placeholderBusqueda="Buscar placa o socio..."
          acciones={
            <button className="boton-barra" onClick={() => exportarDetalle(u)}>
              Exportar detalle
            </button>
          }
          detalle={(v) => <DesgloseVehiculo v={v} />}
        />
      </div>
    </>
  );
}
