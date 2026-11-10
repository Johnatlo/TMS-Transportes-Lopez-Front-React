/**
 * Imagenes del camion:
 * - CamionFrente: la foto frontal de la marca para las tarjetas y la cabeza
 *   del perfil (la mula de mantenimiento para las marcas sin foto).
 * - VisorMantenimiento: el camion de la marca que se gira arrastrando (o con
 *   las flechas) entre izquierda, frente y derecha; mientras se arrastra se
 *   inclina en 3D. Sus partes se iluminan al pasar el mouse o por grupo, se
 *   eligen con clic y se marcan en rojo si tuvieron novedad en el ultimo
 *   preoperacional.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as EventoPuntero } from "react";
import type { Esquema, GrupoParte, Parte } from "./esquemaCamion";
import { estadoParte } from "./esquemaCamion";
import { imagenesDe, parteDeZona, vistasDe } from "./vistasMantenimiento";

/** Foto frontal del camion segun su marca. */
export function CamionFrente({ marca }: { marca: string | null }) {
  return <img className="camion-frente" src={imagenesDe(marca).frente.src} alt={marca ?? "Camion"} draggable={false} />;
}

/** Lo que el visor necesita de la pagina. */
interface PropsVisor {
  marca: string | null;
  configuracion: string | null;
  esquema: Esquema;
  respuestas: Record<string, string> | null;
  grupo: GrupoParte | null;
  elegida: string | null;
  alElegir: (p: Parte | null) => void;
}

const UMBRAL = 50;
/** Lo maximo que se agranda una imagen (las pequenas se verian borrosas). */
const ESCALA_MAX = 2.2;
/** La vista con la que abre: el frente. */
const FRENTE = 1;

/** El camion de la marca, girable entre izquierda, frente y derecha, con sus partes. */
export function VisorMantenimiento({ marca, configuracion, esquema, respuestas, grupo, elegida, alElegir }: PropsVisor) {
  const vistas = useMemo(() => vistasDe(marca), [marca]);
  const [indice, setIndice] = useState(FRENTE);
  const [entrada, setEntrada] = useState<"der" | "izq" | null>(null);
  const [arrastre, setArrastre] = useState<number | null>(null);
  const [encima, setEncima] = useState<Parte | null>(null);
  const [tamano, setTamano] = useState({ w: 800, h: 460 });
  const escenario = useRef<HTMLDivElement>(null);
  const movido = useRef(false);
  const vista = vistas[indice];

  useEffect(() => {
    const div = escenario.current;
    if (!div) return;
    const obs = new ResizeObserver(() => setTamano({ w: div.clientWidth, h: div.clientHeight }));
    obs.observe(div);
    return () => obs.disconnect();
  }, []);

  /** Va a una vista (sin pasarse de los extremos) y la hace entrar girando desde el lado que corresponde. */
  const irA = (i: number) => {
    const destino = Math.max(0, Math.min(vistas.length - 1, i));
    if (destino === indice) return;
    setEntrada(destino > indice ? "der" : "izq");
    setIndice(destino);
  };

  /** Arrastrar a los lados: inclina la imagen y, al soltar, gira si paso del umbral. */
  const alBajar = (e: EventoPuntero<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    movido.current = false;
    const mover = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 5) movido.current = true;
      if (movido.current) setArrastre(ev.clientX - x0);
    };
    const soltar = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      const dx = ev.clientX - x0;
      setArrastre(null);
      if (Math.abs(dx) > UMBRAL) irA(indice + (dx < 0 ? 1 : -1));
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };
  /** Flechas del teclado. */
  const alTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") irA(indice + 1);
    else if (e.key === "ArrowLeft") irA(indice - 1);
    else return;
    e.preventDefault();
  };

  const escala = Math.min(tamano.w / vista.ancho, (tamano.h - 8) / vista.alto, ESCALA_MAX);
  const inclinar = arrastre === null ? undefined : `rotateY(${Math.max(-35, Math.min(35, arrastre * 0.2))}deg)`;

  return (
    <div className="visor-mula">
      <div
        ref={escenario}
        className={`visor-mula-escenario${arrastre !== null ? " arrastrando" : ""}`}
        onPointerDown={alBajar}
        onKeyDown={alTecla}
        tabIndex={0}
        aria-label="Camion: arrastra a los lados o usa las flechas para girarlo"
      >
        <div
          key={vista.id}
          className={`visor-mula-lamina${entrada ? ` entra-${entrada}` : ""}`}
          style={{ width: vista.ancho * escala, height: vista.alto * escala, transform: inclinar }}
        >
          <img
            src={vista.src}
            alt={vista.nombre}
            draggable={false}
            className={[vista.espejo ? "espejo" : "", vista.papel ? "papel" : ""].join(" ").trim() || undefined}
          />
          {vista.zonas.map((z, i) => {
            const id = parteDeZona(z.parte, configuracion);
            const p = id ? esquema.partes.find((x) => x.id === id) : undefined;
            if (!p) return null;
            const estado = estadoParte(p, respuestas);
            const clase = `zona-parte estado-${estado}${grupo === p.grupo ? " iluminada" : ""}${elegida === p.id ? " elegida" : ""}${encima?.id === p.id ? " encima" : ""}`;
            return (
              <button
                key={`${p.id}-${i}`}
                type="button"
                className={clase}
                style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%` }}
                title={p.nombre}
                aria-label={p.nombre}
                onMouseEnter={() => setEncima(p)}
                onMouseLeave={() => setEncima(null)}
                onClick={() => !movido.current && alElegir(p)}
              />
            );
          })}
        </div>
        <button type="button" className="visor-mula-flecha izquierda" onClick={() => irA(indice - 1)} disabled={indice === 0} aria-label="Girar a la izquierda">
          ‹
        </button>
        <button
          type="button"
          className="visor-mula-flecha derecha"
          onClick={() => irA(indice + 1)}
          disabled={indice === vistas.length - 1}
          aria-label="Girar a la derecha"
        >
          ›
        </button>
      </div>
      <div className="visor-mula-pie">
        <div className="visor-mula-vistas">
          {vistas.map((v, i) => (
            <button key={v.id} type="button" className={i === indice ? "activo" : ""} onClick={() => irA(i)}>
              {v.nombre}
            </button>
          ))}
        </div>
        <span className="visor-mula-ayuda">{encima ? encima.nombre : "Arrastra a los lados para girarlo; clic en una parte para ver su informacion"}</span>
      </div>
    </div>
  );
}
