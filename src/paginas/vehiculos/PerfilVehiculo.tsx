/**
 * Perfil de un vehiculo: su costado y el camion de su marca, que se gira
 * (izquierda, frente, derecha) y deja elegir sus partes en la imagen o en la
 * lista (las del remolque y las que no se ven, como los ejes) para ver lo que
 * dijo de cada una el ultimo preoperacional. Alrededor: datos, documentos y
 * vencimientos, equipo y botiquin, ultimo mantenimiento y los ultimos viajes.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiVehiculos } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import { Pastilla } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { PREGUNTAS } from "../preoperacional/preguntasPreoperacional";
import { CamionFrente, VisorMantenimiento } from "./VisorCamion";
import { esquemaCamion, estadoParte, GRUPOS, nombreCorto, tipoDe } from "./esquemaCamion";
import type { GrupoParte, Parte } from "./esquemaCamion";
import { estadoVencimiento } from "./Vehiculos";

const TEXTO_ESTADO = {
  ok: "Sin novedad en el ultimo preoperacional",
  novedad: "Con novedad en el ultimo preoperacional",
  sinDato: "Sin dato",
};
const TONO_ESTADO = { ok: "ok", novedad: "error", sinDato: "neutro" } as const;

/** Pagina del perfil. */
export default function PerfilVehiculo() {
  const { placa = "" } = useParams();
  const datos = useDatos(() => apiVehiculos.perfil(placa), [placa]);
  const [grupo, setGrupo] = useState<GrupoParte | null>(null);
  const [parte, setParte] = useState<Parte | null>(null);

  if (datos.cargando && !datos.datos) return <Cargando que="el vehiculo" />;
  if (datos.error || !datos.datos) return <ErrorCarga mensaje={datos.error ?? "Sin datos"} alReintentar={datos.recargar} />;

  const v = datos.datos;
  const esquema = esquemaCamion(v.configuracion);
  const preop = v.ultimoPreoperacional;
  const r = preop?.respuestas ?? null;
  const soat = estadoVencimiento(v.vencSoat);
  const tecno = estadoVencimiento(v.vencTecno);
  const extintor = estadoVencimiento(r?.vencExtintor ?? null);
  const novedades = esquema.partes.filter((p) => estadoParte(p, r) === "novedad");
  const titulo = (clave: string) => PREGUNTAS.find((q) => q.clave === clave)?.titulo ?? clave;

  return (
    <>
      <div className="perfil-cabeza">
        <div className="perfil-cabeza-dibujo">
          <CamionFrente marca={v.marca} />
        </div>
        <div className="perfil-cabeza-textos">
          <Link to="/vehiculos" className="btn-link">
            ← Vehiculos
          </Link>
          <h2>
            {v.placa} <span className="dato-sec">{v.marca ?? ""}</span>
          </h2>
          <span className="dato-sec">
            {tipoDe(v.configuracion)} ({v.configuracion ?? "?"}) · {esquema.ejes} ejes · {esquema.llantas} llantas · grupo {v.grupo}
            {v.placaRemolque ? ` · remolque ${v.placaRemolque}` : ""}
          </span>
        </div>
      </div>

      <div className="panel panel-body">
        <div className="grupos-partes">
          <span className="dato-sec">Iluminar:</span>
          {GRUPOS.map((g) => (
            <button key={g.id} className={`chip-grupo${grupo === g.id ? " activo" : ""}`} onClick={() => setGrupo(grupo === g.id ? null : g.id)}>
              {g.nombre}
            </button>
          ))}
          <span className="leyenda-partes">
            <i className="estado-elegida" /> Elegida <i className="estado-novedad" /> Con novedad
          </span>
        </div>
        <div className="perfil-3d">
          <VisorMantenimiento
            marca={v.marca}
            configuracion={v.configuracion}
            esquema={esquema}
            respuestas={r}
            grupo={grupo}
            elegida={parte?.id ?? null}
            alElegir={setParte}
          />
          <aside className="detalle-parte">
            {parte ? (
              <>
                <span className="dato-sec">{GRUPOS.find((g) => g.id === parte.grupo)?.nombre}</span>
                <strong className="detalle-parte-nombre">{parte.nombre}</strong>
                <Pastilla tono={TONO_ESTADO[estadoParte(parte, r)]}>{TEXTO_ESTADO[estadoParte(parte, r)]}</Pastilla>
                {parte.preop.length > 0 && r ? (
                  <dl className="resumen-vehiculo detalle-parte-preguntas">
                    {parte.preop.map((c) => (
                      <div key={c}>
                        <dt>{titulo(c)}</dt>
                        <dd>
                          {r[c] || "-"}
                          {r[`${c}Novedad`] && <span className="texto-vencido"> · {r[`${c}Novedad`]}</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="dato-sec">{parte.preop.length ? "Aun no tiene preoperacional." : "El preoperacional no revisa esta parte."}</div>
                )}
                {preop && parte.preop.length > 0 && (
                  <div className="dato-sec">
                    Revisado el {fechaCorta(preop.fecha)} por {preop.conductor}.
                  </div>
                )}
                <div className="dato-sec">Mantenimientos de esta parte: se registraran en el modulo de mantenimiento.</div>
                <button type="button" className="btn-link" style={{ alignSelf: "flex-start" }} onClick={() => setParte(null)}>
                  Cerrar
                </button>
              </>
            ) : (
              <>
                <strong className="detalle-parte-nombre">Elige una parte</strong>
                <div className="dato-sec">
                  Gira el camion y haz clic en una llanta, el radiador, los tanques, los espejos, las luces o la cabina, o elige la parte en la lista de abajo
                  (ahi estan tambien las del remolque), para ver lo que dijo el ultimo preoperacional.
                </div>
                {novedades.length > 0 ? (
                  <div className="alert danger">Novedades del ultimo preoperacional: {novedades.map((p) => p.nombre).join(", ")}.</div>
                ) : (
                  <div className="dato-sec">{preop ? "El ultimo preoperacional no reporta novedades." : "Aun no tiene preoperacional."}</div>
                )}
              </>
            )}
          </aside>
        </div>
        <div className="lista-partes">
          {GRUPOS.map((g) => (
            <div key={g.id} className={`lista-partes-grupo${grupo === g.id ? " activo" : ""}`}>
              <span className="dato-sec">{g.nombre}</span>
              <div>
                {esquema.partes
                  .filter((x) => x.grupo === g.id)
                  .map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      className={`chip-parte estado-${estadoParte(x, r)}${parte?.id === x.id ? " elegida" : ""}`}
                      onClick={() => setParte(x)}
                      title={x.nombre}
                    >
                      {nombreCorto(x)}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tarjetas-perfil">
        <div className="panel panel-body">
          <h4>Datos</h4>
          <dl className="resumen-vehiculo">
            <div>
              <dt>Conductor habitual</dt>
              <dd>{v.conductorHabitual ?? "-"}</dd>
            </div>
            <div>
              <dt>Capacidad</dt>
              <dd>{v.capacidadKg === null ? "-" : `${v.capacidadKg.toLocaleString("es-CO")} kg`}</dd>
            </div>
            <div>
              <dt>Peso vacio</dt>
              <dd>{v.pesoVacioKg === null ? "-" : `${v.pesoVacioKg.toLocaleString("es-CO")} kg`}</dd>
            </div>
            <div>
              <dt>Flota</dt>
              <dd>{v.flota}</dd>
            </div>
            <div>
              <dt>GPS</dt>
              <dd>{v.tieneGps ? "Con acceso guardado" : r?.gps === "Sí" ? "Tiene (preoperacional)" : "Sin dato"}</dd>
            </div>
            <div>
              <dt>Viajes (30 dias)</dt>
              <dd>{v.viajes30Dias}</dd>
            </div>
          </dl>
        </div>

        <div className="panel panel-body">
          <h4>Documentos y equipo</h4>
          <dl className="resumen-vehiculo">
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
              <dt>Extintor</dt>
              <dd>
                <Pastilla tono={extintor.tono}>{extintor.texto}</Pastilla>
              </dd>
            </div>
            <div>
              <dt>Botiquin</dt>
              <dd>{r?.botiquin ?? "-"}</dd>
            </div>
            <div>
              <dt>Equipo de carretera</dt>
              <dd>{r?.equipoCarretera ?? "-"}</dd>
            </div>
            <div>
              <dt>Ultimo mantenimiento</dt>
              <dd>{r?.fechaMantenimiento ? fechaCorta(r.fechaMantenimiento) : "-"}</dd>
            </div>
          </dl>
          <div className="dato-sec">Extintor, botiquin, equipo y mantenimiento: del ultimo preoperacional.</div>
        </div>

        <div className="panel panel-body">
          <h4>Ultimo preoperacional</h4>
          {preop ? (
            <dl className="resumen-vehiculo">
              <div>
                <dt>Fecha</dt>
                <dd>{fechaCorta(preop.fecha)}</dd>
              </div>
              <div>
                <dt>Conductor</dt>
                <dd>{preop.conductor}</dd>
              </div>
              <div>
                <dt>Resultado</dt>
                <dd>
                  <Pastilla tono={preop.aprobo ? "ok" : "error"}>{preop.aprobo ? "Aprobo" : "No aprobo"}</Pastilla>
                </dd>
              </div>
              <div>
                <dt>Inspecciones</dt>
                <dd>
                  {v.preoperacionales} · <Link to="/preoperacional">ver todas</Link>
                </dd>
              </div>
            </dl>
          ) : (
            <div className="dato-sec">
              Aun no tiene inspecciones. Se llenan al despachar o desde <Link to="/preoperacional">Preoperacional</Link>.
            </div>
          )}
        </div>
      </div>

      <div className="panel panel-body">
        <h4>Ultimos viajes</h4>
        <table className="tabla tabla-compacta">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Empresa</th>
              <th>Manifiesto</th>
              <th>Conductor</th>
            </tr>
          </thead>
          <tbody>
            {v.ultimosViajes.map((x) => (
              <tr key={x.id}>
                <td>{fechaCorta(x.fecha)}</td>
                <td>{x.empresa}</td>
                <td className="codigo">{x.manifiesto ?? "-"}</td>
                <td>{x.conductor ?? "-"}</td>
              </tr>
            ))}
            {!v.ultimosViajes.length && (
              <tr>
                <td colSpan={4} className="empty-row">
                  Sin viajes en el Cuadro pagos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
