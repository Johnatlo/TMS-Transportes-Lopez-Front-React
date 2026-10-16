/**
 * Arranque de React: monta App dentro del enrutador (BrowserRouter) y del
 * proveedor de sesion, y carga los estilos globales.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ProveedorSesion } from "./ganchos/useSesion";
import "./estilos.css";
// Despues de estilos.css: redefine colores y fuentes (GUIA-UI.md).
import "./tema.css";

/**
 * La rueda del mouse sobre un campo numerico con el cursor adentro le sube o
 * le baja el valor sin que nadie lo note (un peso o un flete mal digitado).
 * Se le quita el foco antes de que el navegador cambie el numero: el valor
 * queda igual y la rueda sigue desplazando la pagina. Aplica a todos los
 * <input type="number"> de la aplicacion.
 */
document.addEventListener(
  "wheel",
  (e) => {
    const campo = e.target;
    if (campo instanceof HTMLInputElement && campo.type === "number" && campo === document.activeElement) campo.blur();
  },
  { passive: true, capture: true }
);

/**
 * Cuando aparece un aviso verde (.alert.success, "quedo guardado") o cambia
 * su texto, la pantalla se mueve hasta el si no se esta viendo: antes habia
 * que subir para saber si el guardado salio bien. Sirve en todas las paginas
 * y dentro de las ventanas (scrollIntoView mueve el recuadro que se desplaza).
 * "nearest" no mueve nada si el aviso ya esta a la vista.
 */
new MutationObserver((cambios) => {
  for (const cambio of cambios) {
    for (const nodo of cambio.addedNodes) {
      const elemento = nodo instanceof Element ? nodo : nodo.parentElement;
      const aviso = elemento?.closest(".alert.success") ?? elemento?.querySelector(".alert.success");
      if (aviso) {
        aviso.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
    }
  }
}).observe(document.body, { childList: true, subtree: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </BrowserRouter>
  </React.StrictMode>
);
