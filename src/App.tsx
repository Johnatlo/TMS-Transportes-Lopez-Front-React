import { Navigate, Route, Routes } from "react-router-dom";
import Shell from "./componentes/Shell";
import Dashboard from "./paginas/Dashboard";
import Despacho from "./paginas/Despacho";
import Plantillas from "./paginas/Plantillas";
import Catalogo from "./paginas/Catalogo";
import Historial from "./paginas/Historial";

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/despacho" element={<Despacho />} />
        <Route path="/plantillas" element={<Plantillas />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/historial" element={<Historial />} />
      </Route>
    </Routes>
  );
}
