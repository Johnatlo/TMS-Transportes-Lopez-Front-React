/**
 * Seguimiento de papeles (ventana del Cuadro pagos): los viajes que ya descargaron y aun no
 * estan facturados. Muestra donde estan los papeles, quien los tiene, si
 * estan completos y a que conductores hay que llamar hoy (sobre todo en
 * CORAME / Cartones America).
 */
import { useState } from "react";
import { apiSeguimiento, fechaHora } from "../../api/cliente";
import type { AlertaFila, EstadoPapeles, FilaSeguimiento } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import { usarShell } from "../../componentes/Shell";
import DetalleCuadro from "../cuadro/DetalleCuadro";
import { ETIQUETA_PAPELES, fechaCorta, hoyColombia, pasosPapeles } from "../cuadro/estadosCuadro";

/** Dias desde el descargue (null si no hay fecha o aun no llega). */
const diasDescargue = (f: FilaSeguimiento) => {
  if (!f.fechaDescargue) return null;
  const d = Math.round((Date.parse(`${hoyColombia()}T12:00:00Z`) - Date.parse(`${f.fechaDescargue}T12:00:00Z`)) / 86_400_000);
  return d >= 0 ? d : null;
};

/** La alerta mas grave del viaje (papeles o facturacion). */
const alertaDe = (f: FilaSeguimiento): AlertaFila | null => {
  const a = [f.alertaPapeles, f.alertaFacturacion].filter((x): x is AlertaFila => !!x);
  return a.find((x) => x.nivel === "urgente") ?? a[0] ?? null;
};

/** Motivos de las dos alertas juntos. */
const motivosDe = (f: FilaSeguimiento) => [...(f.alertaPapeles?.motivos ?? []), ...(f.alertaFacturacion?.motivos ?? [])];

/** Ya descargo: los papeles salieron de "en ruta" o paso la fecha de descargue. */
const descargado = (f: FilaSeguimiento) =>
  f.estadoPapeles !== "EN_RUTA" || (!!f.fechaDescargue && f.fechaDescargue <= hoyColombia());

/** Papeles listos para facturar: "listo para facturar" o, en CORAME, ya radicados. */
const listos = (f: FilaSeguimiento) => f.estadoPapeles === "RADICADO" || f.estadoPapeles === "RADICADOS";

const PESTANAS: PestanaTabla<FilaSeguimiento>[] = [
  { id: "comunicarse", etiqueta: "Comunicarse hoy", incluye: (f) => !!f.alertaPapeles?.comunicarse },
  { id: "urgentes", etiqueta: "Urgentes", incluye: (f) => alertaDe(f)?.nivel === "urgente" },
  { id: "faltan", etiqueta: "Faltan papeles", incluye: (f) => f.papelesCompletos === false },
  { id: "corame", etiqueta: "CORAME / Cartones", incluye: (f) => f.flujoCorame && descargado(f) && !listos(f) },
  { id: "descargados", etiqueta: "Descargados sin radicar", incluye: (f) => descargado(f) && !listos(f) },
  { id: "porFacturar", etiqueta: "Por facturar", incluye: (f) => listos(f) || !!f.alertaFacturacion },
  { id: "radicados", etiqueta: "Radicados", incluye: (f) => f.estadoPapeles === "RADICADOS" },
  { id: "enRuta", etiqueta: "En ruta", incluye: (f) => !descargado(f) },
  { id: "todos", etiqueta: "Todos", incluye: () => true },
];

const COLUMNAS: Columna<FilaSeguimiento>[] = [
  {
    id: "alerta",
    titulo: "Alerta",
    filtrable: true,
    valor: (f) => (alertaDe(f)?.nivel === "urgente" ? "Urgente" : alertaDe(f) ? "Atencion" : "Al dia"),
    celda: (f) => {
      const a = alertaDe(f);
      if (!a) return <Pastilla tono="ok">Al dia</Pastilla>;
      return (
        <>
          <Pastilla tono={a.nivel === "urgente" ? "error" : "aviso"}>
            {f.alertaPapeles?.comunicarse ? "Comunicarse con el conductor" : a.nivel === "urgente" ? "Urgente" : "Atencion"}
          </Pastilla>
          {motivosDe(f)
            .filter((m) => !m.startsWith("Comunicarse"))
            .map((m) => (
              <span key={m} className="dato-sec">
                {m}
              </span>
            ))}
        </>
      );
    },
  },
  {
    id: "viaje",
    titulo: "Viaje",
    valor: (f) => `${f.placa} ${f.manifiesto ?? ""} ${f.remision ?? ""}`,
    celda: (f) => (
      <>
        <span className="principal">{f.placa}</span>
        {f.manifiesto ? (
          <span className="dato-sec codigo">Manifiesto {f.manifiesto}</span>
        ) : (
          f.remision && <span className="dato-sec codigo">Remision {f.remision}</span>
        )}
      </>
    ),
  },
  {
    id: "empresa",
    titulo: "Empresa",
    filtrable: true,
    valor: (f) => f.empresa,
    buscar: (f) => f.conductor,
    celda: (f) => (
      <>
        {f.empresa}
        {f.conductor && <span className="dato-sec">{f.conductor}</span>}
      </>
    ),
  },
  {
    id: "descargue",
    titulo: "Descargue",
    valor: (f) => f.fechaDescargue,
    celda: (f) => {
      const d = diasDescargue(f);
      return (
        <>
          {fechaCorta(f.fechaDescargue)}
          {d !== null && <span className={d >= 5 ? "texto-vencido" : "dato-sec"}>{d === 0 ? "hoy" : `hace ${d} dias`}</span>}
        </>
      );
    },
  },
  {
    id: "papeles",
    titulo: "Papeles",
    filtrable: true,
    valor: (f) => ETIQUETA_PAPELES[f.estadoPapeles],
    celda: (f) => (
      <>
        {ETIQUETA_PAPELES[f.estadoPapeles]}
        {f.papelesTiene && <span className="dato-sec">Los tiene: {f.papelesTiene}</span>}
      </>
    ),
  },
  {
    id: "completos",
    titulo: "Completos",
    valor: (f) => (f.papelesCompletos === null ? "Sin preguntar" : f.papelesCompletos ? "Si" : "No"),
    celda: (f) =>
      f.papelesCompletos === null ? (
        <span className="dato-sec">Sin preguntar</span>
      ) : f.papelesCompletos ? (
        <Pastilla tono="ok">Completos</Pastilla>
      ) : (
        <>
          <Pastilla tono="error">Faltan</Pastilla>
          {f.papelesFaltan && <span className="dato-sec">{f.papelesFaltan}</span>}
        </>
      ),
  },
  {
    id: "revisado",
    titulo: "Ultimo seguimiento",
    valor: (f) => f.papelesRevisadoEn,
    celda: (f) =>
      f.papelesRevisadoEn ? (
        <>
          {fechaHora(f.papelesRevisadoEn)}
          {f.papelesRevisadoPor && <span className="dato-sec">por {f.papelesRevisadoPor}</span>}
        </>
      ) : (
        <span className="dato-sec">Nunca</span>
      ),
  },
];

/**
 * Seguimiento de papeles (se abre como ventana desde el Cuadro pagos): clic en
 * un viaje abre "Registrar seguimiento" para anotar lo que dijo el conductor.
 * `viajeInicial` (id del cuadro) abre directo ese viaje: asi llegan las
 * alertas de la campana. `alCambiarCuadro` refresca el cuadro pagos de atras.
 */
export default function Papeles({
  viajeInicial = null,
  alCambiarCuadro,
}: {
  viajeInicial?: number | null;
  alCambiarCuadro?: () => void;
}) {
  const { datos, cargando, error, recargar } = useDatos(() => apiSeguimiento.papeles(), []);
  const { recargarSeguimiento } = usarShell();
  const [registrando, setRegistrando] = useState<number | null>(viajeInicial);
  const [detalle, setDetalle] = useState<number | null>(null);

  if (cargando && !datos) return <Cargando que="el seguimiento de papeles" />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;
  const filas = datos ?? [];
  const abierto = registrando !== null ? filas.find((f) => f.id === registrando) ?? null : null;

  const alCambiar = () => {
    recargar();
    recargarSeguimiento();
    alCambiarCuadro?.();
  };

  return (
    <>
      <div className="barra-sincronizacion">
        <span>
          <strong>Despues del descargue</strong> los papeles se persiguen hasta que esten listos para facturar: desde el
          dia del descargue, cada viaje avisa todos los dias que hay que comunicarse con el conductor. Clic en un viaje
          para registrar lo que se supo; eso apaga su alerta hasta el dia siguiente.
        </span>
      </div>
      <div className="panel">
        <TablaDatos
          filas={filas}
          columnas={COLUMNAS}
          clave={(f) => f.id}
          pestanas={PESTANAS}
          nombreArchivo="seguimiento-papeles"
          placeholderBusqueda="Buscar placa, empresa, conductor, manifiesto..."
          vacio="No hay viajes con estos criterios."
          alClicFila={(f) => setRegistrando(f.id)}
        />
      </div>

      {registrando !== null && abierto === null && !cargando && (
        <Modal titulo="Seguimiento de papeles" alCerrar={() => setRegistrando(null)}>
          <div className="alert info">Este viaje ya no esta en seguimiento (facturado, pagado o anulado).</div>
        </Modal>
      )}
      {abierto && (
        <RegistrarPapeles
          fila={abierto}
          alCerrar={() => setRegistrando(null)}
          alGuardar={() => {
            setRegistrando(null);
            alCambiar();
          }}
          alVerCuadro={() => {
            setRegistrando(null);
            setDetalle(abierto.id);
          }}
        />
      )}
      {detalle !== null && <DetalleCuadro id={detalle} alCerrar={() => setDetalle(null)} alCambiar={alCambiar} />}
    </>
  );
}

/**
 * Ventana para registrar lo que se supo de los papeles (normalmente al
 * llamar al conductor): donde estan, quien los tiene, si estan completos,
 * que falta y una nota. Guardar apaga la alerta de "comunicarse" por hoy.
 */
function RegistrarPapeles({
  fila,
  alCerrar,
  alGuardar,
  alVerCuadro,
}: {
  fila: FilaSeguimiento;
  alCerrar: () => void;
  alGuardar: () => void;
  alVerCuadro: () => void;
}) {
  const [estado, setEstado] = useState<EstadoPapeles>(fila.estadoPapeles === "EN_RUTA" ? "DESCARGADO" : fila.estadoPapeles);
  const [tiene, setTiene] = useState(fila.papelesTiene ?? (fila.estadoPapeles === "EN_RUTA" ? fila.conductor ?? "" : ""));
  const [completos, setCompletos] = useState<"si" | "no" | "">(
    fila.papelesCompletos === null ? "" : fila.papelesCompletos ? "si" : "no"
  );
  const [faltan, setFaltan] = useState(fila.papelesFaltan ?? "");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setEnviando(true);
    setError(null);
    try {
      await apiSeguimiento.registrarPapeles(fila.id, {
        estadoPapeles: estado,
        papelesTiene: tiene,
        papelesCompletos: completos === "" ? null : completos === "si",
        papelesFaltan: faltan,
        nota,
      });
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    } finally {
      setEnviando(false);
    }
  }

  // Quien suele tener los papeles en cada paso.
  const sugerencias = [fila.conductor, "Parqueadero", "Don Alexander", "Oficina", "Cliente"].filter(Boolean) as string[];

  return (
    <Modal
      titulo={`Papeles · ${fila.placa} · ${fila.empresa}`}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" style={{ marginRight: "auto" }} onClick={alVerCuadro}>
            Ver en cuadro pagos
          </button>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={enviando || (completos === "no" && !faltan.trim())}>
            {enviando ? "Guardando..." : "Guardar seguimiento"}
          </button>
        </>
      }
    >
      <div className="detalle-viaje">
        <div className="detalle-cabecera">
          {fila.manifiesto && (
            <span className="dato-sec">
              Manifiesto <span className="codigo">{fila.manifiesto}</span>
            </span>
          )}
          {fila.conductor && <span className="dato-sec">Conductor: {fila.conductor}</span>}
          <span className="dato-sec">Descargue: {fechaCorta(fila.fechaDescargue)}</span>
        </div>
        {motivosDe(fila).length > 0 && (
          <div className={`alert ${alertaDe(fila)?.nivel === "urgente" ? "danger" : "warning"}`}>
            {motivosDe(fila).map((m) => (
              <div key={m}>{m}</div>
            ))}
          </div>
        )}
        {error && <div className="alert danger">{error}</div>}

        <section className="detalle-seccion">
          <h4>Donde estan los papeles</h4>
          <div className="pasos-papeles">
            {pasosPapeles(fila.flujoCorame).map((paso) => (
              <button
                key={paso}
                type="button"
                className={`paso-papeles ${paso === estado ? "activo" : ""}`}
                onClick={() => setEstado(paso)}
              >
                {ETIQUETA_PAPELES[paso]}
              </button>
            ))}
          </div>
        </section>

        <section className="detalle-seccion">
          <h4>Lo que dijo el conductor</h4>
          <div className="campos-cuadro">
            <div>
              <label>Quien los tiene</label>
              <input list="papeles-quien" value={tiene} onChange={(e) => setTiene(e.target.value)} />
              <datalist id="papeles-quien">
                {sugerencias.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label>¿Estan todos los papeles?</label>
              <select value={completos} onChange={(e) => setCompletos(e.target.value as "si" | "no" | "")}>
                <option value="">No se sabe</option>
                <option value="si">Si, estan completos</option>
                <option value="no">No, falta algo</option>
              </select>
            </div>
            {completos === "no" && (
              <div>
                <label>Que falta</label>
                <input value={faltan} onChange={(e) => setFaltan(e.target.value)} placeholder="Cumplido firmado, tiquete de bascula..." />
              </div>
            )}
          </div>
          <div style={{ marginTop: "0.6rem" }}>
            <label>Nota (opcional)</label>
            <textarea rows={2} style={{ width: "100%" }} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Los entrega el lunes en la oficina..." />
          </div>
          <div className="dato-sec" style={{ marginTop: "0.4rem" }}>
            Al guardar se anota en las notas del viaje y la alerta de comunicarse se apaga hasta manana.
          </div>
        </section>
      </div>
    </Modal>
  );
}
