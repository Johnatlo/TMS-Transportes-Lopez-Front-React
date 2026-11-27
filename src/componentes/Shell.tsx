/**
 * Marco de la aplicacion con sesion: menu lateral, barra superior (alertas,
 * usuario) y el contenido de la pantalla actual.
 */
import { Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { api, apiSeguimiento, auth } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import AlertasDocumentos from "./AlertasDocumentos";
import AlertasSeguimiento, { ETIQUETA_CORTA, TIPOS_ALERTA } from "./AlertasSeguimiento";
import CambiarClave from "./CambiarClave";
import Modal from "./Modal";
import { Cargando } from "./Estado";
import { useSesion } from "../ganchos/useSesion";
import { aplicarPreferencia, otroTema, useTema } from "../modoPantalla";
import type { PreferenciaTema } from "../modoPantalla";
import { NOMBRE_ROL, puedeRuta } from "../permisos";
import {
  IconoCampana,
  IconoClientes,
  IconoConductores,
  IconoCuentaViaje,
  IconoConfiguracion,
  IconoContraer,
  IconoDocumento,
  IconoFlota,
  IconoInicio,
  IconoCamion,
  IconoCartera,
  IconoGrafica,
  IconoCheck,
  IconoMenu,
  IconoBomba,
  IconoReloj,
  IconoPlantillas,
  IconoViajes,
  IconoUsuarios,
  IconoChevron,
  IconoLuna,
  IconoSol,
  IconoNomina,
  IconoRecibo,
  IconoTorta,
  IconoTransferencia,
  IconoVolante,
} from "./Iconos";
import type { ResumenAlertas } from "../api/tipos";
import type { TipoAlerta } from "../api/cliente";
import logoPequeno from "../assets/logo-pequeno.png";

/** Una opcion del menu. */
interface Seccion {
  ruta: string;
  etiqueta: string;
  icono: ReactNode;
}

/**
 * Menu lateral por grupos (cada opcion con su propio icono). Inicio va solo,
 * arriba; los demas grupos se pliegan y el de la pantalla actual se abre solo.
 */
const GRUPOS: Array<{ id: string; titulo: string | null; secciones: Seccion[] }> = [
  { id: "inicio", titulo: null, secciones: [{ ruta: "/dashboard", etiqueta: "Inicio", icono: <IconoInicio /> }] },
  {
    id: "operacion",
    titulo: "Operacion",
    secciones: [
      { ruta: "/despacho", etiqueta: "Despachar", icono: <IconoCamion /> },
      { ruta: "/historial", etiqueta: "RNDC", icono: <IconoViajes /> },
      { ruta: "/plantillas", etiqueta: "Plantillas", icono: <IconoPlantillas /> },
    ],
  },
  {
    id: "flotaPropia",
    titulo: "Flota propia",
    secciones: [
      { ruta: "/vehiculos", etiqueta: "Vehiculos", icono: <IconoVolante /> },
      { ruta: "/preoperacional", etiqueta: "Preoperacional", icono: <IconoCheck /> },
    ],
  },
  {
    id: "cobros",
    titulo: "Cobros y pagos",
    secciones: [
      { ruta: "/cuadro", etiqueta: "Cuadro pagos", icono: <IconoDocumento /> },
      { ruta: "/anticipos", etiqueta: "Anticipos", icono: <IconoBomba /> },
      { ruta: "/cartera", etiqueta: "Cartera", icono: <IconoCartera /> },
      { ruta: "/terceros", etiqueta: "Pago a terceros", icono: <IconoTransferencia /> },
    ],
  },
  {
    id: "finanzas",
    titulo: "Finanzas",
    secciones: [
      { ruta: "/liquidacion-viajes", etiqueta: "Liquidacion de viajes", icono: <IconoDocumento /> },
      { ruta: "/gastos", etiqueta: "Gastos", icono: <IconoRecibo /> },
      { ruta: "/nomina", etiqueta: "Nomina", icono: <IconoNomina /> },
      { ruta: "/cuentas-conductores", etiqueta: "Cuentas conductores", icono: <IconoCuentaViaje /> },
      { ruta: "/rentabilidad", etiqueta: "Rentabilidad", icono: <IconoGrafica /> },
      { ruta: "/reparto", etiqueta: "Reparto a socios", icono: <IconoTorta /> },
    ],
  },
  {
    id: "catalogos",
    titulo: "Catalogos",
    secciones: [
      { ruta: "/clientes", etiqueta: "Clientes", icono: <IconoClientes /> },
      { ruta: "/flota", etiqueta: "Flota", icono: <IconoFlota /> },
      { ruta: "/conductores", etiqueta: "Conductores", icono: <IconoConductores /> },
    ],
  },
  {
    id: "administracion",
    titulo: "Administracion",
    secciones: [
      { ruta: "/configuracion", etiqueta: "Configuracion", icono: <IconoConfiguracion /> },
      { ruta: "/usuarios", etiqueta: "Usuarios y roles", icono: <IconoUsuarios /> },
      { ruta: "/control-interno", etiqueta: "Control interno", icono: <IconoCheck /> },
    ],
  },
];
const SECCIONES: Seccion[] = GRUPOS.flatMap((g) => g.secciones);

/** Grupos del menu que el usuario dejo plegados. Solo es comodidad: si falla, se ignora. */
function leerPlegados(): string[] {
  try {
    return JSON.parse(localStorage.getItem("menuGruposPlegados") ?? "[]");
  } catch {
    return [];
  }
}

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
  /** Vuelve a pedir las alertas de seguimiento (tras registrar papeles, facturar o cobrar). */
  recargarSeguimiento: () => void;
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
  // Alertas de papeles, facturacion y cartera: se refrescan cada 5 minutos.
  const seguimiento = useDatos(() => apiSeguimiento.alertas(), []);
  /** Panel de seguimiento abierto: true = en el primer grupo con algo; un tipo = en ese grupo. */
  const [verSeguimiento, setVerSeguimiento] = useState<TipoAlerta | boolean>(false);
  const recargarSeguimiento = seguimiento.recargar;
  useEffect(() => {
    const reloj = window.setInterval(recargarSeguimiento, 5 * 60_000);
    return () => window.clearInterval(reloj);
  }, [recargarSeguimiento]);
  const [versionDocumentos, setVersionDocumentos] = useState(0);
  const [contraido, setContraido] = useState(leerContraido);
  const [plegados, setPlegados] = useState<string[]>(leerPlegados);
  /** Pliega o despliega un grupo del menu (y lo recuerda en este navegador). */
  const alternarGrupo = (id: string) => {
    const nuevos = plegados.includes(id) ? plegados.filter((x) => x !== id) : [...plegados, id];
    setPlegados(nuevos);
    try {
      localStorage.setItem("menuGruposPlegados", JSON.stringify(nuevos));
    } catch {
      // Sin almacenamiento: el menu igual funciona.
    }
  };
  /**
   * En el celular el menu no ocupa espacio: se abre encima del contenido con
   * el boton de tres rayas. En el computador esto no se usa (ver estilos.css,
   * "Celular").
   */
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { usuario, salir, actualizarUsuario } = useSesion();
  const { tema, preferencia } = useTema();
  /** Cambia el modo al instante y lo guarda en el usuario. */
  const elegirTema = (nuevo: PreferenciaTema) => {
    aplicarPreferencia(nuevo);
    auth
      .guardarTema(nuevo)
      .then(actualizarUsuario)
      .catch(() => {
        // Sin conexion: queda en este navegador y se guarda la proxima vez.
      });
  };
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
    recargarSeguimiento,
  };
  const urgentesSeguimiento = seguimiento.datos?.urgentes ?? 0;
  /** Alertas de cada tipo: un boton aparte para cada uno (antes un solo reloj con "+99"). */
  const porTipo = (t: TipoAlerta) => seguimiento.datos?.alertas.filter((a) => a.tipo === t) ?? [];

  return (
    <div className={`app-shell ${contraido ? "menu-contraido" : ""}`}>
      {/* Fondo oscuro detras del menu abierto en el celular: tocarlo lo cierra. */}
      {menuAbierto && <div className="capa-menu" onClick={() => setMenuAbierto(false)} />}
      <aside className={`sidebar ${menuAbierto ? "abierto" : ""}`}>
        <div className="brand">
          <img className="brand-logo" src={logoPequeno} alt="" />
          <span className="solo-expandido marca-sofi">
            <strong>SOFI</strong>
            <span>por Transportes López</span>
          </span>
        </div>
        <nav>
          {GRUPOS.map((g) => {
            const visibles = g.secciones.filter((s) => puedeRuta(usuario?.rol, s.ruta));
            if (!visibles.length) return null;
            // El grupo de la pantalla actual siempre abierto.
            const tieneActual = visibles.some((s) => ubicacion.pathname.startsWith(s.ruta));
            const abierto = !g.titulo || tieneActual || !plegados.includes(g.id);
            return (
              <div key={g.id} className="menu-grupo">
                {g.titulo && (
                  <button type="button" className="menu-grupo-titulo" onClick={() => alternarGrupo(g.id)} aria-expanded={abierto}>
                    <span className="solo-expandido">{g.titulo}</span>
                    <span className="solo-expandido">
                      <IconoChevron abierto={abierto} />
                    </span>
                  </button>
                )}
                {(abierto || contraido) &&
                  visibles.map((s) => (
                    <NavLink key={s.ruta} to={s.ruta} title={s.etiqueta} className={({ isActive }) => (isActive ? "active" : undefined)}>
                      <span className="icon">{s.icono}</span>
                      <span className="solo-expandido">{s.etiqueta}</span>
                    </NavLink>
                  ))}
              </div>
            );
          })}
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
            {actual?.etiqueta ?? "SOFI"}
            <span className="crumb"> · {nombreEmpresa}</span>
          </h1>
          <div className="actions">
            <button className="btn-primary boton-con-texto" onClick={() => navegar("/despacho")}>
              Nuevo despacho
            </button>
            <button
              className="boton-redondo"
              title={`Seguimiento: papeles, facturacion y cartera${urgentesSeguimiento ? ` (${urgentesSeguimiento} urgentes)` : ""}`}
              onClick={() => setVerSeguimiento(true)}
              disabled={!seguimiento.datos}
            >
              <IconoReloj />
            </button>
            {/* Un boton por tipo de alerta, con su numero; rojo si tiene algo urgente. */}
            <div className="alertas-tipos">
              {TIPOS_ALERTA.map((t) => {
                const lista = porTipo(t);
                if (lista.length === 0) return null;
                const urgentes = lista.filter((a) => a.nivel === "urgente").length;
                return (
                  <button
                    key={t}
                    className={`chip-alerta ${urgentes ? "urgente" : ""}`}
                    title={`${ETIQUETA_CORTA[t]}: ${lista.length} alerta(s)${urgentes ? `, ${urgentes} urgente(s)` : ""}`}
                    onClick={() => setVerSeguimiento(t)}
                  >
                    {ETIQUETA_CORTA[t]}
                    <span className="chip-contador">{lista.length > 99 ? "99+" : lista.length}</span>
                  </button>
                );
              })}
            </div>
            <button
              className="boton-redondo"
              title={tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              onClick={() => elegirTema(otroTema(tema))}
            >
              {tema === "oscuro" ? <IconoSol /> : <IconoLuna />}
            </button>
            <button className="boton-redondo" title="Documentos vencidos o por vencer" onClick={() => setVerAlertas(true)} disabled={!alertas.datos}>
              <IconoCampana />
              {pendientes > 0 && <span className="punto-contador">{pendientes > 99 ? "99+" : pendientes}</span>}
            </button>
            <div className="menu-usuario-contenedor">
              <button className="avatar-usuario" title={usuario ? `${usuario.nombre} (${usuario.email})` : ""} onClick={() => setMenuUsuario(!menuUsuario)}>
                {iniciales}
              </button>
              {menuUsuario && (
                <>
                  {/* Capa invisible: un clic fuera del menu lo cierra. */}
                  <div className="capa-cierre" onClick={() => setMenuUsuario(false)} />
                  <div className="menu-usuario">
                    <div className="menu-usuario-cabecera">
                      <strong>{usuario?.nombre}</strong>
                      {usuario && <span className="dato-sec">{NOMBRE_ROL[usuario.rol] ?? usuario.rol}</span>}
                      <span>{usuario?.email}</span>
                    </div>
                    <button
                      onClick={() => {
                        setMenuUsuario(false);
                        setCambiandoClave(true);
                      }}
                    >
                      Cambiar contraseña
                    </button>
                    {preferencia !== "auto" && (
                      <button
                        onClick={() => {
                          setMenuUsuario(false);
                          elegirTema("auto");
                        }}
                        title="Claro de 5 a.m. a 5 p.m. y oscuro de noche"
                      >
                        Modo automatico (dia / noche)
                      </button>
                    )}
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
        <Modal titulo="Cambiar contraseña" alCerrar={() => setCambiandoClave(false)}>
          <CambiarClave alTerminar={() => setCambiandoClave(false)} />
        </Modal>
      )}

      {verSeguimiento && seguimiento.datos && (
        <AlertasSeguimiento
          resumen={seguimiento.datos}
          grupoInicial={typeof verSeguimiento === "string" ? verSeguimiento : undefined}
          alCerrar={() => setVerSeguimiento(false)}
          alCambiar={seguimiento.recargar}
        />
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
