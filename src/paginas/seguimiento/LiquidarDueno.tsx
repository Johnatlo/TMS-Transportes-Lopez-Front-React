/**
 * Liquidacion a un dueno (docs/Liq duenos ejemplo.xlsx), como la de Pago a
 * terceros: se elige el grupo y sus viajes, se escriben los conceptos, se ve el
 * total y se descarga en Excel; "Registrar pago" ademas marca los viajes como
 * pagados al dueno y guarda la liquidacion. Lo que no se pague pasa como saldo
 * pendiente a la siguiente.
 *
 * Los conceptos que se van escribiendo quedan como borrador en este navegador
 * hasta que se registra.
 */
import { useEffect, useState } from "react";
import { apiSeguimiento, moneda } from "../../api/cliente";
import type { ConceptoLiquidacion, FilaRentabilidad, LiquidacionDueno } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import Modal from "../../componentes/Modal";
import { Pastilla } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "../cuadro/estadosCuadro";
import { numeroONulo } from "./liquidacionTerceros";
import { armarLiquidacionDueno, conceptosAutomaticos, evaluarExpresion, tituloCuenta } from "./liquidacionDuenos";
import { descargarLiquidacionDueno } from "./excelLiquidacionDueno";

/** Un concepto escrito a mano: la cuenta va en texto y "suma" dice si se le suma o descuenta. */
interface ConceptoEscrito {
  descripcion: string;
  valor: string;
  suma: boolean;
}

const VACIO: ConceptoEscrito = { descripcion: "", valor: "", suma: false };
/** Donde queda el borrador de un grupo en este navegador. */
const claveBorrador = (grupo: string) => `tms-liquidacion-dueno-${grupo}`;

/** Borrador guardado de un grupo (el navegador puede no dejar leerlo). */
function leerBorrador(grupo: string): ConceptoEscrito[] {
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(claveBorrador(grupo)) ?? "[]");
    return Array.isArray(guardado) ? (guardado as ConceptoEscrito[]) : [];
  } catch {
    return [];
  }
}

/** Guarda o borra el borrador de un grupo. */
function guardarBorrador(grupo: string, conceptos: ConceptoEscrito[]) {
  try {
    if (conceptos.length) localStorage.setItem(claveBorrador(grupo), JSON.stringify(conceptos));
    else localStorage.removeItem(claveBorrador(grupo));
  } catch {
    // Sin borrador: se pierde lo escrito si se cierra la ventana.
  }
}

/** Sirve el concepto para liquidar: tiene descripcion y una cuenta que se entiende. */
const conceptoValido = (c: ConceptoEscrito) => !!c.descripcion.trim() && evaluarExpresion(c.valor) !== null;
/** Renglon a medio escribir o con una cuenta que no se entiende. */
const conceptoIncompleto = (c: ConceptoEscrito) => (c.descripcion.trim() !== "" || c.valor.trim() !== "") && !conceptoValido(c);

/** Ventana de la liquidacion a un dueno. */
export default function LiquidarDueno({
  filas,
  grupos,
  grupoInicial,
  alCerrar,
  alGuardar,
}: {
  filas: FilaRentabilidad[];
  grupos: string[];
  grupoInicial: string;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const historial = useDatos(() => apiSeguimiento.liquidacionesDuenos(), []);
  const [grupo, setGrupo] = useState(grupoInicial);
  const [nombre, setNombre] = useState(grupoInicial);
  const sinPagar = (g: string) =>
    filas.filter((f) => f.grupo === g && !f.fechaPagoBeneficiario && f.valorEmpresa > 0).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  /** Marcados de entrada: los que el cliente ya pago. */
  const cobrados = (g: string) => new Set(sinPagar(g).filter((f) => f.fechaPagoEmpresa).map((f) => f.id));
  const [marcados, setMarcados] = useState<Set<number>>(() => cobrados(grupoInicial));
  const [fecha, setFecha] = useState(hoyColombia());
  const [pagado, setPagado] = useState("");
  const [escritos, setEscritos] = useState<ConceptoEscrito[]>(() => leerBorrador(grupoInicial));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => guardarBorrador(grupo, escritos), [grupo, escritos]);

  const viajes = sinPagar(grupo);
  const elegidos = viajes.filter((v) => marcados.has(v.id));
  const delGrupo = (historial.datos ?? []).filter((l) => l.grupo === grupo);
  const automaticos = conceptosAutomaticos(elegidos, delGrupo[0] ?? null);
  const manuales: ConceptoLiquidacion[] = escritos.filter(conceptoValido).map((c) => {
    const v = evaluarExpresion(c.valor) ?? 0;
    return { descripcion: c.descripcion.trim(), expresion: c.valor, valor: c.suma ? v : -v };
  });
  const conceptos = [...automaticos, ...manuales];
  const valorPagado = numeroONulo(pagado);
  const l = armarLiquidacionDueno(elegidos, conceptos, { grupo, nombre: nombre.trim() || grupo, fecha, pagado: valorPagado });
  const incompletos = escritos.filter(conceptoIncompleto).length;
  // El saldo pendiente sale de la liquidacion anterior: hay que esperar a tenerla.
  const bloqueado = enviando || historial.cargando || !!historial.error || !fecha || l.filas.length === 0 || incompletos > 0;

  /** Cambia de grupo con sus viajes cobrados y su borrador. */
  function elegirGrupo(g: string) {
    setGrupo(g);
    setNombre(g);
    setMarcados(cobrados(g));
    setEscritos(leerBorrador(g));
    setPagado("");
  }

  const alternar = (id: number) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const cambiar = (i: number, c: Partial<ConceptoEscrito>) => setEscritos(escritos.map((x, j) => (j === i ? { ...x, ...c } : x)));

  /** Descarga el Excel y, si se pide, antes registra la liquidacion. */
  async function descargar(registrar: boolean) {
    setEnviando(true);
    setError(null);
    try {
      if (!registrar) {
        await descargarLiquidacionDueno(l);
        setEnviando(false);
        return;
      }
      const nueva = await apiSeguimiento.registrarLiquidacionDueno({ grupo, nombre: l.nombre, fecha, ids: elegidos.map((v) => v.id), conceptos, pagado: valorPagado });
      setEscritos([]);
      guardarBorrador(grupo, []);
      await descargarLiquidacionDueno(nueva);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo generar la liquidacion.");
      setEnviando(false);
    }
  }

  /** Anula la ultima liquidacion del grupo. */
  async function anular(a: LiquidacionDueno) {
    if (a.id === null) return;
    if (!window.confirm(`¿Anular ${tituloCuenta(a.nombre, a.fecha)}? Sus ${a.filas.length} viajes vuelven a quedar sin pagar al dueno.`)) return;
    setError(null);
    try {
      await apiSeguimiento.anularLiquidacionDueno(a.id);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo anular.");
    }
  }

  return (
    <Modal
      ancho="pantalla"
      titulo="Liquidar a un dueno"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-secondary" onClick={() => descargar(false)} disabled={bloqueado}>
            Descargar Excel
          </button>
          <button className="btn-primary" onClick={() => descargar(true)} disabled={bloqueado}>
            {enviando ? "Guardando..." : "Registrar pago y descargar"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      {historial.error && <div className="alert danger">No se pudo leer la liquidacion anterior: {historial.error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Grupo de carros</label>
          <select value={grupo} onChange={(e) => elegirGrupo(e.target.value)}>
            {grupos.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>A nombre de</label>
          <input value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label>Fecha (de la liquidacion y del pago)</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <div className="tabla-scroll" style={{ margin: "0.6rem 0" }}>
        <table className="tabla tabla-compacta">
          <thead>
            <tr>
              <th />
              <th>Fecha</th>
              <th>Placa</th>
              <th>Empresa</th>
              <th>Remision</th>
              <th>Factura</th>
              <th className="num">Valor empresa</th>
              <th className="num">Anticipo</th>
              <th className="num">Saldo</th>
              <th>Pago del cliente</th>
            </tr>
          </thead>
          <tbody>
            {viajes.map((v) => (
              <tr key={v.id}>
                <td>
                  <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={marcados.has(v.id)} onChange={() => alternar(v.id)} />
                </td>
                <td>{fechaCorta(v.fecha)}</td>
                <td>{v.placa}</td>
                <td>{v.empresa}</td>
                <td>{v.remision ?? v.manifiesto ?? "-"}</td>
                <td>{v.facturaNumero ?? "-"}</td>
                <td className="num">{moneda(v.valorEmpresa)}</td>
                <td className="num">{moneda(v.anticipo)}</td>
                <td className="num">{moneda(v.saldoBeneficiario + v.otrosDescuentos)}</td>
                <td>{v.fechaPagoEmpresa ? fechaCorta(v.fechaPagoEmpresa) : <Pastilla tono="aviso">Sin cobrar</Pastilla>}</td>
              </tr>
            ))}
            {viajes.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-row">
                  Este grupo no tiene viajes con flete sin pagar al dueno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h4>Conceptos</h4>
      <div className="dato-sec">El valor acepta cuentas, como en el Excel: 82000/12*2. Quedan como formula en el archivo.</div>
      <table className="tabla tabla-compacta" style={{ margin: "0.4rem 0" }}>
        <tbody>
          {automaticos.map((c) => (
            <tr key={c.descripcion} className="dato-sec">
              <td colSpan={3}>{c.descripcion}</td>
              <td className="num">{moneda(Math.round(c.valor))}</td>
              <td />
            </tr>
          ))}
          {escritos.map((c, i) => {
            const v = evaluarExpresion(c.valor);
            return (
              <tr key={i}>
                <td>
                  <input aria-label="Descripcion del concepto" value={c.descripcion} maxLength={300} placeholder="Sueldo, peajes, cuota del credito..." onChange={(e) => cambiar(i, { descripcion: e.target.value })} />
                </td>
                <td style={{ width: 160 }}>
                  <select aria-label="Se suma o se descuenta" value={c.suma ? "suma" : "resta"} onChange={(e) => cambiar(i, { suma: e.target.value === "suma" })}>
                    <option value="resta">Descuenta</option>
                    <option value="suma">Suma</option>
                  </select>
                </td>
                <td style={{ width: 170 }}>
                  <input aria-label="Valor del concepto" value={c.valor} placeholder="0" onChange={(e) => cambiar(i, { valor: e.target.value })} />
                </td>
                <td className="num" style={{ width: 120 }}>
                  {v === null ? (c.valor.trim() ? <span className="texto-vencido">No se entiende</span> : "-") : moneda(Math.round(c.suma ? v : -v))}
                </td>
                <td style={{ width: 70 }}>
                  <button className="btn-link" onClick={() => setEscritos(escritos.filter((_, j) => j !== i))}>
                    Quitar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button className="btn-link" onClick={() => setEscritos([...escritos, VACIO])}>
        + Agregar concepto
      </button>
      {incompletos > 0 && <div className="dato-sec texto-vencido">Hay {incompletos} concepto(s) sin descripcion o sin un valor valido.</div>}

      <div className="campos-cuadro" style={{ marginTop: "0.6rem" }}>
        <div>
          <label>Valor pagado (si no se le paga todo)</label>
          <input type="number" min={0} value={pagado} onChange={(e) => setPagado(e.target.value)} placeholder={String(Math.max(l.total, 0))} />
        </div>
      </div>

      {l.filas.length > 0 && (
        <table className="tabla" style={{ maxWidth: 560 }}>
          <tbody>
            <tr>
              <td>Saldo de {l.filas.length} viaje(s)</td>
              <td className="num">{moneda(l.totalViajes)}</td>
            </tr>
            <tr>
              <td>Conceptos ({conceptos.length})</td>
              <td className="num">{moneda(l.total - l.totalViajes)}</td>
            </tr>
            <tr>
              <td>
                <strong>Total</strong>
              </td>
              <td className="num">
                <strong className={l.total < 0 ? "texto-vencido" : ""}>{moneda(l.total)}</strong>
              </td>
            </tr>
            <tr>
              <td>Se le paga</td>
              <td className="num">{moneda(l.pagado)}</td>
            </tr>
            {l.saldoPendiente !== 0 && (
              <tr>
                <td>Saldo pendiente (pasa a la siguiente)</td>
                <td className="num">{moneda(l.saldoPendiente)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {delGrupo.length > 0 && (
        <>
          <h4>Liquidaciones registradas de {grupo}</h4>
          <table className="tabla tabla-compacta">
            <tbody>
              {delGrupo.map((a, i) => (
                <tr key={a.id}>
                  <td>{tituloCuenta(a.nombre, a.fecha)}</td>
                  <td className="num">{a.filas.length} viaje(s)</td>
                  <td className="num">{moneda(a.total)}</td>
                  <td className="num">{a.saldoPendiente ? `Pendiente ${moneda(a.saldoPendiente)}` : "-"}</td>
                  <td>
                    <button className="btn-link" onClick={() => descargarLiquidacionDueno(a)}>
                      Excel
                    </button>
                    {i === 0 && (
                      <button className="btn-link" onClick={() => anular(a)}>
                        Anular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
        Salen los viajes con flete sin pagar al dueno; vienen marcados los que el cliente ya pago. "Registrar pago" les pone esta
        fecha de pago y guarda la liquidacion.
      </div>
    </Modal>
  );
}
