/**
 * Las tarjetas del Inicio. Cada una toma sus datos de useInicio() y llena el
 * espacio que le da la rejilla (o su alto natural en el celular).
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { soloDia } from "../../api/cliente";
import Indicador from "../../componentes/Indicador";
import MapaSeguimiento from "../../componentes/MapaSeguimiento";
import { IconoCalendario, IconoCamion, IconoCheck, IconoConductores, IconoDocumento, IconoFlecha, IconoGrafica, IconoMapa } from "../../componentes/Iconos";
import type { AlertaDocumento, Conductor, Viaje } from "../../api/tipos";
import { useInicio } from "./DatosInicio";
import { Esqueleto, Marco } from "./MarcoTarjeta";
import { claseEstado, claveDia, diaMes, estadoViaje, hora, ruta, variacion, type Semana } from "./reglasInicio";

/** Tarjeta de una sola cifra. */
function TarjetaCifra(props: Parameters<typeof Indicador>[0]) {
  const d = useInicio();
  return <section className="tarjeta-inicio tarjeta-inicio-cifra">{d.cargando ? <Esqueleto filas={2} /> : <Indicador {...props} />}</section>;
}

/** Vehiculos en transito (entre la cita de cargue y la de descargue). */
function Transito() {
  const d = useInicio();
  return <TarjetaCifra icono={<IconoCamion />} titulo="Vehiculos en transito" valor={d.enCamino.length} />;
}

/** Viajes finalizados en 30 dias contra los 30 anteriores. */
function Finalizados() {
  const d = useInicio();
  return (
    <TarjetaCifra
      icono={<IconoCheck />}
      titulo="Viajes finalizados"
      valor={d.finalizados30}
      variacion={variacion(d.finalizados30, d.finalizadosPrevios)}
      detalle="30 dias"
    />
  );
}

/** Viajes programados que aun no cargan. */
function Proximos() {
  const d = useInicio();
  return <TarjetaCifra icono={<IconoCalendario />} titulo="Proximos viajes" valor={d.programados.length} detalle="programados" />;
}

/** Viajes expedidos esta semana contra la pasada. */
function EstaSemana() {
  const d = useInicio();
  const [actual, anterior] = d.semanas;
  return (
    <TarjetaCifra
      icono={<IconoGrafica />}
      titulo="Viajes esta semana"
      valor={actual.total}
      variacion={variacion(actual.total, anterior.total)}
      detalle="vs. semana pasada"
    />
  );
}

/**
 * Tarjeta con el documento mas urgente (o un mensaje si no hay): quien, que
 * documento y en cuantos dias vence. Al hacer clic abre todas las alertas.
 */
function AlertaDestacada({ alerta, icono, tono, vacio }: { alerta: AlertaDocumento | undefined; icono: ReactNode; tono: "rojo" | "azul"; vacio: string }) {
  const d = useInicio();
  const dias = alerta?.diasRestantes ?? 0;
  return (
    <button className="alerta-destacada tarjeta-inicio" onClick={d.abrirAlertas} title="Ver todos los documentos">
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

/** El documento de vehiculo o remolque mas urgente. */
function DocumentoVehiculo() {
  const d = useInicio();
  return <AlertaDestacada alerta={d.docVehiculo} icono={<IconoCamion />} tono="rojo" vacio="Ningun documento de vehiculo vencido ni por vencer." />;
}

/** La licencia de conductor mas urgente. */
function DocumentoConductor() {
  const d = useInicio();
  return <AlertaDestacada alerta={d.docConductor} icono={<IconoConductores />} tono="azul" vacio="Ninguna licencia vencida ni por vencer." />;
}

/** Viajes entregados que falta cumplir en el RNDC; lleva al historial. */
function PorCumplir() {
  const d = useInicio();
  const navegar = useNavigate();
  const n = d.porCumplir.length;
  const vencidos = d.porCumplir.filter((v) => v.plazoCumplido!.vencido).length;
  const urgentes = d.porCumplir.filter((v) => !v.plazoCumplido!.vencido && v.plazoCumplido!.diasHabilesRestantes <= 1).length;
  return (
    <button className="alerta-destacada tarjeta-inicio" onClick={() => navegar("/historial")} title="Cumplir remesas y manifiestos en el historial">
      <span className={`alerta-icono ${vencidos > 0 ? "rojo" : "azul"}`}>
        <IconoCheck />
      </span>
      <span className="alerta-texto">
        {n > 0 ? (
          <>
            <strong>
              {n} viaje{n === 1 ? "" : "s"} por cumplir
            </strong>
            <span>
              {vencidos > 0
                ? `${vencidos} con el plazo vencido`
                : urgentes > 0
                  ? `${urgentes} vence${urgentes === 1 ? "" : "n"} pronto`
                  : "Dentro del plazo de 5 dias habiles"}
            </span>
          </>
        ) : (
          <span>{d.cargando ? "Cargando..." : "Ningun viaje entregado pendiente de cumplido."}</span>
        )}
      </span>
      <span className="alerta-flecha">
        <IconoFlecha />
      </span>
    </button>
  );
}

/** Circulo con las iniciales del conductor (su nombre completo al pasar el mouse). */
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

/** Etiqueta de color con el estado del viaje. */
function EtiquetaEstado({ v }: { v: Viaje }) {
  const d = useInicio();
  const e = estadoViaje(v, d.ahora);
  return <span className={`etiqueta-estado ${claseEstado(e)}`}>{e}</span>;
}

/** Manifiesto con el punto de color de su estado. */
function Manifiesto({ v }: { v: Viaje }) {
  const d = useInicio();
  return (
    <td>
      <span className={`punto-estado ${claseEstado(estadoViaje(v, d.ahora))}`} />
      <strong>{v.consecutivoManifiesto ?? `#${v.id}`}</strong>
    </td>
  );
}

/** Las citas de hoy: cargues o descargues, por hora. */
function Hoy() {
  const d = useInicio();
  const navegar = useNavigate();
  const [vista, setVista] = useState<"cargues" | "descargues">("cargues");
  const fecha = (v: Viaje) => (vista === "cargues" ? v.fechaHoraCargue : v.fechaHoraDescargue);
  const hoy = claveDia(d.ahora);
  const deHoy = d.confirmados
    .filter((v) => {
      const f = fecha(v);
      return f && claveDia(new Date(f)) === hoy;
    })
    .sort((a, b) => hora(fecha(a)).localeCompare(hora(fecha(b))));
  return (
    <Marco
      titulo="Hoy"
      acciones={
        <>
          <div className="pildoras">
            <button className={vista === "cargues" ? "activa" : ""} onClick={() => setVista("cargues")}>
              Cargues
            </button>
            <button className={vista === "descargues" ? "activa" : ""} onClick={() => setVista("descargues")}>
              Descargues
            </button>
          </div>
          <button className="boton-suave" onClick={() => navegar("/historial")}>
            Ver todos
          </button>
        </>
      }
    >
      {d.cargando ? (
        <Esqueleto />
      ) : (
        <table className="tabla-tablero">
          <thead>
            <tr>
              <th>Manifiesto</th>
              <th>Hora</th>
              <th>{vista === "cargues" ? "Destino" : "Origen"}</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Vehiculo</th>
              <th>Conductor</th>
            </tr>
          </thead>
          <tbody>
            {deHoy.map((v) => {
              const p = d.plantilla(v.plantillaId);
              return (
                <tr key={v.id}>
                  <Manifiesto v={v} />
                  <td>{hora(fecha(v))}</td>
                  <td>{vista === "cargues" ? (p?.destinatario?.ciudad ?? "-") : (p?.remitente?.ciudad ?? "-")}</td>
                  <td>{p?.contratante?.nombre ?? "-"}</td>
                  <td>
                    <EtiquetaEstado v={v} />
                  </td>
                  <td>{d.vehiculo(v.vehiculoId)?.placa ?? v.placaRndc ?? "-"}</td>
                  <td>
                    <AvatarConductor conductor={d.conductor(v.conductorId)} />
                  </td>
                </tr>
              );
            })}
            {deHoy.length === 0 && (
              <tr>
                <td colSpan={7} className="vacio-tablero">
                  No hay {vista} programados para hoy.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </Marco>
  );
}

/** Los ultimos manifiestos con su estado, ruta y llegada. */
function Ultimos() {
  const d = useInicio();
  const navegar = useNavigate();
  const ultimos = d.viajes.slice(0, 8);
  return (
    <Marco
      titulo="Ultimos viajes"
      acciones={
        <button className="boton-suave" onClick={() => navegar("/historial")}>
          Ver todos
        </button>
      }
    >
      {d.cargando ? (
        <Esqueleto filas={4} />
      ) : (
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
            {ultimos.map((v) => {
              const p = d.plantilla(v.plantillaId);
              return (
                <tr key={v.id}>
                  <Manifiesto v={v} />
                  <td>
                    <EtiquetaEstado v={v} />
                  </td>
                  <td>{ruta(p)}</td>
                  <td>{p?.contratante?.nombre ?? "-"}</td>
                  <td>{v.fechaHoraDescargue ? `${diaMes(v.fechaHoraDescargue)} ${hora(v.fechaHoraDescargue)}` : "-"}</td>
                  <td>{d.vehiculo(v.vehiculoId)?.placa ?? v.placaRndc ?? "-"}</td>
                  <td>
                    <AvatarConductor conductor={d.conductor(v.conductorId)} />
                  </td>
                </tr>
              );
            })}
            {ultimos.length === 0 && (
              <tr>
                <td colSpan={7} className="vacio-tablero">
                  Aun no hay viajes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </Marco>
  );
}

/** Grafica de viajes por dia de la semana elegida. */
function ViajesPorSemana() {
  const d = useInicio();
  const [atras, setAtras] = useState(0);
  return (
    <Marco
      titulo="Viajes por semana"
      icono={<IconoGrafica />}
      acciones={
        <select value={atras} onChange={(e) => setAtras(Number(e.target.value))} className="selector-pequeno" aria-label="Semana">
          <option value={0}>Esta semana</option>
          <option value={1}>Semana pasada</option>
          <option value={2}>Hace 2 semanas</option>
          <option value={3}>Hace 3 semanas</option>
        </select>
      }
    >
      {/* key: al cambiar de semana las barras vuelven a crecer. */}
      {d.cargando ? <Esqueleto /> : <GraficaSemana key={atras} actual={d.semanas[atras]} anterior={d.semanas[atras + 1]} />}
    </Marco>
  );
}

/**
 * Viajes por dia de la semana elegida. Cada dia lleva dos barras: la semana
 * anterior en claro (de fondo, para comparar) y la elegida en violeta. Una
 * sola metrica, dos periodos: el claro es solo referencia. Las barras crecen
 * al aparecer, una tras otra.
 */
function GraficaSemana({ actual, anterior }: { actual: Semana; anterior: Semana | undefined }) {
  const [foco, setFoco] = useState<number | null>(null);
  const dias = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const maximo = Math.max(1, ...actual.porDia, ...(anterior?.porDia ?? []));
  const promedio = actual.total / 7;

  return (
    <>
      <div className="grafica-semana" role="img" aria-label={`Viajes por dia, semana ${actual.etiqueta}`}>
        {dias.map((dia, i) => (
          <div key={dia} className="dia-columna" style={{ ["--i" as string]: i }} onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}>
            <div className="barras">
              <div className="barra anterior" style={{ height: `${((anterior?.porDia[i] ?? 0) / maximo) * 100}%` }} />
              <div className={`barra actual ${foco !== null && foco !== i ? "atenuado" : ""}`} style={{ height: `${(actual.porDia[i] / maximo) * 100}%` }} />
            </div>
            <span className="dia-etiqueta">{dia}</span>
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
        <span>
          <i className="muestra-actual" /> Semana elegida
        </span>
        <span>
          <i className="muestra-anterior" /> Semana anterior
        </span>
      </div>
    </>
  );
}

/**
 * La flota en el mapa: los vehiculos en camino con su posicion estimada entre
 * cargue y descargue. Al pasar el mouse por un carro sale su tarjeta (placa,
 * ruta, cliente, conductor y avance). Cuando llegue el GPS, los puntos saldran
 * de ahi sin cambiar la tarjeta.
 */
function Mapa() {
  const d = useInicio();
  const navegar = useNavigate();
  return (
    <Marco
      titulo="La flota en el mapa"
      icono={<IconoMapa />}
      acciones={
        <button className="boton-suave" onClick={() => navegar("/historial")}>
          Mas
        </button>
      }
    >
      <div className="tarjeta-inicio-mapa">
        <MapaSeguimiento puntos={d.puntos} />
      </div>
      <p className="nota-mapa">
        {d.enCamino.length === 0 ? "No hay vehiculos en camino." : `${d.puntos.length} de ${d.enCamino.length} en camino con ubicacion. `}
        Posicion estimada entre cargue y descargue segun las citas; no es GPS.
      </p>
    </Marco>
  );
}

/** Componente de cada tarjeta del catalogo (catalogoInicio.ts), por id. */
export const TARJETAS: Record<string, () => JSX.Element> = {
  "indicador-transito": Transito,
  "indicador-finalizados": Finalizados,
  "indicador-proximos": Proximos,
  "indicador-semana": EstaSemana,
  "documento-vehiculo": DocumentoVehiculo,
  "documento-conductor": DocumentoConductor,
  "por-cumplir": PorCumplir,
  hoy: Hoy,
  ultimos: Ultimos,
  semana: ViajesPorSemana,
  mapa: Mapa,
};
