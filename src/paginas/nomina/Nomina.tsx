/**
 * Pantalla Nomina (fase 2 del modulo de gastos): liquidaciones por periodo,
 * empleados y parametros por ano.
 *
 * - Liquidacion: se crea con desde y hasta y trae a los empleados activos.
 *   En cada linea se escriben los dias, el producido (conductores), el
 *   vehiculo y un ajuste con nota. Se ve lo que se le paga al empleado y el
 *   costo del empleador (aportes redondeados a la centena + provisiones).
 * - Aprobar crea un gasto por empleado en el libro (categoria Nomina) por su
 *   costo total, causado por dias entre los meses del periodo: el del
 *   conductor a su vehiculo, el de oficina a su reparto. Reabrir los borra.
 * - Exportar saca el Excel con las columnas del modelo de nomina.
 */
import { useEffect, useState } from "react";
import { apiGastos, apiNomina, hoyColombia, moneda } from "../../api/cliente";
import type { Empleado, LineaNomina, Nomina as TipoNomina, OpcionesGastos } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { useSesion } from "../../ganchos/useSesion";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import Modal from "../../componentes/Modal";
import { Pastilla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import Empleados from "./Empleados";
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
                  <th className="num">Producido</th>
                  <th className="num">Salarial</th>
                  <th className="num">Viaticos</th>
                  <th className="num">Neto a pagar</th>
                  <th className="num">Costo empleador</th>
                  <th className="num">Ajuste</th>
                  <th className="num">Costo total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {n.lineas.map((l) => (
                  <FilaLinea
                    key={l.id}
                    l={l}
                    n={n}
                    opciones={opciones}
                    abierta={abierta === l.id}
                    alAbrir={() => setAbierta(abierta === l.id ? null : l.id)}
                    alCambiar={(d) => accion(() => apiNomina.actualizarLinea(n.id, l.id, d))}
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
  opciones,
  abierta,
  alAbrir,
  alCambiar,
  alQuitar,
}: {
  l: LineaNomina;
  n: TipoNomina;
  opciones: OpcionesGastos;
  abierta: boolean;
  alAbrir: () => void;
  alCambiar: (d: Partial<Pick<LineaNomina, "dias" | "producido" | "vehiculoId" | "ajuste" | "notaAjuste">>) => void;
  alQuitar: () => void;
}) {
  const borrador = n.estado === "BORRADOR";
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
        </td>
        <td className="num">{borrador ? <CampoValor valor={l.dias} ancho="4rem" alGuardar={(v) => alCambiar({ dias: v })} /> : l.dias}</td>
        <td className="num">{conductor ? <CampoValor valor={l.producido} disabled={!borrador} alGuardar={(v) => alCambiar({ producido: v })} /> : "-"}</td>
        <td className="num">{moneda(c.salarial)}</td>
        <td className="num">{c.viaticos ? moneda(c.viaticos) : "-"}</td>
        <td className="num">
          <strong>{moneda(c.neto)}</strong>
        </td>
        <td className="num">{moneda(c.costoEmpleador)}</td>
        <td className="num">
          <CampoValor valor={l.ajuste} disabled={!borrador} ancho="6rem" alGuardar={(v) => alCambiar({ ajuste: v })} />
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
          <strong>{moneda(c.costoTotal)}</strong>
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
          <td colSpan={11}>
            <div className="detalle-nomina">
              <div>
                <h5>Empleado</h5>
                <Concepto t="Salario basico" v={c.basico} />
                {c.auxilio > 0 && <Concepto t="Auxilio de transporte" v={c.auxilio} />}
                {c.variable > 0 && <Concepto t={`Sueldo variable (${l.entrada.pctSalarial} %)`} v={c.variable} />}
                {c.viaticos > 0 && <Concepto t={`Viaticos (${l.entrada.pctViaticos} %, no salarial)`} v={c.viaticos} />}
                <Concepto t="Devengado" v={c.devengado} fuerte />
                <Concepto t="Salud" v={-c.saludEmpleado} />
                <Concepto t="Pension" v={-c.pensionEmpleado} />
                <Concepto t="Neto a pagar" v={c.neto} fuerte />
              </div>
              <div>
                <h5>Aportes del empleador (PILA)</h5>
                <Concepto t="Pension" v={c.pensionEmpleador} />
                <Concepto t="Salud" v={c.saludEmpleador} />
                <Concepto t={`ARL riesgo ${["", "I", "II", "III", "IV", "V"][l.entrada.riesgoArl]}`} v={c.arl} />
                <Concepto t="Caja" v={c.caja} />
                {c.ibc !== c.salarial && <Concepto t="IBC (con exceso no salarial)" v={c.ibc} />}
              </div>
              <div>
                <h5>Provisiones</h5>
                <Concepto t="Prima" v={c.prima} />
                <Concepto t="Cesantias" v={c.cesantias} />
                <Concepto t="Intereses de cesantias" v={c.interesesCesantias} />
                <Concepto t="Vacaciones" v={c.vacaciones} />
                {c.ajuste !== 0 && <Concepto t="Ajuste" v={c.ajuste} />}
                <Concepto t="Costo del empleador" v={c.costoEmpleador} fuerte />
                <Concepto t="Costo total" v={c.costoTotal} fuerte />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Un concepto del detalle. */
function Concepto({ t, v, fuerte }: { t: string; v: number; fuerte?: boolean }) {
  return (
    <div className="concepto-nomina">
      <span>{t}</span>
      {fuerte ? <strong>{moneda(v)}</strong> : <span>{moneda(v)}</span>}
    </div>
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
        Trae a los empleados activos en el periodo con sus dias. Despues escribes el producido de cada conductor.
      </div>
    </Modal>
  );
}
