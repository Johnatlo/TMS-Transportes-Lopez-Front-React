/**
 * Vehiculos de los socios y la flota propia (no los terceros), en tarjetas:
 * la foto frontal del camion segun su marca (todas del mismo tamano), sus datos principales y, al
 * abrirla, el resumen (viajes, documentos, ultimo preoperacional) con el
 * enlace a su perfil.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiVehiculos } from "../../api/cliente";
import type { PerfilVehiculo } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import { Pastilla } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "../cuadro/estadosCuadro";
import { CamionFrente } from "./VisorCamion";
import { esquemaCamion, tipoDe } from "./esquemaCamion";

/** Vencido, por vencer (30 dias) o al dia. */
export function estadoVencimiento(fecha: string | null): {
  tono: "error" | "aviso" | "ok" | "neutro";
  texto: string;
} {
  if (!fecha) return { tono: "neutro", texto: "Sin dato" };
  const hoy = hoyColombia();
  if (fecha < hoy) return { tono: "error", texto: `Vencio ${fechaCorta(fecha)}` };
  const en30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  return { tono: fecha <= en30 ? "aviso" : "ok", texto: fechaCorta(fecha) };
}

/** Kilos a toneladas ("34 t"). */
const toneladas = (kg: number | null) => (kg === null ? "-" : `${(kg / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} t`);

/** Pagina de la lista de vehiculos. */
export default function Vehiculos() {
  const datos = useDatos(() => apiVehiculos.perfiles(), []);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [buscar, setBuscar] = useState("");

  if (datos.cargando && !datos.datos) return <Cargando que="los vehiculos" />;
  if (datos.error || !datos.datos) return <ErrorCarga mensaje={datos.error ?? "Sin datos"} alReintentar={datos.recargar} />;

  const q = buscar.trim().toUpperCase();
  const lista = datos.datos.filter(
    (v) => !q || [v.placa, v.grupo, v.marca ?? "", v.conductorHabitual ?? ""].some((t) => t.toUpperCase().replace(/-/g, "").includes(q.replace(/-/g, ""))),
  );

  return (
    <>
      <div className="barra-envio" style={{ marginBottom: "0.75rem" }}>
        <input placeholder="Buscar placa, grupo, marca o conductor..." value={buscar} onChange={(e) => setBuscar(e.target.value)} style={{ maxWidth: 360 }} />
        <span className="dato-sec">{lista.length} vehiculo(s) de los socios y la flota propia. Abre uno para ver su resumen y su perfil.</span>
      </div>
      <div className="lista-vehiculos">
        {lista.map((v) => (
          <TarjetaVehiculo key={v.id} v={v} abierta={abierta === v.id} alAlternar={() => setAbierta(abierta === v.id ? null : v.id)} />
        ))}
        {!lista.length && <div className="dato-sec">Ningun vehiculo coincide.</div>}
      </div>
    </>
  );
}

/** Tarjeta de un vehiculo: dibujo, datos principales y, abierta, el resumen. */
function TarjetaVehiculo({ v, abierta, alAlternar }: { v: PerfilVehiculo; abierta: boolean; alAlternar: () => void }) {
  const soat = estadoVencimiento(v.vencSoat);
  const tecno = estadoVencimiento(v.vencTecno);
  const preop = v.ultimoPreoperacional;
  const alerta = soat.tono === "error" || tecno.tono === "error" || (preop && !preop.aprobo);
  return (
    <div className={`tarjeta-vehiculo${abierta ? " abierta" : ""}`}>
      <div className="tarjeta-vehiculo-cabeza" onClick={alAlternar} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && alAlternar()}>
        <div className="tarjeta-vehiculo-dibujo">
          <CamionFrente marca={v.marca} />
          {alerta && (
            <span className="tarjeta-vehiculo-alerta">
              <Pastilla tono="error">Revisar</Pastilla>
            </span>
          )}
        </div>
        <div className="tarjeta-vehiculo-datos">
          <strong>{v.placa}</strong>
          <span className="dato-sec">
            {v.marca ?? "Sin marca"} · {tipoDe(v.configuracion)} ({v.configuracion ?? "?"})
          </span>
          <span className="dato-sec">
            {v.grupo} · {esquemaCamion(v.configuracion).llantas} llantas · {toneladas(v.capacidadKg)}
          </span>
        </div>
        <span className={`tarjeta-vehiculo-boton${abierta ? " abierta" : ""}`} aria-hidden>
          {abierta ? "−" : "+"}
        </span>
      </div>
      {abierta && (
        <div className="tarjeta-vehiculo-detalle">
          <dl className="resumen-vehiculo">
            <div>
              <dt>Conductor habitual</dt>
              <dd>{v.conductorHabitual ?? "-"}</dd>
            </div>
            <div>
              <dt>Viajes (30 dias)</dt>
              <dd>{v.viajes30Dias}</dd>
            </div>
            <div>
              <dt>SOAT</dt>
              <dd>
                <Pastilla tono={soat.tono}>{soat.texto}</Pastilla>
              </dd>
            </div>
            <div>
              <dt>Tecnomecanica</dt>
              <dd>
                <Pastilla tono={tecno.tono}>{tecno.texto}</Pastilla>
              </dd>
            </div>
            <div>
              <dt>Ultimo preoperacional</dt>
              <dd>{preop ? `${fechaCorta(preop.fecha)} · ${preop.aprobo ? "aprobo" : "no aprobo"}` : "Sin inspecciones"}</dd>
            </div>
            <div>
              <dt>Ultimo viaje</dt>
              <dd>{v.ultimosViajes[0] ? `${fechaCorta(v.ultimosViajes[0].fecha)} · ${v.ultimosViajes[0].empresa}` : "-"}</dd>
            </div>
          </dl>
          <Link
            className="btn-primary boton-con-texto"
            style={{ justifySelf: "start", textDecoration: "none" }}
            to={`/vehiculos/${encodeURIComponent(v.placa)}`}
          >
            Ver perfil del vehiculo
          </Link>
        </div>
      )}
    </div>
  );
}
