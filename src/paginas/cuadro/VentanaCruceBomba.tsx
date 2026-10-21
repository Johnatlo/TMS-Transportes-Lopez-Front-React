/**
 * Cruce con la bomba (quincenal). La bomba manda una relacion de vales por
 * cada factura (AE5044797) con los tanqueos de ese periodo; aqui se compara
 * con lo registrado en el TMS y se cruza.
 *
 * - Lista de facturas ya cruzadas: total, vales, fecha de pago (al pagarle a
 *   la bomba) y borrar (deshace el cruce).
 * - Nueva relacion: desde el PDF o el Excel de la bomba (se leen los vales y
 *   el sistema propone el tanqueo de cada uno) o armada a mano (se eligen los
 *   tanqueos de un periodo). Se revisa vale por vale y se guarda.
 */
import { useMemo, useState } from "react";
import { apiCuadro, moneda } from "../../api/cliente";
import type { AnticipoBomba, EstadoVale, RelacionBomba, ValeBomba, ValePropuesto } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Modal from "../../componentes/Modal";
import { Pastilla } from "../../componentes/TablaDatos";
import type { TonoPastilla } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "./estadosCuadro";
import { placaConGuion } from "./facturacion";
import { leerPdf, valesDesdeFilas, valesDesdePdf } from "./relacionBomba";
import { leerHojas } from "../seguimiento/cargaExcel";

const ESTADO_VALE: Record<EstadoVale, { etiqueta: string; tono: TonoPastilla }> = {
  COINCIDE: { etiqueta: "Coincide", tono: "ok" },
  DIFERENCIA: { etiqueta: "Valor distinto", tono: "aviso" },
  SIN_TANQUEO: { etiqueta: "No esta en el TMS", tono: "error" },
};

/** Texto de un tramo en la lista para elegir el de un vale. */
const etiquetaTramo = (t: AnticipoBomba) =>
  `${fechaCorta(t.fecha)} · ${t.bomba ?? "-"} · ${t.tramo === "VUELTA" ? "vuelta" : "ida"} · ${t.empresa ?? "vuelta pendiente"} · ${moneda(t.combustible)}`;

/** Ventana del cruce: facturas cruzadas y nueva relacion. */
export default function VentanaCruceBomba({
  tramos,
  alCerrar,
  alCambiar,
}: {
  tramos: AnticipoBomba[];
  alCerrar: () => void;
  alCambiar: () => void;
}) {
  const relaciones = useDatos(() => apiCuadro.relacionesBomba(), []);
  const [lista, setLista] = useState<RelacionBomba[] | null>(null);
  const [nueva, setNueva] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const datos = lista ?? relaciones.datos;

  async function cambiar(accion: () => Promise<RelacionBomba[]>) {
    setError(null);
    try {
      setLista(await accion());
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  if (nueva) {
    return (
      <NuevaRelacion
        tramos={tramos}
        alCerrar={() => setNueva(false)}
        alGuardar={(l) => {
          setLista(l);
          setNueva(false);
          alCambiar();
        }}
      />
    );
  }

  return (
    <Modal
      ancho="pantalla"
      titulo="Cruce con la bomba"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cerrar
          </button>
          <button className="btn-primary" onClick={() => setNueva(true)}>
            Cruzar una relacion de la bomba
          </button>
        </>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.6rem" }}>
        La bomba manda cada quincena la relacion de vales de su factura (los tanqueos de ese periodo). Al cruzarla, cada
        vale queda con su tanqueo, el combustible pasa a ser lo que cobra la bomba y el tanqueo se pinta de verde en el
        cuadro. Cuando se le pague a la bomba, escribe la fecha de pago de la factura.
      </div>
      {error && <div className="alert danger">{error}</div>}
      {!datos && relaciones.cargando && <Cargando que="las facturas de la bomba" />}
      {relaciones.error && !datos && <ErrorCarga mensaje={relaciones.error} alReintentar={relaciones.recargar} />}
      {datos && datos.length === 0 && <div className="alert info">Aun no se ha cruzado ninguna relacion de la bomba.</div>}
      {datos && datos.length > 0 && (
        <table className="tabla">
          <thead>
            <tr>
              <th>Factura</th>
              <th>Fecha</th>
              <th className="num">Vales</th>
              <th className="num">Total</th>
              <th>Sin tanqueo</th>
              <th>Fecha de pago a la bomba</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {datos.map((r) => {
              const sinTanqueo = r.vales.filter((v) => !v.tramoId).length;
              return (
                <tr key={r.id}>
                  <td>
                    <span className="principal codigo">{r.numero}</span>
                    {r.nota && <span className="dato-sec">{r.nota}</span>}
                  </td>
                  <td>{fechaCorta(r.fecha)}</td>
                  <td className="num">{r.vales.length}</td>
                  <td className="num">
                    <strong>{moneda(r.total)}</strong>
                  </td>
                  <td>{sinTanqueo ? <Pastilla tono="error">{sinTanqueo} vale(s)</Pastilla> : <Pastilla tono="ok">Todos</Pastilla>}</td>
                  <td>
                    <input
                      type="date"
                      value={r.fechaPago ?? ""}
                      onChange={(e) => cambiar(() => apiCuadro.pagarRelacionBomba(r.id, e.target.value))}
                    />
                  </td>
                  <td className="num">
                    <button
                      className="btn-link"
                      onClick={() =>
                        window.confirm(`¿Borrar la factura ${r.numero}? Sus tanqueos vuelven a quedar sin cruzar.`) &&
                        cambiar(() => apiCuadro.borrarRelacionBomba(r.id))
                      }
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

/** Vale en revision: el propuesto y el tramo que se eligio. */
type ValeRevision = ValePropuesto;

/** Nueva relacion: leer el archivo (o armarla a mano), revisar vale por vale y guardar. */
function NuevaRelacion({
  tramos,
  alCerrar,
  alGuardar,
}: {
  tramos: AnticipoBomba[];
  alCerrar: () => void;
  alGuardar: (l: RelacionBomba[]) => void;
}) {
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(hoyColombia());
  const [nota, setNota] = useState("");
  const [vales, setVales] = useState<ValeRevision[] | null>(null);
  const [aMano, setAMano] = useState(false);
  const [yaExiste, setYaExiste] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Pide al servidor el tanqueo de cada vale leido. */
  async function proponer(leidos: ValeBomba[], num: string) {
    const r = await apiCuadro.previaRelacionBomba(num, leidos);
    setVales(r.vales);
    setYaExiste(r.yaExiste);
  }

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setTrabajando(true);
    try {
      const r = /\.pdf$/i.test(archivo.name) ? valesDesdePdf(await leerPdf(archivo)) : valesDesdeFilas((await leerHojas(archivo))[0].filas);
      if (r.vales.length === 0) throw new Error("No se encontraron vales en el archivo.");
      if (r.numero) setNumero(r.numero);
      if (r.fecha) setFecha(r.fecha);
      await proponer(r.vales, r.numero ?? numero);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo leer el archivo.");
    } finally {
      setTrabajando(false);
    }
  }

  async function guardar() {
    if (!vales) return;
    setError(null);
    setTrabajando(true);
    try {
      alGuardar(
        await apiCuadro.guardarRelacionBomba({
          numero,
          fecha,
          nota,
          vales: vales.map(({ eds, vale, fecha: f, hora, placa, galones, valor, tramoId }) => ({ eds, vale, fecha: f, hora, placa, galones, valor, tramoId })),
        })
      );
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setTrabajando(false);
    }
  }

  // Tramos que puede tomar un vale: misma placa, con combustible, sin otro vale.
  const libres = useMemo(() => tramos.filter((t) => t.combustible > 0 && t.bombaId !== null && !t.relacionId), [tramos]);
  const elegidos = new Set((vales ?? []).map((v) => v.tramoId).filter(Boolean));
  const totalRelacion = (vales ?? []).reduce((s, v) => s + v.valor, 0);
  const totalTms = (vales ?? []).reduce((s, v) => s + (v.tramoId ? libres.find((t) => t.id === v.tramoId)?.combustible ?? 0 : 0), 0);
  const cambiarTramo = (i: number, tramoId: number | null) =>
    setVales((vs) =>
      (vs ?? []).map((v, j) => {
        if (j !== i) return v;
        const t = libres.find((x) => x.id === tramoId);
        return {
          ...v,
          tramoId,
          combustibleTramo: t?.combustible ?? null,
          estado: !t ? "SIN_TANQUEO" : Math.abs(t.combustible - v.valor) <= 1000 ? "COINCIDE" : "DIFERENCIA",
        };
      })
    );

  return (
    <Modal
      ancho="pantalla"
      titulo="Cruzar una relacion de la bomba"
      alCerrar={alCerrar}
      pie={
        <>
          {vales && (
            <span className="dato-sec" style={{ marginRight: "auto" }}>
              Relacion <strong>{moneda(totalRelacion)}</strong> · registrado en el TMS <strong>{moneda(totalTms)}</strong>
              {totalRelacion !== totalTms && <span className="texto-vencido"> · diferencia {moneda(totalRelacion - totalTms)}</span>}
            </span>
          )}
          <button className="btn-secondary" onClick={alCerrar}>
            Volver
          </button>
          {vales && (
            <button className="btn-primary" onClick={guardar} disabled={trabajando || !numero.trim() || !fecha || vales.length === 0 || yaExiste}>
              {trabajando ? "Guardando..." : "Guardar el cruce"}
            </button>
          )}
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      {yaExiste && <div className="alert danger">La factura {numero} ya se cruzo. Borrala en la lista si quieres cargarla de nuevo.</div>}
      <div className="campos-cuadro">
        <div>
          <label>Factura de la bomba</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value.toUpperCase())} placeholder="AE5044797" />
        </div>
        <div>
          <label>Fecha de la factura</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label>Nota (opcional)</label>
          <input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Quincena 16-30 sep" />
        </div>
      </div>

      {!vales && !aMano && (
        <div className="barra-envio" style={{ marginTop: "0.8rem" }}>
          <label className="btn-primary boton-con-texto" style={{ cursor: "pointer" }}>
            {trabajando ? "Leyendo..." : "Elegir la relacion (PDF o Excel)"}
            <input
              type="file"
              accept=".pdf,.xlsx"
              style={{ display: "none" }}
              disabled={trabajando}
              onChange={(e) => {
                leer(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button className="boton-barra" onClick={() => setAMano(true)}>
            Armarla a mano
          </button>
        </div>
      )}

      {aMano && !vales && (
        <ArmarAMano
          libres={libres}
          alListo={(vs) => {
            setAMano(false);
            setYaExiste(false);
            setVales(vs);
          }}
        />
      )}

      {vales && (
        <table className="tabla" style={{ marginTop: "0.8rem" }}>
          <thead>
            <tr>
              <th>Vale</th>
              <th>Fecha</th>
              <th>Placa</th>
              <th>EDS</th>
              <th className="num">Galones</th>
              <th className="num">Valor de la bomba</th>
              <th>Tanqueo del TMS</th>
              <th className="num">Registrado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {vales.map((v, i) => {
              const opciones = libres.filter((t) => t.placa?.replace(/[^A-Z0-9]/gi, "").toUpperCase() === v.placa && (t.id === v.tramoId || !elegidos.has(t.id)));
              return (
                <tr key={i} className={v.estado === "COINCIDE" ? "fila-cruzada" : undefined}>
                  <td className="codigo">{v.vale ?? "-"}</td>
                  <td>
                    {fechaCorta(v.fecha)}
                    {v.hora && <span className="dato-sec">{v.hora}</span>}
                  </td>
                  <td>{placaConGuion(v.placa)}</td>
                  <td>{v.eds || "-"}</td>
                  <td className="num">{v.galones ?? "-"}</td>
                  <td className="num">
                    <strong>{moneda(v.valor)}</strong>
                  </td>
                  <td>
                    <select value={v.tramoId ?? ""} onChange={(e) => cambiarTramo(i, e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Ninguno</option>
                      {opciones.map((t) => (
                        <option key={t.id} value={t.id}>
                          {etiquetaTramo(t)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">{v.combustibleTramo === null ? "-" : moneda(v.combustibleTramo)}</td>
                  <td>
                    <Pastilla tono={ESTADO_VALE[v.estado].tono}>{ESTADO_VALE[v.estado].etiqueta}</Pastilla>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {vales && (
        <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
          Al guardar, cada tanqueo elegido queda cruzado: su combustible pasa a ser el valor de la bomba (lo registrado
          antes se guarda para ver la diferencia). Los vales sin tanqueo quedan en la factura para reclamarlos o registrarlos.
        </div>
      )}
    </Modal>
  );
}

/** Relacion armada a mano: los tanqueos de un periodo, marcando los que trae la factura. */
function ArmarAMano({ libres, alListo }: { libres: AnticipoBomba[]; alListo: (vales: ValeRevision[]) => void }) {
  const hoy = hoyColombia();
  const [desde, setDesde] = useState(`${hoy.slice(0, 8)}${Number(hoy.slice(8)) > 15 ? "16" : "01"}`);
  const [hasta, setHasta] = useState(hoy);
  const [bomba, setBomba] = useState("");
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const bombas = [...new Set(libres.map((t) => t.bomba).filter((b): b is string => !!b))].sort();
  const enPeriodo = libres.filter((t) => t.fecha >= desde && t.fecha <= hasta && (!bomba || t.bomba === bomba)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const total = enPeriodo.filter((t) => marcados.has(t.id)).reduce((s, t) => s + t.combustible, 0);
  const alternar = (id: number) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div style={{ marginTop: "0.8rem" }}>
      <div className="campos-cuadro">
        <div>
          <label>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label>Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div>
          <label>Bomba</label>
          <select value={bomba} onChange={(e) => setBomba(e.target.value)}>
            <option value="">Todas</option>
            {bombas.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="barra-envio">
        <button className="boton-barra" onClick={() => setMarcados(new Set(enPeriodo.map((t) => t.id)))}>
          Marcar todos ({enPeriodo.length})
        </button>
        <button className="boton-barra" onClick={() => setMarcados(new Set())}>
          Ninguno
        </button>
        <span className="dato-sec" style={{ marginLeft: "auto" }}>
          Marcados: <strong>{moneda(total)}</strong> (comparalo con el total de la factura)
        </span>
        <button
          className="btn-primary"
          disabled={marcados.size === 0}
          onClick={() =>
            alListo(
              enPeriodo
                .filter((t) => marcados.has(t.id))
                .map((t) => ({
                  eds: t.bomba ?? "",
                  vale: null,
                  fecha: t.fecha,
                  hora: null,
                  placa: (t.placa ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase(),
                  galones: t.galones,
                  valor: t.combustible,
                  tramoId: t.id,
                  estado: "COINCIDE" as const,
                  combustibleTramo: t.combustible,
                }))
            )
          }
        >
          Usar los marcados
        </button>
      </div>
      <table className="tabla">
        <thead>
          <tr>
            <th />
            <th>Fecha</th>
            <th>Placa</th>
            <th>Bomba</th>
            <th>Viaje</th>
            <th className="num">Combustible</th>
          </tr>
        </thead>
        <tbody>
          {enPeriodo.map((t) => (
            <tr key={t.id} className="fila-clic" onClick={() => alternar(t.id)}>
              <td>
                <input type="checkbox" checked={marcados.has(t.id)} readOnly />
              </td>
              <td>{fechaCorta(t.fecha)}</td>
              <td>{placaConGuion(t.placa ?? "")}</td>
              <td>{t.bomba}</td>
              <td>
                {t.empresa ?? "Vuelta pendiente"} <span className="dato-sec">{t.tramo === "VUELTA" ? "Vuelta" : "Ida"}</span>
              </td>
              <td className="num">{moneda(t.combustible)}</td>
            </tr>
          ))}
          {enPeriodo.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-row">
                No hay tanqueos sin cruzar en ese periodo.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
