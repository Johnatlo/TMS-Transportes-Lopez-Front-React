import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, soloDia } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../componentes/Estado";
import { usarShell } from "../componentes/Shell";
import MapaSeguimiento, { coordenadaValida, type PuntoMapa } from "../componentes/MapaSeguimiento";
import {
  IconoCalendario,
  IconoCamion,
  IconoCheck,
  IconoConductores,
  IconoDocumento,
  IconoFlecha,
  IconoGrafica,
  IconoMapa,
} from "../componentes/Iconos";
import type { AlertaDocumento, Conductor, PlantillaViaje, Viaje } from "../api/tipos";

/**
 * Pantalla de inicio, organizada como docs/template de ejemplo.png:
 * indicadores arriba, los documentos mas urgentes, los viajes de hoy, los
 * ultimos viajes, los viajes por semana y el mapa de seguimiento.
 *
 * Todo se calcula en el navegador con listas que ya existen (los ultimos 100
 * viajes, vehiculos, conductores y plantillas). Si el volumen crece, conviene
 * mover los conteos al backend.
 *
 * El estado de un viaje sale de las CITAS de cargue y descargue del
 * manifiesto: el sistema aun no registra cumplidos ni posicion GPS.
 */
export default function Dashboard() {
  const navegar = useNavigate();
  const { alertas, abrirAlertas, versionDocumentos } = usarShell();
  const historial = useDatos(() => api.getHistorial(), []);
  const vehiculos = useDatos(() => api.getVehiculos(), [versionDocumentos]);
  const conductores = useDatos(() => api.getConductores(), []);
  const plantillas = useDatos(() => api.getPlantillas(), []);

  const [hoyVista, setHoyVista] = useState<"cargues" | "descargues">("cargues");
  const [semanaAtras, setSemanaAtras] = useState(0);

  const ahora = useMemo(() => new Date(), [historial.datos]);
  const viajes = historial.datos ?? [];
  const vehiculoPorId = useMemo(() => new Map((vehiculos.datos ?? []).map((v) => [v.id, v])), [vehiculos.datos]);
  const conductorPorId = useMemo(() => new Map((conductores.datos ?? []).map((c) => [c.id, c])), [conductores.datos]);
  const plantillaPorId = useMemo(() => new Map((plantillas.datos ?? []).map((p) => [p.id, p])), [plantillas.datos]);

  const confirmados = viajes.filter((v) => v.estado === "CONFIRMADO");
  const enCamino = confirmados.filter((v) => estadoViaje(v, ahora) === "En camino");
  const programados = confirmados.filter((v) => estadoViaje(v, ahora) === "Programado");

  // Finalizados: llegada (cita de descargue) en los ultimos 30 dias, contra los 30 anteriores.
  const finalizadosEn = (desdeDias: number, hastaDias: number) =>
    confirmados.filter((v) => {
      const d = v.fechaHoraDescargue ? new Date(v.fechaHoraDescargue).getTime() : NaN;
      return d <= ahora.getTime() - hastaDias * DIA && d > ahora.getTime() - desdeDias * DIA;
    }).length;
  const finalizados30 = finalizadosEn(30, 0);
  const finalizadosPrevios = finalizadosEn(60, 30);

  // Viajes por semana (lunes a domingo, hora de Colombia), por fecha de expedicion.
  const semanas = useMemo(() => viajesPorSemana(confirmados, ahora), [historial.datos]);
  const semanaActual = semanas[0];
  const semanaAnterior = semanas[1];

  // Los dos documentos mas urgentes: uno de vehiculo y uno de conductor.
  const urgentes = alertas ? [...alertas.vencidos, ...alertas.porVencer] : [];
  const docVehiculo = urgentes.find((a) => a.origen.entidad === "vehiculo" || a.origen.entidad === "remolque");
  const docConductor = urgentes.find((a) => a.origen.entidad === "conductor");

  const hoy = claveDia(ahora);
  const deHoy = confirmados
    .filter((v) => {
      const f = hoyVista === "cargues" ? v.fechaHoraCargue : v.fechaHoraDescargue;
      return f && claveDia(new Date(f)) === hoy;
    })
    .sort((a, b) => hora(hoyVista === "cargues" ? a.fechaHoraCargue : a.fechaHoraDescargue).localeCompare(
      hora(hoyVista === "cargues" ? b.fechaHoraCargue : b.fechaHoraDescargue)
    ));
  const ultimos = viajes.slice(0, 6);

  const puntos = useMemo<PuntoMapa[]>(
    () =>
      enCamino.flatMap((v) => {
        const p = plantillaPorId.get(v.plantillaId);
        const o = p?.remitente;
        const d = p?.destinatario;
        if (!o || !d || !coordenadaValida(o.latitud, o.longitud) || !coordenadaValida(d.latitud, d.longitud)) return [];
        return [{
          id: v.id,
          etiqueta: vehiculoPorId.get(v.vehiculoId)?.placa ?? `Viaje #${v.id}`,
          detalle: `${ruta(p)} · llega ${soloHora(v.fechaHoraDescargue)}`,
          origen: [o.latitud!, o.longitud!] as [number, number],
          destino: [d.latitud!, d.longitud!] as [number, number],
          avance: avance(v, ahora),
        }];
      }),
    // Solo cambia cuando llegan datos nuevos, no en cada render: si no, el
    // mapa se reencuadraria cada vez que se toca algo de la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historial.datos, plantillas.datos, vehiculos.datos]
  );

  if (historial.cargando && !historial.datos) return <Cargando que="el tablero" />;
  if (historial.error) return <ErrorCarga mensaje={historial.error} alReintentar={historial.recargar} />;

  const fila = (v: Viaje, columnaLugar: "destino" | "ruta") => {
    const p = plantillaPorId.get(v.plantillaId);
    const estado = estadoViaje(v, ahora);
    return (
      <tr key={v.id}>
        <td>
          <span className={`punto-estado ${claseEstado(estado)}`} />
          <strong>{v.consecutivoManifiesto ?? `#${v.id}`}</strong>
        </td>
        {columnaLugar === "destino" ? (
          <>
            <td>{soloHora(hoyVista === "cargues" ? v.fechaHoraCargue : v.fechaHoraDescargue)}</td>
            <td>{hoyVista === "cargues" ? p?.destinatario?.ciudad ?? "-" : p?.remitente?.ciudad ?? "-"}</td>
          </>
        ) : (
          <td>
            <span className={`etiqueta-estado ${claseEstado(estado)}`}>{estado}</span>
          </td>
        )}
        {columnaLugar === "ruta" && <td>{ruta(p)}</td>}
        <td>{p?.contratante?.nombre ?? "-"}</td>
        {columnaLugar === "destino" ? (
          <td>
            <span className={`etiqueta-estado ${claseEstado(estado)}`}>{estado}</span>
          </td>
        ) : (
          <td>{v.fechaHoraDescargue ? `${fechaCorta(v.fechaHoraDescargue)} ${soloHora(v.fechaHoraDescargue)}` : "-"}</td>
        )}
        <td>{vehiculoPorId.get(v.vehiculoId)?.placa ?? "-"}</td>
        <td>
          <AvatarConductor conductor={conductorPorId.get(v.conductorId)} />
        </td>
      </tr>
    );
  };

  return (
    <div className="tablero">
      {/* ---------- Indicadores ---------- */}
      <div className="tarjeta indicadores">
        <Indicador icono={<IconoCamion />} titulo="Vehiculos en transito" valor={enCamino.length} />
        <Indicador
          icono={<IconoCheck />}
          titulo="Viajes finalizados"
          valor={finalizados30}
          variacion={variacion(finalizados30, finalizadosPrevios)}
          periodo="30 dias"
        />
        <Indicador icono={<IconoCalendario />} titulo="Proximos viajes" valor={programados.length} periodo="programados" />
        <Indicador
          icono={<IconoGrafica />}
          titulo="Viajes esta semana"
          valor={semanaActual.total}
          variacion={variacion(semanaActual.total, semanaAnterior.total)}
          periodo="vs. semana pasada"
        />
      </div>

      <div className="tablero-cuerpo">
        <div className="tablero-principal">
          {/* ---------- Documentos mas urgentes ---------- */}
          <div className="alertas-destacadas">
            <AlertaDestacada
              alerta={docVehiculo}
              icono={<IconoCamion />}
              tono="rojo"
              vacio="Ningun documento de vehiculo vencido ni por vencer."
              alAbrir={abrirAlertas}
            />
            <AlertaDestacada
              alerta={docConductor}
              icono={<IconoConductores />}
              tono="azul"
              vacio="Ninguna licencia vencida ni por vencer."
              alAbrir={abrirAlertas}
            />
          </div>

          {/* ---------- Hoy ---------- */}
          <div className="seccion-tabla">
            <div className="encabezado-seccion">
              <h2>Hoy:</h2>
              <div className="pildoras">
                <button className={hoyVista === "cargues" ? "activa" : ""} onClick={() => setHoyVista("cargues")}>
                  Cargues
                </button>
                <button className={hoyVista === "descargues" ? "activa" : ""} onClick={() => setHoyVista("descargues")}>
                  Descargues
                </button>
              </div>
              <button className="boton-suave" onClick={() => navegar("/historial")}>
                Ver todos
              </button>
            </div>
            <table className="tabla-tablero">
              <thead>
                <tr>
                  <th>Manifiesto</th>
                  <th>Hora</th>
                  <th>{hoyVista === "cargues" ? "Destino" : "Origen"}</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Vehiculo</th>
                  <th>Conductor</th>
                </tr>
              </thead>
              <tbody>
                {deHoy.map((v) => fila(v, "destino"))}
                {deHoy.length === 0 && (
                  <tr>
                    <td colSpan={7} className="vacio-tablero">
                      No hay {hoyVista} programados para hoy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ---------- Ultimos viajes ---------- */}
          <div className="seccion-tabla">
            <div className="encabezado-seccion">
              <h2>Ultimos viajes</h2>
              <button className="boton-suave" onClick={() => navegar("/historial")}>
                Ver todos
              </button>
            </div>
            <table className="tabla-tablero">
              <thead>
                <tr>
                  <th>Manifiesto</th>
                  <th>Estado</th>
                  <th>Ruta</th>
                  <th>Cliente</th>
                  <th>Llegada</th>
                  <th>Vehiculo</th>
                  <th>Conductor</th>
                </tr>
              </thead>
              <tbody>
                {ultimos.map((v) => fila(v, "ruta"))}
                {ultimos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="vacio-tablero">
                      Aun no hay viajes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="tablero-lateral">
          {/* ---------- Viajes por semana (en lugar de Cost & Profitability) ---------- */}
          <div className="tarjeta">
            <div className="encabezado-tarjeta">
              <span className="titulo-tarjeta">
                <IconoGrafica /> Viajes por semana
              </span>
              <select
                value={semanaAtras}
                onChange={(e) => setSemanaAtras(Number(e.target.value))}
                className="selector-pequeno"
              >
                <option value={0}>Esta semana</option>
                <option value={1}>Semana pasada</option>
                <option value={2}>Hace 2 semanas</option>
                <option value={3}>Hace 3 semanas</option>
              </select>
            </div>
            <GraficaSemana actual={semanas[semanaAtras]} anterior={semanas[semanaAtras + 1]} />
          </div>

          {/* ---------- Seguimiento ---------- */}
          <div className="tarjeta">
            <div className="encabezado-tarjeta">
              <span className="titulo-tarjeta">
                <IconoMapa /> Seguimiento
              </span>
              <button className="boton-suave" onClick={() => navegar("/historial")}>
                Mas
              </button>
            </div>
            <MapaSeguimiento puntos={puntos} />
            <p className="nota-mapa">
              {enCamino.length === 0
                ? "No hay vehiculos en camino."
                : `${puntos.length} de ${enCamino.length} en camino con ubicacion. `}
              Posicion estimada entre cargue y descargue segun las citas; no es GPS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------

const DIA = 86_400_000;
type EstadoViaje = "En camino" | "Programado" | "Finalizado" | "Anulado" | "Con incidencia";

function estadoViaje(v: Viaje, ahora: Date): EstadoViaje {
  if (v.estado === "ANULADO") return "Anulado";
  if (v.estado !== "CONFIRMADO") return "Con incidencia";
  const ini = new Date(v.fechaHoraCargue).getTime();
  const fin = v.fechaHoraDescargue ? new Date(v.fechaHoraDescargue).getTime() : ini;
  if (ahora.getTime() < ini) return "Programado";
  if (ahora.getTime() <= fin) return "En camino";
  return "Finalizado";
}

function claseEstado(e: EstadoViaje): string {
  return {
    "En camino": "estado-azul",
    Programado: "estado-gris",
    Finalizado: "estado-verde",
    Anulado: "estado-neutro",
    "Con incidencia": "estado-rojo",
  }[e];
}

function avance(v: Viaje, ahora: Date): number {
  const ini = new Date(v.fechaHoraCargue).getTime();
  const fin = v.fechaHoraDescargue ? new Date(v.fechaHoraDescargue).getTime() : ini;
  if (fin <= ini) return 1;
  return Math.min(1, Math.max(0, (ahora.getTime() - ini) / (fin - ini)));
}

/** "AAAA-MM-DD" del dia en Colombia. */
function claveDia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(d);
}

function hora(valor: string | null): string {
  return valor
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(valor))
    : "";
}
const soloHora = hora;

/** "DD/MM" en hora de Colombia (no del texto UTC: de noche seria el dia siguiente). */
function fechaCorta(valor: string): string {
  const [, m, d] = claveDia(new Date(valor)).split("-");
  return `${d}/${m}`;
}

function ruta(p: PlantillaViaje | undefined): string {
  if (!p) return "-";
  return `${corto(p.remitente?.ciudad)} → ${corto(p.destinatario?.ciudad)}`;
}
/** "SOACHA CUNDINAMARCA" -> "Soacha": el municipio sin el departamento. */
function corto(ciudad: string | null | undefined): string {
  if (!ciudad) return "?";
  const primera = ciudad.split(" ")[0];
  return primera.charAt(0) + primera.slice(1).toLowerCase();
}

/** Variacion porcentual; null si no hay base para comparar. */
function variacion(actual: number, previo: number): number | null {
  if (previo === 0) return null;
  return Math.round(((actual - previo) / previo) * 100);
}

interface Semana {
  total: number;
  /** Lunes a domingo. */
  porDia: number[];
  etiqueta: string;
}

/**
 * Viajes confirmados por semana (lunes a domingo, hora de Colombia), por fecha
 * de expedicion. Devuelve la semana actual y las 4 anteriores.
 */
function viajesPorSemana(viajes: Viaje[], ahora: Date): Semana[] {
  const [a, m, d] = claveDia(ahora).split("-").map(Number);
  const hoyUtc = Date.UTC(a, m - 1, d);
  const diaSemana = (new Date(hoyUtc).getUTCDay() + 6) % 7; // 0 = lunes
  const lunes = hoyUtc - diaSemana * DIA;
  return Array.from({ length: 5 }, (_, s) => {
    const inicio = lunes - s * 7 * DIA;
    const porDia = Array(7).fill(0);
    for (const v of viajes) {
      const [va, vm, vd] = claveDia(new Date(v.fechaCreacion)).split("-").map(Number);
      const i = (Date.UTC(va, vm - 1, vd) - inicio) / DIA;
      if (i >= 0 && i < 7) porDia[i]++;
    }
    const fin = new Date(inicio + 6 * DIA);
    const ini = new Date(inicio);
    const f = (x: Date) => `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
    return { total: porDia.reduce((x, y) => x + y, 0), porDia, etiqueta: `${f(ini)} - ${f(fin)}` };
  });
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function Indicador({
  icono,
  titulo,
  valor,
  variacion: v,
  periodo,
}: {
  icono: ReactNode;
  titulo: string;
  valor: number;
  variacion?: number | null;
  periodo?: string;
}) {
  return (
    <div className="indicador">
      <div className="indicador-titulo">
        <span className="indicador-icono">{icono}</span>
        {titulo}
      </div>
      <div className="indicador-fila">
        <span className="indicador-valor">{valor.toLocaleString("es-CO")}</span>
        {v !== undefined && v !== null && (
          // Signo + flecha ademas del color: la variacion no depende solo del color.
          <span className={`variacion ${v >= 0 ? "sube" : "baja"}`}>
            {v >= 0 ? "▲ +" : "▼ "}
            {v}%
          </span>
        )}
        {periodo && <span className="indicador-periodo">{periodo}</span>}
      </div>
    </div>
  );
}

function AlertaDestacada({
  alerta,
  icono,
  tono,
  vacio,
  alAbrir,
}: {
  alerta: AlertaDocumento | undefined;
  icono: ReactNode;
  tono: "rojo" | "azul";
  vacio: string;
  alAbrir: () => void;
}) {
  const dias = alerta?.diasRestantes ?? 0;
  return (
    <button className="alerta-destacada" onClick={alAbrir} title="Ver todos los documentos">
      <span className={`alerta-icono ${tono}`}>{alerta ? icono : <IconoDocumento />}</span>
      <span className="alerta-texto">
        {alerta ? (
          <>
            <strong>
              {alerta.origen.entidad === "conductor" ? "Conductor" : "Vehiculo"} {alerta.sujeto} · {alerta.tipo}
            </strong>
            <span>
              {dias < 0 ? `Vencio hace ${Math.abs(dias)} dias` : dias === 0 ? "Vence hoy" : `Vence en ${dias} dias`}
              {alerta.fechaVencimiento ? ` · ${soloDia(alerta.fechaVencimiento)}` : ""}
            </span>
          </>
        ) : (
          <span>{vacio}</span>
        )}
      </span>
      <span className="alerta-flecha">
        <IconoFlecha />
      </span>
    </button>
  );
}

function AvatarConductor({ conductor }: { conductor: Conductor | undefined }) {
  if (!conductor) return <span className="dato-sec">-</span>;
  const iniciales = conductor.nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (
    <span className="avatar-conductor" title={conductor.nombre}>
      {iniciales}
    </span>
  );
}

/**
 * Viajes por dia de la semana elegida. Cada dia lleva dos barras: la semana
 * anterior en azul claro (de fondo, para comparar) y la elegida en azul. Una
 * sola metrica, dos periodos: el claro es solo referencia.
 */
function GraficaSemana({ actual, anterior }: { actual: Semana; anterior: Semana | undefined }) {
  const [foco, setFoco] = useState<number | null>(null);
  const dias = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const maximo = Math.max(1, ...actual.porDia, ...(anterior?.porDia ?? []));
  const promedio = actual.total / 7;

  return (
    <>
      <div className="grafica-semana" role="img" aria-label={`Viajes por dia, semana ${actual.etiqueta}`}>
        {dias.map((d, i) => (
          <div
            key={d}
            className="dia-columna"
            onMouseEnter={() => setFoco(i)}
            onMouseLeave={() => setFoco(null)}
          >
            <div className="barras">
              <div className="barra anterior" style={{ height: `${((anterior?.porDia[i] ?? 0) / maximo) * 100}%` }} />
              <div className={`barra actual ${foco !== null && foco !== i ? "atenuado" : ""}`} style={{ height: `${(actual.porDia[i] / maximo) * 100}%` }} />
            </div>
            <span className="dia-etiqueta">{d}</span>
          </div>
        ))}
      </div>
      <div className="tooltip-linea">
        {foco !== null
          ? `${dias[foco]}: ${actual.porDia[foco]} viaje(s)${anterior ? ` · semana anterior ${anterior.porDia[foco]}` : ""}`
          : `Semana ${actual.etiqueta}`}
      </div>
      <div className="totales-semana">
        <div>
          <strong>{actual.total}</strong>
          <span>Viajes de la semana</span>
        </div>
        <div>
          <strong>{anterior?.total ?? "-"}</strong>
          <span>Semana anterior</span>
        </div>
        <div>
          <strong>{promedio.toLocaleString("es-CO", { maximumFractionDigits: 1 })}</strong>
          <span>Promedio diario</span>
        </div>
      </div>
      <div className="leyenda-semana">
        <span><i className="muestra-actual" /> Semana elegida</span>
        <span><i className="muestra-anterior" /> Semana anterior</span>
      </div>
    </>
  );
}
