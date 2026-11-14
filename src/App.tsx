/**
 * Raiz de la aplicacion: sin sesion muestra el login; con clave temporal, el
 * cambio obligatorio de clave; con sesion, el marco (Shell) y las rutas de
 * cada pantalla, que se descargan al abrirlas por primera vez (React.lazy).
 */
import { lazy } from "react";
import type { ReactNode } from "react";
import { puedeRuta } from "./permisos";
import { Navigate, Route, Routes } from "react-router-dom";
import Shell from "./componentes/Shell";
import Login from "./paginas/Login";
import CambiarClave from "./componentes/CambiarClave";
import PantallaAcceso from "./componentes/PantallaAcceso";
import { Cargando } from "./componentes/Estado";
import { useSesion } from "./ganchos/useSesion";

// Cada pantalla se descarga al abrirla por primera vez, no toda la aplicacion
// al entrar: el inicio carga mas rapido (sobre todo en el celular). Shell
// muestra "Cargando" mientras llega (Suspense alrededor de su Outlet).
const Dashboard = lazy(() => import("./paginas/Dashboard"));
const Despacho = lazy(() => import("./paginas/Despacho"));
const Historial = lazy(() => import("./paginas/Historial"));
const CuadroCentral = lazy(() => import("./paginas/cuadro/CuadroCentral"));
const Anticipos = lazy(() => import("./paginas/cuadro/CuadroAnticipos"));
const Cartera = lazy(() => import("./paginas/seguimiento/Cartera"));
const PagoTerceros = lazy(() => import("./paginas/seguimiento/PagoTerceros"));
const Rentabilidad = lazy(() => import("./paginas/seguimiento/Rentabilidad"));
const Preoperacional = lazy(() => import("./paginas/preoperacional/Preoperacional"));
const Vehiculos = lazy(() => import("./paginas/vehiculos/Vehiculos"));
const PerfilVehiculo = lazy(() => import("./paginas/vehiculos/PerfilVehiculo"));
const Plantillas = lazy(() => import("./paginas/Plantillas"));
const Catalogo = lazy(() => import("./paginas/Catalogo"));
const Usuarios = lazy(() => import("./paginas/Usuarios"));

/** Deja ver la pantalla solo si el rol puede abrir esa ruta (si no, al inicio). */
function ConPermiso({ ruta, children }: { ruta: string; children: ReactNode }) {
  const { usuario } = useSesion();
  return puedeRuta(usuario?.rol, ruta) ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

/**
 * Clientes, Flota, Conductores y Configuracion son el mismo Catalogo con
 * distintas pestanas. La `key` distinta hace que React monte uno nuevo al
 * pasar de una seccion a otra: si no, reutilizaria el anterior y se quedaria
 * con su pestana y su busqueda.
 */
export default function App() {
  const { estado, usuario } = useSesion();

  // Sin sesion no se monta nada del sistema: ni el menu ni las pantallas.
  if (estado === "cargando") return <Cargando que="la sesion" />;
  if (estado === "anonimo") return <Login />;
  // Con clave temporal, lo primero es crear una propia.
  if (usuario?.debeCambiarClave) {
    return (
      <PantallaAcceso>
        <CambiarClave obligatorio />
      </PantallaAcceso>
    );
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <ConPermiso ruta="/dashboard">
              <Dashboard />
            </ConPermiso>
          }
        />
        <Route
          path="/despacho"
          element={
            <ConPermiso ruta="/despacho">
              <Despacho />
            </ConPermiso>
          }
        />
        <Route
          path="/historial"
          element={
            <ConPermiso ruta="/historial">
              <Historial />
            </ConPermiso>
          }
        />
        <Route
          path="/cuadro"
          element={
            <ConPermiso ruta="/cuadro">
              <CuadroCentral />
            </ConPermiso>
          }
        />
        <Route
          path="/anticipos"
          element={
            <ConPermiso ruta="/anticipos">
              <Anticipos />
            </ConPermiso>
          }
        />
        {/* Seguimiento de papeles ahora es una ventana del Cuadro pagos. */}
        <Route path="/papeles" element={<Navigate to="/cuadro?papeles=0" replace />} />
        <Route
          path="/cartera"
          element={
            <ConPermiso ruta="/cartera">
              <Cartera />
            </ConPermiso>
          }
        />
        <Route
          path="/terceros"
          element={
            <ConPermiso ruta="/terceros">
              <PagoTerceros />
            </ConPermiso>
          }
        />
        <Route
          path="/rentabilidad"
          element={
            <ConPermiso ruta="/rentabilidad">
              <Rentabilidad />
            </ConPermiso>
          }
        />
        <Route
          path="/preoperacional"
          element={
            <ConPermiso ruta="/preoperacional">
              <Preoperacional />
            </ConPermiso>
          }
        />
        <Route
          path="/vehiculos"
          element={
            <ConPermiso ruta="/vehiculos">
              <Vehiculos />
            </ConPermiso>
          }
        />
        <Route
          path="/vehiculos/:placa"
          element={
            <ConPermiso ruta="/vehiculos">
              <PerfilVehiculo />
            </ConPermiso>
          }
        />
        <Route
          path="/plantillas"
          element={
            <ConPermiso ruta="/plantillas">
              <Plantillas />
            </ConPermiso>
          }
        />
        <Route path="/clientes" element={<Catalogo key="clientes" pestanas={["terceros"]} />} />
        <Route path="/flota" element={<Catalogo key="flota" pestanas={["vehiculos", "remolques", "monitoreo"]} />} />
        <Route path="/conductores" element={<Catalogo key="conductores" pestanas={["conductores"]} />} />
        <Route
          path="/configuracion"
          element={
            <ConPermiso ruta="/configuracion">
              <Catalogo key="configuracion" pestanas={["empresa"]} />
            </ConPermiso>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ConPermiso ruta="/usuarios">
              <Usuarios />
            </ConPermiso>
          }
        />
        {/* La ruta vieja sigue funcionando. */}
        <Route path="/catalogo" element={<Navigate to="/flota" replace />} />
        {/* Lo que no existe vuelve al inicio. */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
