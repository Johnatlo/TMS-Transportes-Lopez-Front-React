import { Navigate, Route, Routes } from "react-router-dom";
import Shell from "./componentes/Shell";
import Dashboard from "./paginas/Dashboard";
import Despacho from "./paginas/Despacho";
import Plantillas from "./paginas/Plantillas";
import Catalogo from "./paginas/Catalogo";
import Historial from "./paginas/Historial";
import Usuarios from "./paginas/Usuarios";
import Login from "./paginas/Login";
import CambiarClave from "./componentes/CambiarClave";
import PantallaAcceso from "./componentes/PantallaAcceso";
import { Cargando } from "./componentes/Estado";
import { useSesion } from "./ganchos/useSesion";

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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/despacho" element={<Despacho />} />
        <Route path="/historial" element={<Historial />} />
        <Route path="/plantillas" element={<Plantillas />} />
        <Route path="/clientes" element={<Catalogo key="clientes" pestanas={["terceros"]} />} />
        <Route
          path="/flota"
          element={<Catalogo key="flota" pestanas={["vehiculos", "remolques", "monitoreo"]} />}
        />
        <Route path="/conductores" element={<Catalogo key="conductores" pestanas={["conductores"]} />} />
        <Route path="/configuracion" element={<Catalogo key="configuracion" pestanas={["empresa"]} />} />
        <Route path="/usuarios" element={<Usuarios />} />
        {/* La ruta vieja sigue funcionando. */}
        <Route path="/catalogo" element={<Navigate to="/flota" replace />} />
      </Route>
    </Routes>
  );
}
