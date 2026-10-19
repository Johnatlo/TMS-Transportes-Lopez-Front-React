/**
 * Anticipos que dan las empresas (clientes) en sus viajes: los del Zorro
 * (Ecoambiental, Reciclajes Bogota, Bodegas de Reciclaje), Aburra Limpio y los
 * viajes sin manifiesto (salvo urbanos). Es aparte de los anticipos de la
 * bomba. Aqui se registra cuanto dio cada empresa y cuando lo pago, y se ve lo
 * que debe cada una para cobrarlo. Se usa en Cartera y en Anticipos.
 */
import { useEffect, useState } from "react";
import { apiCuadro, apiSeguimiento, moneda } from "../../api/cliente";
import type { EstadoAnticipoEmpresa, FilaCuadro, ResumenAnticipoEmpresa } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla, TonoPastilla } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "../cuadro/estadosCuadro";

const ESTADO: Record<EstadoAnticipoEmpresa, { etiqueta: string; tono: TonoPastilla }> = {
  FALTA_REGISTRAR: { etiqueta: "Falta registrar", tono: "error" },
  POR_COBRAR: { etiqueta: "Por cobrar", tono: "aviso" },
  PAGADO: { etiqueta: "Pagado", tono: "ok" },
  NO_APLICA: { etiqueta: "No aplica", tono: "neutro" },
};

/** Por que el viaje lleva anticipo de la empresa. */
const motivo = (f: FilaCuadro) =>
  /ABURRA\s+LIMPIO/i.test(f.empresa)
    ? "Aburra Limpio"
    : /ECOAMBIENTAL|RECICLAJES?\s+BOGOTA|BODEGAS?\s+DE\s+RECICLAJE/i.test(f.empresa)
      ? "Viaje del Zorro"
      : !f.viajeId
        ? "Sin manifiesto"
        : "Registrado a mano";

const PESTANAS: PestanaTabla<FilaCuadro>[] = [
  { id: "faltan", etiqueta: "Falta registrar", incluye: (f) => f.estadoAnticipoEmpresa === "FALTA_REGISTRAR" },
  { id: "porCobrar", etiqueta: "Por cobrar", incluye: (f) => f.estadoAnticipoEmpresa === "POR_COBRAR" },
  { id: "pagados", etiqueta: "Pagados", incluye: (f) => f.estadoAnticipoEmpresa === "PAGADO" },
  { id: "noAplica", etiqueta: "No aplica", incluye: (f) => f.estadoAnticipoEmpresa === "NO_APLICA" },
  { id: "todos", etiqueta: "Todos", incluye: () => true },
];

const COLUMNAS: Columna<FilaCuadro>[] = [
  { id: "fecha", titulo: "Fecha", valor: (f) => f.fecha, celda: (f) => fechaCorta(f.fecha) },
  { id: "placa", titulo: "Placa", filtrable: true, valor: (f) => f.placa, celda: (f) => <span className="principal">{f.placa}</span> },
  {
    id: "empresa",
    titulo: "Empresa",
    filtrable: true,
    valor: (f) => f.empresa,
    celda: (f) => (
      <>
        {f.empresa}
        <span className="dato-sec">{motivo(f)}</span>
      </>
    ),
  },
  {
    id: "documento",
    titulo: "Manifiesto / remision",
    valor: (f) => f.manifiesto ?? f.remision ?? "",
    celda: (f) => <span className="codigo">{f.manifiesto ?? f.remision ?? "-"}</span>,
  },
  {
    id: "anticipo",
    titulo: "Anticipo de la empresa",
    alinear: "derecha",
    valor: (f) => f.anticipoEmpresa ?? 0,
    celda: (f) => (f.anticipoEmpresa ? moneda(f.anticipoEmpresa) : <span className="dato-sec">-</span>),
  },
  {
    id: "pago",
    titulo: "Fecha de pago",
    valor: (f) => f.anticipoEmpresaFechaPago ?? "",
    celda: (f) => (f.anticipoEmpresaFechaPago ? fechaCorta(f.anticipoEmpresaFechaPago) : <span className="dato-sec">-</span>),
  },
  {
    id: "estado",
    titulo: "Estado",
    filtrable: true,
    valor: (f) => ESTADO[f.estadoAnticipoEmpresa].etiqueta,
    celda: (f) => <Pastilla tono={ESTADO[f.estadoAnticipoEmpresa].tono}>{ESTADO[f.estadoAnticipoEmpresa].etiqueta}</Pastilla>,
  },
];

/**
 * Vista completa: totales, lo que debe cada empresa (con "registrar pago" de
 * todos sus anticipos) y los viajes. Clic en un viaje abre su anticipo. Con
 * `abrirViaje` abre de una ese viaje (desde la alerta de la campana).
 */
export default function AnticiposEmpresas({ abrirViaje, alCambiar }: { abrirViaje?: number | null; alCambiar?: () => void }) {
  const datos = useDatos(() => apiSeguimiento.anticiposEmpresas(), []);
  const [editando, setEditando] = useState<number | null>(abrirViaje ?? null);
  const [pagando, setPagando] = useState<ResumenAnticipoEmpresa | null>(null);
  const [vista, setVista] = useState<"viajes" | "empresas">("viajes");

  useEffect(() => {
    if (abrirViaje) setEditando(abrirViaje);
  }, [abrirViaje]);

  if (datos.cargando && !datos.datos) return <Cargando que="los anticipos de las empresas" />;
  if (datos.error || !datos.datos) return <ErrorCarga mensaje={datos.error ?? "Sin datos"} alReintentar={datos.recargar} />;

  const { viajes, empresas } = datos.datos;
  const porCobrar = empresas.reduce((s, e) => s + e.porCobrar, 0);
  const faltan = empresas.reduce((s, e) => s + e.faltaRegistrar, 0);
  const pagado = empresas.reduce((s, e) => s + e.pagado, 0);
  const viaje = editando ? viajes.find((v) => v.id === editando) ?? null : null;
  const cambio = () => {
    datos.recargar();
    alCambiar?.();
  };

  const columnasEmpresas: Columna<ResumenAnticipoEmpresa>[] = [
    { id: "empresa", titulo: "Empresa", valor: (e) => e.empresa, celda: (e) => <span className="principal">{e.empresa}</span> },
    { id: "faltan", titulo: "Falta registrar", alinear: "derecha", valor: (e) => e.faltaRegistrar, celda: (e) => (e.faltaRegistrar ? <span className="texto-vencido">{e.faltaRegistrar} viaje(s)</span> : "-") },
    { id: "viajes", titulo: "Viajes por cobrar", alinear: "derecha", valor: (e) => e.viajesPorCobrar, celda: (e) => e.viajesPorCobrar || "-" },
    { id: "porCobrar", titulo: "Debe", alinear: "derecha", valor: (e) => e.porCobrar, celda: (e) => <strong>{moneda(e.porCobrar)}</strong> },
    { id: "pagado", titulo: "Pagado", alinear: "derecha", valor: (e) => e.pagado, celda: (e) => moneda(e.pagado) },
    {
      id: "acciones",
      titulo: "",
      etiquetaMovil: null,
      alinear: "derecha",
      celda: (e) =>
        e.viajesPorCobrar > 0 ? (
          <button className="boton-suave" onClick={() => setPagando(e)}>
            Registrar pago
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador dinero titulo="Anticipos por cobrar a empresas" valor={moneda(porCobrar)} detalle={`${empresas.filter((e) => e.porCobrar > 0).length} empresas`} />
        <Indicador titulo="Viajes sin registrar el anticipo" valor={faltan} alerta={faltan > 0} detalle="falta valor" />
        <Indicador dinero titulo="Ya pagado" valor={moneda(pagado)} />
      </div>
      <div className="dato-sec" style={{ marginBottom: "0.5rem" }}>
        Anticipo que da el cliente en los viajes del Zorro (Ecoambiental, Reciclajes Bogota, Bodegas de Reciclaje), de
        Aburra Limpio y en los viajes sin manifiesto (salvo urbanos). Es aparte de los anticipos de la bomba. Cada viaje
        avisa hasta que tiene el valor y la fecha en que la empresa lo pago.
      </div>
      <div className="tabla-pestanas selector-vista">
        <button className={vista === "viajes" ? "activa" : ""} onClick={() => setVista("viajes")}>
          Por viaje
        </button>
        <button className={vista === "empresas" ? "activa" : ""} onClick={() => setVista("empresas")}>
          Por empresa
        </button>
      </div>
      <div className="panel">
        {vista === "viajes" ? (
          <TablaDatos
            filas={viajes}
            columnas={COLUMNAS}
            clave={(f) => f.id}
            pestanas={PESTANAS}
            nombreArchivo="anticipos-empresas"
            placeholderBusqueda="Buscar placa, empresa, manifiesto..."
            vacio="No hay viajes con estos criterios."
            alClicFila={(f) => setEditando(f.id)}
          />
        ) : (
          <TablaDatos
            filas={empresas}
            columnas={columnasEmpresas}
            clave={(e) => e.empresa}
            nombreArchivo="anticipos-por-empresa"
            placeholderBusqueda="Buscar empresa..."
            vacio="Ninguna empresa tiene anticipos."
          />
        )}
      </div>
      {viaje && <EditarAnticipo viaje={viaje} alCerrar={() => setEditando(null)} alGuardar={cambio} />}
      {editando !== null && !viaje && !datos.cargando && (
        <Modal titulo="Anticipo de la empresa" alCerrar={() => setEditando(null)}>
          <div className="alert info">Ese viaje no lleva anticipo de la empresa o ya no esta en la lista.</div>
        </Modal>
      )}
      {pagando && (
        <PagarEmpresa
          resumen={pagando}
          ids={viajes.filter((v) => v.empresa === pagando.empresa && v.estadoAnticipoEmpresa === "POR_COBRAR").map((v) => v.id)}
          alCerrar={() => setPagando(null)}
          alGuardar={() => {
            setPagando(null);
            cambio();
          }}
        />
      )}
    </>
  );
}

/** El anticipo de un viaje: valor, fecha de pago o "no aplica". */
function EditarAnticipo({ viaje, alCerrar, alGuardar }: { viaje: FilaCuadro; alCerrar: () => void; alGuardar: () => void }) {
  const [valor, setValor] = useState(viaje.anticipoEmpresa ? String(viaje.anticipoEmpresa) : "");
  const [fecha, setFecha] = useState(viaje.anticipoEmpresaFechaPago ?? "");
  const [noAplica, setNoAplica] = useState(viaje.anticipoEmpresaNoAplica);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setEnviando(true);
    setError(null);
    try {
      await apiCuadro.actualizar(viaje.id, {
        anticipoEmpresaNoAplica: noAplica,
        anticipoEmpresa: noAplica ? null : valor.trim() === "" ? null : Number(valor),
        anticipoEmpresaFechaPago: noAplica ? null : fecha || null,
      });
      alGuardar();
      alCerrar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo={`Anticipo de la empresa · ${viaje.placa} · ${viaje.empresa}`}
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
        Viaje del {fechaCorta(viaje.fecha)} · {viaje.manifiesto ? `manifiesto ${viaje.manifiesto}` : `remision ${viaje.remision ?? "-"}`} ·{" "}
        {motivo(viaje)}
      </div>
      <label className="check-linea">
        <input type="checkbox" checked={noAplica} onChange={(e) => setNoAplica(e.target.checked)} />
        Este viaje no lleva anticipo de la empresa (por ejemplo, un urbano)
      </label>
      {!noAplica && (
        <div className="campos-cuadro">
          <div>
            <label>Anticipo que da la empresa</label>
            <input type="number" min={0} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label>Fecha en que la empresa lo pago</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>
      )}
      <div className="dato-sec">Sin fecha de pago, el anticipo queda "por cobrar" a la empresa.</div>
    </Modal>
  );
}

/** Registra el pago de todos los anticipos por cobrar de una empresa. */
function PagarEmpresa({
  resumen,
  ids,
  alCerrar,
  alGuardar,
}: {
  resumen: ResumenAnticipoEmpresa;
  ids: number[];
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const [fecha, setFecha] = useState(hoyColombia());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pagar() {
    setEnviando(true);
    setError(null);
    try {
      await apiSeguimiento.pagarAnticiposEmpresa(ids, fecha);
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo registrar el pago.");
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo={`Pago de anticipos · ${resumen.empresa}`}
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
        {resumen.empresa} pago los anticipos de {resumen.viajesPorCobrar} viaje(s) por <strong>{moneda(resumen.porCobrar)}</strong>.
      </p>
      <label>Fecha en que pago</label>
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <div className="dato-sec">Si pago solo algunos, registralos uno por uno desde la vista "Por viaje".</div>
    </Modal>
  );
}
