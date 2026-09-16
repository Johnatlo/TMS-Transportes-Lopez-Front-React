import { NavLink, Outlet, useLocation } from "react-router-dom";

const SECCIONES = [
  { ruta: "/dashboard", etiqueta: "Inicio", icono: "\u{1F3E0}" },
  { ruta: "/despacho", etiqueta: "Despachar", icono: "\u{1F69A}" },
  { ruta: "/plantillas", etiqueta: "Plantillas", icono: "\u{1F4CB}" },
  { ruta: "/catalogo", etiqueta: "Catalogo", icono: "\u{1F5C2}\uFE0F" },
  { ruta: "/historial", etiqueta: "Historial", icono: "\u{1F552}" },
];

/**
 * Marco de la aplicacion: barra lateral, barra superior y el contenido que
 * cambia segun la ruta.
 *
 * Usa las mismas clases del CSS que ya existia (.app-shell, .sidebar,
 * .main-area, .topbar, .content) para no duplicar estilos.
 */
export default function Shell() {
  const ubicacion = useLocation();
  const actual = SECCIONES.find((s) => ubicacion.pathname.startsWith(s.ruta));

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
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
