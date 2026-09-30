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
}

/** Colombia continental, aproximado: descarta coordenadas de relleno (999...). */
export function coordenadaValida(lat: number | null | undefined, lon: number | null | undefined): boolean {
  return (
    typeof lat === "number" && typeof lon === "number" &&
    lat > -5 && lat < 14 && lon > -80 && lon < -66
  );
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
      const pos: [number, number] = [
        p.origen[0] + (p.destino[0] - p.origen[0]) * p.avance,
        p.origen[1] + (p.destino[1] - p.origen[1]) * p.avance,
      ];
      L.polyline([p.origen, p.destino], { color: "#94a3b8", weight: 2, dashArray: "4 6" }).addTo(g);
      L.circleMarker(p.destino, { radius: 4, color: "#64748b", weight: 2, fillColor: "#fff", fillOpacity: 1 }).addTo(g);
      L.circleMarker(pos, { radius: 8, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 })
        .bindTooltip(`<strong>${p.etiqueta}</strong><br>${p.detalle}`, { direction: "top" })
        .addTo(g);
      limites.push(p.origen, p.destino);
    }
    if (limites.length > 0) m.fitBounds(L.latLngBounds(limites), { padding: [24, 24], maxZoom: 9 });
    else m.setView([4.6, -74.1], 5);
  }, [puntos]);

  return <div ref={contenedor} className="mapa-seguimiento" />;
}
