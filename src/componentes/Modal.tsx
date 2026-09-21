import type { ReactNode } from "react";
import { Fragment, useEffect } from "react";

/**
 * Ventana modal. Equivale a modal.component de Angular y reutiliza sus mismas
 * clases de CSS (.modal-overlay, .modal-card, .stepper-header).
 *
 * `pasos` dibuja el indicador del asistente cuando la ventana tiene varios
 * pasos; si se omite, la ventana es simple.
 */
export default function Modal({
  titulo,
  ancho = "normal",
  pasos,
  pasoActual = 0,
  children,
  pie,
  alCerrar,
}: {
  titulo: string;
  ancho?: "normal" | "wide";
  pasos?: string[];
  pasoActual?: number;
  children: ReactNode;
  pie?: ReactNode;
  alCerrar: () => void;
}) {
  // Escape cierra la ventana: en el despacho nocturno se agradece no tener que
  // buscar el boton con el mouse.
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [alCerrar]);

  return (
    <div className="modal-overlay" onClick={alCerrar}>
      {/* Sin stopPropagation, hacer clic dentro del formulario cerraria la
          ventana y se perderia lo que se llevaba escrito. */}
      <div
        className={`modal-card ${ancho === "wide" ? "wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{titulo}</h2>
          <button className="modal-close" onClick={alCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>

        {pasos && pasos.length > 1 && (
          <div className="stepper-header">
            {pasos.map((p, i) => (
              <Fragment key={p}>
                <div
                  className={
                    i === pasoActual
                      ? "stepper-step active"
                      : i < pasoActual
                        ? "stepper-step done"
                        : "stepper-step"
                  }
                >
                  <span className="dot">{i < pasoActual ? "✓" : i + 1}</span>
                  <span>{p}</span>
                </div>
                {i < pasos.length - 1 && <div className="stepper-line" />}
              </Fragment>
            ))}
          </div>
        )}

        <div className="modal-body">{children}</div>

        {pie && <div className="modal-footer">{pie}</div>}
      </div>
    </div>
  );
}
