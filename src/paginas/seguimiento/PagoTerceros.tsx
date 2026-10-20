/**
 * Pago a terceros: lo que se le paga al dueno de cada vehiculo tercero por sus
 * viajes. Reemplaza la "Matriz Terceros" de Excel (una hoja por tercero).
 *
 * Por viaje se escribe lo pactado con el tercero (por tonelada o fijo), el
 * adicional por transferencia, cuando entrego los documentos y su cuenta de
 * cobro. El efectivo y el combustible salen de los anticipos de la bomba. Las
 * retenciones se ven siempre y se descuentan solo si se marca. Se le paga el
 * viernes (descargue lunes o martes: el de esa semana; de miercoles en
 * adelante: el de la siguiente). "Por tercero" junta lo que se le debe a cada
 * uno para registrar el pago de una vez.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiCuadro, apiSeguimiento, moneda } from "../../api/cliente";
import type { EstadoPagoTercero, ResumenTercero, ViajeTercero } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla, TonoPastilla } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "../cuadro/estadosCuadro";
import { liquidarTercero, numeroONulo } from "./liquidacionTerceros";
import ImportarNombresTerceros from "./ImportarNombresTerceros";

const ESTADO: Record<EstadoPagoTercero, { etiqueta: string; tono: TonoPastilla }> = {
  FALTA_PACTAR: { etiqueta: "Falta pactar", tono: "error" },
  FALTAN_DOCUMENTOS: { etiqueta: "Faltan documentos", tono: "aviso" },
  POR_PAGAR: { etiqueta: "Por pagar", tono: "info" },
  VENCIDO: { etiqueta: "Vencido", tono: "error" },
  PAGADO: { etiqueta: "Pagado", tono: "ok" },
};

/** Listo para pagar: pactado, con documentos y sin pagar. */
const listo = (v: ViajeTercero) => v.estadoPagoTercero === "POR_PAGAR" || v.estadoPagoTercero === "VENCIDO";

const PESTANAS: PestanaTabla<ViajeTercero>[] = [
  { id: "porPagar", etiqueta: "Por pagar", incluye: listo },
  { id: "vencidos", etiqueta: "Vencidos", incluye: (v) => v.estadoPagoTercero === "VENCIDO" },
  { id: "faltaPactar", etiqueta: "Falta pactar", incluye: (v) => v.estadoPagoTercero === "FALTA_PACTAR" },
  { id: "faltanDocumentos", etiqueta: "Faltan documentos", incluye: (v) => v.estadoPagoTercero === "FALTAN_DOCUMENTOS" },
  { id: "pagados", etiqueta: "Pagados", incluye: (v) => v.estadoPagoTercero === "PAGADO" },
  { id: "todos", etiqueta: "Todos", incluye: () => true },
];

/** Kilos a toneladas para mostrar (34000 -> "34"); sin peso, "-". */
const toneladas = (kg: number | null) => (kg === null ? "-" : (kg / 1000).toLocaleString("es-CO", { maximumFractionDigits: 3 }));

const COLUMNAS: Columna<ViajeTercero>[] = [
  { id: "fecha", titulo: "Fecha", valor: (v) => v.fecha, celda: (v) => fechaCorta(v.fecha) },
  {
    id: "tercero",
    titulo: "Tercero",
    filtrable: true,
    valor: (v) => v.tercero,
    celda: (v) => (
      <>
        <span className="principal">{v.tercero}</span>
        <span className="dato-sec">{v.placa}</span>
      </>
    ),
  },
  { id: "empresa", titulo: "Empresa", filtrable: true, valor: (v) => v.empresa, celda: (v) => v.empresa },
  {
    id: "documento",
    titulo: "Manifiesto / remision",
    valor: (v) => v.manifiesto ?? v.remision ?? "",
    celda: (v) => (
      <>
        <span className="codigo">{v.manifiesto ?? "-"}</span>
        {v.remision && <span className="dato-sec">Rem. {v.remision}</span>}
      </>
    ),
  },
  { id: "peso", titulo: "Toneladas", alinear: "derecha", valor: (v) => v.pesoKg ?? 0, celda: (v) => toneladas(v.pesoKg) },
  {
    id: "valorTercero",
    titulo: "Valor tercero",
    alinear: "derecha",
    valor: (v) => v.valorTercero ?? 0,
    celda: (v) =>
      v.valorTercero === null ? (
        <span className="texto-vencido">Sin pactar</span>
      ) : (
        <>
          {moneda(v.valorTercero)}
          <span className="dato-sec">{v.valorTerceroFijo !== null ? "Fijo" : `${moneda(v.valorTerceroTon ?? 0)} x ton`}</span>
        </>
      ),
  },
  {
    id: "anticipos",
    titulo: "Anticipos",
    alinear: "derecha",
    valor: (v) => v.efectivo + v.combustible + v.transferencia,
    celda: (v) => (
      <>
        {moneda(v.efectivo + v.combustible + v.transferencia)}
        <span className="dato-sec">
          Efect. {moneda(v.efectivo)} · Comb. {moneda(v.combustible)}
          {v.transferencia > 0 && ` · Transf. ${moneda(v.transferencia)}`}
        </span>
      </>
    ),
  },
  {
    id: "valorAPagar",
    titulo: "Valor a pagar",
    alinear: "derecha",
    valor: (v) => v.valorAPagar ?? 0,
    celda: (v) =>
      v.valorAPagar === null ? (
        <span className="dato-sec">-</span>
      ) : (
        <>
          <strong className={v.valorAPagar < 0 ? "texto-vencido" : ""}>{moneda(v.valorAPagar)}</strong>
          {v.aplicaDescuentosTercero && <span className="dato-sec">Con retenciones</span>}
        </>
      ),
  },
  {
    id: "pago",
    titulo: "Fecha de pago",
    valor: (v) => v.fechaPagoSaldo ?? v.venceSaldo ?? "",
    celda: (v) =>
      v.fechaPagoSaldo ? (
        <>
          {fechaCorta(v.fechaPagoSaldo)}
          {v.cuentaCobroTercero && <span className="dato-sec">{v.cuentaCobroTercero}</span>}
        </>
      ) : v.venceSaldo ? (
        <span className={v.estadoPagoTercero === "VENCIDO" ? "texto-vencido" : "dato-sec"}>Viernes {fechaCorta(v.venceSaldo)}</span>
      ) : (
        <span className="dato-sec">Sin descargue</span>
      ),
  },
  {
    id: "estado",
    titulo: "Estado",
    filtrable: true,
    valor: (v) => ESTADO[v.estadoPagoTercero].etiqueta,
    celda: (v) => <Pastilla tono={ESTADO[v.estadoPagoTercero].tono}>{ESTADO[v.estadoPagoTercero].etiqueta}</Pastilla>,
  },
];

/** Pagina completa: totales, viajes o resumen por tercero, editor del viaje y registro de pago. */
export default function PagoTerceros() {
  const datos = useDatos(() => apiSeguimiento.terceros(), []);
  const [parametros, setParametros] = useSearchParams();
  const [editando, setEditando] = useState<number | null>(null);
  const [pagando, setPagando] = useState<ResumenTercero | null>(null);
  const [vista, setVista] = useState<"viajes" | "terceros">("viajes");
  const [importando, setImportando] = useState(false);

  // ?viaje=<id del cuadro>: abre ese viaje (desde el detalle del cuadro).
  useEffect(() => {
    const id = Number(parametros.get("viaje"));
    if (id) {
      setEditando(id);
      setParametros({}, { replace: true });
    }
  }, [parametros, setParametros]);

  if (datos.cargando && !datos.datos) return <Cargando que="los pagos a terceros" />;
  if (datos.error || !datos.datos) return <ErrorCarga mensaje={datos.error ?? "Sin datos"} alReintentar={datos.recargar} />;

  const { viajes, terceros } = datos.datos;
  const porPagar = terceros.reduce((s, t) => s + t.porPagar, 0);
  const vencido = terceros.reduce((s, t) => s + t.vencido, 0);
  const faltanDocumentos = terceros.reduce((s, t) => s + t.faltanDocumentos, 0);
  const faltaPactar = terceros.reduce((s, t) => s + t.faltaPactar, 0);
  const viaje = editando ? viajes.find((v) => v.id === editando) ?? null : null;

  const columnasTerceros: Columna<ResumenTercero>[] = [
    {
      id: "tercero",
      titulo: "Tercero",
      valor: (t) => t.tercero,
      celda: (t) => (
        <>
          <span className="principal">{t.tercero}</span>
          <span className="dato-sec">{t.placas.join(", ")}</span>
        </>
      ),
    },
    { id: "viajes", titulo: "Viajes", alinear: "derecha", valor: (t) => t.viajes, celda: (t) => t.viajes },
    { id: "faltaPactar", titulo: "Falta pactar", alinear: "derecha", valor: (t) => t.faltaPactar, celda: (t) => (t.faltaPactar ? <span className="texto-vencido">{t.faltaPactar}</span> : "-") },
    { id: "faltanDocumentos", titulo: "Faltan documentos", alinear: "derecha", valor: (t) => t.faltanDocumentos, celda: (t) => t.faltanDocumentos || "-" },
    { id: "vencido", titulo: "Vencido", alinear: "derecha", valor: (t) => t.vencido, celda: (t) => (t.vencido ? <span className="texto-vencido">{moneda(t.vencido)}</span> : "-") },
    { id: "porPagar", titulo: "Por pagar", alinear: "derecha", valor: (t) => t.porPagar, celda: (t) => <strong>{moneda(t.porPagar)}</strong> },
    {
      id: "acciones",
      titulo: "",
      etiquetaMovil: null,
      alinear: "derecha",
      celda: (t) =>
        viajes.some((v) => v.tercero === t.tercero && listo(v)) ? (
          <button className="boton-suave" onClick={() => setPagando(t)}>
            Registrar pago
          </button>
        ) : null,
    },
  ];

  const botonNombres = (
    <button className="boton-barra" onClick={() => setImportando(true)}>
      Nombres desde la matriz
    </button>
  );

  return (
    <>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador dinero titulo="Por pagar a terceros" valor={moneda(porPagar)} detalle={`${terceros.filter((t) => t.porPagar > 0).length} terceros`} />
        <Indicador dinero titulo="Vencido" valor={moneda(vencido)} alerta={vencido > 0} detalle="su viernes ya paso" />
        <Indicador titulo="Viajes sin pactar" valor={faltaPactar} alerta={faltaPactar > 0} detalle="falta el valor del tercero" />
        <Indicador titulo="Faltan documentos" valor={faltanDocumentos} detalle="el tercero no los ha entregado" />
      </div>
      <div className="dato-sec" style={{ marginBottom: "0.5rem" }}>
        Viajes de vehiculos terceros. Valor a pagar = valor del tercero - efectivo - combustible - transferencia (y las
        retenciones, si se marcan). Se le paga el viernes: si descargo lunes o martes, el de esa semana; de miercoles en
        adelante, el de la siguiente.
      </div>
      <div className="tabla-pestanas selector-vista">
        <button className={vista === "viajes" ? "activa" : ""} onClick={() => setVista("viajes")}>
          Por viaje
        </button>
        <button className={vista === "terceros" ? "activa" : ""} onClick={() => setVista("terceros")}>
          Por tercero
        </button>
      </div>
      <div className="panel">
        {vista === "viajes" ? (
          <TablaDatos
            filas={viajes}
            columnas={COLUMNAS}
            clave={(v) => v.id}
            pestanas={PESTANAS}
            nombreArchivo="pago-terceros"
            acciones={botonNombres}
            placeholderBusqueda="Buscar tercero, placa, empresa, manifiesto..."
            vacio="No hay viajes con estos criterios."
            alClicFila={(v) => setEditando(v.id)}
          />
        ) : (
          <TablaDatos
            filas={terceros}
            columnas={columnasTerceros}
            clave={(t) => t.tercero}
            nombreArchivo="pago-por-tercero"
            acciones={botonNombres}
            placeholderBusqueda="Buscar tercero o placa..."
            vacio="No hay viajes de terceros."
          />
        )}
      </div>
      {viaje && <EditarPago viaje={viaje} alCerrar={() => setEditando(null)} alGuardar={datos.recargar} />}
      {editando !== null && !viaje && !datos.cargando && (
        <Modal titulo="Pago al tercero" alCerrar={() => setEditando(null)}>
          <div className="alert info">Ese viaje no es de un vehiculo tercero o esta anulado.</div>
        </Modal>
      )}
      {importando && <ImportarNombresTerceros alCerrar={() => setImportando(false)} alCambiar={datos.recargar} />}
      {pagando && (
        <PagarTercero
          tercero={pagando.tercero}
          viajes={viajes.filter((v) => v.tercero === pagando.tercero && listo(v))}
          alCerrar={() => setPagando(null)}
          alGuardar={() => {
            setPagando(null);
            datos.recargar();
          }}
        />
      )}
    </>
  );
}

/** Formulario del pago de un viaje: lo pactado, la transferencia, documentos, retenciones y fechas. */
function EditarPago({ viaje, alCerrar, alGuardar }: { viaje: ViajeTercero; alCerrar: () => void; alGuardar: () => void }) {
  const texto = (n: number | null) => (n === null ? "" : String(n));
  const [f, setF] = useState({
    valorTerceroTon: texto(viaje.valorTerceroTon),
    valorTerceroFijo: texto(viaje.valorTerceroFijo),
    anticipoTransferencia: texto(viaje.anticipoTransferencia),
    anticipoTransferenciaFecha: viaje.anticipoTransferenciaFecha ?? "",
    anticipoTransferenciaLink: viaje.anticipoTransferenciaLink ?? "",
    fechaEntregaDocsTercero: viaje.fechaEntregaDocsTercero ?? "",
    cuentaCobroTercero: viaje.cuentaCobroTercero ?? "",
    icaTerceroPorMil: texto(viaje.icaTerceroPorMil),
    aplicaDescuentosTercero: viaje.aplicaDescuentosTercero,
    fechaPagoTerceroProgramada: viaje.fechaPagoTerceroProgramada ?? "",
    fechaPagoSaldo: viaje.fechaPagoSaldo ?? "",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cambiar = (campo: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const icaPorMil = numeroONulo(f.icaTerceroPorMil) ?? viaje.icaSugerido;
  const l = liquidarTercero(
    {
      pesoKg: viaje.pesoKg,
      valorTerceroTon: numeroONulo(f.valorTerceroTon),
      valorTerceroFijo: numeroONulo(f.valorTerceroFijo),
      anticipoTransferencia: numeroONulo(f.anticipoTransferencia),
      aplicaDescuentosTercero: f.aplicaDescuentosTercero,
      icaPorMil,
    },
    viaje
  );
  // Sin fecha escrita a mano: el viernes que calcula el backend con el descargue.
  const viernes = viaje.fechaPagoTerceroProgramada ? null : viaje.venceSaldo;

  async function guardar() {
    setEnviando(true);
    setError(null);
    try {
      await apiCuadro.actualizar(viaje.id, {
        valorTerceroTon: numeroONulo(f.valorTerceroTon),
        valorTerceroFijo: numeroONulo(f.valorTerceroFijo),
        anticipoTransferencia: numeroONulo(f.anticipoTransferencia),
        anticipoTransferenciaFecha: f.anticipoTransferenciaFecha || null,
        anticipoTransferenciaLink: f.anticipoTransferenciaLink.trim() || null,
        fechaEntregaDocsTercero: f.fechaEntregaDocsTercero || null,
        cuentaCobroTercero: f.cuentaCobroTercero.trim() || null,
        icaTerceroPorMil: numeroONulo(f.icaTerceroPorMil),
        aplicaDescuentosTercero: f.aplicaDescuentosTercero,
        fechaPagoTerceroProgramada: f.fechaPagoTerceroProgramada || null,
        fechaPagoSaldo: f.fechaPagoSaldo || null,
      });
      alGuardar();
      alCerrar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setEnviando(false);
    }
  }

  const fila = (etiqueta: string, valor: number, resta = true) => (
    <tr>
      <td>{etiqueta}</td>
      <td style={{ textAlign: "right" }}>{valor ? `${resta ? "- " : ""}${moneda(valor)}` : "-"}</td>
    </tr>
  );

  return (
    <Modal
      ancho="wide"
      titulo={`Pago al tercero · ${viaje.tercero} · ${viaje.placa}`}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={enviando}>
            {enviando ? "Guardando..." : "Guardar"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="dato-sec" style={{ marginBottom: "0.6rem" }}>
        {viaje.empresa} · viaje del {fechaCorta(viaje.fecha)} · {viaje.manifiesto ? `manifiesto ${viaje.manifiesto}` : "sin manifiesto"}
        {viaje.remision && ` · remision ${viaje.remision}`} · {toneladas(viaje.pesoKg)} t
        {viaje.fechaDescargue ? ` · descargo el ${fechaCorta(viaje.fechaDescargue)}` : " · sin fecha de descargue"}
      </div>

      <h4>Lo pactado con el tercero</h4>
      <div className="campos-cuadro">
        <div>
          <label>Valor por tonelada</label>
          <input type="number" min={0} value={f.valorTerceroTon} onChange={cambiar("valorTerceroTon")} placeholder="0" />
        </div>
        <div>
          <label>O valor fijo del viaje</label>
          <input type="number" min={0} value={f.valorTerceroFijo} onChange={cambiar("valorTerceroFijo")} placeholder="Manda sobre el de por tonelada" />
        </div>
      </div>

      <h4>Adicional por transferencia</h4>
      <div className="campos-cuadro">
        <div>
          <label>Valor</label>
          <input type="number" min={0} value={f.anticipoTransferencia} onChange={cambiar("anticipoTransferencia")} placeholder="0" />
        </div>
        <div>
          <label>Fecha</label>
          <input type="date" value={f.anticipoTransferenciaFecha} onChange={cambiar("anticipoTransferenciaFecha")} />
        </div>
        <div>
          <label>Enlace al comprobante (opcional)</label>
          <input type="url" value={f.anticipoTransferenciaLink} onChange={cambiar("anticipoTransferenciaLink")} placeholder="https://..." />
        </div>
      </div>
      {f.anticipoTransferenciaLink.startsWith("http") && (
        <div className="dato-sec">
          <a href={f.anticipoTransferenciaLink} target="_blank" rel="noreferrer">
            Abrir comprobante
          </a>
        </div>
      )}

      <h4>Documentos y pago</h4>
      <div className="campos-cuadro">
        <div>
          <label>Entrego los documentos</label>
          <input type="date" value={f.fechaEntregaDocsTercero} onChange={cambiar("fechaEntregaDocsTercero")} />
        </div>
        <div>
          <label>Cuenta de cobro del tercero</label>
          <input value={f.cuentaCobroTercero} onChange={cambiar("cuentaCobroTercero")} placeholder="AR-138" />
        </div>
        <div>
          <label>Pagar el (si no es el viernes que toca)</label>
          <input type="date" value={f.fechaPagoTerceroProgramada} onChange={cambiar("fechaPagoTerceroProgramada")} />
        </div>
        <div>
          <label>Fecha en que se le pago</label>
          <input type="date" value={f.fechaPagoSaldo} onChange={cambiar("fechaPagoSaldo")} />
        </div>
      </div>
      {viernes && !f.fechaPagoTerceroProgramada && <div className="dato-sec">Le toca el viernes {fechaCorta(viernes)}.</div>}

      <h4>Retenciones</h4>
      <div className="campos-cuadro">
        <div>
          <label>ICA (por mil)</label>
          <input type="number" min={0} step="0.01" value={f.icaTerceroPorMil} onChange={cambiar("icaTerceroPorMil")} placeholder={`${viaje.icaSugerido} (sugerido por el cliente)`} />
        </div>
      </div>
      <label className="check-linea">
        <input type="checkbox" checked={f.aplicaDescuentosTercero} onChange={cambiar("aplicaDescuentosTercero")} />
        Descontarle las retenciones al pagarle (retefuente, ICA, FOPAT y poliza)
      </label>

      <table className="tabla" style={{ maxWidth: 460, marginTop: "0.6rem" }}>
        <tbody>
          <tr>
            <td>Valor del viaje del tercero</td>
            <td style={{ textAlign: "right" }}>{l.valorTercero === null ? "Sin pactar" : moneda(l.valorTercero)}</td>
          </tr>
          {fila("Efectivo (bomba)", viaje.efectivo)}
          {fila("Combustible (bomba)", viaje.combustible)}
          {fila("Transferencia", numeroONulo(f.anticipoTransferencia) ?? 0)}
          <tr className={f.aplicaDescuentosTercero ? "" : "dato-sec"}>
            <td>
              Retenciones{f.aplicaDescuentosTercero ? "" : " (no se descuentan)"}
              <div className="dato-sec">
                Retef. 1 % {moneda(l.retefuente)} · ICA {icaPorMil} por mil {moneda(l.ica)} · FOPAT 0,1 % {moneda(l.fopat)} · poliza {moneda(l.poliza)}
              </div>
            </td>
            <td style={{ textAlign: "right" }}>{l.totalDescuentos ? `${f.aplicaDescuentosTercero ? "- " : ""}${moneda(l.totalDescuentos)}` : "-"}</td>
          </tr>
          <tr>
            <td>
              <strong>Valor a pagar</strong>
            </td>
            <td style={{ textAlign: "right" }}>
              <strong className={l.valorAPagar !== null && l.valorAPagar < 0 ? "texto-vencido" : ""}>
                {l.valorAPagar === null ? "-" : moneda(l.valorAPagar)}
              </strong>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="dato-sec">El efectivo y el combustible se registran en Anticipos (bomba).</div>
    </Modal>
  );
}

/** Registra el pago de todos los viajes listos de un tercero, con su cuenta de cobro. */
function PagarTercero({
  tercero,
  viajes,
  alCerrar,
  alGuardar,
}: {
  tercero: string;
  viajes: ViajeTercero[];
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [fecha, setFecha] = useState(hoyColombia());
  const [cuenta, setCuenta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = viajes.reduce((s, v) => s + (v.valorAPagar ?? 0), 0);

  async function pagar() {
    setEnviando(true);
    setError(null);
    try {
      await apiSeguimiento.pagarTerceros(
        viajes.map((v) => v.id),
        fecha,
        cuenta
      );
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo registrar el pago.");
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo={`Pago · ${tercero}`}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={pagar} disabled={enviando || !fecha}>
            {enviando ? "Guardando..." : "Registrar pago"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <p>
        Se le pagan {viajes.length} viaje(s) por <strong>{moneda(total)}</strong>:
      </p>
      <ul className="dato-sec">
        {viajes.map((v) => (
          <li key={v.id}>
            {fechaCorta(v.fecha)} · {v.placa} · {v.empresa} · {v.manifiesto ?? v.remision ?? "-"}: {moneda(v.valorAPagar ?? 0)}
          </li>
        ))}
      </ul>
      <div className="campos-cuadro">
        <div>
          <label>Fecha en que se le pago</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label>Cuenta de cobro (opcional)</label>
          <input value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder="AR-138" />
        </div>
      </div>
      <div className="dato-sec">
        La cuenta de cobro se anota en los viajes que aun no la tienen. Si solo se pagan algunos, registralos uno por uno
        desde "Por viaje".
      </div>
    </Modal>
  );
}
