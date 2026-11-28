/**
 * Cuentas de viaje, por vehiculo: arriba cada carro de la flota propia con
 * sus viajes del mes, lo gastado y el saldo con el conductor (clic para ver
 * solo ese carro); abajo sus viajes con su producido conductor y su hoja de
 * gastos (la que llena el conductor). El rol total filtra por empresa (Lopez
 * o M&C) para las cuentas de cada dueno; M&C solo ve sus carros. Clic en un viaje
 * abre la hoja: lo que recibio (anticipo de la bomba y transferencia, del
 * Cuadro pagos, y las transferencias del gerente que se agregan aqui para
 * completar el anticipo) y lo que gasto por concepto. El rojo de cada viaje es
 * gastos - lo recibido (como en el cuadro SWK-973). El ACPM sale del combustible del
 * anticipo y se puede corregir. Al guardar, los gastos quedan en el libro de
 * gastos (gasto del vehiculo) y en Utilidades el viaje cuenta lo gastado.
 */
import { useState } from "react";
import { useSesion } from "../../ganchos/useSesion";
import { soloGastosConductores } from "../../permisos";
import { apiConductores, hoyColombia, moneda } from "../../api/cliente";
import type { ConceptoCuenta, EmpresaGasto, ViajeConductor } from "../../api/cliente";
import type { FiltroEmpresa } from "./LiquidacionConductores";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import LinksViaje from "../../componentes/LinksViaje";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import { CONCEPTOS, textoSaldo, totalesCuenta } from "./calculos";

/** Saldo con su color: verde si se le debe al conductor, rojo si el debe. */
export const Saldo = ({ valor }: { valor: number }) => (
  <span className={valor < 0 ? "texto-vencido" : valor > 0 ? "texto-ok" : "dato-sec"} title={textoSaldo(valor)}>
    {valor > 0 ? "+ " : ""}
    {moneda(valor)}
  </span>
);

/** Lo de un vehiculo en el mes. */
interface ResumenVehiculo {
  placa: string;
  empresa: EmpresaGasto;
  viajes: number;
  conCuenta: number;
  gastos: number;
  saldo: number;
  conductores: string[];
}

/** Resumen de cada vehiculo (por placa), en orden de placa. */
function porVehiculo(viajes: ViajeConductor[]): ResumenVehiculo[] {
  const m = new Map<string, ResumenVehiculo>();
  for (const v of viajes) {
    const r = m.get(v.placa) ?? { placa: v.placa, empresa: v.empresaVehiculo, viajes: 0, conCuenta: 0, gastos: 0, saldo: 0, conductores: [] };
    r.viajes += 1;
    if (v.cuenta) {
      r.conCuenta += 1;
      r.gastos += v.cuenta.total;
      r.saldo += v.cuenta.saldo;
    }
    if (v.conductor && !r.conductores.includes(v.conductor)) r.conductores.push(v.conductor);
    m.set(v.placa, r);
  }
  return [...m.values()].sort((a, b) => a.placa.localeCompare(b.placa));
}

/** Cuentas de viaje del mes, por vehiculo. */
export default function CuentasViaje({ mes, empresa }: { mes: string; empresa: FiltroEmpresa }) {
  const { usuario } = useSesion();
  // Las administrativas registran los gastos sin ver el producido ni el saldo del conductor.
  const verPagos = !soloGastosConductores(usuario?.rol);
  const carga = useDatos(() => apiConductores.viajes(mes), [mes]);
  const [abierto, setAbierto] = useState<ViajeConductor | null>(null);
  /** Carro elegido (null = todos los de la empresa). */
  const [placa, setPlaca] = useState<string | null>(null);
  if (carga.cargando && !carga.datos) return <Cargando que="los viajes del mes" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;
  const deEmpresa = carga.datos.filter((v) => empresa === "TODAS" || v.empresaVehiculo === empresa);
  const vehiculos = porVehiculo(deEmpresa);
  const elegido = placa && vehiculos.some((x) => x.placa === placa) ? placa : null;
  const viajes = elegido ? deEmpresa.filter((v) => v.placa === elegido) : deEmpresa;
  const conCuenta = viajes.filter((v) => v.cuenta);
  const sinProducido = viajes.filter((v) => v.producido === null);

  const columnas: Columna<ViajeConductor>[] = [
    {
      id: "fecha",
      titulo: "Fecha",
      valor: (v) => v.fecha,
      celda: (v) => (
        <>
          {fechaCorta(v.fecha)}
          {v.mesMovido && (
            <span className="dato-sec" title={v.notaMovido ?? "Se paso a la liquidacion de este mes"}>
              traido a este mes
            </span>
          )}
        </>
      ),
    },
    {
      id: "placa",
      titulo: "Placa",
      filtrable: true,
      valor: (v) => placaConGuion(v.placa),
      celda: (v) => <span className="principal">{placaConGuion(v.placa)}</span>,
    },
    {
      id: "conductor",
      titulo: "Conductor",
      filtrable: true,
      valor: (v) => v.conductor ?? "Sin asignar",
      celda: (v) =>
        v.conductor ? (
          <span
            title={
              v.conductorPor === "vehiculo" ? "Por la asignacion del vehiculo (el viaje no dice quien lo manejo o no esta en Nomina)" : "Quien manejo el viaje"
            }
          >
            {v.conductor}
          </span>
        ) : (
          <span className="texto-aviso" title={v.motivoSinConductor ?? "Registralo en Nomina > Empleados"}>
            {v.conductorViaje ? `${v.conductorViaje} (no esta en Nomina)` : "Sin asignar"}
          </span>
        ),
    },
    {
      id: "viaje",
      titulo: "Cliente / remision",
      valor: (v) => v.cliente,
      buscar: (v) => `${v.remision ?? ""} ${v.manifiesto ?? ""}`,
      celda: (v) => (
        <>
          <span className="principal">{v.cliente}</span>
          <span className="dato-sec">{[v.remision && `Rem. ${v.remision}`, v.manifiesto && `Manif. ${v.manifiesto}`].filter(Boolean).join(" · ") || "-"}</span>
          <LinksViaje remisionUrl={v.remisionUrl} facturaUrl={v.facturaUrl} />
        </>
      ),
    },
    {
      id: "producido",
      titulo: "Producido conductor",
      alinear: "derecha",
      valor: (v) => v.producido ?? 0,
      celda: (v) =>
        v.producido === null ? (
          <span
            className="texto-aviso"
            title={
              v.tarifa
                ? `La tarifa ${v.tarifa} no tiene valor en la matriz de fletes conductor: ponselo en Fletes conductor o escribelo en la cuenta`
                : "El viaje no tiene tarifa en el Cuadro pagos (y no se pudo deducir): eligela en el Cuadro o escribe el producido en la cuenta"
            }
          >
            {v.tarifa ? "Sin valor" : "Sin tarifa"}
          </span>
        ) : (
          <>
            {moneda(v.producido)}
            {v.integro && (
              <span className="dato-sec" title="Se le paga completo al conductor (no se le saca el %)">
                integro
              </span>
            )}
            {v.producidoManual && <span className="dato-sec">a mano</span>}
          </>
        ),
    },
    { id: "recibido", titulo: "Recibio", alinear: "derecha", valor: (v) => v.recibido, celda: (v) => (v.recibido ? moneda(v.recibido) : "-") },
    { id: "gastos", titulo: "Gastos", alinear: "derecha", valor: (v) => v.cuenta?.total ?? 0, celda: (v) => (v.cuenta ? moneda(v.cuenta.total) : "-") },
    {
      // El "rojo" del cuadro: gastos - lo recibido (+ se le debe al conductor, - el debe).
      id: "saldo",
      titulo: "Rojo",
      alinear: "derecha",
      prioridad: 0,
      sumar: "pesos",
      valor: (v) => v.cuenta?.saldo ?? 0,
      celda: (v) => (v.cuenta ? <Saldo valor={v.cuenta.saldo} /> : <Pastilla tono="aviso">Sin cuenta</Pastilla>),
    },
  ];
  const columnasVisibles = verPagos ? columnas : columnas.filter((c) => c.id !== "producido" && c.id !== "saldo");
  const pestanas: PestanaTabla<ViajeConductor>[] = [
    { id: "todos", etiqueta: "Todos", incluye: () => true },
    { id: "sin", etiqueta: "Sin cuenta", incluye: (v) => !v.cuenta },
    { id: "con", etiqueta: "Con cuenta", incluye: (v) => !!v.cuenta },
    ...(verPagos ? [{ id: "sinProducido", etiqueta: "Sin producido conductor", incluye: (v: ViajeConductor) => v.producido === null }] : []),
  ];

  return (
    <>
      <div className="vehiculos-cuenta" role="group" aria-label="Vehiculo">
        <button type="button" className={`vehiculo-cuenta${elegido ? "" : " activo"}`} onClick={() => setPlaca(null)}>
          <strong>Todos</strong>
          <span className="dato-sec">
            {vehiculos.length} vehiculo(s) · {deEmpresa.length} viajes
          </span>
        </button>
        {vehiculos.map((r) => (
          <button
            key={r.placa}
            type="button"
            className={`vehiculo-cuenta${elegido === r.placa ? " activo" : ""}`}
            onClick={() => setPlaca(elegido === r.placa ? null : r.placa)}
            title={r.conductores.join(", ") || "Sin conductor asignado"}
          >
            <span>
              <strong>{placaConGuion(r.placa)}</strong> <span className="dato-sec">{r.empresa === "MYC" ? "M&C" : "Lopez"}</span>
            </span>
            <span className="dato-sec">
              {r.viajes} viajes · {r.conCuenta === r.viajes ? "todas con cuenta" : <span className="texto-aviso">{r.viajes - r.conCuenta} sin cuenta</span>}
            </span>
            <span className="vehiculo-cuenta-valores">
              <span>Gastos {moneda(r.gastos)}</span>
              {verPagos && <Saldo valor={r.saldo} />}
            </span>
          </button>
        ))}
      </div>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador
          titulo={elegido ? `Viajes de ${placaConGuion(elegido)}` : "Viajes del mes"}
          valor={viajes.length}
          detalle={`${conCuenta.length} con cuenta de viaje`}
          alerta={conCuenta.length < viajes.length}
        />
        <Indicador
          dinero
          titulo="Gastos de los viajes"
          valor={moneda(conCuenta.reduce((s, v) => s + (v.cuenta?.total ?? 0), 0))}
          detalle="segun las cuentas de viaje"
        />
        {verPagos && (
          <Indicador
            dinero
            titulo="Rojo de los conductores"
            valor={moneda(conCuenta.reduce((s, v) => s + (v.cuenta?.saldo ?? 0), 0))}
            detalle="+ se les debe / - deben"
          />
        )}
        {verPagos && (
          <Indicador titulo="Sin producido conductor" valor={sinProducido.length} detalle="viajes sin valor en la matriz" alerta={sinProducido.length > 0} />
        )}
      </div>
      <div className="panel">
        <TablaDatos
          filas={viajes}
          columnas={columnasVisibles}
          clave={(v) => v.cuadroViajeId}
          pestanas={pestanas}
          nombreArchivo={`cuentas-de-viaje-${elegido ?? (empresa === "TODAS" ? "todos" : empresa.toLowerCase())}-${mes}`}
          placeholderBusqueda="Buscar placa, conductor, cliente, remision, manifiesto..."
          vacio={elegido ? "Ese vehiculo no tiene viajes en el mes." : "No hay viajes de la flota propia en ese mes."}
          alClicFila={(v) => setAbierto(v)}
        />
      </div>
      {abierto && (
        <FormularioCuenta
          verPagos={verPagos}
          viaje={abierto}
          mes={mes}
          alCerrar={() => setAbierto(null)}
          alGuardar={() => {
            setAbierto(null);
            carga.recargar();
          }}
          alCambiarViaje={(v) => {
            setAbierto(v);
            carga.recargar();
          }}
        />
      )}
    </>
  );
}

/** La hoja de cuenta de un viaje. */
function FormularioCuenta({
  viaje,
  mes,
  verPagos,
  alCerrar,
  alGuardar,
  alCambiarViaje,
}: {
  viaje: ViajeConductor;
  mes: string;
  /** false: sin el producido ni el saldo del conductor (administrativas). */
  verPagos: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
  /** El viaje cambio sin cerrar la hoja (se agrego o quito una transferencia). */
  alCambiarViaje: (v: ViajeConductor) => void;
}) {
  const c = viaje.cuenta;
  const [valores, setValores] = useState<Record<ConceptoCuenta, string>>(
    () => Object.fromEntries(CONCEPTOS.map(([k]) => [k, c && (k !== "acpm" || c.acpmManual) && c[k] ? String(c[k]) : ""])) as Record<ConceptoCuenta, string>,
  );
  const [otrosConcepto, setOtrosConcepto] = useState(c?.otrosConcepto ?? "");
  const [nota, setNota] = useState(c?.nota ?? "");
  const [producido, setProducido] = useState(viaje.producidoManual && viaje.producido !== null ? String(viaje.producido) : "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const t = totalesCuenta(valores, viaje.combustible, viaje.recibido);
  // Transferencia nueva del gerente.
  const [trFecha, setTrFecha] = useState(hoyColombia());
  const [trValor, setTrValor] = useState("");
  const [trNota, setTrNota] = useState("");

  /** Agrega o quita una transferencia del gerente (queda guardada al instante). */
  async function transferencia(fn: () => Promise<ViajeConductor>) {
    setError(null);
    try {
      alCambiarViaje(await fn());
      setTrValor("");
      setTrNota("");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar la transferencia.");
    }
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await apiConductores.guardarCuenta(viaje.cuadroViajeId, mes, {
        ...Object.fromEntries(CONCEPTOS.map(([k]) => [k, valores[k].trim() === "" ? (k === "acpm" ? null : 0) : Number(valores[k])])),
        otrosConcepto,
        nota,
        ...(verPagos ? { producidoManual: producido.trim() === "" ? null : Number(producido) } : {}),
      });
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!window.confirm("¿Borrar la cuenta de este viaje? Su gasto sale del libro de gastos y de Utilidades.")) return;
    setGuardando(true);
    try {
      await apiConductores.borrarCuenta(viaje.cuadroViajeId);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo borrar.");
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={`Cuenta de viaje · ${placaConGuion(viaje.placa)} · ${fechaCorta(viaje.fecha)}`}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          {c && (
            <button className="btn-link texto-vencido" onClick={borrar} disabled={guardando} style={{ marginRight: "auto" }}>
              Borrar cuenta
            </button>
          )}
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar cuenta"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="dato-sec" style={{ marginBottom: "0.6rem" }}>
        {viaje.cliente} · {[viaje.remision && `remision ${viaje.remision}`, viaje.manifiesto && `manifiesto ${viaje.manifiesto}`].filter(Boolean).join(" · ")} ·{" "}
        {viaje.conductor ?? viaje.motivoSinConductor ?? "sin conductor"} <LinksViaje remisionUrl={viaje.remisionUrl} facturaUrl={viaje.facturaUrl} />
      </div>
      <div className="cuenta-viaje">
        <div>
          <h4>Gastos del viaje</h4>
          <div className="campos-cuenta">
            {CONCEPTOS.map(([k, nombre]) => (
              <label key={k}>
                <span>{nombre}</span>
                <input
                  type="number"
                  step="any"
                  value={valores[k]}
                  placeholder={k === "acpm" ? String(viaje.combustible) : "0"}
                  onChange={(e) => setValores({ ...valores, [k]: e.target.value })}
                />
              </label>
            ))}
          </div>
          {valores.otros.trim() !== "" && (
            <label className="campo-ancho">
              <span>Que es "otros"</span>
              <input value={otrosConcepto} maxLength={200} onChange={(e) => setOtrosConcepto(e.target.value)} placeholder="Basculas, cuentas pendientes..." />
            </label>
          )}
          <div className="dato-sec">El ACPM vacio es el combustible de los anticipos del viaje ({moneda(viaje.combustible)}); escribelo si fue otro.</div>
        </div>
        <div>
          <table className="tabla tabla-compacta desglose">
            <tbody className="desglose-anticipo">
              <tr className="desglose-titulo">
                <th colSpan={2}>Lo que recibio</th>
              </tr>
              <tr className={viaje.efectivo ? "" : "desglose-cero"}>
                <td>Efectivo (bomba)</td>
                <td className="num">{moneda(viaje.efectivo)}</td>
              </tr>
              <tr className={viaje.combustible ? "" : "desglose-cero"}>
                <td>Combustible (bomba)</td>
                <td className="num">{moneda(viaje.combustible)}</td>
              </tr>
              <tr className={viaje.transferencia ? "" : "desglose-cero"}>
                <td>Transferencia (Cuadro pagos)</td>
                <td className="num">{moneda(viaje.transferencia)}</td>
              </tr>
              {(viaje.transferenciasGerente ?? []).map((tr) => (
                <tr key={tr.id}>
                  <td>
                    Transferencia del {fechaCorta(tr.fecha)}
                    {tr.nota && <span className="dato-sec">{tr.nota}</span>}
                    <button
                      className="btn-link texto-vencido"
                      style={{ marginLeft: "0.4rem" }}
                      onClick={() =>
                        window.confirm(`¿Quitar la transferencia de ${moneda(tr.valor)}?`) && transferencia(() => apiConductores.borrarTransferencia(tr.id))
                      }
                    >
                      Quitar
                    </button>
                  </td>
                  <td className="num">{moneda(tr.valor)}</td>
                </tr>
              ))}
              <tr className="desglose-total">
                <td>Total recibido</td>
                <td className="num">{moneda(viaje.recibido)}</td>
              </tr>
            </tbody>
            <tbody className="desglose-tercero">
              <tr className="desglose-titulo">
                <th colSpan={2}>Lo que gasto</th>
              </tr>
              <tr className="desglose-total">
                <td>Total gastos</td>
                <td className="num">{moneda(t.total)}</td>
              </tr>
            </tbody>
            {verPagos && (
              <tbody className="desglose-resultado">
                <tr className="desglose-total">
                  <td>{textoSaldo(t.saldo)}</td>
                  <td className="num">
                    <Saldo valor={t.saldo} />
                  </td>
                </tr>
              </tbody>
            )}
          </table>
          {/* Transferencia del gerente: completa el anticipo de la bomba. No va al Cuadro pagos ni a la bomba. */}
          <div className="transferencia-nueva">
            <span className="dato-sec">Transferencia para completar el anticipo (no va al Cuadro pagos ni a la bomba)</span>
            <div className="transferencia-campos">
              <input type="date" aria-label="Fecha de la transferencia" value={trFecha} onChange={(e) => setTrFecha(e.target.value)} />
              <input
                type="number"
                min={0}
                step="any"
                aria-label="Valor de la transferencia"
                placeholder="Valor"
                value={trValor}
                onChange={(e) => setTrValor(e.target.value)}
              />
              <input
                aria-label="Nota de la transferencia"
                placeholder="Nota (opcional)"
                maxLength={300}
                value={trNota}
                onChange={(e) => setTrNota(e.target.value)}
              />
              <button
                className="btn-secondary"
                disabled={!trValor || Number(trValor) <= 0 || !trFecha}
                onClick={() =>
                  transferencia(() =>
                    apiConductores.agregarTransferencia(viaje.cuadroViajeId, { fecha: trFecha, valor: Number(trValor), nota: trNota || undefined }),
                  )
                }
              >
                Agregar transferencia
              </button>
            </div>
          </div>
          {verPagos && (
            <>
              <label className="campo-ancho" style={{ marginTop: "0.8rem" }}>
                <span>Producido conductor</span>
                <input
                  type="number"
                  step="any"
                  value={producido}
                  placeholder={viaje.producidoMatriz === null ? "Sin valor en la matriz" : String(viaje.producidoMatriz)}
                  onChange={(e) => setProducido(e.target.value)}
                />
              </label>
              <div className="dato-sec">
                {viaje.producidoMatriz === null
                  ? `Sin valor en la matriz${viaje.tarifa ? ` para ${viaje.tarifa}` : " (el viaje no tiene tarifa)"}: escribelo aqui.`
                  : `De la matriz (${viaje.tarifa}${viaje.tarifaDeducida ? ", deducida: el viaje no tiene tarifa en el Cuadro" : ""}): ${moneda(viaje.producidoMatriz)}. Vacio = ese valor.`}
              </div>
            </>
          )}
          <label className="campo-ancho" style={{ marginTop: "0.6rem" }}>
            <span>Nota (opcional)</span>
            <input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
          </label>
        </div>
      </div>
    </Modal>
  );
}
