/**
 * Marco de las pantallas sin sesion: tarjeta con logo y formulario a la
 * izquierda y foto a la derecha.
 */
import type { ReactNode } from "react";
import logo from "../assets/logo-empresa.png";

/**
 * Marco de las pantallas sin sesion (login, recuperar contrasena y el cambio
 * obligatorio de la clave temporal).
 *
 * Una tarjeta centrada sobre la foto de fondo, partida en dos: a la izquierda
 * el logo y el formulario que llegue como `children`; a la derecha una foto
 * con el nombre del sistema. Las dos fotos van en el CSS (.pantalla-acceso y
 * .acceso-foto), asi se cambian sin tocar el componente.
 *
 * En pantallas angostas la mitad de la foto se oculta y queda solo el formulario.
 */
export default function PantallaAcceso({ children }: { children: ReactNode }) {
  return (
    <div className="pantalla-acceso">
      <div className="tarjeta-dividida">
        <section className="acceso-formulario">
          <div className="acceso-contenido">
            <img className="acceso-logo" src={logo} alt="Transportes Lopez C S.A.S" />
            {children}
          </div>
        </section>
        <aside className="acceso-foto" aria-hidden="true">
          <div className="acceso-foto-texto">
            <h2>Despachos en regla, viaje a viaje</h2>
            <p>Remesas y manifiestos expedidos ante el RNDC, con el seguimiento de toda la flota en un solo lugar.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
