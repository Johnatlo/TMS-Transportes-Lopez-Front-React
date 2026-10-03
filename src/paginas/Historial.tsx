import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fechaHora, moneda } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../componentes/Estado";
import { esReintentable } from "../componentes/ReintentarViaje";
import AnularViaje, { esAnulable } from "../componentes/AnularViaje";
import CumplirViaje, { esCumplible } from "../componentes/CumplirViaje";
import VentanaDocumentosViaje from "../componentes/DocumentosViaje";
import TablaDatos, { Pastilla } from "../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../componentes/TablaDatos";
import type { Viaje } from "../api/tipos";

/**
 * Historial de despachos. Migrada completa por ser la mas simple: sirve para
 * ver el patron minimo (useDatos + tabla) sin el ruido del Dashboard.
 */
export default function Historial() {
  const { datos, cargando, error, recargar } = useDatos(() => api.getHistorial(), []);
  // Reintentar abre el viaje completo en Despachar: ahi se puede corregir
  // cualquier dato (cargas, citas, valores, via, FOPAT) antes de reenviarlo.
  const navegar = useNavigate();
  /** Viaje abierto en la ventana de anulacion. */
  const [anulando, setAnulando] = useState<Viaje | null>(null);
  /** Viaje cuyos documentos (manifiesto y remesas) se van a imprimir. */
  const [imprimiendo, setImprimiendo] = useState<Viaje | null>(null);
  /** Viaje abierto en la ventana de cumplido. */
  const [cumpliendo, setCumpliendo] = useState<Viaje | null>(null);

  // Solo la primera carga muestra "Cargando". Las recargas (despues de cumplir,
  // anular o reintentar) dejan la tabla y la ventana abierta en pantalla: si se
  // desmontaran, la ventana volveria a abrir con los datos viejos del viaje.
  if (cargando && !datos) return <Cargando que="historial" />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;

  const viajes = datos ?? [];

  const columnas: Columna<Viaje>[] = [
    {
      id: "viaje",
      titulo: "Viaje",
      etiquetaMovil: null,
      claseCelda: "celda-viaje",
      valor: (v) => v.id,
      celda: (v) => (
        <>
          <span className="principal">#{v.id}</span>
          {v.creadoPorNombre && <span className="dato-sec">por {v.creadoPorNombre}</span>}
        </>
      ),
    },
    {
      id: "cargue",
      titulo: "Cargue",
      valor: (v) => v.fechaHoraCargue,
      celda: (v) => fechaHora(v.fechaHoraCargue),
    },
    {
      id: "estado",
      titulo: "Estado",
      filtrable: true,
      valor: (v) => ETIQUETA_ESTADO[v.estado] ?? v.estado,
      celda: (v) => (
        <>
          <Pastilla tono={tonoEstado(v.estado)}>{ETIQUETA_ESTADO[v.estado] ?? v.estado}</Pastilla>
          {v.plazoCumplido && <PlazoCumplido dias={v.plazoCumplido.diasHabilesRestantes} />}
          {v.estado === "CUMPLIDO" && v.cumplidoPorNombre && (
            <span className="dato-sec">por {v.cumplidoPorNombre}</span>
          )}
        </>
      ),
    },
    {
      id: "manifiesto",
      titulo: "Manifiesto",
      valor: (v) => v.consecutivoManifiesto,
      celda: (v) => (
        <>
          <span className="codigo principal">{v.consecutivoManifiesto ?? "-"}</span>
          {v.numeroManifiestoRndc && <span className="dato-sec">Radicado {v.numeroManifiestoRndc}</span>}
          {v.radicadoAnulacion && <span className="dato-sec">Anulado: radicado {v.radicadoAnulacion}</span>}
          {v.estado === "ANULADO" && v.anuladoPorNombre && (
            <span className="dato-sec">
              Anulado por {v.anuladoPorNombre}
              {v.fechaAnulacion ? ` · ${fechaHora(v.fechaAnulacion)}` : ""}
            </span>
          )}
        </>
      ),
    },
    {
      id: "creadoPor",
      titulo: "Despachado por",
      filtrable: true,
      valor: (v) => v.creadoPorNombre ?? "Sin usuario",
      celda: (v) => v.creadoPorNombre ?? "-",
    },
    {
      id: "flete",
      titulo: "Flete",
      alinear: "derecha",
      valor: (v) => v.valorFleteReal ?? 0,
      celda: (v) => moneda(v.valorFleteReal),
    },
    {
      id: "fopat",
      titulo: "FOPAT",
      alinear: "derecha",
      valor: (v) => v.retencionFopat ?? 0,
      celda: (v) => moneda(v.retencionFopat),
    },
    {
      id: "error",
      titulo: "Error",
      etiquetaMovil: null,
      claseCelda: (v) => `celda-error ${v.mensajeError ? "" : "sin-error"}`,
      valor: (v) => v.mensajeError ?? "",
      // El error completo se ve en la ventana; aqui solo el comienzo.
      celda: (v) =>
        v.mensajeError ? (
          <span className="dato-sec" title={v.mensajeError}>
            {v.codigoError ? `${v.codigoError}: ` : ""}
            {v.mensajeError.slice(0, 110)}
            {v.mensajeError.length > 110 ? "..." : ""}
          </span>
        ) : (
          "-"
        ),
    },
    {
      id: "acciones",
      titulo: "",
      etiquetaMovil: null,
      claseCelda: "celda-acciones",
      celda: (v) => (
        <>
          {(v.estado === "CONFIRMADO" || v.estado === "CUMPLIDO") && (
            <button className="btn-primary" onClick={() => setImprimiendo(v)}>
              Imprimir
            </button>
          )}
          {esCumplible(v) && (
            <button className="btn-secondary" onClick={() => setCumpliendo(v)}>
              Cumplir
            </button>
          )}
          {esReintentable(v) && (
            <button className="btn-primary" onClick={() => navegar(`/despacho?viaje=${v.id}`)}>
              Corregir y reintentar
            </button>
          )}
          {esAnulable(v) && (
            <button className="btn-secondary" onClick={() => setAnulando(v)}>
              {v.estado === "ANULACION_ERROR" ? "Reintentar anulacion" : "Anular"}
            </button>
          )}
        </>
      ),
    },
  ];

  return (
    <>
      <div className="panel">
        {/* En el celular cada fila se ve como tarjeta (ver .tabla-viajes en estilos.css). */}
        <TablaDatos
          filas={viajes}
          columnas={columnas}
          clave={(v) => v.id}
          pestanas={PESTANAS_VIAJES}
          claseTabla="tabla-viajes"
          nombreArchivo="viajes"
          placeholderBusqueda="Buscar manifiesto, radicado, error..."
          vacio="No hay viajes con estos criterios."
        />
      </div>

      {imprimiendo && (
        <VentanaDocumentosViaje viaje={imprimiendo} alCerrar={() => setImprimiendo(null)} />
      )}
      {anulando && (
        <AnularViaje viaje={anulando} alCerrar={() => setAnulando(null)} alTerminar={recargar} />
      )}
      {cumpliendo && (
        <CumplirViaje viaje={cumpliendo} alCerrar={() => setCumpliendo(null)} alTerminar={recargar} />
      )}
    </>
  );
}

/** Dias habiles que quedan para cumplir, en la columna de estado. */
function PlazoCumplido({ dias }: { dias: number }) {
  if (dias < 0) return <span className="plazo-cumplido vencido">Cumplido vencido ({-dias} d)</span>;
  if (dias <= 1) return <span className="plazo-cumplido pronto">Cumplir: queda{dias === 1 ? " 1 dia" : "n 0 dias"}</span>;
  return <span className="plazo-cumplido ok">Cumplir en {dias} dias habiles</span>;
}

/** Nombre de cada estado para la gente (el codigo interno sigue en la base). */
const ETIQUETA_ESTADO: Record<string, string> = {
  CONFIRMADO: "Expedido",
  CUMPLIDO: "Cumplido",
  ANULADO: "Anulado",
  VALIDACION_ERROR: "Error de validacion",
  REMESA_ERROR: "Error en remesa",
  MANIFIESTO_ERROR: "Error en manifiesto",
  ANULACION_ERROR: "Error al anular",
  REINTENTANDO: "Enviando...",
  ANULANDO: "Anulando...",
  CUMPLIENDO: "Cumpliendo...",
};

function tonoEstado(estado: string): "ok" | "aviso" | "error" | "info" | "neutro" {
  if (estado === "CUMPLIDO") return "ok";
  if (estado === "CONFIRMADO") return "info";
  if (estado === "ANULADO") return "neutro";
  if (["REINTENTANDO", "ANULANDO", "CUMPLIENDO"].includes(estado)) return "aviso";
  return "error";
}

const ERRORES = ["VALIDACION_ERROR", "REMESA_ERROR", "MANIFIESTO_ERROR", "ANULACION_ERROR"];

/** Pestanas de Viajes, como "In progress / Closed / All" del ejemplo. */
const PESTANAS_VIAJES: PestanaTabla<Viaje>[] = [
  { id: "curso", etiqueta: "En curso", incluye: (v) => v.estado === "CONFIRMADO" },
  { id: "errores", etiqueta: "Con error", incluye: (v) => ERRORES.includes(v.estado) },
  { id: "cumplidos", etiqueta: "Cumplidos", incluye: (v) => v.estado === "CUMPLIDO" },
  { id: "anulados", etiqueta: "Anulados", incluye: (v) => v.estado === "ANULADO" },
  { id: "todos", etiqueta: "Todos", incluye: () => true },
];
