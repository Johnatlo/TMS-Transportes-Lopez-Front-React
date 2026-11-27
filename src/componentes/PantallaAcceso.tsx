/**
 * Marco de las pantallas sin sesion: tarjeta con logo y formulario a la
 * izquierda y video (de dia o de noche) a la derecha.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import logoDia from "../assets/logo-sofi.png";
import logoNoche from "../assets/logo-sofi-noche.png";
import videoDia from "../assets/acceso-dia.mp4";
import videoNoche from "../assets/acceso-noche.mp4";
import fotoDia from "../assets/acceso-dia.jpg";
import fotoNoche from "../assets/acceso-noche.jpg";
import { pintarAutomatico, useTema } from "../modoPantalla";

/**
 * Si se muestra el video: solo en pantallas anchas (en el celular la mitad de
 * la foto se oculta y asi no se gastan datos) y si el computador no pide
 * reducir el movimiento.
 */
function conVideo(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(min-width: 821px)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Marco de las pantallas sin sesion (login, recuperar contrasena y el cambio
 * obligatorio de la clave temporal).
 *
 * Una tarjeta centrada sobre una imagen del video (desenfocada, con degradado), partida en dos: a la izquierda
 * el logo de SOFI y el formulario que llegue como `children`; a la derecha un
 * video de un vehiculo en carretera, con el nombre del sistema encima.
 *
 * Siempre va en modo automatico: claro de dia y oscuro de noche (a las 5 a.m.
 * y a las 5 p.m., ver modoPantalla.ts). Con el modo cambian el logo y el video
 * (solo se descarga el que toca). Mientras carga se ve su primera imagen.
 *
 * En pantallas angostas la mitad del video se oculta y queda solo el formulario.
 */
export default function PantallaAcceso({ children }: { children: ReactNode }) {
  const { tema } = useTema();
  const [video] = useState(conVideo);
  useEffect(() => {
    pintarAutomatico();
  }, []);

  const noche = tema === "oscuro";
  const foto = noche ? fotoNoche : fotoDia;

  return (
    <div className="pantalla-acceso">
      <div className="tarjeta-dividida">
        <section className="acceso-formulario">
          <div className="acceso-contenido">
            <img className="acceso-logo" src={noche ? logoNoche : logoDia} alt="SOFI por Transportes López" />
            {children}
          </div>
        </section>
        <aside className="acceso-foto" aria-hidden="true">
          {video ? (
            // key: al pasar del dia a la noche se cambia el video completo.
            <video key={tema} className="acceso-video" src={noche ? videoNoche : videoDia} poster={foto} autoPlay muted loop playsInline preload="auto" />
          ) : (
            <img className="acceso-video" src={foto} alt="" />
          )}
          <div className="acceso-foto-texto">
            <h2>SOFI</h2>
            <p>
              Sistema de Operacion de Flota e Ingresos, por Transportes López: despachos, nomina, cuentas de los vehiculos y rentabilidad en un
              solo lugar.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
