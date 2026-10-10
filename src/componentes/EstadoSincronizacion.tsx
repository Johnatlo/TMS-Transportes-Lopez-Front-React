/**
 * Barra con el estado de la sincronizacion automatica con el RNDC: cuando
 * corrio por ultima vez, que trajo (manifiestos del portal, cumplidos,
 * anulaciones) y un boton para sincronizar ya sin esperar la siguiente vuelta.
 */
import { useState } from "react";
import { api, fechaHora } from "../api/cliente";
import type { ResumenSincronizacion } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";

/** "hace 3 min", "hace 2 h"... desde una fecha ISO. */
function hace(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `el ${fechaHora(iso)}`;
}

/** Frase con lo que cambio en la ultima sincronizacion, o null si no cambio nada. */
export function textoResumen(r: ResumenSincronizacion | null): string | null {
  if (!r) return null;
  const partes = [
    [r.manifiestosNuevos.length, "manifiesto(s) del portal"],
    [r.adoptados.length, "viaje(s) con error que ya estaban en el RNDC"],
    [r.cumplidos.length, "manifiesto(s) cumplido(s)"],
    [r.remesasCumplidas.length, "remesa(s) cumplida(s)"],
    [r.anulados.length, "manifiesto(s) anulado(s)"],
    [r.remesasAnuladas.length, "remesa(s) anulada(s)"],
  ] as const;
  const hubo = partes.filter(([n]) => n > 0).map(([n, que]) => `${n} ${que}`);
  return hubo.length ? `Trajo: ${hubo.join(", ")}.` : null;
}

/**
 * Estado de la sincronizacion. `alSincronizar` se llama despues de una
 * sincronizacion manual, para recargar la lista de la pantalla.
 */
export default function EstadoSincronizacion({ alSincronizar }: { alSincronizar: () => void }) {
  const estado = useDatos(() => api.getSincronizacion(), []);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e = estado.datos;
  if (!e) return null;
  if (!e.activa) {
    return <div className="barra-sincronizacion dato-sec">Sincronizacion con el RNDC desactivada (modo simulacion).</div>;
  }

  async function sincronizar() {
    setEnviando(true);
    setError(null);
    try {
      await api.sincronizarRndc();
      estado.recargar();
      alSincronizar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo sincronizar.");
    } finally {
      setEnviando(false);
    }
  }

  const resumen = textoResumen(e.resumen);
  return (
    <div className="barra-sincronizacion">
      <span>
        <strong>Sincronizado con el RNDC</strong>{" "}
        {e.ultimaEjecucion ? hace(e.ultimaEjecucion) : "todavia no"} · se revisa solo cada {e.cadaMinutos} min
        {resumen && <span className="dato-sec">{resumen}</span>}
        {e.resumen?.conflictos.map((c) => (
          <span key={c} className="dato-sec texto-vencido">{c}</span>
        ))}
        {(error || e.error) && <span className="dato-sec texto-vencido">Ultimo error: {error ?? e.error}</span>}
      </span>
      <button type="button" className="boton-barra" onClick={sincronizar} disabled={enviando || e.corriendo}>
        {enviando || e.corriendo ? "Sincronizando..." : "Sincronizar ahora"}
      </button>
    </div>
  );
}
