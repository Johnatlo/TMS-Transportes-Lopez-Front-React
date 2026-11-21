/**
 * Pantalla Nomina (fase 2 del modulo de gastos): liquidaciones por periodo,
 * empleados y parametros por ano.
 *
 * - Liquidacion: se crea con desde y hasta y trae a los empleados activos.
 *   El producido de cada conductor es su PRODUCIDO CONDUCTOR (matriz de fletes
 *   conductor del modulo Cuentas vehiculos; no el flete de la empresa).
 *   Cada conductor muestra tambien el saldo de sus cuentas de viaje, sus
 *   prestamos (lo que se descuenta el mes, editable: es el mismo dato que en
 *   la liquidacion) y el total a pagar.
 *   El producido sale de los viajes del sistema (de
 *   los vehiculos que manejaba en el mes del producido; por defecto el mes en
 *   que empieza la nomina) y se puede ver viaje por viaje. Si hace falta se
 *   escribe a mano y se puede volver al del sistema. En cada linea tambien
 *   van los dias, el vehiculo y un ajuste con nota. Se ve lo que se le paga al empleado y el
 *   costo del empleador (aportes redondeados a la centena + provisiones).
 * - Aprobar crea un gasto por empleado en el libro (categoria Nomina) por su
 *   costo total, causado por dias entre los meses del periodo: el del
 *   conductor a su vehiculo, el de oficina a su reparto. Reabrir los borra.
 * - Exportar saca el Excel con las columnas del modelo de nomina.
 */
import { useEffect, useState } from "react";
import { apiGastos, apiNomina, hoyColombia, moneda } from "../../api/cliente";
import LinksViaje from "../../componentes/LinksViaje";
import type { Empleado, LineaNomina, Nomina as TipoNomina, OpcionesGastos, ViajeProducidoNomina } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { useSesion } from "../../ganchos/useSesion";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import Modal from "../../componentes/Modal";
import { Pastilla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import Empleados from "./Empleados";
import GastoLinea from "./GastoLinea";
import type { CambioGasto } from "./GastoLinea";
import Parametros from "./Parametros";
import { exportarNomina } from "./excelNomina";

type Vista = "nominas" | "empleados" | "parametros";

/** Pantalla de nomina. */
export default function Nomina() {
  const { usuario } = useSesion();
  const carga = useDatos(() => Promise.all([apiNomina.nominas(), apiNomina.empleados(), apiNomina.parametros(), apiGastos.opciones()]), []);
  const [vista, setVista] = useState<Vista>("nominas");

  if (carga.cargando && !carga.datos) return <Cargando que="la nomina" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;
  const [nominas, empleados, parametros, opciones] = carga.datos;

  return (
    <>
      <div className="barra-envio" style={{ marginBottom: "0.75rem" }}>
        <div className="selector-vista" role="group" aria-label="Vista">
          {(
            [
              ["nominas", "Liquidaciones"],
              ["empleados", "Empleados"],
              ["parametros", "Parametros"],
            ] as Array<[Vista, string]>
          ).map(([id, etiqueta]) => (
            <button key={id} type="button" className={vista === id ? "activo" : ""} onClick={() => setVista(id)}>
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
      {vista === "nominas" && (
        <Liquidaciones nominas={nominas} empleados={empleados} opciones={opciones} administra={usuario?.rol !== "MYC"} alCambiar={carga.recargar} />
      )}
      {vista === "empleados" && <Empleados empleados={empleados} opciones={opciones} soloMyc={usuario?.rol === "MYC"} alCambiar={carga.recargar} />}
      {vista === "parametros" && <Parametros parametros={parametros} editable={usuario?.rol === "TOTAL"} alCambiar={carga.recargar} />}
    </>
  );
}

/** "21/10 - 20/11/2026". */
const periodo = (n: Pick<TipoNomina, "desde" | "hasta">) => `${fechaCorta(n.desde).slice(0, 5)} - ${fechaCorta(n.hasta)}`;

/** Liquidaciones: elegir una nomina, editar sus lineas, aprobar o reabrir. */
function Liquidaciones({
  nominas,
  empleados,
  opciones,
  administra,
  alCambiar,
}: {
  nominas: TipoNomina[];
  empleados: Empleado[];
  opciones: OpcionesGastos;
  /** Rol total o administrativo: crea, aprueba, reabre y borra. */
  administra: boolean;
  alCambiar: () => void;
}) {
  const [elegida, setElegida] = useState<number | null>(nominas[0]?.id ?? null);
  const [nueva, setNueva] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [agregar, setAgregar] = useState("");
  const [viajes, setViajes] = useState<LineaNomina | null>(null);
  useEffect(() => {
    if (!nominas.some((n) => n.id === elegida)) setElegida(nominas[0]?.id ?? null);
  }, [nominas, elegida]);
  const n = nominas.find((x) => x.id === elegida) ?? null;

  /** Ejecuta una accion y recarga. */
  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }
  const borrador = n?.estado === "BORRADOR";
  const problemas = n?.lineas.filter((l) => l.problema) ?? [];
  const faltan = n
    ? empleados.filter((e) => !n.lineas.some((l) => l.empleadoId === e.id) && e.fechaIngreso <= n.hasta && (!e.fechaRetiro || e.fechaRetiro >= n.desde))
    : [];

  return (
    <>
      {error && <div className="alert danger">{error}</div>}
      <div className="barra-envio" style={{ marginBottom: "0.75rem" }}>
        {nominas.length > 0 && (
          <select value={elegida ?? ""} onChange={(e) => setElegida(Number(e.target.value))} aria-label="Nomina">
            {nominas.map((x) => (
              <option key={x.id} value={x.id}>
                Nomina {periodo(x)} · {x.estado === "APROBADA" ? "Aprobada" : "Borrador"}
              </option>
            ))}
          </select>
        )}
        {administra && (
          <button className="btn-primary boton-con-texto" onClick={() => setNueva(true)}>
            Nueva nomina
          </button>
        )}
        {n && (
          <button className="boton-barra" onClick={() => exportarNomina(n)}>
            Exportar Excel
          </button>
        )}
      </div>

      {!n && <div className="panel vacio">Aun no hay nominas. Crea los empleados y luego la primera nomina.</div>}
      {n && (
        <>
          <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
            <Indicador dinero titulo="Devengado" valor={moneda(n.totales.devengado)} detalle={`${n.lineas.length} empleado(s)`} />
            <Indicador dinero titulo="Neto a pagar" valor={moneda(n.totales.neto)} detalle="despues de salud y pension" />
            <Indicador dinero titulo="Costo del empleador" valor={moneda(n.totales.costoEmpleador)} detalle="aportes + provisiones" />
            <Indicador dinero titulo="Costo total" valor={moneda(n.totales.costoTotal)} detalle="lo que va a la rentabilidad" />
          </div>
          <div className="barra-envio" style={{ marginBottom: "0.5rem" }}>
            {borrador ? <Pastilla tono="aviso">Borrador</Pastilla> : <Pastilla tono="ok">Aprobada</Pastilla>}
            <span className="dato-sec">
              Parametros {n.anioParametros}
              {n.aprobadaPor && ` · aprobada por ${n.aprobadaPor}`}
            </span>
            <PeriodoProducido n={n} editable={administra && borrador} alCambiar={(d, h) => accion(() => apiNomina.periodoProducido(n.id, d, h))} />
            {administra && borrador && (
              <>
                <button
                  className="btn-primary"
                  style={{ marginLeft: "auto" }}
                  disabled={problemas.length > 0 || !n.lineas.length}
                  onClick={() =>
                    window.confirm(`¿Aprobar la nomina ${periodo(n)}? Se crea un gasto por empleado (${moneda(n.totales.costoTotal)} en total).`) &&
                    accion(() => apiNomina.aprobar(n.id))
                  }
                >
                  Aprobar y llevar a gastos
                </button>
                <button className="btn-link" onClick={() => window.confirm("¿Borrar esta nomina?") && accion(() => apiNomina.borrar(n.id))}>
                  Borrar
                </button>
              </>
            )}
            {administra && !borrador && (
              <button
                className="btn-secondary"
                style={{ marginLeft: "auto" }}
                onClick={() => window.confirm("¿Reabrir la nomina? Se borran sus gastos del libro.") && accion(() => apiNomina.reabrir(n.id))}
              >
                Reabrir
              </button>
            )}
          </div>
          {borrador && problemas.length > 0 && (
            <div className="alert warning">Para aprobar falta: {problemas.map((l) => `${l.nombre} (${l.problema})`).join("; ")}</div>
          )}
          <div className="panel" style={{ overflowX: "auto" }}>
            <table className="tabla tabla-nomina">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Vehiculo</th>
                  <th className="num">Dias</th>
                  <th className="num">Producido conductor</th>
                  <th className="num">Salarial</th>
                  <th className="num">Viaticos</th>
                  <th className="num">Neto nomina</th>
                  <th className="num">Total a pagar</th>
                  <th className="num">Costo empleador</th>
                  <th className="num">Ajuste</th>
                  <th className="num" title="Lo que se carga a los vehiculos (o al reparto): los conceptos marcados">
                    Gasto
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {n.lineas.map((l) => (
                  <FilaLinea
                    key={l.id}
                    l={l}
                    n={n}
                    editable={administra || l.empresa === "MYC"}
                    opciones={opciones}
                    abierta={abierta === l.id}
                    alAbrir={() => setAbierta(abierta === l.id ? null : l.id)}
                    alCambiar={(d) => accion(() => apiNomina.actualizarLinea(n.id, l.id, d))}
                    alVerViajes={() => setViajes(l)}
                    alDescontar={(prestamoId, valor) => accion(() => apiNomina.descontarPrestamo(prestamoId, n.producidoDesde.slice(0, 7), valor))}
                    alQuitar={() => window.confirm(`¿Quitar a ${l.nombre} de esta nomina?`) && accion(() => apiNomina.quitarLinea(n.id, l.id))}
                  />
                ))}
              </tbody>
            </table>
            {borrador && faltan.length > 0 && (
              <div className="barra-envio" style={{ padding: "0.6rem 0.8rem" }}>
                <select value={agregar} onChange={(e) => setAgregar(e.target.value)} aria-label="Empleado">
                  <option value="">Agregar empleado...</option>
                  {faltan.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-secondary"
                  disabled={!agregar}
                  onClick={() => {
                    accion(() => apiNomina.agregarLinea(n.id, Number(agregar)));
                    setAgregar("");
                  }}
                >
                  Agregar
                </button>
              </div>
            )}
          </div>
        </>
      )}
      {viajes && n && <VentanaViajes n={n} l={viajes} alCerrar={() => setViajes(null)} />}
      {nueva && (
        <NuevaNomina
          ultima={nominas[0] ?? null}
          alCerrar={() => setNueva(false)}
          alCrear={(id) => {
            setNueva(false);
            setElegida(id);
            alCambiar();
          }}
        />
      )}
    </>
  );
}

/** Numero que se guarda al salir del campo (si cambio). */
function CampoValor({ valor, alGuardar, disabled, ancho = "7rem" }: { valor: number; alGuardar: (v: number) => void; disabled?: boolean; ancho?: string }) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  if (disabled) return <>{moneda(valor)}</>;
  return (
    <input
      type="number"
      step="any"
      style={{ width: ancho, textAlign: "right" }}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => Number(texto || 0) !== valor && alGuardar(Number(texto || 0))}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Una linea de la nomina y, al abrirla, el detalle de cada concepto. */
function FilaLinea({
  l,
  n,
  editable,
  opciones,
  abierta,
  alAbrir,
  alCambiar,
  alVerViajes,
  alDescontar,
  alQuitar,
}: {
  l: LineaNomina;
  n: TipoNomina;
  /** M&C solo cambia las lineas de sus empleados. */
  editable: boolean;
  opciones: OpcionesGastos;
  abierta: boolean;
  alAbrir: () => void;
  alCambiar: (d: Partial<Pick<LineaNomina, "dias" | "producido" | "producidoManual" | "vehiculoId" | "ajuste" | "notaAjuste">> & CambioGasto) => void;
  /** Abre los viajes que suman el producido. */
  alVerViajes: () => void;
  /** Lo que se descuenta de un prestamo en el mes del producido (null = no se descuenta). */
  alDescontar: (prestamoId: number, valor: number | null) => void;
  alQuitar: () => void;
}) {
  const borrador = n.estado === "BORRADOR" && editable;
  const c = l.calculo;
  const [nota, setNota] = useState(l.notaAjuste ?? "");
  useEffect(() => setNota(l.notaAjuste ?? ""), [l.notaAjuste]);
  const conductor = l.tipo === "CONDUCTOR";
  return (
    <>
      <tr className={l.problema ? "fila-alerta" : undefined}>
        <td>
          <button className="btn-link principal" onClick={alAbrir} style={{ textAlign: "left" }}>
            {l.nombre}
          </button>
          <span className="dato-sec">
            {l.empresa === "MYC" ? "T. M&C" : "T. Lopez"} · {conductor ? "Conductor" : (l.cargo ?? "Oficina")}
          </span>
        </td>
        <td>
          {!conductor ? (
            <span className="dato-sec">Reparto</span>
          ) : borrador ? (
            <select
              value={l.vehiculoId ?? ""}
              onChange={(e) => alCambiar({ vehiculoId: e.target.value ? Number(e.target.value) : null })}
              aria-label="Vehiculo"
              style={{ minWidth: "7.5rem" }}
            >
              <option value="">Elige...</option>
              {opciones.vehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {placaConGuion(v.placa)}
                </option>
              ))}
            </select>
          ) : (
            placaConGuion(l.placa ?? "-")
          )}
          {conductor && l.porVehiculo.some((v) => v.producido > 0 && v.vehiculoId !== l.vehiculoId) && (
            <span className="dato-sec producido-origen" style={{ maxWidth: "8.5rem" }}>
              Produjo en{" "}
              {l.porVehiculo
                .filter((v) => v.producido > 0)
                .map((v) => placaConGuion(v.placa))
                .join(" + ")}
              : su costo va ahi
            </span>
          )}
        </td>
        <td className="num">{borrador ? <CampoValor valor={l.dias} ancho="4rem" alGuardar={(v) => alCambiar({ dias: v })} /> : l.dias}</td>
        <td className="num">
          {conductor ? (
            <>
              <CampoValor valor={l.producido} disabled={!borrador} alGuardar={(v) => alCambiar({ producido: v })} />
              <span className="dato-sec producido-origen">
                {l.producidoManual ? (
                  <>
                    A mano (sistema {moneda(l.producidoSistema)})
                    {borrador && (
                      <button className="btn-link" onClick={() => alCambiar({ producidoManual: false })}>
                        Usar el del sistema
                      </button>
                    )}
                  </>
                ) : (
                  <>Del sistema</>
                )}
                {(l.porVehiculo.length > 0 || l.producidoSistema > 0) && (
                  <button className="btn-link" onClick={alVerViajes}>
                    {l.porVehiculo.reduce((s, v) => s + v.viajes, 0)} viajes
                  </button>
                )}
              </span>
              {l.porVehiculo.some((v) => v.sinTarifa > 0) && (
                <span className="texto-vencido producido-origen">{l.porVehiculo.reduce((s, v) => s + v.sinTarifa, 0)} sin producido conductor (no suman)</span>
              )}
            </>
          ) : (
            "-"
          )}
        </td>
        <td className="num">{moneda(c.salarial)}</td>
        <td className="num">{c.viaticos ? moneda(c.viaticos) : "-"}</td>
        <td className="num">{moneda(c.neto)}</td>
        <td className="num">
          <strong className={(l.totalAPagar ?? c.neto) < 0 ? "texto-vencido" : undefined}>{moneda(l.totalAPagar ?? c.neto)}</strong>
          {((l.cuentasViaje && l.cuentasViaje.saldo !== 0) || (l.prestamos ?? []).some((p) => p.descuento)) && (
            <span className="partes-valor">
              {l.cuentasViaje && l.cuentasViaje.saldo !== 0 && (
                <>
                  <span>Cuentas de viaje</span>
                  <span>{l.cuentasViaje.saldo > 0 ? `+ ${moneda(l.cuentasViaje.saldo)}` : `- ${moneda(-l.cuentasViaje.saldo)}`}</span>
                </>
              )}
              {(l.prestamos ?? []).some((p) => p.descuento) && (
                <>
                  <span>Prestamos</span>
                  <span>- {moneda((l.prestamos ?? []).reduce((s2, p) => s2 + (p.descuento ?? 0), 0))}</span>
                </>
              )}
            </span>
          )}
          {l.cuentasViaje && l.cuentasViaje.sinCuenta > 0 && <span className="texto-aviso">{l.cuentasViaje.sinCuenta} viaje(s) sin cuenta</span>}
        </td>
        <td className="num">{moneda(c.costoEmpleador)}</td>
        <td className="num">
          <CampoValor valor={l.ajuste} disabled={!borrador} ancho="5rem" alGuardar={(v) => alCambiar({ ajuste: v })} />
          {borrador && l.ajuste !== 0 && (
            <input
              placeholder="Nota del ajuste"
              style={{ width: "9rem", display: "block", marginTop: "0.2rem" }}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onBlur={() => nota !== (l.notaAjuste ?? "") && alCambiar({ notaAjuste: nota })}
            />
          )}
          {!borrador && l.notaAjuste && <span className="dato-sec">{l.notaAjuste}</span>}
        </td>
        <td className="num">
          <strong>{moneda(l.gasto.total)}</strong>
          {l.gasto.total !== c.costoTotal && <span className="dato-sec">costo {moneda(c.costoTotal)}</span>}
          {conductor && l.reparto.length > 1 && (
            <span className="dato-sec">{l.reparto.map((r) => `${placaConGuion(r.placa)} ${r.porcentaje} %`).join(" · ")}</span>
          )}
        </td>
        <td className="num">
          {borrador && (
            <button className="btn-link" onClick={alQuitar}>
              Quitar
            </button>
          )}
        </td>
      </tr>
      {abierta && (
        <tr>
          <td colSpan={12}>
            {/* Por colores, como en Rentabilidad: lo del empleado, los aportes, las provisiones y lo que se le paga. */}
            <div className="detalle-nomina-desglose">
              <table className="tabla tabla-compacta desglose">
                <tbody className="desglose-empresa">
                  <Titulo t="Empleado" />
                  <Renglon t="Salario basico" v={c.basico} />
                  <Renglon t="Auxilio de transporte" v={c.auxilio} />
                  {conductor && <Renglon t={`Sueldo variable (${l.entrada.pctSalarial} % del producido)`} v={c.variable} />}
                  {conductor && <Renglon t={`Viaticos (${l.entrada.pctViaticos} %, no salarial)`} v={c.viaticos} />}
                  <Renglon t="Devengado" v={c.devengado} total />
                  <Renglon t="Salud" v={c.saludEmpleado} signo="- " />
                  <Renglon t="Pension" v={c.pensionEmpleado} signo="- " />
                  <Renglon t="Neto de la nomina" v={c.neto} total />
                </tbody>
              </table>
              <table className="tabla tabla-compacta desglose">
                <tbody className="desglose-tercero">
                  <Titulo t="Aportes del empleador (PILA)" />
                  <Renglon t="Salud" v={c.saludEmpleador} />
                  <Renglon t="UPC adicional" v={c.upcAdicional ?? 0} />
                  <Renglon t="Pension" v={c.pensionEmpleador} />
                  <Renglon t={`ARL riesgo ${["", "I", "II", "III", "IV", "V"][l.entrada.riesgoArl]}`} v={c.arl} />
                  <Renglon t="Caja de compensacion" v={c.caja} />
                  {c.ibc !== c.salarial && <Renglon t="IBC (con exceso no salarial)" v={c.ibc} />}
                </tbody>
                <tbody className="desglose-dueno">
                  <Titulo t="Provisiones" />
                  <Renglon t="Prima" v={c.prima} />
                  <Renglon t="Cesantias" v={c.cesantias} />
                  <Renglon t="Intereses de cesantias" v={c.interesesCesantias} />
                  <Renglon t="Vacaciones" v={c.vacaciones} />
                  {c.ajuste !== 0 && <Renglon t="Ajuste" v={c.ajuste} />}
                  <Renglon t="Costo del empleador" v={c.costoEmpleador} total />
                  <Renglon t="Costo total" v={c.costoTotal} total />
                </tbody>
              </table>
              {(conductor || (l.prestamos ?? []).length > 0) && (
                <table className="tabla tabla-compacta desglose">
                  <tbody className="desglose-resultado">
                    <Titulo t="Lo que se le paga" />
                    <Renglon t="Neto de la nomina" v={c.neto} />
                    {l.cuentasViaje && (
                      <Renglon
                        t={l.cuentasViaje.saldo >= 0 ? "Cuentas de viaje (se le debe)" : "Cuentas de viaje (debe)"}
                        v={Math.abs(l.cuentasViaje.saldo)}
                        signo={l.cuentasViaje.saldo >= 0 ? "+ " : "- "}
                      />
                    )}
                    {(l.prestamos ?? []).map((p) => (
                      <tr key={p.prestamoId}>
                        <td>
                          Prestamo {fechaCorta(p.fecha)}
                          <span className="dato-sec">saldo {moneda(p.saldo)}</span>
                        </td>
                        <td className="num">
                          <input
                            key={`${p.prestamoId}-${p.descuento}`}
                            type="number"
                            min={0}
                            disabled={!editable}
                            style={{ width: "7.5rem", textAlign: "right" }}
                            defaultValue={p.descuento ?? ""}
                            placeholder={p.cuota ? `Cuota ${p.cuota}` : "No se descuenta"}
                            aria-label="Descontar este mes"
                            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                            onBlur={(e) => {
                              const v = e.target.value.trim() === "" ? null : Number(e.target.value);
                              if (v !== p.descuento) alDescontar(p.prestamoId, v);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                    <Renglon t="Total a pagar" v={l.totalAPagar ?? c.neto} total />
                  </tbody>
                </table>
              )}
            </div>
            <GastoLinea l={l} editable={borrador} opciones={opciones} alCambiar={alCambiar} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Titulo de un bloque del detalle. */
const Titulo = ({ t }: { t: string }) => (
  <tr className="desglose-titulo">
    <th colSpan={2}>{t}</th>
  </tr>
);

/** Un renglon del detalle: en cero sale apagado; el total, resaltado. */
const Renglon = ({ t, v, signo = "", total = false }: { t: string; v: number; signo?: string; total?: boolean }) => (
  <tr className={total ? "desglose-total" : v ? "" : "desglose-cero"}>
    <td>{t}</td>
    <td className="num">{v ? `${signo}${moneda(v)}` : "-"}</td>
  </tr>
);

/** De donde sale el producido (por defecto el mes en que empieza la nomina); se puede cambiar en borrador. */
function PeriodoProducido({ n, editable, alCambiar }: { n: TipoNomina; editable: boolean; alCambiar: (desde: string, hasta: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [desde, setDesde] = useState(n.producidoDesde);
  const [hasta, setHasta] = useState(n.producidoHasta);
  useEffect(() => {
    setDesde(n.producidoDesde);
    setHasta(n.producidoHasta);
  }, [n.producidoDesde, n.producidoHasta]);
  if (!editando)
    return (
      <span className="dato-sec">
        · Producido de los viajes del {fechaCorta(n.producidoDesde)} al {fechaCorta(n.producidoHasta)}{" "}
        {editable && (
          <button className="btn-link" onClick={() => setEditando(true)}>
            Cambiar
          </button>
        )}
      </span>
    );
  return (
    <span className="estado-abono">
      <span className="dato-sec">Producido del</span>
      <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Producido desde" />
      <span className="dato-sec">al</span>
      <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Producido hasta" />
      <button
        className="btn-secondary"
        disabled={!desde || !hasta || hasta < desde}
        onClick={() => {
          alCambiar(desde, hasta);
          setEditando(false);
        }}
      >
        Guardar
      </button>
      <button className="btn-link" onClick={() => setEditando(false)}>
        Cancelar
      </button>
    </span>
  );
}

/** Los viajes del sistema que suman el producido de un conductor, por vehiculo. */
function VentanaViajes({ n, l, alCerrar }: { n: TipoNomina; l: LineaNomina; alCerrar: () => void }) {
  const [viajes, setViajes] = useState<ViajeProducidoNomina[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiNomina
      .viajesLinea(n.id, l.id)
      .then(setViajes)
      .catch((exc) => setError(exc instanceof Error ? exc.message : "No se pudieron cargar los viajes."));
  }, [n.id, l.id]);
  const placas = [...new Set((viajes ?? []).map((v) => v.placa))];
  return (
    <Modal
      titulo={`Producido de ${l.nombre}`}
      ancho="pantalla"
      alCerrar={alCerrar}
      pie={
        <button className="btn-primary" onClick={alCerrar}>
          Listo
        </button>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.5rem" }}>
        Viajes del {fechaCorta(n.producidoDesde)} al {fechaCorta(n.producidoHasta)} de los vehiculos que manejaba (segun su asignacion en Empleados). El
        producido es la suma del producido conductor de cada viaje (matriz de fletes conductor, o el escrito en su cuenta de viaje en Liquidacion conductores);
        los que no tienen valor no suman hasta que se les ponga.
        {l.porVehiculo.length > 1 && " Al aprobar, su costo se reparte entre los vehiculos segun lo que produjo en cada uno."}
      </div>
      {error && <div className="alert danger">{error}</div>}
      {!viajes && !error && <div className="dato-sec">Cargando...</div>}
      {viajes && !viajes.length && <div className="dato-sec">No hay viajes en ese periodo.</div>}
      {placas.map((placa) => {
        const lista = viajes!.filter((v) => v.placa === placa);
        const total = lista.reduce((s, v) => s + (v.flete ?? 0), 0);
        return (
          <div key={placa} style={{ marginBottom: "0.8rem", overflowX: "auto" }}>
            <h4 style={{ margin: "0 0 0.3rem" }}>
              {placaConGuion(placa)} · {moneda(total)}
            </h4>
            <table className="tabla tabla-compacta" style={{ minWidth: "100%" }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Manifiesto</th>
                  <th>Cliente</th>
                  <th className="num">Peso</th>
                  <th className="num">Tarifa</th>
                  <th className="num">Flete empresa</th>
                  <th className="num">Producido conductor</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => (
                  <tr key={v.id}>
                    <td>{fechaCorta(v.fecha)}</td>
                    <td>
                      {v.manifiesto ?? v.remision ?? "-"} <LinksViaje remisionUrl={v.remisionUrl} facturaUrl={v.facturaUrl} />
                    </td>
                    <td>
                      {v.cliente}
                      {v.concepto && <span className="dato-sec">{v.concepto}</span>}
                    </td>
                    <td className="num">{v.pesoKg !== null ? v.pesoKg.toLocaleString("es-CO") : "-"}</td>
                    <td className="num">{v.tipoFlete === "FIJO" ? "Fijo" : v.tarifaKilo !== null ? v.tarifaKilo.toLocaleString("es-CO") : "-"}</td>
                    <td className="num dato-sec">{v.fleteEmpresa != null ? moneda(v.fleteEmpresa) : "-"}</td>
                    <td className="num">{v.flete !== null ? moneda(v.flete) : <span className="texto-vencido">Sin valor</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </Modal>
  );
}

/** Crear una nomina: por defecto el periodo que sigue a la ultima. */
function NuevaNomina({ ultima, alCerrar, alCrear }: { ultima: TipoNomina | null; alCerrar: () => void; alCrear: (id: number) => void }) {
  const siguiente = (f: string, meses: number) => {
    const [a, m, d] = f.split("-").map(Number);
    const x = new Date(Date.UTC(a, m - 1 + meses, d));
    return x.toISOString().slice(0, 10);
  };
  const desdeSugerido = ultima
    ? siguiente(ultima.hasta, 0).replace(/-(\d+)$/, (_, d) => `-${String(Number(d) + 1).padStart(2, "0")}`)
    : hoyColombia().slice(0, 8) + "01";
  const [desde, setDesde] = useState(ultima ? new Date(Date.parse(ultima.hasta) + 86_400_000).toISOString().slice(0, 10) : desdeSugerido);
  const [hasta, setHasta] = useState(
    ultima ? siguiente(ultima.hasta, 1) : new Date(Date.parse(siguiente(desdeSugerido, 1)) - 86_400_000).toISOString().slice(0, 10),
  );
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function crear() {
    setError(null);
    try {
      alCrear((await apiNomina.crear(desde, hasta, nota || null)).id);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo crear.");
    }
  }
  return (
    <Modal
      titulo="Nueva nomina"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!desde || !hasta || hasta < desde} onClick={crear}>
            Crear
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label>Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Nota (opcional)</label>
          <input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
        </div>
      </div>
      <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
        Trae a los empleados activos en el periodo con sus dias. El producido de cada conductor sale de sus viajes del mes en que empieza la nomina (se puede
        cambiar).
      </div>
    </Modal>
  );
}
