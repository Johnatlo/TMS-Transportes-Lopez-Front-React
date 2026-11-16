/**
 * Pantalla Utilidades (fase 3 del modulo de gastos): cascada de rentabilidad
 * por vehiculo y reparto de la utilidad entre los socios, mes a mes.
 *
 * - Cascada: por vehiculo, 1. fletes, 2. descuentos del viaje, 3. costos
 *   directos (anticipos de los viajes y gastos que van completos al carro),
 *   4. nomina del conductor, 5. gastos generales prorrateados, 6. utilidad.
 *   Clic en un vehiculo muestra cada paso con su detalle (viajes y gastos).
 * - Reparto: la utilidad de cada vehiculo segun su participacion, menos los
 *   gastos propios de cada socio; y la diferencia contra lo que ya se le
 *   liquido al dueno por los viajes.
 * - Participaciones: quien es dueno de cada vehiculo (sociedades).
 * - Socios (rol total): los de la empresa y los externos, con su cuenta:
 *   lo repartido en los meses aprobados, los pagos y el saldo.
 * - El rol total aprueba el reparto de un mes cerrado: queda la foto.
 */
import { useState } from "react";
import { apiUtilidades, hoyColombia, moneda } from "../../api/cliente";
import type { UtilidadesMes } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { useSesion } from "../../ganchos/useSesion";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import Participaciones from "./Participaciones";
import Socios from "./Socios";
import { exportarCascada, exportarDetalle, exportarReparto } from "./excelUtilidades";
import { DESCUENTOS, mesAnterior, nombreMes } from "./pasos";

type Vista = "cascada" | "reparto" | "participaciones" | "socios";
type FilaVehiculo = UtilidadesMes["vehiculos"][number];
type FilaSocio = UtilidadesMes["socios"][number];

/** Pantalla de utilidades. */
export default function Utilidades() {
  const { usuario } = useSesion();
  const total = usuario?.rol === "TOTAL";
  const [mes, setMes] = useState(mesAnterior(hoyColombia().slice(0, 7)));
  const [vista, setVista] = useState<Vista>("cascada");
  // Al volver de Participaciones o Socios se recarga (pudo cambiar una participacion o aprobarse algo).
  const enMes = vista === "cascada" || vista === "reparto";
  const carga = useDatos(() => apiUtilidades.mes(mes), [mes, enMes]);
  const [error, setError] = useState<string | null>(null);
  // Meses para elegir: los 18 ultimos.
  const meses: string[] = [];
  for (let m = hoyColombia().slice(0, 7), i = 0; i < 18; i++, m = mesAnterior(m)) meses.push(m);

  /** Ejecuta una accion y recarga. */
  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      carga.recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

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
              ["reparto", "Reparto por socio"],
              ["participaciones", "Participaciones"],
              ...(total ? [["socios", "Socios"] as [Vista, string]] : []),
            ] as Array<[Vista, string]>
          ).map(([id, etiqueta]) => (
            <button key={id} type="button" className={vista === id ? "activo" : ""} onClick={() => setVista(id)}>
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="alert danger">{error}</div>}
      {vista === "socios" ? (
        <Socios />
      ) : vista === "participaciones" ? (
        <Participaciones editable={total} />
      ) : carga.cargando && !u ? (
        <Cargando que="las utilidades" />
      ) : carga.error || !u ? (
        <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />
      ) : (
        <>
          <Resumen u={u} />
          <div className="barra-envio" style={{ marginBottom: "0.5rem" }}>
            {u.aprobado ? (
              <Pastilla tono="ok">Reparto aprobado</Pastilla>
            ) : u.cerrado ? (
              <Pastilla tono="info">Mes cerrado</Pastilla>
            ) : (
              <Pastilla tono="aviso">Mes abierto: los valores pueden cambiar</Pastilla>
            )}
            {u.aprobado && (
              <span className="dato-sec">
                Aprobado por {u.aprobado.por ?? "-"} el {fechaCorta(u.aprobado.en.slice(0, 10))}: los valores son la foto de ese dia.
              </span>
            )}
            {total && !u.aprobado && (
              <button
                className="btn-primary"
                style={{ marginLeft: "auto" }}
                disabled={!u.cerrado}
                title={u.cerrado ? undefined : "Primero cierra el mes en Gastos"}
                onClick={() =>
                  window.confirm(`¿Aprobar el reparto de ${nombreMes(u.mes)}? Queda guardado tal como esta.`) && accion(() => apiUtilidades.aprobar(u.mes))
                }
              >
                Aprobar reparto
              </button>
            )}
            {total && u.aprobado && (
              <button
                className="btn-secondary"
                style={{ marginLeft: "auto" }}
                onClick={() =>
                  window.confirm("¿Anular la aprobacion? El reparto se vuelve a calcular con los datos actuales.") && accion(() => apiUtilidades.anular(u.mes))
                }
              >
                Anular aprobacion
              </button>
            )}
          </div>
          {u.sinParticipacion.length > 0 && (
            <div className="alert warning">
              {u.sinParticipacion.map(placaConGuion).join(", ")} no tiene(n) participacion que sume 100 %: su utilidad no se reparte. Registrala en
              Participaciones.
            </div>
          )}
          {vista === "cascada" ? <Cascada u={u} /> : <Reparto u={u} />}
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

/** Reparto por socio. */
function Reparto({ u }: { u: UtilidadesMes }) {
  const placa = (id: number) => placaConGuion(u.vehiculos.find((v) => v.vehiculoId === id)?.placa ?? "?");
  const columnas: Columna<FilaSocio>[] = [
    { id: "socio", titulo: "Socio", valor: (s) => s.nombre, celda: (s) => <span className="principal">{s.nombre}</span> },
    {
      id: "vehiculos",
      titulo: "Vehiculos",
      valor: (s) => s.porVehiculo.length,
      celda: (s) => (
        <span className="dato-sec">
          {s.porVehiculo
            .map((v) =>
              v.porcentaje === 100
                ? placa(v.vehiculoId)
                : v.porcentaje === 0
                  ? `${placa(v.vehiculoId)} (solo liquidacion)`
                  : `${placa(v.vehiculoId)} ${v.porcentaje} %`,
            )
            .join(", ") || "-"}
        </span>
      ),
    },
    {
      id: "utilidad",
      titulo: "Utilidad de sus vehiculos",
      alinear: "derecha",
      valor: (s) => Math.round(s.utilidadVehiculos),
      celda: (s) => moneda(s.utilidadVehiculos),
    },
    {
      id: "propios",
      titulo: "Gastos propios",
      alinear: "derecha",
      valor: (s) => Math.round(s.totalGastosPropios),
      celda: (s) => (s.totalGastosPropios ? `- ${moneda(s.totalGastosPropios)}` : "-"),
    },
    {
      id: "total",
      titulo: "Utilidad del socio",
      alinear: "derecha",
      valor: (s) => Math.round(s.total),
      celda: (s) => <strong className={s.total < 0 ? "texto-vencido" : undefined}>{moneda(s.total)}</strong>,
    },
    { id: "liquidado", titulo: "Ya liquidado (viajes)", alinear: "derecha", valor: (s) => Math.round(s.saldoViajes), celda: (s) => moneda(s.saldoViajes) },
    {
      id: "diferencia",
      titulo: "Diferencia",
      alinear: "derecha",
      valor: (s) => Math.round(s.diferencia),
      celda: (s) => (
        <span className={s.diferencia < 0 ? "texto-vencido" : undefined} title={s.diferencia < 0 ? "Lo que el socio debe devolver" : "Lo que falta por darle"}>
          {moneda(s.diferencia)}
        </span>
      ),
    },
  ];
  return (
    <>
      <div className="section-desc" style={{ marginBottom: "0.5rem" }}>
        Utilidad del socio = su parte de la utilidad neta de cada vehiculo - sus gastos propios. Diferencia = utilidad del socio - lo que ya se le liquido por
        los viajes (la liquidacion de los viajes se le cuenta completa al dueno del vehiculo en Flota): si es negativa, es lo que debe cubrir (nomina, gastos
        generales y directos que no se descontaron en los viajes, o la parte de otro socio de la sociedad que recibio el); si es positiva, lo que falta por
        darle.
      </div>
      <div className="panel">
        <TablaDatos
          filas={u.socios}
          columnas={columnas}
          clave={(s) => s.socioId}
          nombreArchivo={`reparto-${u.mes}`}
          alExportar={() => exportarReparto(u)}
          vacio="No hay utilidad que repartir en el mes."
          detalle={(s) => (
            <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
              <div className="detalle-nomina">
                <div>
                  <h5>Por vehiculo</h5>
                  {s.porVehiculo.map((v) => (
                    <div key={v.vehiculoId} className="concepto-nomina">
                      <span>
                        {placa(v.vehiculoId)} ({v.porcentaje ? `${v.porcentaje} %` : "recibio la liquidacion de los viajes"})
                      </span>
                      <span>{moneda(v.utilidad)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h5>Gastos propios</h5>
                  {s.gastosPropios.length ? (
                    s.gastosPropios.map((g, i) => (
                      <div key={i} className="concepto-nomina">
                        <span>{g.descripcion}</span>
                        <span>{g.monto < 0 ? `+ ${moneda(-g.monto)}` : `- ${moneda(g.monto)}`}</span>
                      </div>
                    ))
                  ) : (
                    <span className="dato-sec">Ninguno en el mes.</span>
                  )}
                </div>
              </div>
            </div>
          )}
        />
      </div>
    </>
  );
}
