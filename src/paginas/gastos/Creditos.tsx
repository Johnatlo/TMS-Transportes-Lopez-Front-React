/**
 * Creditos de las dos empresas: monto, plazo, la cuota que cobra el banco, la
 * tasa mensual (opcional: si no se escribe se deduce de la cuota), el
 * 4 x 1000 que se le descuenta a cada cuota y a quien se reparte cada
 * cuota. Clic en un credito muestra su tabla de amortizacion (capital,
 * interes y saldo) y deja registrar el pago de cada cuota: al pagarla se crea
 * su gasto en el libro con el reparto del credito. Las cuotas anteriores a la
 * fecha de inicio de los gastos solo se marcan pagadas (para que el saldo
 * cuadre). La tabla se exporta a Excel.
 */
import { useState } from "react";
import { apiGastos, hoyColombia, moneda } from "../../api/cliente";
import type { Credito, DatosCredito, EmpresaGasto, OpcionesGastos } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { useSesion } from "../../ganchos/useSesion";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import SelectorDestinos from "./SelectorDestinos";
import { aDestinos, aSeleccion, SELECCION_VACIA, vistaPrevia } from "./destinos";
import type { SeleccionDestinos } from "./destinos";

const EMPRESA: Record<EmpresaGasto, string> = { LOPEZ: "T. Lopez", MYC: "T. M&C" };

/**
 * Tasa mensual (en fraccion) que da la cuota del banco, como la calcula el
 * servidor (prorrateo.ts, tasaImplicita), solo para mostrarla; null si la
 * cuota no alcanza a pagar el monto.
 */
function tasaSegunCuota(monto: number, plazo: number, cuota: number): number | null {
  if (!(monto > 0) || !(plazo > 0) || !(cuota > 0)) return 0;
  if (cuota * plazo < monto - 1) return null;
  if (cuota * plazo <= monto + 1) return 0;
  let bajo = 0;
  let alto = 1;
  for (let i = 0; i < 100; i++) {
    const medio = (bajo + alto) / 2;
    if ((monto * medio) / (1 - Math.pow(1 + medio, -plazo)) > cuota) alto = medio;
    else bajo = medio;
  }
  return Math.round(((bajo + alto) / 2) * 1e6) / 1e6;
}

/** Descarga la tabla de amortizacion del credito. */
async function exportarTabla(c: Credito) {
  const { descargarTabla } = await import("../../componentes/excelTabla");
  const col = (titulo: string, valor: (q: Credito["cuotas"][number]) => string | number | null, derecha = false) => ({
    titulo,
    valores: c.cuotas.map(valor),
    derecha,
  });
  await descargarTabla(
    [
      col("CUOTA", (q) => q.numero),
      col("FECHA", (q) => q.fecha),
      col("VALOR CUOTA", (q) => Math.round(q.cuota), true),
      col("CAPITAL", (q) => Math.round(q.capital), true),
      col("INTERES", (q) => Math.round(q.interes), true),
      col("SALDO", (q) => Math.round(q.saldo), true),
      col("FECHA DE PAGO", (q) => q.fechaPago),
      col("VALOR PAGADO", (q) => (q.fechaPago ? Math.round(q.valorPagado ?? q.cuota) : null), true),
      col(`${c.gmfPorMil} X 1000`, (q) => (q.fechaPago ? Math.round(((q.valorPagado ?? q.cuota) * c.gmfPorMil) / 1000) : null), true),
    ],
    c.nombre,
    `credito-${c.nombre.replace(/[^\w]+/g, "-").toLowerCase()}`,
  );
}

/** Lista de creditos con su tabla de amortizacion. */
export default function Creditos({ opciones, alCambiar }: { opciones: OpcionesGastos; alCambiar: () => void }) {
  const { usuario } = useSesion();
  const carga = useDatos(() => apiGastos.creditos(), []);
  const [formulario, setFormulario] = useState<{ credito: Credito | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (carga.cargando && !carga.datos) return <Cargando que="los creditos" />;
  if (carga.error || !carga.datos) return <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />;

  /** Ejecuta una accion y recarga los creditos y el libro de gastos. */
  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      carga.recargar();
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  const columnas: Columna<Credito>[] = [
    {
      id: "nombre",
      titulo: "Credito",
      valor: (c) => c.nombre,
      celda: (c) => (
        <>
          <span className="principal">{c.nombre}</span>
          <span className="dato-sec">{[c.entidad, c.obligacion ? `Obligacion ${c.obligacion}` : null].filter(Boolean).join(" · ") || "-"}</span>
        </>
      ),
    },
    {
      id: "empresa",
      titulo: "Empresa",
      filtrable: true,
      valor: (c) => EMPRESA[c.empresa],
      celda: (c) => <Pastilla tono={c.empresa === "MYC" ? "morado" : "azul"}>{EMPRESA[c.empresa]}</Pastilla>,
    },
    { id: "monto", titulo: "Monto", alinear: "derecha", valor: (c) => Math.round(c.monto), celda: (c) => moneda(c.monto) },
    {
      id: "tasa",
      titulo: "Tasa (segun la cuota)",
      alinear: "derecha",
      valor: (c) => c.tasaMensual,
      celda: (c) => `${c.tasaMensual.toLocaleString("es-CO", { maximumFractionDigits: 4 })} %`,
    },
    { id: "cuota", titulo: "Cuota", alinear: "derecha", valor: (c) => Math.round(c.cuotas[0]?.cuota ?? 0), celda: (c) => moneda(c.cuotas[0]?.cuota ?? 0) },
    { id: "primera", titulo: "Primera cuota", valor: (c) => c.primeraCuota, celda: (c) => fechaCorta(c.primeraCuota) },
    { id: "pagadas", titulo: "Cuotas pagadas", alinear: "derecha", valor: (c) => c.cuotasPagadas, celda: (c) => `${c.cuotasPagadas} de ${c.plazo}` },
    {
      id: "saldo",
      titulo: "Saldo pendiente",
      alinear: "derecha",
      valor: (c) => Math.round(c.saldoPendiente),
      celda: (c) => <strong>{moneda(c.saldoPendiente)}</strong>,
    },
    {
      id: "prorratea",
      titulo: "Se reparte",
      valor: (c) => (c.prorratea === "INTERES" ? "Solo interes" : "Capital e interes"),
      celda: (c) => (c.prorratea === "INTERES" ? "Solo interes" : "Capital e interes"),
    },
  ];

  return (
    <>
      {error && <div className="alert danger">{error}</div>}
      <div className="panel">
        <TablaDatos
          filas={carga.datos}
          columnas={columnas}
          clave={(c) => c.id}
          nombreArchivo="creditos"
          placeholderBusqueda="Buscar credito, entidad..."
          vacio="Aun no hay creditos. Crea el primero con el boton Nuevo credito."
          acciones={
            <button className="btn-primary boton-con-texto" onClick={() => setFormulario({ credito: null })}>
              Nuevo credito
            </button>
          }
          detalle={(c) => (
            <TablaAmortizacion
              c={c}
              corte={opciones.corte}
              alEditar={() => setFormulario({ credito: c })}
              alBorrar={() => window.confirm(`¿Borrar el credito "${c.nombre}"?`) && accion(() => apiGastos.borrarCredito(c.id))}
              alPagar={(numero, fecha, valor) => accion(() => apiGastos.pagarCuota(c.id, numero, { fechaPago: fecha, valor }))}
              alQuitarPago={(numero) =>
                window.confirm(`¿Quitar el pago de la cuota ${numero}? Se borra su gasto del libro.`) && accion(() => apiGastos.quitarPagoCuota(c.id, numero))
              }
            />
          )}
        />
      </div>
      {formulario && (
        <FormularioCredito
          opciones={opciones}
          credito={formulario.credito}
          soloMyc={usuario?.rol === "MYC"}
          alCerrar={() => setFormulario(null)}
          alGuardar={() => {
            setFormulario(null);
            carga.recargar();
          }}
        />
      )}
    </>
  );
}

/** Tabla de amortizacion de un credito con el pago de cada cuota. */
function TablaAmortizacion({
  c,
  corte,
  alEditar,
  alBorrar,
  alPagar,
  alQuitarPago,
}: {
  c: Credito;
  corte: string;
  alEditar: () => void;
  alBorrar: () => void;
  alPagar: (numero: number, fecha: string, valor: number | null) => void;
  alQuitarPago: (numero: number) => void;
}) {
  const [fechas, setFechas] = useState<Record<number, string>>({});
  const [valores, setValores] = useState<Record<number, string>>({});
  const siguiente = c.cuotas.find((q) => !q.fechaPago)?.numero;
  return (
    <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
      <div className="detalle-tanqueo-pie" style={{ marginTop: 0, marginBottom: "0.5rem" }}>
        <span>
          Saldo pendiente: <strong>{moneda(c.saldoPendiente)}</strong>
        </span>
        <span className="dato-sec">
          {c.cuotasPagadas} de {c.plazo} cuotas pagadas · a cada cuota se le suma su {c.gmfPorMil} x 1000
        </span>
        <button className="btn-secondary" onClick={alEditar}>
          Editar credito
        </button>
        <button className="boton-barra" onClick={() => exportarTabla(c)}>
          Exportar tabla
        </button>
        {c.cuotasPagadas === 0 && (
          <button className="btn-link" onClick={alBorrar}>
            Borrar
          </button>
        )}
      </div>
      {c.nota && <div className="dato-sec">{c.nota}</div>}
      <div className="tabla-amortizacion">
        <table className="tabla tabla-compacta">
          <thead>
            <tr>
              <th>Cuota</th>
              <th>Fecha</th>
              <th className="num">Valor cuota</th>
              <th className="num">Capital</th>
              <th className="num">Interes</th>
              <th className="num">Saldo</th>
              <th>Pago</th>
            </tr>
          </thead>
          <tbody>
            {c.cuotas.map((q) => (
              <tr key={q.numero} className={q.fechaPago ? "fila-cruzada" : undefined}>
                <td>{q.numero}</td>
                <td>{fechaCorta(q.fecha)}</td>
                <td className="num">{moneda(q.cuota)}</td>
                <td className="num">{moneda(q.capital)}</td>
                <td className="num">{moneda(q.interes)}</td>
                <td className="num">
                  <strong>{moneda(q.saldo)}</strong>
                </td>
                <td>
                  {q.fechaPago ? (
                    <>
                      Pagada {fechaCorta(q.fechaPago)}
                      {q.valorPagado !== null && <span className="dato-sec"> por {moneda(q.valorPagado)}</span>}{" "}
                      {!q.gastoId && <span className="dato-sec">(antes del inicio: sin gasto)</span>}{" "}
                      <button className="btn-link" onClick={() => alQuitarPago(q.numero)}>
                        Quitar
                      </button>
                    </>
                  ) : (
                    <span className="estado-abono">
                      <input
                        type="date"
                        value={fechas[q.numero] ?? (q.numero === siguiente ? hoyColombia() : "")}
                        onChange={(e) => setFechas({ ...fechas, [q.numero]: e.target.value })}
                        aria-label={`Fecha de pago de la cuota ${q.numero}`}
                      />
                      <input
                        type="number"
                        min={0}
                        step="any"
                        style={{ width: "8rem", textAlign: "right" }}
                        placeholder={String(Math.round(q.cuota))}
                        title="Lo que de verdad se pago (si la tasa cambio); vacio = la cuota de la tabla"
                        value={valores[q.numero] ?? ""}
                        onChange={(e) => setValores({ ...valores, [q.numero]: e.target.value })}
                        aria-label={`Valor pagado de la cuota ${q.numero}`}
                      />
                      <button
                        className="btn-link"
                        disabled={!(fechas[q.numero] ?? (q.numero === siguiente ? hoyColombia() : ""))}
                        onClick={() => alPagar(q.numero, fechas[q.numero] ?? hoyColombia(), valores[q.numero] ? Number(valores[q.numero]) : null)}
                      >
                        Registrar pago
                      </button>
                      {q.fecha < corte && <span className="dato-sec">anterior al inicio</span>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Formulario para crear o cambiar un credito. */
function FormularioCredito({
  opciones,
  credito,
  soloMyc,
  alCerrar,
  alGuardar,
}: {
  opciones: OpcionesGastos;
  credito: Credito | null;
  soloMyc: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [f, setF] = useState({
    empresa: (credito?.empresa ?? (soloMyc ? "MYC" : "LOPEZ")) as EmpresaGasto,
    nombre: credito?.nombre ?? "",
    entidad: credito?.entidad ?? "",
    obligacion: credito?.obligacion ?? "",
    monto: credito ? String(credito.monto) : "",
    gmfPorMil: credito ? String(credito.gmfPorMil) : "4",
    tasaMensual: credito ? String(credito.tasaMensual) : "",
    plazo: credito ? String(credito.plazo) : "",
    primeraCuota: credito?.primeraCuota ?? "",
    cuotaFija: credito ? String(credito.cuotaFija ?? credito.cuotas[0]?.cuota ?? "") : "",
    prorratea: credito?.prorratea ?? ("CAPITAL_E_INTERES" as Credito["prorratea"]),
    nota: credito?.nota ?? "",
  });
  const [destinos, setDestinos] = useState<SeleccionDestinos>(credito ? aSeleccion(credito.destinos) : SELECCION_VACIA);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const conPagos = (credito?.cuotasPagadas ?? 0) > 0;
  // Cuota estimada para la vista previa del reparto.
  const monto = Number(f.monto) || 0;
  const plazo = Number(f.plazo) || 0;
  const cuota = Number(f.cuotaFija) || 0;
  const gmf = Math.round((cuota * (Number(f.gmfPorMil) || 0)) / 1000);
  // La tasa es opcional: si se escribe se usa esa; si no, la que da la cuota del banco.
  const tasaEscrita = f.tasaMensual.trim() === "" ? null : Number(f.tasaMensual) / 100;
  const tasa = tasaEscrita ?? tasaSegunCuota(monto, plazo, cuota);
  const listo = !!f.nombre.trim() && monto > 0 && plazo > 0 && cuota > 0 && tasa !== null && !!f.primeraCuota && !vistaPrevia(cuota + gmf, destinos).problema;

  async function guardar() {
    setGuardando(true);
    setError(null);
    const datos: DatosCredito = {
      empresa: f.empresa,
      nombre: f.nombre,
      entidad: f.entidad || null,
      obligacion: f.obligacion || null,
      monto,
      gmfPorMil: f.gmfPorMil === "" ? 4 : Number(f.gmfPorMil),
      tasaMensual: f.tasaMensual.trim() === "" ? null : Number(f.tasaMensual),
      plazo,
      primeraCuota: f.primeraCuota,
      cuotaFija: cuota,
      prorratea: f.prorratea,
      destinos: aDestinos(destinos),
      nota: f.nota || null,
    };
    try {
      if (credito) await apiGastos.actualizarCredito(credito.id, datos);
      else await apiGastos.crearCredito(datos);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={credito ? `Editar credito ${credito.nombre}` : "Nuevo credito"}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={!listo || guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      {conPagos && (
        <div className="alert info">
          Este credito ya tiene cuotas pagadas: el monto, la cuota, el plazo y las fechas no se cambian (solo el nombre, la nota, el 4 x 1000 y el reparto de
          las cuotas que faltan).
        </div>
      )}
      <div className="campos-cuadro">
        <div>
          <label>Empresa</label>
          <select value={f.empresa} disabled={soloMyc} onChange={(e) => setF({ ...f, empresa: e.target.value as EmpresaGasto })}>
            <option value="LOPEZ">Transportes Lopez C SAS</option>
            <option value="MYC">Transportes M&C SAS</option>
          </select>
        </div>
        <div>
          <label>Nombre del credito</label>
          <input value={f.nombre} maxLength={150} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Credito 80 millones" />
        </div>
        <div>
          <label>Entidad (opcional)</label>
          <input value={f.entidad} maxLength={100} onChange={(e) => setF({ ...f, entidad: e.target.value })} />
        </div>
        <div>
          <label>N° de obligacion (opcional)</label>
          <input value={f.obligacion} maxLength={60} onChange={(e) => setF({ ...f, obligacion: e.target.value })} />
        </div>
        <div>
          <label>Monto</label>
          <input type="number" min={0} step="any" disabled={conPagos} value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
        </div>
        <div>
          <label>4 x 1000 que se descuenta a cada cuota (por mil)</label>
          <input type="number" min={0} step="any" value={f.gmfPorMil} onChange={(e) => setF({ ...f, gmfPorMil: e.target.value })} placeholder="4" />
        </div>
        <div>
          <label>Tasa de interes mensual % (opcional)</label>
          <input
            type="number"
            min={0}
            step="any"
            disabled={conPagos}
            value={f.tasaMensual}
            onChange={(e) => setF({ ...f, tasaMensual: e.target.value })}
            placeholder={tasaSegunCuota(monto, plazo, cuota) ? String(Math.round(tasaSegunCuota(monto, plazo, cuota)! * 1_000_000) / 10_000) : "1,6725"}
          />
        </div>
        <div>
          <label>Plazo (cuotas)</label>
          <input type="number" min={1} max={480} disabled={conPagos} value={f.plazo} onChange={(e) => setF({ ...f, plazo: e.target.value })} />
        </div>
        <div>
          <label>Fecha de la primera cuota</label>
          <input type="date" disabled={conPagos} value={f.primeraCuota} onChange={(e) => setF({ ...f, primeraCuota: e.target.value })} />
        </div>
        <div>
          <label>Cuota que cobra el banco</label>
          <input
            type="number"
            min={0}
            step="any"
            disabled={conPagos}
            value={f.cuotaFija}
            onChange={(e) => setF({ ...f, cuotaFija: e.target.value })}
            placeholder="2122647"
          />
        </div>
        <div>
          <label>Que se reparte al pagar la cuota</label>
          <select value={f.prorratea} onChange={(e) => setF({ ...f, prorratea: e.target.value as Credito["prorratea"] })}>
            <option value="CAPITAL_E_INTERES">Capital e interes (toda la cuota)</option>
            <option value="INTERES">Solo el interes</option>
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Nota (opcional)</label>
          <input value={f.nota} maxLength={300} onChange={(e) => setF({ ...f, nota: e.target.value })} />
        </div>
      </div>
      {cuota > 0 && (
        <div className="dato-sec" style={{ marginTop: "0.3rem" }}>
          Cada cuota: <strong>{moneda(cuota)}</strong> + {f.gmfPorMil || 0} x 1000 (<strong>{moneda(gmf)}</strong>) = <strong>{moneda(cuota + gmf)}</strong>.{" "}
          {tasa === null
            ? "Con esa cuota y ese plazo no se alcanza a pagar el monto."
            : tasaEscrita !== null
              ? `Capital e interes con la tasa escrita: ${(tasa * 100).toLocaleString("es-CO", { maximumFractionDigits: 4 })} % mensual. Al pagar cada cuota se puede escribir lo que de verdad se pago.`
              : `Sin tasa escrita (cambia mes a mes), con esta cuota da ${(tasa * 100).toLocaleString("es-CO", { maximumFractionDigits: 4 })} % mensual, para separar capital e interes. Al pagar cada cuota se puede escribir lo que de verdad se pago.`}
        </div>
      )}
      <h4 style={{ margin: "1rem 0 0.4rem" }}>A quien se le descuenta cada cuota</h4>
      <SelectorDestinos opciones={opciones} monto={Math.round(cuota + gmf)} valor={destinos} alCambiar={setDestinos} />
    </Modal>
  );
}
