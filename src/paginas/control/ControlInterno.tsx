/**
 * Control interno (solo acceso total): que se cambio en SOFI, quien y cuando.
 *
 * - Bitacora: cada creacion, cambio y borrado de lo sensible (viajes del
 *   cuadro, anticipos, bomba, cartera, notas credito, gastos, nomina,
 *   prestamos, socios, repartos, usuarios, vehiculos...), con el valor de antes
 *   y el de despues, quien lo hizo y desde que pantalla. Se filtra por fecha,
 *   por que, por usuario y por accion, y se descarga en Excel.
 * - Papelera: lo borrado, con todos sus datos. Lo simple (notas, anticipos
 *   del cliente, notas credito, pagos a socios, fletes conductor,
 *   participaciones) se puede restaurar; lo demas se borro con otros datos
 *   relacionados y queda para consultarlo.
 * Lo guarda la base (triggers), asi que tambien queda lo que hacen las
 * importaciones y los procesos automaticos ("Sistema").
 */
import { useState } from "react";
import { apiControl, auth } from "../../api/cliente";
import type { RegistroBitacora } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { ACCION, cuandoTexto, ListaCambios, nombreCampo, valorTexto } from "../../componentes/HistorialCambios";
import { hoyColombia } from "../cuadro/estadosCuadro";

type Vista = "bitacora" | "papelera";

/** Fecha "AAAA-MM-DD" de hace n dias. */
const haceDias = (n: number) => {
  const d = new Date(`${hoyColombia()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

/** Pantalla de Control interno. */
export default function ControlInterno() {
  const [vista, setVista] = useState<Vista>("bitacora");
  const [desde, setDesde] = useState(haceDias(7));
  const [hasta, setHasta] = useState(hoyColombia());
  const [tabla, setTabla] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [accion, setAccion] = useState("");
  const estado = useDatos(() => apiControl.estado(), []);
  const usuarios = useDatos(() => auth.listarUsuarios(), []);
  const filtros = { desde, hasta, tabla, usuarioId, accion: vista === "papelera" ? "" : accion };
  const carga = useDatos(
    () => (vista === "papelera" ? apiControl.papelera(filtros) : apiControl.bitacora(filtros)),
    [vista, desde, hasta, tabla, usuarioId, accion],
  );
  const [viendo, setViendo] = useState<RegistroBitacora | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const registros = carga.datos ?? [];
  const tablas = [...new Map(registros.map((r) => [r.tabla, r.que])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  async function restaurar(r: RegistroBitacora) {
    if (!window.confirm(`¿Restaurar ${r.que.toLowerCase()} ${r.descripcion ?? `#${r.registroId}`}? Se vuelve a crear con los mismos datos.`)) return;
    setAviso(null);
    setError(null);
    try {
      await apiControl.restaurar(r.id);
      setAviso(`Se restauro ${r.que.toLowerCase()} ${r.descripcion ?? `#${r.registroId}`}.`);
      carga.recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo restaurar.");
    }
  }

  const columnas: Columna<RegistroBitacora>[] = [
    { id: "en", titulo: "Cuando", valor: (r) => r.en, celda: (r) => <span className="dato-sec">{cuandoTexto(r.en)}</span> },
    {
      id: "usuario",
      titulo: "Quien",
      filtrable: true,
      valor: (r) => r.usuario ?? "Sistema",
      celda: (r) => r.usuario ?? <span className="dato-sec">Sistema</span>,
    },
    {
      id: "accion",
      titulo: "Que hizo",
      filtrable: true,
      valor: (r) => ACCION[r.accion].texto,
      celda: (r) => <Pastilla tono={ACCION[r.accion].tono}>{ACCION[r.accion].texto}</Pastilla>,
    },
    {
      id: "que",
      titulo: "En que",
      filtrable: true,
      valor: (r) => r.que,
      buscar: (r) => `${r.descripcion ?? ""} ${r.registroId}`,
      celda: (r) => (
        <>
          <strong>{r.que}</strong>
          <span className="dato-sec" style={{ display: "block" }}>
            {r.descripcion ?? `#${r.registroId}`}
          </span>
        </>
      ),
    },
    {
      id: "cambios",
      titulo: vista === "papelera" ? "Datos" : "Cambios",
      valor: (r) =>
        r.cambios
          .map((c) =>
            r.accion === "CAMBIAR"
              ? `${nombreCampo(c.campo)}: ${valorTexto(c.antes)} -> ${valorTexto(c.despues)}`
              : `${nombreCampo(c.campo)}: ${valorTexto(r.accion === "CREAR" ? c.despues : c.antes)}`,
          )
          .join(" | "),
      celda: (r) => <ListaCambios r={r} maximo={r.accion === "CAMBIAR" ? 6 : 3} />,
    },
    { id: "origen", titulo: "Desde", valor: (r) => r.origen ?? "", celda: (r) => <span className="dato-sec codigo">{r.origen ?? "-"}</span> },
    ...(vista === "papelera"
      ? [
          {
            id: "restaurar",
            titulo: "",
            celda: (r: RegistroBitacora) =>
              r.restauradoEn ? (
                <span className="dato-sec">
                  Restaurado {cuandoTexto(r.restauradoEn)}
                  {r.restauradoPor ? ` por ${r.restauradoPor}` : ""}
                </span>
              ) : r.restaurable ? (
                <button className="btn-secondary" onClick={() => restaurar(r)}>
                  Restaurar
                </button>
              ) : (
                <span className="dato-sec" title="Se borro con otros datos relacionados: sus datos quedan para consultarlos">
                  Solo consulta
                </span>
              ),
          } as Columna<RegistroBitacora>,
        ]
      : []),
  ];

  const cuenta = (a: RegistroBitacora["accion"]) => registros.filter((r) => r.accion === a).length;

  return (
    <>
      {estado.datos && !estado.datos.activa && (
        <div className="alert danger" style={{ marginBottom: "0.75rem" }}>
          La bitacora no esta activa: la base de datos no dejo crear el registro de cambios ({estado.datos.error}). Revisa la seccion de control interno del
          DEPLOY.md.
        </div>
      )}
      <div className="barra-envio" style={{ marginBottom: "0.75rem" }}>
        <div className="selector-vista" role="group" aria-label="Vista">
          {(
            [
              ["bitacora", "Bitacora de cambios"],
              ["papelera", "Papelera"],
            ] as Array<[Vista, string]>
          ).map(([v, t]) => (
            <button key={v} type="button" className={vista === v ? "activo" : ""} onClick={() => setVista(v)}>
              {t}
            </button>
          ))}
        </div>
        <label className="selector-mes">
          <span className="dato-sec">Desde</span>
          <input type="date" value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} />
        </label>
        <label className="selector-mes">
          <span className="dato-sec">Hasta</span>
          <input type="date" value={hasta} onChange={(e) => e.target.value && setHasta(e.target.value)} />
        </label>
        <select value={tabla} onChange={(e) => setTabla(e.target.value)} aria-label="Que">
          <option value="">Todo</option>
          {tablas.map(([t, q]) => (
            <option key={t} value={t}>
              {q}
            </option>
          ))}
          {tabla && !tablas.some(([t]) => t === tabla) && <option value={tabla}>{tabla}</option>}
        </select>
        <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} aria-label="Quien">
          <option value="">Todos los usuarios</option>
          <option value="SISTEMA">Sistema (procesos automaticos)</option>
          {(usuarios.datos ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
        {vista === "bitacora" && (
          <select value={accion} onChange={(e) => setAccion(e.target.value)} aria-label="Accion">
            <option value="">Crear, cambiar y borrar</option>
            <option value="CREAR">Solo lo creado</option>
            <option value="CAMBIAR">Solo lo cambiado</option>
            <option value="BORRAR">Solo lo borrado</option>
          </select>
        )}
      </div>
      {aviso && <div className="alert success">{aviso}</div>}
      {error && <div className="alert danger">{error}</div>}
      {carga.cargando && !carga.datos ? (
        <Cargando que={vista === "papelera" ? "la papelera" : "la bitacora"} />
      ) : carga.error ? (
        <ErrorCarga mensaje={carga.error} alReintentar={carga.recargar} />
      ) : (
        <>
          <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
            {vista === "bitacora" ? (
              <>
                <Indicador titulo="Cambios" valor={cuenta("CAMBIAR")} detalle="en las fechas elegidas" />
                <Indicador titulo="Creados" valor={cuenta("CREAR")} detalle="registros nuevos" />
                <Indicador titulo="Borrados" valor={cuenta("BORRAR")} detalle="estan en la papelera" alerta={cuenta("BORRAR") > 0} />
                <Indicador titulo="Usuarios" valor={new Set(registros.map((r) => r.usuario ?? "Sistema")).size} detalle="que hicieron cambios" />
              </>
            ) : (
              <>
                <Indicador titulo="Borrados" valor={registros.length} detalle="en las fechas elegidas" />
                <Indicador titulo="Se pueden restaurar" valor={registros.filter((r) => r.restaurable).length} detalle="registros simples" />
                <Indicador titulo="Restaurados" valor={registros.filter((r) => r.restauradoEn).length} detalle="ya se devolvieron" />
              </>
            )}
          </div>
          <div className="section-desc" style={{ marginBottom: "0.5rem" }}>
            {vista === "bitacora"
              ? "Cada creacion, cambio y borrado de lo sensible, con el valor de antes y el de despues. Lo guarda la base de datos, asi que tambien queda lo que hacen las importaciones y los procesos automaticos (Sistema). Clic en una fila para ver todos sus datos. Se muestran hasta 1.000 registros: acorta las fechas o filtra si necesitas mas."
              : "Lo que se borro, con todos sus datos y quien lo borro. Lo simple se puede restaurar (vuelve igual, con el mismo numero); lo que se borro junto con otros datos relacionados queda para consultarlo."}
          </div>
          <div className="panel">
            <TablaDatos
              filas={registros}
              columnas={columnas}
              clave={(r) => r.id}
              nombreArchivo={`${vista === "papelera" ? "papelera" : "bitacora"}-${desde}-a-${hasta}`}
              placeholderBusqueda="Buscar placa, numero, nombre, campo..."
              vacio={vista === "papelera" ? "No se borro nada en esas fechas." : "Sin cambios en esas fechas."}
              alClicFila={(r) => setViendo(r)}
            />
          </div>
        </>
      )}
      {viendo && (
        <Modal
          titulo={`${ACCION[viendo.accion].texto} · ${viendo.que} ${viendo.descripcion ?? `#${viendo.registroId}`}`}
          ancho="wide"
          alCerrar={() => setViendo(null)}
        >
          <div className="dato-sec" style={{ marginBottom: "0.6rem" }}>
            {cuandoTexto(viendo.en)} · {viendo.usuario ?? "Sistema (proceso automatico)"} · {viendo.origen ?? "-"} · registro #{viendo.registroId}
          </div>
          <ListaCambios r={viendo} />
        </Modal>
      )}
    </>
  );
}
