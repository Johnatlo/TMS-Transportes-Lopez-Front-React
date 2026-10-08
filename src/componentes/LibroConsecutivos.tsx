/**
 * Libro de consecutivos de manifiestos y remesas: una fila por remesa, con
 * las columnas de la hoja de control de la empresa.
 */
import { api, fechaHora, moneda } from "../api/cliente";
import type { FilaConsecutivo } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "./Estado";
import TablaDatos, { Pastilla } from "./TablaDatos";
import type { Columna, PestanaTabla } from "./TablaDatos";
import { ERRORES, ETIQUETA_ESTADO, tonoEstado } from "../paginas/estadosViaje";

/** Estado de la fila: el del viaje, salvo que la remesa ya este cumplida. */
function estadoFila(f: FilaConsecutivo): string {
  if (f.estadoViaje === "ANULADO") return "Anulado";
  if (f.estadoViaje === "CUMPLIDO" || f.estadoRemesa === "CUMPLIDA") return "Cumplido";
  return ETIQUETA_ESTADO[f.estadoViaje] ?? f.estadoViaje;
}
/**
 * Color de la pastilla de estado: gris si anulado, verde si cumplido, y si no
 * el tono del estado del viaje.
 */
function tonoFila(f: FilaConsecutivo) {
  if (f.estadoViaje === "ANULADO") return "neutro" as const;
  if (f.estadoViaje === "CUMPLIDO" || f.estadoRemesa === "CUMPLIDA") return "ok" as const;
  return tonoEstado(f.estadoViaje);
}

/** Dia en hora de Colombia (el servidor guarda en UTC: de noche ya es el dia siguiente). */
const dia = (fecha: string) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(fecha));

/** "julio de 2026", para filtrar por mes como las hojas mensuales del Excel. */
const mesDe = (fecha: string) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "long" }).format(new Date(fecha));

const PESTANAS: PestanaTabla<FilaConsecutivo>[] = [
  { id: "todos", etiqueta: "Todos", incluye: () => true },
  { id: "expedidos", etiqueta: "Por cumplir", incluye: (f) => f.estadoViaje === "CONFIRMADO" && f.estadoRemesa !== "CUMPLIDA" },
  { id: "cumplidos", etiqueta: "Cumplidos", incluye: (f) => estadoFila(f) === "Cumplido" },
  { id: "anulados", etiqueta: "Anulados", incluye: (f) => f.estadoViaje === "ANULADO" },
  { id: "errores", etiqueta: "Con error", incluye: (f) => ERRORES.includes(f.estadoViaje) },
];

/** Nombre de remitente o destinatario y debajo su NIT o CC. */
const persona = (tipo: string | null, nit: string | null, nombre: string | null) => (
  <>
    <span className="principal">{nombre ?? "-"}</span>
    {nit && <span className="dato-sec">{tipo === "N" ? "NIT" : tipo === "C" ? "CC" : tipo} {nit}</span>}
  </>
);

const COLUMNAS: Columna<FilaConsecutivo>[] = [
  { id: "fecha", titulo: "Fecha planillada", valor: (f) => f.fechaPlanillada, celda: (f) => dia(f.fechaPlanillada) },
  { id: "mes", titulo: "Mes", filtrable: true, valor: (f) => mesDe(f.fechaPlanillada), celda: (f) => mesDe(f.fechaPlanillada) },
  { id: "placa", titulo: "Placa", filtrable: true, valor: (f) => f.placa, celda: (f) => <span className="principal">{f.placa}</span> },
  {
    id: "cliente",
    titulo: "Empresa",
    filtrable: true,
    valor: (f) => f.cliente,
    celda: (f) => (
      <>
        {f.cliente ?? "-"}
        {f.pesoReal !== null && <span className="dato-sec">{f.pesoReal.toLocaleString("es-CO")} kg</span>}
      </>
    ),
  },
  { id: "valor", titulo: "Valor manifiesto", alinear: "derecha", valor: (f) => f.valorManifiesto ?? 0, celda: (f) => (f.valorManifiesto === null ? "-" : moneda(f.valorManifiesto)) },
  { id: "fopat", titulo: "FOPAT 0,1%", alinear: "derecha", valor: (f) => f.retencionFopat ?? 0, celda: (f) => (f.retencionFopat === null ? "-" : moneda(f.retencionFopat)) },
  {
    id: "citas",
    titulo: "Cita cargue y descargue",
    valor: (f) => `Cargue ${fechaHora(f.citaCargue)} Descargue ${fechaHora(f.citaDescargue)}`,
    celda: (f) => (
      <>
        <span>Cargue {fechaHora(f.citaCargue)}</span>
        <span className="dato-sec">Descargue {fechaHora(f.citaDescargue)}</span>
      </>
    ),
  },
  { id: "manifiesto", titulo: "N° manifiesto", valor: (f) => f.consecutivoManifiesto, celda: (f) => <span className="codigo principal">{f.consecutivoManifiesto ?? "-"}</span> },
  { id: "remesa", titulo: "N° remesa", valor: (f) => f.consecutivoRemesa, celda: (f) => <span className="codigo">{f.consecutivoRemesa ?? "-"}</span> },
  { id: "radicado", titulo: "Radicado remesa", valor: (f) => f.radicadoRemesa, celda: (f) => <span className="codigo">{f.radicadoRemesa ?? "-"}</span> },
  { id: "estado", titulo: "Estado", filtrable: true, valor: (f) => estadoFila(f), celda: (f) => <Pastilla tono={tonoFila(f)}>{estadoFila(f)}</Pastilla> },
  {
    id: "cargue",
    titulo: "Municipio de cargue",
    filtrable: true,
    valor: (f) => f.municipioCargue ?? f.codMunicipioCargue,
    celda: (f) => (
      <>
        {f.municipioCargue ?? "-"}
        {f.codMunicipioCargue && <span className="dato-sec codigo">{f.codMunicipioCargue}</span>}
      </>
    ),
  },
  { id: "producto", titulo: "Producto transportado", filtrable: true, valor: (f) => f.producto, celda: (f) => f.producto ?? "-" },
  { id: "remitente", titulo: "Remitente", valor: (f) => `${f.remitenteNombre ?? ""} ${f.remitenteNit ?? ""}`, celda: (f) => persona(f.remitenteTipoId, f.remitenteNit, f.remitenteNombre) },
  {
    id: "descargue",
    titulo: "Municipio de descargue",
    filtrable: true,
    valor: (f) => f.municipioDescargue ?? f.codMunicipioDescargue,
    celda: (f) => (
      <>
        {f.municipioDescargue ?? "-"}
        {f.codMunicipioDescargue && <span className="dato-sec codigo">{f.codMunicipioDescargue}</span>}
      </>
    ),
  },
  { id: "destinatario", titulo: "Destinatario", valor: (f) => `${f.destinatarioNombre ?? ""} ${f.destinatarioNit ?? ""}`, celda: (f) => persona(f.destinatarioTipoId, f.destinatarioNit, f.destinatarioNombre) },
  { id: "anticipo", titulo: "Anticipo", alinear: "derecha", valor: (f) => f.valorAnticipo ?? 0, celda: (f) => (f.valorAnticipo === null ? "-" : moneda(f.valorAnticipo)) },
  { id: "conductor", titulo: "Conductor", filtrable: true, valor: (f) => f.conductor, celda: (f) => f.conductor ?? "-" },
];

/**
 * Libro de consecutivos de manifiestos y remesas: una fila por remesa, con
 * las columnas de la hoja de control que llevaba la empresa. El viaje de
 * varias remesas ocupa varias filas (00006193, 00006193B...); el valor del
 * manifiesto y el FOPAT van solo en la primera. Clic en una fila abre todo lo
 * que se registro al despachar.
 */
export default function LibroConsecutivos({ alAbrirViaje }: { alAbrirViaje: (viajeId: number) => void }) {
  const { datos, cargando, error, recargar } = useDatos(() => api.getConsecutivos(), []);
  if (cargando && !datos) return <Cargando que="los consecutivos" />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;
  return (
    <TablaDatos
      filas={datos ?? []}
      columnas={COLUMNAS}
      clave={(f) => f.remesaId}
      pestanas={PESTANAS}
      nombreArchivo="consecutivos-manifiestos-remesas"
      placeholderBusqueda="Buscar placa, numero, radicado, NIT..."
      vacio="No hay remesas con estos criterios."
      alClicFila={(f) => alAbrirViaje(f.viajeId)}
    />
  );
}
