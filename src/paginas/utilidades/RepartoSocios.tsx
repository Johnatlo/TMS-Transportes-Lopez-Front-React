/**
 * Reparto a socios: como se reparte lo que dejaron los carros, mes a mes.
 * Lo que deja cada carro sale de Rentabilidad (su cascada).
 *
 * - Fondos y reparto: el fondo de cada vehiculo, lo que se reparte y lo que
 *   le toca a cada socio; aprobar el mes (ver FondosReparto.tsx).
 * - Participaciones: quien es dueno de cada vehiculo (sociedades).
 * - Socios: la cuenta de cada socio (saldo, netos de cada mes y pagos).
 * - Reporte por socio: lo de un socio en el mes (sus carros, su reparto y su
 *   cuenta) para mostrarselo o descargarlo en Excel (ver ReporteSocio.tsx).
 * Las administrativas solo ven las participaciones (el reparto es del area
 * REPARTO). Aprobar y cambiar fondos, participaciones y socios: rol total.
 */
import { useState } from "react";
import { apiUtilidades, hoyColombia } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { useSesion } from "../../ganchos/useSesion";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import { puede } from "../../permisos";
import FondosReparto from "./FondosReparto";
import Participaciones from "./Participaciones";
import ReporteSocio from "./ReporteSocio";
import Socios from "./Socios";
import { mesAnterior, nombreMes } from "./pasos";

type Vista = "reparto" | "reporte" | "participaciones" | "socios";

/** Pantalla del reparto a socios. */
export default function RepartoSocios() {
  const { usuario } = useSesion();
  const total = usuario?.rol === "TOTAL";
  const veReparto = puede(usuario?.rol, "REPARTO");
  const [mes, setMes] = useState(mesAnterior(hoyColombia().slice(0, 7)));
  const [vista, setVista] = useState<Vista>(veReparto ? "reparto" : "participaciones");
  // Al volver de Participaciones o Socios se recarga (pudo cambiar una participacion o aprobarse algo).
  const conMes = vista === "reparto" || vista === "reporte";
  const carga = useDatos(() => (conMes ? apiUtilidades.mes(mes) : Promise.resolve(null)), [mes, vista]);
  const meses: string[] = [];
  for (let m = hoyColombia().slice(0, 7), i = 0; i < 18; i++, m = mesAnterior(m)) meses.push(m);
  const vistas: Array<[Vista, string]> = [
    ...(veReparto ? [["reparto", "Fondos y reparto"] as [Vista, string], ["reporte", "Reporte por socio"] as [Vista, string]] : []),
    ["participaciones", "Participaciones"],
    ...(veReparto ? [["socios", "Socios"] as [Vista, string]] : []),
  ];

  return (
    <>
      <div className="barra-envio" style={{ marginBottom: "0.75rem" }}>
        {conMes && (
          <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
            {meses.map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>
        )}
        <div className="selector-vista" role="group" aria-label="Vista">
          {vistas.map(([id, etiqueta]) => (
            <button key={id} type="button" className={vista === id ? "activo" : ""} onClick={() => setVista(id)}>
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
      {vista === "socios" ? (
        <Socios editable={total} />
      ) : vista === "participaciones" ? (
        <Participaciones editable={total} />
      ) : carga.cargando && !carga.datos ? (
        <Cargando que="el reparto" />
      ) : carga.error || !carga.datos ? (
        <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />
      ) : vista === "reporte" ? (
        <ReporteSocio u={carga.datos} />
      ) : (
        <FondosReparto datos={carga.datos} total={total} alCambiar={carga.recargar} />
      )}
    </>
  );
}
