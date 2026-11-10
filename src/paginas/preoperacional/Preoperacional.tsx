/**
 * Modulo Preoperacional: el historico de inspecciones preoperacionales (antes
 * en el Excel de respuestas del Google Forms) y los viajes despachados que aun
 * no la tienen. Exportar descarga el Excel con una columna por pregunta.
 *
 * "Cargar matriz" importa la MATRIZ CONTROL INTEGRAL CONDUCTORES (enlaces
 * precargados, mantenimientos, extintores y EPS / ARL / pension) para que el
 * formulario venga contestado.
 */
import { useState } from "react";
import { apiPreoperacional } from "../../api/cliente";
import type { Preoperacional as Inspeccion, PreoperacionalPendiente } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import MenuMas from "../../componentes/MenuMas";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "../cuadro/estadosCuadro";
import FormularioPreoperacional from "./FormularioPreoperacional";
import { descargarPreoperacionales, leerMatriz } from "./excelPreoperacional";
import { PREGUNTAS } from "./preguntasPreoperacional";

/** Items con novedad: los que no quedaron en Si / Cumple / No aplica, o con algo escrito en su novedad. */
export function novedades(p: Inspeccion): string[] {
  return PREGUNTAS.filter((q) => q.seccion === "Inspeccion" || ["saludOptima", "epp", "botiquin", "extintor", "gps"].includes(q.clave))
    .filter((q) => {
      const v = p.respuestas[q.clave] ?? "";
      return (v && !["Sí", "Cumple", "No aplica"].includes(v)) || !!(q.novedad && (p.respuestas[q.novedad] ?? "").trim());
    })
    .map((q) => q.titulo.replace(/^Inspeccion (de )?/i, ""));
}

const COLUMNAS: Columna<Inspeccion>[] = [
  { id: "fecha", titulo: "Fecha", valor: (p) => p.fecha, celda: (p) => fechaCorta(p.fecha) },
  { id: "placa", titulo: "Placa", filtrable: true, valor: (p) => p.placa, celda: (p) => <span className="principal">{p.placa}</span> },
  { id: "conductor", titulo: "Conductor", filtrable: true, valor: (p) => p.conductor, celda: (p) => p.conductor },
  { id: "manifiesto", titulo: "Manifiesto", valor: (p) => p.manifiesto, celda: (p) => <span className="codigo">{p.manifiesto ?? "-"}</span> },
  {
    id: "aprobo",
    titulo: "Aprobo",
    filtrable: true,
    valor: (p) => (p.aprobo ? "Aprobo" : "No aprobo"),
    celda: (p) => <Pastilla tono={p.aprobo ? "ok" : "error"}>{p.aprobo ? "Aprobo" : "No aprobo"}</Pastilla>,
  },
  {
    id: "novedades",
    titulo: "Novedades",
    valor: (p) => novedades(p).join(", "),
    celda: (p) => {
      const n = novedades(p);
      return n.length ? <span className="texto-vencido">{n.join(", ")}</span> : <span className="dato-sec">Sin novedad</span>;
    },
  },
  { id: "registro", titulo: "Registro", filtrable: true, valor: (p) => p.creadoPor, celda: (p) => p.creadoPor ?? "-" },
];

/** Pagina del modulo. */
export default function Preoperacional() {
  const inspecciones = useDatos(() => apiPreoperacional.listar(), []);
  const pendientes = useDatos(() => apiPreoperacional.pendientes(), []);
  const [vista, setVista] = useState<"inspecciones" | "pendientes">("inspecciones");
  /** Formulario abierto: de un viaje pendiente, una inspeccion a corregir, o una nueva suelta. */
  const [abierto, setAbierto] = useState<{ viajeId: number | null; titulo?: string; existente?: Inspeccion } | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "success" | "danger"; texto: string } | null>(null);
  const [importando, setImportando] = useState(false);

  if (inspecciones.cargando && !inspecciones.datos) return <Cargando que="las inspecciones" />;
  if (inspecciones.error || !inspecciones.datos) return <ErrorCarga mensaje={inspecciones.error ?? "Sin datos"} alReintentar={inspecciones.recargar} />;

  const lista = inspecciones.datos;
  const faltan = pendientes.datos ?? [];
  const hoy = hoyColombia();
  const deHoy = lista.filter((p) => p.fecha === hoy);
  const conNovedad = lista.filter((p) => novedades(p).length > 0 || !p.aprobo);

  function recargar() {
    inspecciones.recargar();
    pendientes.recargar();
  }

  /** Importa la matriz de control integral (respuestas sugeridas por placa y conductor). */
  async function importar(archivo: File | undefined) {
    if (!archivo) return;
    setImportando(true);
    setMensaje(null);
    try {
      const m = await leerMatriz(archivo);
      if (!m.vehiculos.length && !m.conductores.length) throw new Error("No se encontraron las hojas RESPUESTAS ni Datos Conductor.");
      const r = await apiPreoperacional.importarBase(m);
      setMensaje({ tipo: "success", texto: `Matriz cargada: ${r.vehiculos} vehiculo(s) con sus respuestas y ${r.conductores} conductor(es) con EPS, ARL y pension.` });
    } catch (exc) {
      setMensaje({ tipo: "danger", texto: exc instanceof Error ? exc.message : "No se pudo leer la matriz." });
    } finally {
      setImportando(false);
    }
  }

  const columnasPendientes: Columna<PreoperacionalPendiente>[] = [
    { id: "fecha", titulo: "Despachado", valor: (v) => v.fecha, celda: (v) => fechaCorta(v.fecha.slice(0, 10)) },
    { id: "manifiesto", titulo: "Manifiesto", valor: (v) => v.manifiesto, celda: (v) => <span className="codigo">{v.manifiesto ?? "-"}</span> },
    { id: "placa", titulo: "Placa", filtrable: true, valor: (v) => v.placa, celda: (v) => <span className="principal">{v.placa ?? "-"}</span> },
    { id: "conductor", titulo: "Conductor", filtrable: true, valor: (v) => v.conductor, celda: (v) => v.conductor ?? "-" },
    {
      id: "acciones",
      titulo: "",
      etiquetaMovil: null,
      alinear: "derecha",
      celda: (v) => (
        <button className="boton-suave" onClick={() => setAbierto({ viajeId: v.viajeId, titulo: `Manifiesto ${v.manifiesto ?? ""} · ${v.placa ?? ""}` })}>
          Llenar
        </button>
      ),
    },
  ];

  const acciones = (
    <>
      <MenuMas
        opciones={[
          {
            etiqueta: importando ? "Cargando matriz..." : "Cargar matriz de conductores (Excel)",
            alElegir: () => document.getElementById("archivo-matriz-preoperacional")?.click(),
          },
        ]}
      />
      <input
        id="archivo-matriz-preoperacional"
        type="file"
        accept=".xlsx"
        hidden
        onChange={(e) => {
          importar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button className="btn-primary boton-con-texto" onClick={() => setAbierto({ viajeId: null })}>
        Nueva inspeccion
      </button>
    </>
  );

  return (
    <>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador titulo="Inspecciones" valor={lista.length} detalle={`${deHoy.length} hoy`} />
        <Indicador titulo="Viajes sin inspeccion" valor={faltan.length} alerta={faltan.length > 0} detalle="ultimos 30 dias" />
        <Indicador titulo="Con novedad o sin aprobar" valor={conNovedad.length} alerta={conNovedad.length > 0} />
      </div>
      {mensaje && <div className={`alert ${mensaje.tipo}`}>{mensaje.texto}</div>}
      <div className="dato-sec" style={{ marginBottom: "0.5rem" }}>
        Inspeccion preoperacional de vehiculos (Resolucion 40595). Sale sola al expedir un manifiesto; si se deja para despues, queda en
        "Pendientes". Clic en una inspeccion para corregirla.
      </div>
      <div className="tabla-pestanas selector-vista">
        <button className={vista === "inspecciones" ? "activa" : ""} onClick={() => setVista("inspecciones")}>
          Inspecciones
          <span className="contador">{lista.length}</span>
        </button>
        <button className={vista === "pendientes" ? "activa" : ""} onClick={() => setVista("pendientes")}>
          Pendientes
          <span className="contador">{faltan.length}</span>
        </button>
      </div>
      <div className="panel">
        {vista === "inspecciones" ? (
          <TablaDatos
            filas={lista}
            columnas={COLUMNAS}
            clave={(p) => p.id}
            placeholderBusqueda="Buscar placa, conductor, manifiesto..."
            vacio="Aun no hay inspecciones."
            acciones={acciones}
            alClicFila={(p) => setAbierto({ viajeId: p.viajeId, titulo: `${p.placa} · ${fechaCorta(p.fecha)}`, existente: p })}
            alExportar={(visibles) => descargarPreoperacionales(visibles, `preoperacional-${hoy}`)}
          />
        ) : (
          <TablaDatos
            filas={faltan}
            columnas={columnasPendientes}
            clave={(v) => v.viajeId}
            placeholderBusqueda="Buscar placa, conductor, manifiesto..."
            vacio="Todos los viajes de los ultimos 30 dias tienen su inspeccion."
            acciones={acciones}
          />
        )}
      </div>
      {abierto && (
        <FormularioPreoperacional
          viajeId={abierto.viajeId}
          titulo={abierto.titulo}
          existente={abierto.existente}
          alCerrar={() => setAbierto(null)}
          alGuardar={() => {
            setAbierto(null);
            recargar();
          }}
        />
      )}
    </>
  );
}
