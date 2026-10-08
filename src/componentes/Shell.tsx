/**
 * Marco de la aplicacion con sesion: menu lateral, barra superior (alertas,
 * usuario) y el contenido de la pantalla actual.
 */
import { Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { api } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import AlertasDocumentos from "./AlertasDocumentos";
import CambiarClave from "./CambiarClave";
import Modal from "./Modal";
import { Cargando } from "./Estado";
import { useSesion } from "../ganchos/useSesion";
import {
  IconoCampana,
  IconoClientes,
  IconoConductores,
  IconoConfiguracion,
  IconoContraer,
  IconoDocumento,
  IconoFlota,
  IconoInicio,
  IconoCamion,
  IconoMas,
  IconoMenu,
  IconoPlantillas,
  IconoViajes,
  IconoUsuarios,
} from "./Iconos";
import type { ResumenAlertas } from "../api/tipos";
import logoPequeno from "../assets/logo-pequeno.png";

const SECCIONES: Array<{ ruta: string; etiqueta: string; icono: ReactNode }> = [
  { ruta: "/dashboard", etiqueta: "Inicio", icono: <IconoInicio /> },
  { ruta: "/despacho", etiqueta: "Despachar", icono: <IconoCamion /> },
  { ruta: "/historial", etiqueta: "Viajes", icono: <IconoViajes /> },
  { ruta: "/cuadro", etiqueta: "Cuadro pagos", icono: <IconoDocumento /> },
  { ruta: "/plantillas", etiqueta: "Plantillas", icono: <IconoPlantillas /> },
  { ruta: "/clientes", etiqueta: "Clientes", icono: <IconoClientes /> },
  { ruta: "/flota", etiqueta: "Flota", icono: <IconoFlota /> },
  { ruta: "/conductores", etiqueta: "Conductores", icono: <IconoConductores /> },
  { ruta: "/configuracion", etiqueta: "Configuracion", icono: <IconoConfiguracion /> },
  { ruta: "/usuarios", etiqueta: "Usuarios", icono: <IconoUsuarios /> },
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

/** Preferencia del menu contraido. Solo es comodidad: si falla, se ignora. */
function leerContraido(): boolean {
  try {
    return localStorage.getItem("menuContraido") === "1";
  } catch {
    return false;
  }
}

/**
 * Marco de la aplicacion, siguiendo el template de docs/template de ejemplo.png:
 * menu lateral claro con iconos, la empresa abajo y el boton para contraerlo;
 * barra superior con el titulo, "+" (nuevo despacho), la campana de alertas y
 * el avatar.
 *
 * Las alertas de documentos se cargan aqui una sola vez: la campana se ve en
 * todas las pantallas y el Inicio reutiliza los mismos datos.
 */
export default function Shell() {
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const actual = SECCIONES.find((s) => ubicacion.pathname.startsWith(s.ruta));

  const alertas = useDatos(() => api.getAlertas(30), []);
  const parametros = useDatos(() => api.getParametros(), []);
  const [verAlertas, setVerAlertas] = useState(false);
  const [versionDocumentos, setVersionDocumentos] = useState(0);
  const [contraido, setContraido] = useState(leerContraido);
  /**
   * En el celular el menu no ocupa espacio: se abre encima del contenido con
   * el boton de tres rayas. En el computador esto no se usa (ver estilos.css,
   * "Celular").
   */
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { usuario, salir } = useSesion();
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const iniciales = (usuario?.nombre ?? "TL")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  useEffect(() => {
    try {
      localStorage.setItem("menuContraido", contraido ? "1" : "0");
    } catch {
      /* sin almacenamiento: la preferencia simplemente no se recuerda */
    }
  }, [contraido]);

  // Al elegir una pantalla el menu del celular se cierra solo.
  useEffect(() => setMenuAbierto(false), [ubicacion.pathname]);

  const pendientes = (alertas.datos?.vencidos.length ?? 0) + (alertas.datos?.porVencer.length ?? 0);
  const nombreEmpresa = parametros.datos?.nombreEmpresa ?? "Transportes Lopez";

  const contexto: ContextoShell = {
    alertas: alertas.datos,
    abrirAlertas: () => setVerAlertas(true),
    versionDocumentos,
  };

  return (
    <div className={`app-shell ${contraido ? "menu-contraido" : ""}`}>
      {/* Fondo oscuro detras del menu abierto en el celular: tocarlo lo cierra. */}
      {menuAbierto && <div className="capa-menu" onClick={() => setMenuAbierto(false)} />}
      <aside className={`sidebar ${menuAbierto ? "abierto" : ""}`}>
        <div className="brand">
          <img className="brand-logo" src={logoPequeno} alt="" />
          <span className="solo-expandido">Transportes Lopez</span>
        </div>
        <nav>
          {SECCIONES.map((s) => (
            <NavLink
              key={s.ruta}
              to={s.ruta}
              title={s.etiqueta}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              <span className="icon">{s.icono}</span>
              <span className="solo-expandido">{s.etiqueta}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-pie">
          <div className="empresa-tarjeta" title={nombreEmpresa}>
            <img className="empresa-logo" src={logoPequeno} alt="" />
            <span className="solo-expandido">
              <span className="empresa-etiqueta">Empresa</span>
              <span className="empresa-nombre">{nombreEmpresa}</span>
            </span>
          </div>
          <button className="boton-contraer" onClick={() => setContraido(!contraido)}>
            <IconoContraer />
            <span className="solo-expandido">Contraer</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="boton-redondo boton-menu" title="Menu" aria-label="Abrir menu" onClick={() => setMenuAbierto(true)}>
            <IconoMenu />
          </button>
          <h1>
            {actual?.etiqueta ?? "TMS"}
            <span className="crumb"> · {nombreEmpresa}</span>
          </h1>
          <div className="actions">
            <button className="boton-redondo primario" title="Nuevo despacho" onClick={() => navegar("/despacho")}>
              <IconoMas />
            </button>
            <button
              className="boton-redondo"
              title="Documentos vencidos o por vencer"
              onClick={() => setVerAlertas(true)}
              disabled={!alertas.datos}
            >
              <IconoCampana />
              {pendientes > 0 && <span className="punto-contador">{pendientes > 99 ? "99+" : pendientes}</span>}
            </button>
            <div className="menu-usuario-contenedor">
              <button
                className="avatar-usuario"
                title={usuario ? `${usuario.nombre} (${usuario.email})` : ""}
                onClick={() => setMenuUsuario(!menuUsuario)}
              >
                {iniciales}
              </button>
              {menuUsuario && (
                <>
                  {/* Capa invisible: un clic fuera del menu lo cierra. */}
                  <div className="capa-cierre" onClick={() => setMenuUsuario(false)} />
                  <div className="menu-usuario">
                    <div className="menu-usuario-cabecera">
                      <strong>{usuario?.nombre}</strong>
                      <span>{usuario?.email}</span>
                    </div>
                    <button
                      onClick={() => {
                        setMenuUsuario(false);
                        setCambiandoClave(true);
                      }}
                    >
                      Cambiar contrasena
                    </button>
                    <button onClick={() => salir()}>Cerrar sesion</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <div className="content">
          {/* Las pantallas se cargan bajo demanda (ver App.tsx): el menu sigue visible. */}
          <Suspense fallback={<Cargando que="la pantalla" />}>
            <Outlet context={contexto} />
          </Suspense>
        </div>
      </div>

      {cambiandoClave && (
        <Modal titulo="Cambiar contrasena" alCerrar={() => setCambiandoClave(false)}>
          <CambiarClave alTerminar={() => setCambiandoClave(false)} />
        </Modal>
      )}

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
