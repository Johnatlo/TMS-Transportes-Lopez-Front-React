/**
 * Ventana de un viaje del cuadro pagos: papeles, datos, flete, factura, pago
 * al dueno, revisiones, anticipos de bomba y notas.
 */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiCuadro, fechaHora, moneda } from "../../api/cliente";
import type { DetalleCuadro as Detalle, EstadoPapeles } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Modal from "../../componentes/Modal";
import { Pastilla } from "../../componentes/TablaDatos";
import {
  ETIQUETA_FLOTA,
  ETIQUETA_PAPELES,
  etiquetaEstadoCuadro,
  fechaCorta,
  hoyColombia,
  pasosPapeles,
  saldoVencido,
  tonoEstadoCuadro,
} from "./estadosCuadro";

/** Campos del formulario: todo como texto, igual que los inputs. */
const CAMPOS = [
  "fecha", "placa", "empresa", "conductor", "manifiesto", "remision", "pesoKg", "fechaDescargue",
  "tipoFlete", "tarifaKilo", "valorFijo", "facturaNumero", "facturaFecha", "facturaFechaPago", "fechaPagoSaldo",
] as const;
type Campo = (typeof CAMPOS)[number];
type Formulario = Record<Campo, string>;

/** Viaje -> valores del formulario, todos como texto (asi trabajan los inputs). */
const aFormulario = (d: Detalle): Formulario =>
  Object.fromEntries(CAMPOS.map((c) => [c, d[c] === null || d[c] === undefined ? "" : String(d[c])])) as Formulario;

/** Bloque con titulo (y algo extra al lado del titulo) dentro del detalle. */
function Seccion({ titulo, children, extra }: { titulo: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="detalle-seccion">
      <h4>
        {titulo}
        {extra}
      </h4>
      {children}
    </section>
  );
}

/**
 * Un viaje del cuadro pagos: papeles, datos, flete, factura, pagos,
 * revisiones, anticipos de bomba y notas. Papeles, revisiones, anticipos y
 * notas se guardan al instante; los demas datos con "Guardar cambios".
 */
export default function DetalleCuadro({ id, alCerrar, alCambiar }: { id: number; alCerrar: () => void; alCambiar: () => void }) {
  const carga = useDatos(() => apiCuadro.obtener(id), [id]);
  const [d, setD] = useState<Detalle | null>(null);
  const [f, setF] = useState<Formulario | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (carga.datos) {
      setD(carga.datos);
      setF(aFormulario(carga.datos));
    }
  }, [carga.datos]);

  /** Aplica una accion que devuelve el viaje actualizado. */
  async function aplicar(accion: () => Promise<Detalle>, mensaje?: string) {
    setError(null);
    setAviso(null);
    try {
      const nuevo = await accion();
      setD(nuevo);
      // Lo que no se ha guardado del formulario se conserva.
      setF((previo) => (previo && d ? { ...aFormulario(nuevo), ...cambiosDe(previo, d) } : aFormulario(nuevo)));
      if (mensaje) setAviso(mensaje);
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  const cambiosDe = (form: Formulario, base: Detalle) =>
    Object.fromEntries(CAMPOS.filter((c) => form[c] !== aFormulario(base)[c]).map((c) => [c, form[c]])) as Partial<Formulario>;
  const cambios = f && d ? cambiosDe(f, d) : {};
  const hayCambios = Object.keys(cambios).length > 0;

  async function guardar() {
    setGuardando(true);
    await aplicar(() => apiCuadro.actualizar(id, cambios), "Cambios guardados.");
    setGuardando(false);
  }

  const cerrar = () => {
    if (hayCambios && !window.confirm("Hay cambios sin guardar. ¿Cerrar de todas formas?")) return;
    alCerrar();
  };

  const campo = (c: Campo, etiqueta: string, tipo: "text" | "number" | "date" = "text", props: Record<string, unknown> = {}) =>
    f && (
      <div>
        <label>{etiqueta}</label>
        <input type={tipo} value={f[c]} onChange={(e) => setF({ ...f, [c]: e.target.value })} {...props} />
      </div>
    );

  return (
    <Modal
      titulo={d ? `${d.placa} · ${d.empresa} · ${fechaCorta(d.fecha)}` : "Viaje"}
      ancho="wide"
      alCerrar={cerrar}
      pie={
        <>
          {d && !d.viajeId && (
            <button
              className="btn-danger"
              style={{ marginRight: "auto" }}
              onClick={async () => {
                if (!window.confirm("¿Borrar este viaje del cuadro? No se puede deshacer.")) return;
                try {
                  await apiCuadro.borrar(id);
                  alCambiar();
                  alCerrar();
                } catch (exc) {
                  setError(exc instanceof Error ? exc.message : "No se pudo borrar.");
                }
              }}
            >
              Borrar viaje
            </button>
          )}
          <button className="btn-secondary" onClick={cerrar}>
            Cerrar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={!hayCambios || guardando}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </>
      }
    >
      {carga.cargando && !d && <Cargando que="el viaje" />}
      {carga.error && <ErrorCarga mensaje={carga.error} alReintentar={carga.recargar} />}
      {d && f && (
        <div className="detalle-viaje">
          <div className="detalle-cabecera">
            <Pastilla tono={tonoEstadoCuadro(d)}>{etiquetaEstadoCuadro(d)}</Pastilla>
            <Pastilla tono={d.flota === "TERCERO" ? "neutro" : "info"}>{ETIQUETA_FLOTA[d.flota]}</Pastilla>
            {d.manifiesto ? (
              <span className="dato-sec">
                Manifiesto <span className="codigo">{d.manifiesto}</span>
                {d.remesa && d.remesa !== d.manifiesto ? ` · remesa ${d.remesa}` : ""}
              </span>
            ) : (
              <span className="dato-sec">Sin manifiesto de la empresa</span>
            )}
          </div>
          {error && <div className="alert danger">{error}</div>}
          {aviso && <div className="alert success">{aviso}</div>}

          <Seccion titulo="Papeles">
            <div className="pasos-papeles">
              {pasosPapeles(d.flujoCorame).map((paso, i, pasos) => {
                const actual = pasos.indexOf(d.estadoPapeles);
                const clase = paso === d.estadoPapeles ? "activo" : i < actual ? "hecho" : "";
                return (
                  <button
                    key={paso}
                    type="button"
                    className={`paso-papeles ${clase}`}
                    onClick={() => aplicar(() => apiCuadro.actualizar(id, { estadoPapeles: paso as EstadoPapeles }))}
                  >
                    {ETIQUETA_PAPELES[paso]}
                  </button>
                );
              })}
            </div>
            <label className="check-linea">
              <input
                type="checkbox"
                checked={d.flujoCorame}
                onChange={(e) => aplicar(() => apiCuadro.actualizar(id, { flujoCorame: e.target.checked }))}
              />
              Pasa por parqueadero y oficina de Don Alexander (CORAME / Cartones America)
            </label>
            {d.fechaRadicado && <div className="dato-sec">Listo para facturar desde el {fechaCorta(d.fechaRadicado)}</div>}
          </Seccion>

          <Seccion titulo="Viaje">
            <div className="campos-cuadro">
              {campo("fecha", "Fecha", "date")}
              {campo("placa", "Placa")}
              {campo("empresa", "Empresa")}
              {campo("conductor", "Conductor")}
              {campo("manifiesto", "Manifiesto", "text", { disabled: !!d.viajeId })}
              {campo("remision", "Remision")}
              {campo("pesoKg", "Peso real (kg)", "number", { min: 0 })}
              {campo("fechaDescargue", "Fecha de descargue", "date")}
            </div>
          </Seccion>

          <Seccion titulo="Flete">
            <div className="campos-cuadro">
              <div>
                <label>Se cobra</label>
                <select value={f.tipoFlete} onChange={(e) => setF({ ...f, tipoFlete: e.target.value })}>
                  <option value="KILO">Por kilo</option>
                  <option value="FIJO">Valor fijo</option>
                </select>
              </div>
              {f.tipoFlete === "KILO" ? campo("tarifaKilo", "Tarifa ($ por kilo)", "number", { min: 0, step: "0.01" }) : campo("valorFijo", "Valor fijo", "number", { min: 0 })}
              <div>
                <label>Valor del flete</label>
                <div className="valor-calculado">
                  {f.tipoFlete === "KILO"
                    ? f.pesoKg && f.tarifaKilo
                      ? moneda(Math.round(Number(f.pesoKg) * Number(f.tarifaKilo)))
                      : "Falta peso o tarifa"
                    : f.valorFijo
                      ? moneda(Number(f.valorFijo))
                      : "-"}
                </div>
              </div>
            </div>
          </Seccion>

          <Seccion titulo="Factura">
            <label className="check-linea">
              <input
                type="checkbox"
                checked={d.facturado}
                disabled={!!d.facturaNumero}
                onChange={(e) => aplicar(() => apiCuadro.actualizar(id, { facturado: e.target.checked }))}
              />
              Ya se facturo (aunque aun no tenga numero y fecha)
            </label>
            <div className="campos-cuadro">
              {campo("facturaNumero", "Numero de factura")}
              {campo("facturaFecha", "Fecha de factura", "date")}
              {campo("facturaFechaPago", "Fecha de pago del cliente", "date")}
            </div>
          </Seccion>

          <Seccion titulo="Pago al dueno del vehiculo">
            {d.flota === "TERCERO" ? (
              <>
                <div className="campos-cuadro">{campo("fechaPagoSaldo", "Fecha de pago del saldo", "date")}</div>
                {!d.fechaPagoSaldo && d.venceSaldo && (
                  <div className={saldoVencido(d) ? "texto-vencido" : "dato-sec"}>
                    A los terceros se les paga 15 dias despues de entregar: vence el {fechaCorta(d.venceSaldo)}.
                  </div>
                )}
                {!d.fechaDescargue && <div className="dato-sec">Escribe la fecha de descargue para calcular el vencimiento.</div>}
              </>
            ) : (
              <div className="dato-sec">Vehiculo de la flota propia ({ETIQUETA_FLOTA[d.flota]}): no hay saldo que pagarle a un tercero.</div>
            )}
          </Seccion>

          <Seccion titulo="Revision">
            <div className="revisiones">
              {(["CONTABILIDAD", "GERENCIA"] as const).map((quien) => {
                const por = quien === "CONTABILIDAD" ? d.revisadoContabilidadPor : d.revisadoGerenciaPor;
                const en = quien === "CONTABILIDAD" ? d.revisadoContabilidadEn : d.revisadoGerenciaEn;
                return (
                  <div key={quien} className="revision">
                    <strong>{quien === "CONTABILIDAD" ? "Contabilidad" : "Gerencia"}</strong>
                    {por ? (
                      <>
                        <span className="dato-sec">
                          Revisado por {por}
                          {en ? ` · ${fechaHora(en)}` : ""}
                        </span>
                        <button type="button" className="btn-link" onClick={() => aplicar(() => apiCuadro.revisar(id, quien, false))}>
                          Quitar
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn-secondary" onClick={() => aplicar(() => apiCuadro.revisar(id, quien, true))}>
                        Marcar revisado
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Seccion>

          <Anticipos d={d} aplicar={aplicar} />
          <Notas d={d} aplicar={aplicar} />
        </div>
      )}
    </Modal>
  );
}

type Aplicar = (accion: () => Promise<Detalle>, mensaje?: string) => Promise<void>;

/** Anticipos entregados por las bombas aliadas (aparte del anticipo del manifiesto). */
function Anticipos({ d, aplicar }: { d: Detalle; aplicar: Aplicar }) {
  const bombas = useDatos(() => apiCuadro.bombas(), []);
  const [nuevo, setNuevo] = useState({ bombaId: "", valor: "", fecha: hoyColombia(), nota: "" });
  const activas = (bombas.datos ?? []).filter((b) => b.activa);

  return (
    <Seccion titulo="Anticipos de bomba" extra={d.totalAnticipos ? <span className="dato-sec"> · total {moneda(d.totalAnticipos)}</span> : null}>
      {d.anticipos.length > 0 && (
        <table className="tabla tabla-compacta">
          <thead>
            <tr>
              <th>Bomba</th>
              <th>Fecha</th>
              <th className="num">Valor</th>
              <th>Pagado a la bomba</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.anticipos.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.bomba}
                  {a.ciudad && <span className="dato-sec">{a.ciudad}</span>}
                  {a.nota && <span className="dato-sec">{a.nota}</span>}
                </td>
                <td>{fechaCorta(a.fecha)}</td>
                <td className="num">{moneda(a.valor)}</td>
                <td>
                  <input
                    type="date"
                    value={a.fechaPago ?? ""}
                    onChange={(e) => aplicar(() => apiCuadro.actualizarAnticipo(d.id, a.id, { fechaPago: e.target.value }))}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => window.confirm("¿Quitar este anticipo?") && aplicar(() => apiCuadro.borrarAnticipo(d.id, a.id))}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="campos-cuadro" style={{ marginTop: "0.5rem" }}>
        <div>
          <label>Bomba</label>
          <select value={nuevo.bombaId} onChange={(e) => setNuevo({ ...nuevo, bombaId: e.target.value })}>
            <option value="">Elige la bomba...</option>
            {activas.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
                {b.ciudad ? ` (${b.ciudad})` : ""}
              </option>
            ))}
          </select>
          {bombas.datos && activas.length === 0 && <span className="dato-sec">Agrega las bombas con el boton "Bombas" del cuadro.</span>}
        </div>
        <div>
          <label>Valor</label>
          <input type="number" min="0" value={nuevo.valor} onChange={(e) => setNuevo({ ...nuevo, valor: e.target.value })} />
        </div>
        <div>
          <label>Fecha</label>
          <input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} />
        </div>
        <div>
          <label>Nota (opcional)</label>
          <input value={nuevo.nota} maxLength={200} onChange={(e) => setNuevo({ ...nuevo, nota: e.target.value })} />
        </div>
      </div>
      <button
        type="button"
        className="btn-secondary"
        style={{ marginTop: "0.5rem" }}
        disabled={!nuevo.bombaId || !nuevo.valor || !nuevo.fecha}
        onClick={async () => {
          await aplicar(() => apiCuadro.agregarAnticipo(d.id, nuevo), "Anticipo agregado.");
          setNuevo({ bombaId: "", valor: "", fecha: hoyColombia(), nota: "" });
        }}
      >
        Agregar anticipo
      </button>
    </Seccion>
  );
}

/** Notas con autor y fecha, la mas reciente arriba. */
function Notas({ d, aplicar }: { d: Detalle; aplicar: Aplicar }) {
  const [texto, setTexto] = useState("");
  return (
    <Seccion titulo="Notas">
      <div className="nota-nueva">
        <textarea
          rows={2}
          maxLength={1000}
          placeholder='Ej. "Ya los tiene Don Alexander", "Descargo pero no le entregaron los papeles"...'
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary"
          disabled={!texto.trim()}
          onClick={async () => {
            await aplicar(() => apiCuadro.agregarNota(d.id, texto));
            setTexto("");
          }}
        >
          Agregar nota
        </button>
      </div>
      {d.listaNotas.length === 0 ? (
        <div className="dato-sec">Sin notas.</div>
      ) : (
        <ul className="lista-notas">
          {d.listaNotas.map((n) => (
            <li key={n.id}>
              <div>{n.texto}</div>
              <span className="dato-sec">
                {n.autor ?? "Sin usuario"} · {fechaHora(n.creadaEn)}{" "}
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => window.confirm("¿Borrar esta nota?") && aplicar(() => apiCuadro.borrarNota(d.id, n.id))}
                >
                  Borrar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}
