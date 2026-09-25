import { useState } from "react";
import { NavLink, Outlet, useLocation, useOutletContext } from "react-router-dom";
import { api } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import AlertasDocumentos from "./AlertasDocumentos";
import type { ResumenAlertas } from "../api/tipos";

const SECCIONES = [
  { ruta: "/dashboard", etiqueta: "Inicio", icono: "\u{1F3E0}" },
  { ruta: "/despacho", etiqueta: "Despachar", icono: "\u{1F69A}" },
  { ruta: "/plantillas", etiqueta: "Plantillas", icono: "\u{1F4CB}" },
  { ruta: "/catalogo", etiqueta: "Catalogo", icono: "\u{1F5C2}️" },
  { ruta: "/historial", etiqueta: "Historial", icono: "\u{1F552}" },
];

/** Lo que el marco comparte con las paginas (ver usarShell). */
export interface ContextoShell {
  alertas: ResumenAlertas | null;
  abrirAlertas: () => void;
  /**
   * Sube cada vez que se corrige un documento desde las alertas. Una pagina
   * que muestre esos datos lo pone en las dependencias de su useDatos para
   * volver a pedirlos.
   */
  versionDocumentos: number;
}

/**
 * Las paginas leen el contexto del marco con este gancho. Es el mecanismo de
 * React Router para pasar datos del layout a las rutas hijas sin props: el
 * Shell lo entrega en <Outlet context={...}> y la pagina lo recibe aqui.
 */
export function usarShell(): ContextoShell {
  return useOutletContext<ContextoShell>();
}

/**
 * Marco de la aplicacion: barra lateral, barra superior y el contenido que
 * cambia segun la ruta.
 *
 * Usa las mismas clases del CSS que ya existia (.app-shell, .sidebar,
 * .main-area, .topbar, .content) para no duplicar estilos.
 *
 * Las alertas de documentos se cargan aqui una sola vez: el boton de la barra
 * superior se ve en todas las pantallas y el Inicio reutiliza los mismos datos.
 */
export default function Shell() {
  const ubicacion = useLocation();
  const actual = SECCIONES.find((s) => ubicacion.pathname.startsWith(s.ruta));

  const alertas = useDatos(() => api.getAlertas(30), []);
  const [verAlertas, setVerAlertas] = useState(false);
  const [versionDocumentos, setVersionDocumentos] = useState(0);

  const vencidos = alertas.datos?.vencidos.length ?? 0;
  const porVencer = alertas.datos?.porVencer.length ?? 0;

  const contexto: ContextoShell = {
    alertas: alertas.datos,
    abrirAlertas: () => setVerAlertas(true),
    versionDocumentos,
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">TL</span>
          Transportes Lopez
        </div>
        <nav>
          {SECCIONES.map((s) => (
            <NavLink
              key={s.ruta}
              to={s.ruta}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              <span className="icon">{s.icono}</span>
              {s.etiqueta}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <h1>{actual?.etiqueta ?? "TMS"}</h1>
          <div className="actions">
            <button
              className={`boton-alertas ${vencidos > 0 ? "hay-vencidos" : porVencer > 0 ? "hay-por-vencer" : ""}`}
              onClick={() => setVerAlertas(true)}
              disabled={!alertas.datos}
              title="Documentos vencidos o por vencer"
            >
              <span aria-hidden>{"\u{1F514}"}</span>
              Documentos
              {vencidos > 0 && <span className="contador contador-vencidos">{vencidos} vencidos</span>}
              {porVencer > 0 && <span className="contador contador-por-vencer">{porVencer} por vencer</span>}
            </button>
          </div>
        </header>
        <div className="content">
          <Outlet context={contexto} />
        </div>
      </div>

      {verAlertas && alertas.datos && (
        <AlertasDocumentos
          resumen={alertas.datos}
          alCerrar={() => setVerAlertas(false)}
          alActualizar={() => {
            alertas.recargar();
            // Forma funcional: parte del valor mas reciente, no del de este render.
            setVersionDocumentos((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
