/**
 * Datos compartidos por las tarjetas del Inicio: se cargan una sola vez
 * (historial de viajes, vehiculos, conductores y plantillas) y cada tarjeta
 * toma lo suyo con useInicio().
 */
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { api } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { usarShell } from "../../componentes/Shell";
import { coordenadaValida, type PuntoMapa } from "../../componentes/MapaSeguimiento";
import type { AlertaDocumento, Conductor, PlantillaViaje, Vehiculo, Viaje } from "../../api/tipos";
import { DIA, avance, estadoViaje, hora, ruta, viajesPorSemana, type Semana } from "./reglasInicio";

/** Lo que comparten las tarjetas. */
export interface DatosInicio {
  cargando: boolean;
  error: string | null;
  recargar: () => void;
  ahora: Date;
  viajes: Viaje[];
  /** Manifiestos expedidos y vigentes (los cumplidos cuentan como viajes hechos). */
  confirmados: Viaje[];
  enCamino: Viaje[];
  programados: Viaje[];
  /** Entregados que falta cumplir en el RNDC (5 dias habiles de plazo). */
  porCumplir: Viaje[];
  finalizados30: number;
  finalizadosPrevios: number;
  /** La semana actual y las 4 anteriores. */
  semanas: Semana[];
  docVehiculo: AlertaDocumento | undefined;
  docConductor: AlertaDocumento | undefined;
  puntos: PuntoMapa[];
  vehiculo: (id: number | null) => Vehiculo | undefined;
  conductor: (id: number | null) => Conductor | undefined;
  plantilla: (id: number | null) => PlantillaViaje | undefined;
  abrirAlertas: () => void;
}

const Contexto = createContext<DatosInicio | null>(null);

/** Los datos del Inicio (dentro de <ProveedorInicio>). */
export function useInicio(): DatosInicio {
  const d = useContext(Contexto);
  if (!d) throw new Error("useInicio va dentro de <ProveedorInicio>");
  return d;
}

/**
 * Carga los datos del Inicio y los calcula una vez para todas las tarjetas.
 * Todo sale de listas que ya existen; si el volumen crece, conviene mover los
 * conteos al backend. El sistema no recibe GPS: el estado y la posicion salen
 * de las citas de cargue y descargue.
 */
export function ProveedorInicio({ children }: { children: ReactNode }) {
  const { alertas, abrirAlertas, versionDocumentos } = usarShell();
  const historial = useDatos(() => api.getHistorial(), []);
  const vehiculos = useDatos(() => api.getVehiculos(), [versionDocumentos]);
  const conductores = useDatos(() => api.getConductores(), []);
  const plantillas = useDatos(() => api.getPlantillas(), []);

  const valor = useMemo<DatosInicio>(() => {
    const ahora = new Date();
    const viajes = historial.datos ?? [];
    const vehiculoPorId = new Map((vehiculos.datos ?? []).map((v) => [v.id, v]));
    const conductorPorId = new Map((conductores.datos ?? []).map((c) => [c.id, c]));
    const plantillaPorId = new Map((plantillas.datos ?? []).map((p) => [p.id, p]));
    const confirmados = viajes.filter((v) => v.estado === "CONFIRMADO" || v.estado === "CUMPLIDO");
    const enCamino = confirmados.filter((v) => estadoViaje(v, ahora) === "En camino");
    const finalizadosEn = (desdeDias: number, hastaDias: number) =>
      confirmados.filter((v) => {
        const d = v.fechaHoraDescargue ? new Date(v.fechaHoraDescargue).getTime() : NaN;
        return d <= ahora.getTime() - hastaDias * DIA && d > ahora.getTime() - desdeDias * DIA;
      }).length;
    const urgentes = alertas ? [...alertas.vencidos, ...alertas.porVencer] : [];
    const placa = (v: Viaje) => vehiculoPorId.get(v.vehiculoId ?? -1)?.placa ?? v.placaRndc ?? `Viaje #${v.id}`;

    return {
      cargando: historial.cargando && !historial.datos,
      error: historial.error,
      recargar: historial.recargar,
      ahora,
      viajes,
      confirmados,
      enCamino,
      programados: confirmados.filter((v) => estadoViaje(v, ahora) === "Programado"),
      porCumplir: viajes.filter((v) => v.plazoCumplido && v.fechaHoraDescargue && new Date(v.fechaHoraDescargue) <= ahora),
      finalizados30: finalizadosEn(30, 0),
      finalizadosPrevios: finalizadosEn(60, 30),
      semanas: viajesPorSemana(confirmados, ahora),
      docVehiculo: urgentes.find((a) => a.origen.entidad === "vehiculo" || a.origen.entidad === "remolque"),
      docConductor: urgentes.find((a) => a.origen.entidad === "conductor"),
      puntos: enCamino.flatMap((v) => {
        const p = plantillaPorId.get(v.plantillaId ?? -1);
        const o = p?.remitente;
        const d = p?.destinatario;
        if (!o || !d || !coordenadaValida(o.latitud, o.longitud) || !coordenadaValida(d.latitud, d.longitud)) return [];
        return [
          {
            id: v.id,
            etiqueta: placa(v),
            detalle: `${ruta(p)} · llega ${hora(v.fechaHoraDescargue)}`,
            ruta: ruta(p),
            cliente: p?.contratante?.nombre ?? undefined,
            conductor: conductorPorId.get(v.conductorId ?? -1)?.nombre,
            llegada: hora(v.fechaHoraDescargue),
            origen: [o.latitud!, o.longitud!] as [number, number],
            destino: [d.latitud!, d.longitud!] as [number, number],
            avance: avance(v, ahora),
          },
        ];
      }),
      vehiculo: (id) => vehiculoPorId.get(id ?? -1),
      conductor: (id) => conductorPorId.get(id ?? -1),
      plantilla: (id) => plantillaPorId.get(id ?? -1),
      abrirAlertas,
    };
    // Solo cambia cuando llegan datos nuevos (si no, el mapa se reencuadraria en cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historial.datos, historial.cargando, historial.error, vehiculos.datos, conductores.datos, plantillas.datos, alertas]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
