import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, separarAvisos, fechaHora, hoyColombia, moneda } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../componentes/Estado";
import ReintentarViaje, { esReintentable } from "../componentes/ReintentarViaje";
import { usarShell } from "../componentes/Shell";
import type { Conductor, PlantillaViaje, Vehiculo, Viaje, ViajeRemesa } from "../api/tipos";

/**
 * Pantalla de inicio: tablero con el estado de la flota y de los viajes.
 *
 * Todo se calcula en el navegador a partir de listas que ya existen
 * (vehiculos, conductores, plantillas y los ultimos 100 viajes). No hay
 * endpoints de estadisticas: si el volumen crece, conviene moverlo al backend.
 *
 * "En camino" se deduce de las CITAS de cargue y descargue de los manifiestos
 * confirmados: el sistema aun no registra cumplidos ni posicion GPS.
 */
export default function Dashboard() {
  const { alertas, abrirAlertas, versionDocumentos } = usarShell();
  const historial = useDatos(() => api.getHistorial(), []);
  // Se vuelve a pedir cuando se corrige un documento desde las alertas.
  const vehiculos = useDatos(() => api.getVehiculos(), [versionDocumentos]);
  const conductores = useDatos(() => api.getConductores(), []);
  const plantillas = useDatos(() => api.getPlantillas(), []);
  /** Viaje abierto en la ventana de reintento (null = ventana cerrada). */
  const [reintentando, setReintentando] = useState<Viaje | null>(null);

  // Remesas desplegadas por viaje. Se piden bajo demanda y no de entrada:
  // son varias peticiones y casi nunca se necesitan todas.
  const [remesasPorViaje, setRemesasPorViaje] = useState<Record<number, ViajeRemesa[]>>({});

  async function alternarRemesas(viajeId: number) {
    if (remesasPorViaje[viajeId]) {
      const copia = { ...remesasPorViaje };
      delete copia[viajeId];
      setRemesasPorViaje(copia);
      return;
    }
    const remesas = await api.getRemesasDeViaje(viajeId);
    setRemesasPorViaje({ ...remesasPorViaje, [viajeId]: remesas });
  }

  // Solo la primera carga muestra "Cargando": en una recarga (por ejemplo tras
  // corregir un documento) se siguen viendo los datos anteriores hasta que
  // lleguen los nuevos, sin parpadeo.
  const cargando =
    (historial.cargando && !historial.datos) || (vehiculos.cargando && !vehiculos.datos);
  if (cargando) return <Cargando que="el tablero" />;
  if (historial.error) return <ErrorCarga mensaje={historial.error} alReintentar={historial.recargar} />;
  if (vehiculos.error) return <ErrorCarga mensaje={vehiculos.error} alReintentar={vehiculos.recargar} />;

  const viajes = historial.datos ?? [];
  const flota = vehiculos.datos ?? [];
  const ahora = new Date();

  // Mapas por id para cruzar viajes con vehiculo, conductor y ruta.
  const vehiculoPorId = new Map(flota.map((v) => [v.id, v]));
  const conductorPorId = new Map((conductores.datos ?? []).map((c) => [c.id, c]));
  const plantillaPorId = new Map((plantillas.datos ?? []).map((p) => [p.id, p]));

  const confirmados = viajes.filter((v) => v.estado === "CONFIRMADO");
  const enCamino = confirmados
    .filter((v) => estaEnCamino(v, ahora))
    .sort((a, b) => fecha(a.fechaHoraDescargue) - fecha(b.fechaHoraDescargue));
  const programados = confirmados
    .filter((v) => new Date(v.fechaHoraCargue) > ahora)
    .sort((a, b) => fecha(a.fechaHoraCargue) - fecha(b.fechaHoraCargue));
  const incidencias = viajes.filter(esReintentable);
  const imprimibles = confirmados.filter((v) => v.numeroManifiestoRndc).slice(0, 8);

  const mesActual = claveDia(ahora).slice(0, 7);
  const delMes = confirmados.filter((v) => claveDia(new Date(v.fechaCreacion)).slice(0, 7) === mesActual);
  const fleteDelMes = delMes.reduce((s, v) => s + (v.valorFleteReal ?? 0), 0);

  // Estado de cada vehiculo. Un vehiculo en camino no cuenta como programado.
  const placasEnCamino = new Set(enCamino.map((v) => v.vehiculoId));
  const placasProgramadas = new Set(
    programados.map((v) => v.vehiculoId).filter((id) => !placasEnCamino.has(id))
  );
  const activos = flota.filter((v) => v.activo);
  const estadoFlota: SegmentoFlota[] = [
    { id: "camino", etiqueta: "En camino", valor: activos.filter((v) => placasEnCamino.has(v.id)).length },
    { id: "programado", etiqueta: "Programados", valor: activos.filter((v) => placasProgramadas.has(v.id)).length },
    {
      id: "disponible",
      etiqueta: "Disponibles",
      valor: activos.filter((v) => !placasEnCamino.has(v.id) && !placasProgramadas.has(v.id)).length,
    },
    { id: "inactivo", etiqueta: "Inactivos", valor: flota.length - activos.length },
  ];

  const vencidos = alertas?.vencidos.length ?? 0;
  const porVencer = alertas?.porVencer.length ?? 0;

  return (
    <>
      {/* ---------- Indicadores ---------- */}
      <div className="kpi-grid">
        <Indicador etiqueta="Flota activa" valor={activos.length}>
          {(conductores.datos ?? []).filter((c) => c.activo).length} conductores activos
        </Indicador>
        <Indicador etiqueta="En camino" valor={enCamino.length} destacado>
          segun las citas de cargue y descargue
        </Indicador>
        <Indicador etiqueta="Programados" valor={programados.length}>
          {programados[0]
            ? `proximo cargue ${fechaHora(programados[0].fechaHoraCargue)}`
            : "sin cargues pendientes"}
        </Indicador>
        <Indicador etiqueta="Manifiestos del mes" valor={delMes.length}>
          flete {moneda(fleteDelMes)}
        </Indicador>
        <Indicador etiqueta="Viajes con incidencias" valor={incidencias.length}>
          {incidencias.length > 0 ? <Link to="/historial">ver y reintentar</Link> : "todo al dia"}
        </Indicador>
        <Indicador
          etiqueta="Documentos vencidos"
          valor={alertas ? vencidos : "-"}
          alClic={alertas ? abrirAlertas : undefined}
          estado={vencidos > 0 ? "critico" : porVencer > 0 ? "aviso" : undefined}
        >
          {alertas ? `${porVencer} por vencer · ver detalle` : "cargando..."}
        </Indicador>
      </div>

      {/* ---------- Graficas ---------- */}
      <div className="grid-2">
        <div className="panel panel-body viz-root">
          <h3 className="panel-title">Estado de la flota</h3>
          <p className="section-desc" style={{ margin: "0 0 1rem" }}>
            {flota.length} vehiculos registrados. Un vehiculo en camino que ademas tiene otro
            viaje programado cuenta como en camino.
          </p>
          <BarraFlota segmentos={estadoFlota} />
          <ul className="resumen-flota">
            <li>
              <span>Con SOAT y tecnomecanica al dia</span>
              <strong>
                {activos.filter((v) => alDia(v.fechaVencSoat) && alDia(v.fechaVencTecnomecanica)).length}{" "}
                de {activos.length}
              </strong>
            </li>
            <li>
              <span>Sin proveedor de GPS asignado</span>
              <strong>
                {activos.filter((v) => !v.nitMonitoreoFlota).length}{" "}
                <Link to="/catalogo">asignar</Link>
              </strong>
            </li>
          </ul>
        </div>

        <div className="panel panel-body viz-root">
          <h3 className="panel-title">Manifiestos expedidos, ultimos 14 dias</h3>
          <p className="section-desc" style={{ margin: "0 0 1rem" }}>
            Confirmados por el RNDC, por dia de expedicion.
          </p>
          <ColumnasPorDia viajes={confirmados} dias={14} ahora={ahora} />
        </div>
      </div>

      {/* ---------- En camino ---------- */}
      <div className="panel panel-body">
        <h3 className="panel-title">Vehiculos en camino</h3>
        <p className="section-desc" style={{ margin: "0 0 0.8rem" }}>
          El avance es el tiempo transcurrido entre la cita de cargue y la de descargue, no la
          posicion real del vehiculo.
        </p>
        <TablaViajes
          viajes={enCamino}
          vacio="No hay vehiculos en camino en este momento."
          ahora={ahora}
          conAvance
          vehiculoPorId={vehiculoPorId}
          conductorPorId={conductorPorId}
          plantillaPorId={plantillaPorId}
        />

        {programados.length > 0 && (
          <>
            <h4 className="subtitulo-panel">Proximos a salir</h4>
            <TablaViajes
              viajes={programados.slice(0, 5)}
              vacio=""
              ahora={ahora}
              vehiculoPorId={vehiculoPorId}
              conductorPorId={conductorPorId}
              plantillaPorId={plantillaPorId}
            />
          </>
        )}
      </div>

      {/* ---------- Incidencias y manifiestos ---------- */}
      <div className="grid-2">
        <div className="panel panel-body">
          <h3 className="panel-title">Viajes con incidencias</h3>
          {incidencias.length === 0 ? (
            <p className="section-desc">No hay viajes con incidencias. Todo al dia.</p>
          ) : (
            <table className="modern">
              <tbody>
                {incidencias.slice(0, 6).map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong>#{v.id}</strong>
                      <span className="dato-sec">{vehiculoPorId.get(v.vehiculoId)?.placa ?? "-"}</span>
                    </td>
                    <td style={{ whiteSpace: "normal" }}>
                      <span className="badge badge-danger">{v.codigoError ?? v.estado}</span>
                      <span className="dato-sec" title={v.mensajeError ?? ""}>
                        {(v.mensajeError ?? "").slice(0, 90)}
                        {(v.mensajeError ?? "").length > 90 ? "..." : ""}
                      </span>
                    </td>
                    <td>
                      <button className="btn-primary" onClick={() => setReintentando(v)}>
                        Reintentar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {incidencias.length > 6 && (
            <p className="resumen-catalogo">
              Y {incidencias.length - 6} mas en el <Link to="/historial">Historial</Link>.
            </p>
          )}
        </div>

        <div className="panel panel-body">
          <h3 className="panel-title">Manifiestos para imprimir</h3>
          <p className="section-desc" style={{ margin: "0 0 0.8rem" }}>
            PDF oficial del Ministerio con el codigo QR. El conductor lo lleva todo el recorrido.
          </p>
          <table className="modern">
            <tbody>
              {imprimibles.map((v) => (
                <FilaManifiesto
                  key={v.id}
                  viaje={v}
                  placa={vehiculoPorId.get(v.vehiculoId)?.placa ?? "-"}
                  remesas={remesasPorViaje[v.id]}
                  alAlternar={() => alternarRemesas(v.id)}
                />
              ))}
              {imprimibles.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-row">
                    Aun no hay manifiestos radicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reintentando && (
        <ReintentarViaje
          viaje={reintentando}
          alCerrar={() => setReintentando(null)}
          alTerminar={historial.recargar}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------

function fecha(valor: string | null): number {
  return valor ? new Date(valor).getTime() : Number.POSITIVE_INFINITY;
}

/** Entre la cita de cargue y la de descargue. Sin cita de descargue no se puede afirmar. */
function estaEnCamino(v: Viaje, ahora: Date): boolean {
  if (!v.fechaHoraDescargue) return false;
  return new Date(v.fechaHoraCargue) <= ahora && ahora <= new Date(v.fechaHoraDescargue);
}

/** Fraccion (0 a 1) del tiempo transcurrido entre cargue y descargue. */
function avance(v: Viaje, ahora: Date): number {
  const ini = new Date(v.fechaHoraCargue).getTime();
  const fin = v.fechaHoraDescargue ? new Date(v.fechaHoraDescargue).getTime() : ini;
  if (fin <= ini) return 1;
  return Math.min(1, Math.max(0, (ahora.getTime() - ini) / (fin - ini)));
}

/** Documento vigente hoy (columna DATE, se compara el dia). Sin fecha no cuenta como al dia. */
function alDia(fecha: string | null): boolean {
  return !!fecha && fecha.slice(0, 10) >= hoyColombia();
}

/** "AAAA-MM-DD" del dia en Colombia. */
function claveDia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(d);
}

function ruta(p: PlantillaViaje | undefined): string {
  if (!p) return "-";
  const origen = p.remitente?.ciudad ?? p.municipioOrigen ?? "?";
  const destino = p.destinatario?.ciudad ?? p.municipioDestino ?? "?";
  return `${origen} → ${destino}`;
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function Indicador({
  etiqueta,
  valor,
  children,
  destacado,
  estado,
  alClic,
}: {
  etiqueta: string;
  valor: number | string;
  children?: ReactNode;
  destacado?: boolean;
  estado?: "critico" | "aviso";
  alClic?: () => void;
}) {
  const clases = ["kpi-tile", destacado ? "kpi-destacado" : "", estado ? `kpi-${estado}` : "", alClic ? "kpi-clic" : ""]
    .filter(Boolean)
    .join(" ");
  const contenido = (
    <>
      <span className="kpi-etiqueta">
        {/* El estado lleva icono ademas del color. */}
        {estado === "critico" && "✖ "}
        {estado === "aviso" && "⚠ "}
        {etiqueta}
      </span>
      <span className="kpi-valor">{typeof valor === "number" ? valor.toLocaleString("es-CO") : valor}</span>
      {children && <span className="kpi-detalle">{children}</span>}
    </>
  );
  return alClic ? (
    <button type="button" className={clases} onClick={alClic}>
      {contenido}
    </button>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

interface SegmentoFlota {
  id: "camino" | "programado" | "disponible" | "inactivo";
  etiqueta: string;
  valor: number;
}

/**
 * Parte-de-un-todo: una barra apilada horizontal. Cada categoria tiene color
 * fijo (no depende del orden ni de cuantas haya) y la leyenda lleva siempre la
 * cantidad y el porcentaje, asi la identidad nunca depende solo del color.
 */
function BarraFlota({ segmentos }: { segmentos: SegmentoFlota[] }) {
  const [foco, setFoco] = useState<string | null>(null);
  const total = segmentos.reduce((s, x) => s + x.valor, 0);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const visibles = segmentos.filter((s) => s.valor > 0);
  const enFoco = segmentos.find((s) => s.id === foco);

  return (
    <>
      <div className="barra-apilada" role="img" aria-label="Estado de la flota">
        {visibles.map((s) => (
          <div
            key={s.id}
            className={`segmento serie-${s.id} ${foco && foco !== s.id ? "atenuado" : ""}`}
            style={{ flexGrow: s.valor }}
            onMouseEnter={() => setFoco(s.id)}
            onMouseLeave={() => setFoco(null)}
          />
        ))}
        {total === 0 && <div className="segmento serie-inactivo" style={{ flexGrow: 1 }} />}
      </div>
      <div className="tooltip-linea">
        {enFoco ? `${enFoco.etiqueta}: ${enFoco.valor} vehiculo(s), ${pct(enFoco.valor)}%` : " "}
      </div>
      <ul className="leyenda">
        {segmentos.map((s) => (
          <li
            key={s.id}
            onMouseEnter={() => setFoco(s.id)}
            onMouseLeave={() => setFoco(null)}
          >
            <span className={`muestra serie-${s.id}`} />
            <span className="leyenda-etiqueta">{s.etiqueta}</span>
            <span className="leyenda-valor">
              {s.valor} <span className="dato-sec-inline">({pct(s.valor)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Cambio en el tiempo con pocos puntos: columnas, una sola serie (sin
 * leyenda; el titulo dice que se mide). El valor se ve al pasar el mouse y el
 * dia con mas manifiestos lleva su numero encima.
 */
function ColumnasPorDia({ viajes, dias, ahora }: { viajes: Viaje[]; dias: number; ahora: Date }) {
  const [foco, setFoco] = useState<number | null>(null);
  const [verTabla, setVerTabla] = useState(false);

  const serie = Array.from({ length: dias }, (_, i) => {
    const d = new Date(ahora.getTime() - (dias - 1 - i) * 86_400_000);
    const clave = claveDia(d);
    return {
      clave,
      etiqueta: `${clave.slice(8, 10)}/${clave.slice(5, 7)}`,
      valor: viajes.filter((v) => claveDia(new Date(v.fechaCreacion)) === clave).length,
    };
  });
  const maximo = Math.max(1, ...serie.map((s) => s.valor));
  const iMax = serie.findIndex((s) => s.valor === maximo && maximo > 0);
  // Marcas del eje redondas: 0, la mitad y el tope.
  const tope = Math.max(2, Math.ceil(maximo / 2) * 2);

  return (
    <>
      {verTabla ? (
        <table className="modern">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Manifiestos</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((s) => (
              <tr key={s.clave}>
                <td>{s.etiqueta}</td>
                <td className="numero">{s.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="columnas" role="img" aria-label="Manifiestos por dia">
          <div className="columnas-eje">
            <span>{tope}</span>
            <span>{tope / 2}</span>
            <span>0</span>
          </div>
          <div className="columnas-area">
            <div className="columnas-rejilla" />
            {serie.map((s, i) => (
              <div
                key={s.clave}
                className="columna-banda"
                onMouseEnter={() => setFoco(i)}
                onMouseLeave={() => setFoco(null)}
              >
                {(i === iMax || foco === i) && s.valor > 0 && (
                  <span className="columna-valor" style={{ bottom: `${(s.valor / tope) * 100}%` }}>
                    {s.valor}
                  </span>
                )}
                <div
                  className={`columna ${foco !== null && foco !== i ? "atenuado" : ""}`}
                  style={{ height: `${(s.valor / tope) * 100}%` }}
                />
                <span className="columna-etiqueta">{i % 2 === (dias - 1) % 2 ? s.etiqueta : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="tooltip-linea">
        {foco !== null
          ? `${serie[foco].etiqueta}: ${serie[foco].valor} manifiesto(s)`
          : " "}
        <button type="button" className="btn-link" onClick={() => setVerTabla(!verTabla)}>
          {verTabla ? "Ver grafica" : "Ver como tabla"}
        </button>
      </div>
    </>
  );
}

function TablaViajes({
  viajes,
  vacio,
  ahora,
  conAvance,
  vehiculoPorId,
  conductorPorId,
  plantillaPorId,
}: {
  viajes: Viaje[];
  vacio: string;
  ahora: Date;
  conAvance?: boolean;
  vehiculoPorId: Map<number, Vehiculo>;
  conductorPorId: Map<number, Conductor>;
  plantillaPorId: Map<number, PlantillaViaje>;
}) {
  if (viajes.length === 0) return <p className="section-desc">{vacio}</p>;
  return (
    <div className="tabla-scroll">
      <table className="modern">
        <thead>
          <tr>
            <th>Vehiculo</th>
            <th>Conductor</th>
            <th>Ruta</th>
            <th>Cargue</th>
            <th>Llegada (cita)</th>
            {conAvance && <th>Avance</th>}
            <th>Manifiesto</th>
          </tr>
        </thead>
        <tbody>
          {viajes.map((v) => {
            const a = avance(v, ahora);
            return (
              <tr key={v.id}>
                <td>
                  <strong>{vehiculoPorId.get(v.vehiculoId)?.placa ?? "-"}</strong>
                </td>
                <td>{conductorPorId.get(v.conductorId)?.nombre ?? "-"}</td>
                <td>{ruta(plantillaPorId.get(v.plantillaId))}</td>
                <td>{fechaHora(v.fechaHoraCargue)}</td>
                <td>{v.fechaHoraDescargue ? fechaHora(v.fechaHoraDescargue) : "-"}</td>
                {conAvance && (
                  <td style={{ minWidth: 140 }}>
                    <div className="medidor" title={`${Math.round(a * 100)}% del tiempo pactado`}>
                      <div className="medidor-relleno" style={{ width: `${a * 100}%` }} />
                    </div>
                    <span className="dato-sec">{Math.round(a * 100)}%</span>
                  </td>
                )}
                <td>
                  {v.consecutivoManifiesto ?? "-"}
                  {v.numeroManifiestoRndc && <span className="dato-sec">{v.numeroManifiestoRndc}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilaManifiesto({
  viaje,
  placa,
  remesas,
  alAlternar,
}: {
  viaje: Viaje;
  placa: string;
  remesas?: ViajeRemesa[];
  alAlternar: () => void;
}) {
  const avisos = separarAvisos(viaje.avisos);

  return (
    <>
      <tr>
        <td>
          <strong>{viaje.consecutivoManifiesto ?? `#${viaje.id}`}</strong>
          <span className="dato-sec">
            {placa} · radicado {viaje.numeroManifiestoRndc}
          </span>
        </td>
        <td>{fechaHora(viaje.fechaHoraCargue)}</td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button
            className="btn-secondary"
            onClick={() => window.open(api.urlPdfManifiesto(viaje.id), "_blank")}
          >
            PDF
          </button>
          <button className="btn-secondary" style={{ marginLeft: "0.35rem" }} onClick={alAlternar}>
            Remesas
          </button>
        </td>
      </tr>

      {avisos.length > 0 && (
        <tr>
          {/* maxWidth 0: sin esto la celda crece con el texto y empuja las demas
              columnas fuera del panel en vez de recortar con "...". */}
          <td colSpan={3} style={{ paddingTop: 0, maxWidth: 0 }}>
            {/* Los avisos pueden ser largos: una linea, y el texto completo al pasar el mouse. */}
            <span className="aviso-corto" title={avisos.join("\n")}>
              ⚠ {avisos.length} aviso(s): {avisos[0]}
            </span>
          </td>
        </tr>
      )}

      {remesas && (
        <tr>
          <td colSpan={3} style={{ background: "rgba(0,0,0,0.02)" }}>
            {remesas.map((r) => (
              <div key={r.id} style={{ padding: "0.25rem 0" }}>
                {r.consecutivoRemesa} — radicado {r.numeroRemesaRndc ?? "pendiente"}
                {r.numeroRemesaRndc && (
                  <button
                    className="btn-link"
                    onClick={() => window.open(api.urlImprimirRemesa(r.id), "_blank")}
                  >
                    Imprimir soporte
                  </button>
                )}
              </div>
            ))}
            {remesas.length === 0 && (
              <span className="section-desc">Este viaje no tiene remesas registradas.</span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
