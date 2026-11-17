/**
 * Pantalla Utilidades: cascada de rentabilidad por vehiculo, fondos y reparto
 * entre socios, rentabilidad de la empresa, participaciones y socios, mes a mes.
 *
 * - Cascada: por vehiculo, 1. fletes, 2. descuentos del viaje, 3. costos
 *   directos (anticipos de los viajes y gastos que van completos al carro),
 *   4. nomina del conductor, 5. gastos generales prorrateados, 6. utilidad.
 *   Clic en un vehiculo muestra cada paso con su detalle (viajes y gastos).
 * - Fondos y reparto (no lo ven las administrativas): ver FondosReparto.tsx.
 * - Empresa: ganancia de terceros (no la ve M&C) menos los gastos de la
 *   empresa. No se reparte.
 * - Participaciones: quien es dueno de cada vehiculo (sociedades).
 * - Socios (no lo ven las administrativas): la cuenta de cada socio.
 * Aprobar el reparto y cambiar fondos, participaciones y socios: rol total.
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
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import { puede } from "../../permisos";
import Empresa from "./Empresa";
import FondosReparto from "./FondosReparto";
import Participaciones from "./Participaciones";
import Socios from "./Socios";
import { exportarCascada, exportarDetalle } from "./excelUtilidades";
import { DESCUENTOS, mesAnterior, nombreMes } from "./pasos";

type Vista = "cascada" | "reparto" | "empresa" | "participaciones" | "socios";
type FilaVehiculo = UtilidadesMes["vehiculos"][number];

/** Pantalla de utilidades. */
export default function Utilidades() {
  const { usuario } = useSesion();
  const total = usuario?.rol === "TOTAL";
  const veReparto = puede(usuario?.rol, "REPARTO");
  const verTerceros = usuario?.rol !== "MYC";
  const [mes, setMes] = useState(mesAnterior(hoyColombia().slice(0, 7)));
  const [vista, setVista] = useState<Vista>("cascada");
  // Al volver de Participaciones o Socios se recarga (pudo cambiar una participacion o aprobarse algo).
  const enMes = vista === "cascada" || vista === "reparto" || vista === "empresa";
  const carga = useDatos(() => apiUtilidades.mes(mes), [mes, enMes]);
  // Meses para elegir: los 18 ultimos.
  const meses: string[] = [];
  for (let m = hoyColombia().slice(0, 7), i = 0; i < 18; i++, m = mesAnterior(m)) meses.push(m);

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
          {(
            [
              ["cascada", "Cascada por vehiculo"],
              ...(veReparto ? [["reparto", "Fondos y reparto"] as [Vista, string]] : []),
              ["empresa", "Empresa"],
              ["participaciones", "Participaciones"],
              ...(veReparto ? [["socios", "Socios"] as [Vista, string]] : []),
            ] as Array<[Vista, string]>
          ).map(([id, etiqueta]) => (
            <button key={id} type="button" className={vista === id ? "activo" : ""} onClick={() => setVista(id)}>
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
      {vista === "socios" ? (
        <Socios editable={total} />
      ) : vista === "participaciones" ? (
        <Participaciones editable={total} />
      ) : carga.cargando && !u ? (
        <Cargando que="las utilidades" />
      ) : carga.error || !u ? (
        <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />
      ) : (
        <>
          {vista !== "empresa" && <Resumen u={u} />}
          {vista === "cascada" && <Cascada u={u} />}
          {vista === "reparto" && <FondosReparto datos={u} total={total} alCambiar={carga.recargar} />}
          {vista === "empresa" && <Empresa u={u} verTerceros={verTerceros} />}
        </>
      )}
    </>
  );
}

/** Totales del mes. */
function Resumen({ u }: { u: UtilidadesMes }) {
  const s = (f: (c: FilaVehiculo["cascada"]) => number) => u.vehiculos.reduce((t, v) => t + f(v.cascada), 0);
  return (
    <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
      <Indicador dinero titulo="Ingresos por fletes" valor={moneda(s((c) => c.ingresos))} detalle={`${s((c) => c.viajes)} viajes de la flota propia`} />
      <Indicador dinero titulo="Descuentos y costos directos" valor={moneda(s((c) => c.totalDescuentos + c.totalDirectos))} detalle="pasos 2 y 3" />
      <Indicador dinero titulo="Nomina y gastos generales" valor={moneda(s((c) => c.totalConductor + c.totalGenerales))} detalle="pasos 4 y 5" />
      <Indicador dinero titulo="Utilidad neta" valor={moneda(s((c) => c.utilidad))} detalle={nombreMes(u.mes)} alerta={s((c) => c.utilidad) < 0} />
    </div>
  );
}

/** Cascada por vehiculo. */
function Cascada({ u }: { u: UtilidadesMes }) {
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
    <div className="panel">
      <TablaDatos
        filas={u.vehiculos}
        columnas={columnas}
        clave={(v) => v.vehiculoId}
        nombreArchivo={`utilidades-${u.mes}`}
        alExportar={() => exportarCascada(u)}
        placeholderBusqueda="Buscar placa o socio..."
        acciones={
          <button className="boton-barra" onClick={() => exportarDetalle(u)}>
            Exportar detalle
          </button>
        }
        detalle={(v) => <DetalleCascada v={v} />}
      />
    </div>
  );
}

/** Cada paso de la cascada de un vehiculo con su detalle. */
function DetalleCascada({ v }: { v: FilaVehiculo }) {
  const c = v.cascada;
  const [viajes, setViajes] = useState(false);
  /** Un concepto: los que restan con "-" y los ingresos repartidos (negativos) con "+". */
  const linea = (t: string, x: number, fuerte = false) => (
    <div className="concepto-nomina">
      <span>{t}</span>
      {fuerte ? <strong>{moneda(x)}</strong> : <span>{x < 0 ? `+ ${moneda(-x)}` : x > 0 ? `- ${moneda(x)}` : moneda(0)}</span>}
    </div>
  );
  return (
    <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
      <div className="detalle-nomina">
        <div>
          <h5>1. Ingresos por fletes ({c.viajes} viajes)</h5>
          {linea("Fletes", c.ingresos, true)}
          <h5 style={{ marginTop: "0.6rem" }}>2. Descuentos del viaje</h5>
          {DESCUENTOS.filter(([k]) => c.descuentos[k]).map(([k, t]) => (
            <div key={k}>{linea(t, c.descuentos[k])}</div>
          ))}
          {linea("Total descuentos", c.totalDescuentos, true)}
        </div>
        <div>
          <h5>3. Costos directos</h5>
          {linea("Anticipos de los viajes", c.anticipos)}
          {c.directos.map((p) => (
            <div key={p.gastoId}>{linea(p.descripcion, p.monto)}</div>
          ))}
          {linea("Total directos", c.totalDirectos, true)}
          <h5 style={{ marginTop: "0.6rem" }}>4. Nomina del conductor</h5>
          {c.conductor.length ? (
            c.conductor.map((p) => <div key={p.gastoId}>{linea(p.descripcion, p.monto)}</div>)
          ) : (
            <span className="dato-sec">Sin nomina aprobada en el mes.</span>
          )}
        </div>
        <div>
          <h5>5. Gastos generales prorrateados</h5>
          {c.generales.length ? (
            c.generales.map((p) => <div key={p.gastoId}>{linea(p.descripcion, p.monto)}</div>)
          ) : (
            <span className="dato-sec">Sin gastos generales en el mes.</span>
          )}
          {linea("Total generales", c.totalGenerales, true)}
          <h5 style={{ marginTop: "0.6rem" }}>6. Utilidad neta</h5>
          {linea("Utilidad", c.utilidad, true)}
          <div className="dato-sec" style={{ marginTop: "0.3rem" }}>
            Ya liquidado al dueno por los viajes: {moneda(c.saldoViajes)}
          </div>
        </div>
      </div>
      {v.detalleViajes.length > 0 && (
        <>
          <button className="btn-link" onClick={() => setViajes(!viajes)}>
            {viajes ? "Ocultar viajes" : `Ver los ${v.detalleViajes.length} viajes`}
          </button>
          {viajes && (
            <div style={{ overflowX: "auto" }}>
              <table className="tabla tabla-compacta">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Manifiesto</th>
                    <th>Cliente</th>
                    <th className="num">Flete</th>
                    <th className="num">Descuentos</th>
                    <th className="num">Anticipo</th>
                    <th className="num">Saldo al dueno</th>
                  </tr>
                </thead>
                <tbody>
                  {v.detalleViajes.map((t) => (
                    <tr key={t.id}>
                      <td>{fechaCorta(t.fecha)}</td>
                      <td>{t.manifiesto ?? "-"}</td>
                      <td>{t.cliente}</td>
                      <td className="num">{moneda(t.flete)}</td>
                      <td className="num">{moneda(DESCUENTOS.reduce((s, [k]) => s + t[k], 0))}</td>
                      <td className="num">{moneda(t.anticipo)}</td>
                      <td className="num">{moneda(t.saldoBeneficiario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
