/**
 * Mapa (Leaflet) con la posicion ESTIMADA de los vehiculos en camino: en
 * linea recta entre cargue y descargue segun el tiempo entre las citas.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface PuntoMapa {
  id: number;
  etiqueta: string;
  detalle: string;
  origen: [number, number];
  destino: [number, number];
  /** 0 a 1: tiempo transcurrido entre la cita de cargue y la de descargue. */
  avance: number;
  /** Para la tarjeta del carro al pasar el mouse (opcionales). */
  ruta?: string;
  cliente?: string;
  conductor?: string;
  /** Hora de la cita de descargue ("HH:MM"). */
  llegada?: string;
}

/** Escapa texto para meterlo en el HTML de la tarjeta de Leaflet. */
function escapar(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Tarjeta del carro (al pasar el mouse): placa, ruta, cliente, conductor y una
 * barra con el avance entre la cita de cargue y la de descargue. Sin los datos
 * opcionales queda la placa y el detalle.
 */
export function tarjetaCarro(p: PuntoMapa): string {
  const pct = Math.round(p.avance * 100);
  const filas = p.ruta
    ? [p.ruta, p.cliente, p.conductor && `Conductor: ${p.conductor}`].filter(Boolean).map((t) => `<span>${escapar(String(t))}</span>`)
    : [`<span>${escapar(p.detalle)}</span>`];
  return (
    `<div class="carro-tarjeta"><strong>${escapar(p.etiqueta)}</strong>${filas.join("")}` +
    `<div class="carro-avance" role="presentation"><i style="width:${pct}%"></i></div>` +
    `<span class="carro-pie">${pct} % del recorrido${p.llegada ? ` · llega ${escapar(p.llegada)}` : ""}</span></div>`
  );
}

/** Colombia continental, aproximado: descarta coordenadas de relleno (999...). */
export function coordenadaValida(lat: number | null | undefined, lon: number | null | undefined): boolean {
  return typeof lat === "number" && typeof lon === "number" && lat > -5 && lat < 14 && lon > -80 && lon < -66;
}

/**
 * Mapa con los vehiculos en camino.
 *
 * El sistema no recibe GPS: la posicion es ESTIMADA, en linea recta entre el
 * sitio de cargue y el de descargue, segun el tiempo transcurrido entre las
 * dos citas. Sirve para ver de un vistazo que viaje va por donde; la posicion
 * real la tiene la empresa de monitoreo.
 *
 * Leaflet maneja el mapa por su cuenta (no es un componente de React): se crea
 * una sola vez en un useEffect y en otro se redibujan los puntos cuando
 * cambian. El cleanup destruye el mapa al salir de la pantalla.
 */
export default function MapaSeguimiento({ puntos }: { puntos: PuntoMapa[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!contenedor.current) return;
    const m = L.map(contenedor.current, { zoomControl: true, attributionControl: true }).setView([4.6, -74.1], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap",
    }).addTo(m);
    capa.current = L.layerGroup().addTo(m);
    mapa.current = m;
    // Leaflet mide el contenedor al crearse; si el diseño aun se estaba
    // acomodando, quedan franjas grises. Se vuelve a medir cuando cambia de
    // tamaño (y una vez al montar).
    const observador = new ResizeObserver(() => m.invalidateSize());
    observador.observe(contenedor.current);
    return () => {
      observador.disconnect();
      m.remove();
      mapa.current = null;
      capa.current = null;
    };
  }, []);

  useEffect(() => {
    const m = mapa.current;
    const g = capa.current;
    if (!m || !g) return;
    g.clearLayers();
    const limites: L.LatLngExpression[] = [];

    for (const p of puntos) {
      const pos: [number, number] = [p.origen[0] + (p.destino[0] - p.origen[0]) * p.avance, p.origen[1] + (p.destino[1] - p.origen[1]) * p.avance];
      L.polyline([p.origen, p.destino], { color: "#94a3b8", weight: 2, dashArray: "4 6" }).addTo(g);
      L.circleMarker(p.destino, { radius: 4, color: "#64748b", weight: 2, fillColor: "#fff", fillOpacity: 1 }).addTo(g);
      // Violeta de SOFI (se ve en los dos modos), con un latido suave.
      L.circleMarker(pos, { radius: 8, color: "#fff", weight: 2, fillColor: "#af50ff", fillOpacity: 1, className: "marcador-carro" })
        .bindTooltip(tarjetaCarro(p), { direction: "top", className: "tooltip-carro", offset: [0, -6] })
        .addTo(g);
      limites.push(p.origen, p.destino);
    }
    if (limites.length > 0) m.fitBounds(L.latLngBounds(limites), { padding: [24, 24], maxZoom: 9 });
    else m.setView([4.6, -74.1], 5);
  }, [puntos]);

  return <div ref={contenedor} className="mapa-seguimiento" />;
}
