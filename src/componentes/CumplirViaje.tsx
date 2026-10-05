import { useEffect, useState } from "react";
import { api, aInputLocal, ErrorApi, fechaHora, moneda } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { Cargando, ErrorCarga } from "./Estado";
import Modal from "./Modal";
import type { Viaje, ViajeRemesa } from "../api/tipos";
import type { CumplidoRegistrado, TiemposLogisticos } from "../api/cliente";

/** Solo se cumplen viajes con manifiesto vigente (ver despacho.ts). */
export function esCumplible(v: Pick<Viaje, "estado">): boolean {
  return v.estado === "CONFIRMADO";
}

/** Lo que el usuario escribe para cumplir UNA remesa. */
/** Los seis tiempos logisticos del cumplido, en el orden en que ocurren. */
const TIEMPOS = [
  ["llegadaCargue", "Llegada al cargue"],
  ["entradaCargue", "Entrada al cargue"],
  ["salidaCargue", "Salida del cargue"],
  ["llegadaDescargue", "Llegada al descargue"],
  ["entradaDescargue", "Entrada al descargue"],
  ["salidaDescargue", "Salida del descargue"],
] as const;
type Tiempo = (typeof TIEMPOS)[number][0];

interface FormularioRemesa extends Record<Tiempo, string> {
  kilos: string;
  enviando: boolean;
  error: string | null;
}

/**
 * Valores iniciales de una remesa: lo cargado y las citas que se pusieron al
 * despachar. Llegada y entrada a la hora de la cita, salida una hora despues.
 * Nada puede ser futuro: si la cita del descargue aun no llega, se propone la
 * hora actual. Todo se puede corregir antes de enviar.
 */
function formularioInicial(r: ViajeRemesa): FormularioRemesa {
  const ahora = Date.now();
  const HORA = 3_600_000;
  const hasta = (ms: number) => aInputLocal(new Date(Math.min(ms, ahora)));
  // Si ya se habia cumplido (y se anulo para corregir), se parte de lo reportado.
  const previo = (v: string | null | undefined, defecto: string) => (v ? aInputLocal(new Date(v)) : defecto);
  const cargue = new Date(r.fechaHoraCargue).getTime();
  const descargue = Math.min(new Date(r.fechaHoraDescargue).getTime(), ahora - HORA);
  return {
    kilos: r.cantidadEntregada ? String(r.cantidadEntregada) : r.pesoReal ? String(r.pesoReal) : "",
    llegadaCargue: previo(r.llegadaCargue, hasta(cargue)),
    entradaCargue: previo(r.entradaCargue, hasta(cargue)),
    salidaCargue: previo(r.salidaCargue, hasta(cargue + HORA)),
    llegadaDescargue: previo(r.llegadaDescargue, hasta(descargue)),
    entradaDescargue: previo(r.entradaDescargue, hasta(descargue)),
    salidaDescargue: previo(r.salidaDescargue, hasta(descargue + HORA)),
    enviando: false,
    error: r.mensajeError,
  };
}

/**
 * Ventana para cumplir un viaje en el RNDC: primero cada remesa (proceso 5) y,
 * cuando todas estan cumplidas, el manifiesto (proceso 6). Es el orden que
 * exige el RNDC [Guia Cumplido de Remesa y Manifiesto, pag. 3].
 *
 * Cada remesa tiene su propio formulario y su propio estado de envio: se
 * guardan en un objeto indexado por el id de la remesa, asi cumplir una no
 * reinicia lo que se escribio en otra.
 */
export default function CumplirViaje({
  viaje: viajeInicial,
  alCerrar,
  alTerminar,
}: {
  viaje: Viaje;
  alCerrar: () => void;
  /** Se llama despues de cada envio, para recargar la lista de fondo. */
  alTerminar: () => void;
}) {
  const [viaje, setViaje] = useState<Viaje>(viajeInicial);
  const carga = useDatos(() => api.getRemesasDeViaje(viaje.id), [viaje.id]);
  const [remesas, setRemesas] = useState<ViajeRemesa[] | null>(null);
  const [formularios, setFormularios] = useState<Record<number, FormularioRemesa>>({});
  const [enviandoManifiesto, setEnviandoManifiesto] = useState(false);
  const [errorManifiesto, setErrorManifiesto] = useState<string | null>(null);

  // Cuando llegan las remesas del servidor se copian al estado local (que se
  // actualiza con cada cumplido) y se arma un formulario para cada pendiente.
  useEffect(() => {
    if (!carga.datos) return;
    setRemesas(carga.datos);
    setFormularios(
      Object.fromEntries(
        carga.datos.filter((r) => r.estado === "CREADA").map((r) => [r.id, formularioInicial(r)])
      )
    );
  }, [carga.datos]);

  const activas = (remesas ?? []).filter((r) => r.estado !== "ANULADA");
  const pendientes = activas.filter((r) => r.estado !== "CUMPLIDA");
  const cumplido = viaje.estado === "CUMPLIDO";

  /** Cambia un campo del formulario de una remesa sin tocar los demas. */
  function cambiar(id: number, cambios: Partial<FormularioRemesa>) {
    setFormularios((previo) => ({ ...previo, [id]: { ...previo[id], ...cambios } }));
  }

  async function cumplirRemesa(r: ViajeRemesa) {
    const f = formularios[r.id];
    cambiar(r.id, { enviando: true, error: null });
    try {
      const resp = await api.cumplirRemesa(r.id, {
        cantidadEntregada: Number(f.kilos),
        // Van tal cual se escribieron (hora de Colombia, sin zona): el backend
        // las interpreta como hora de Colombia, sin importar el reloj del equipo.
        llegadaCargue: f.llegadaCargue,
        entradaCargue: f.entradaCargue,
        salidaCargue: f.salidaCargue,
        llegadaDescargue: f.llegadaDescargue,
        entradaDescargue: f.entradaDescargue,
        salidaDescargue: f.salidaDescargue,
      });
      setRemesas(resp.remesas);
      setViaje(resp.viaje);
    } catch (exc) {
      if (exc instanceof ErrorApi && exc.cuerpo?.remesas) setRemesas(exc.cuerpo.remesas);
      cambiar(r.id, { error: exc instanceof Error ? exc.message : "No se pudo cumplir la remesa" });
    } finally {
      cambiar(r.id, { enviando: false });
      alTerminar();
    }
  }

  // ---- Cumplido del manifiesto: valores como en el portal del RNDC ----
  const previa = useDatos(() => api.getPreviaCumplidoManifiesto(viaje.id), [viaje.id]);
  const [cm, setCm] = useState({
    fechaEntregaDocumentos: aInputLocal(new Date()).slice(0, 10),
    valorAdicionalHorasCargue: "",
    valorAdicionalHorasDescargue: "",
    valorAdicionalFlete: "",
    motivoValorAdicional: "",
    valorDescuentoFlete: "",
    motivoDescuento: "",
    valorSobreanticipo: "",
    observaciones: "",
  });
  // Retencion y FOPAT se recalculan solos hasta que se escriben a mano.
  const [retefuenteManual, setRetefuenteManual] = useState<string | null>(null);
  const [fopatManual, setFopatManual] = useState<string | null>(null);
  const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
  const p = previa.datos;
  const valorFinal = p
    ? p.valorFlete +
      num(cm.valorAdicionalHorasCargue) +
      num(cm.valorAdicionalHorasDescargue) +
      num(cm.valorAdicionalFlete) -
      num(cm.valorDescuentoFlete)
    : 0;
  const retefuenteCalculada = p
    ? p.titularEsRegimenSimple
      ? 0
      : Math.round(Math.max(0, valorFinal - p.vacio1Valor - p.vacio2Valor) * (p.tarifaRetencionFuente ?? 0.01))
    : 0;
  const fopatCalculado = p?.aplicaFopat ? Math.round(valorFinal * 0.001) : 0;
  const retefuente = retefuenteManual !== null ? num(retefuenteManual) : retefuenteCalculada;
  const fopat = fopatManual !== null ? num(fopatManual) : fopatCalculado;
  const neto = valorFinal - retefuente - fopat;
  const saldo = neto - (p?.valorAnticipo ?? 0) - num(cm.valorSobreanticipo);

  async function cumplirManifiesto() {
    setEnviandoManifiesto(true);
    setErrorManifiesto(null);
    try {
      const r = await api.cumplirManifiesto(viaje.id, {
        ...cm,
        retencionFuente: retefuenteManual !== null ? num(retefuenteManual) : undefined,
        retencionFopat: fopatManual !== null ? num(fopatManual) : undefined,
      });
      setViaje(r);
      setRemesas(r.remesas);
    } catch (exc) {
      if (exc instanceof ErrorApi && exc.cuerpo?.id === viaje.id) setViaje(exc.cuerpo as Viaje);
      setErrorManifiesto(exc instanceof Error ? exc.message : "No se pudo cumplir el manifiesto");
    } finally {
      setEnviandoManifiesto(false);
      alTerminar();
    }
  }

  return (
    <Modal
      titulo={`Cumplir viaje #${viaje.id} - ${viaje.consecutivoManifiesto ?? ""}`}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cerrar
          </button>
          {!cumplido && remesas && (
            <button
              className="btn-primary"
              onClick={cumplirManifiesto}
              disabled={pendientes.length > 0 || enviandoManifiesto}
              title={pendientes.length > 0 ? "Primero cumple todas las remesas" : undefined}
            >
              {enviandoManifiesto ? "Cumpliendo en el RNDC..." : "Cumplir manifiesto"}
            </button>
          )}
        </>
      }
    >
      {cumplido ? (
        <div className="alert success">
          Manifiesto cumplido en el RNDC. Radicado <strong>{viaje.radicadoCumplido}</strong>
          {viaje.fechaCumplido ? ` · ${fechaHora(viaje.fechaCumplido)}` : ""}
          {/* Los avisos del viaje son de la expedicion; aqui solo interesa si el
              cumplido ya existia en el RNDC (hecho en el portal). */}
          {viaje.avisos?.startsWith("Ya estaba cumplido") ? (
            <div className="dato-sec">{viaje.avisos}</div>
          ) : null}
        </div>
      ) : (
        <>
          {viaje.plazoCumplido && <AvisoPlazo dias={viaje.plazoCumplido.diasHabilesRestantes} />}
          <div className="alert info">
            Este es el <strong>cumplido normal</strong>, con adicionales y descuentos si los hubo. Si
            el viaje se suspendio (accidente, varada, siniestro), hazlo en el portal del RNDC.
          </div>
        </>
      )}

      {carga.cargando && !remesas && <Cargando que="las remesas" />}
      {carga.error && <ErrorCarga mensaje={carga.error} alReintentar={carga.recargar} />}

      {activas.map((r) => (
        <div className="form-section" key={r.id}>
          <div>
            <div className="section-title">Remesa {r.consecutivoRemesa}</div>
            <div className="section-desc">
              Cargados: {r.pesoReal ?? "-"} kg
              <br />
              Cita de descargue: {fechaHora(r.fechaHoraDescargue)}
            </div>
          </div>
          <div>
            {r.estado === "CUMPLIDA" ? (
              <DetalleCumplido
                remesa={r}
                manifiestoCumplido={cumplido}
                alAnular={(resp) => {
                  setRemesas(resp.remesas);
                  setViaje(resp.viaje);
                  const nueva = resp.remesas.find((x) => x.id === r.id);
                  if (nueva) setFormularios((f) => ({ ...f, [r.id]: formularioInicial(nueva) }));
                  alTerminar();
                }}
              />
            ) : formularios[r.id] ? (
              <FormularioCumplido
                f={formularios[r.id]}
                alCambiar={(c) => cambiar(r.id, c)}
                alCumplir={() => cumplirRemesa(r)}
              />
            ) : (
              <div className="alert warning" style={{ margin: 0 }}>
                Esta remesa esta en estado {r.estado} y no se puede cumplir.
              </div>
            )}
          </div>
        </div>
      ))}

      {!cumplido && remesas && (
        <div className="form-section">
          <div>
            <div className="section-title">Manifiesto</div>
            <div className="section-desc">
              Los mismos datos del portal del RNDC. La retencion y el FOPAT se recalculan sobre el
              valor final; puedes corregirlos a mano.
            </div>
          </div>
          <div>
            {previa.cargando && !p && <div className="dato-sec">Cargando valores...</div>}
            {p && (
              <>
                <TablaTiempos
                  t={p.tiempos}
                  alUsar={(campo, valor) => {
                    if (valor >= 0) setCm((c) => ({ ...c, [campo]: String(valor) }));
                    else
                      // Menos tiempo del pactado: descuento con motivo T.
                      setCm((c) => ({
                        ...c,
                        valorDescuentoFlete: String(num(c.valorDescuentoFlete) + -valor),
                        motivoDescuento: "T",
                      }));
                  }}
                />
                <div className="campos-cumplido">
                  <div>
                    <label>Fecha entrega de documentos</label>
                    <input
                      type="date"
                      value={cm.fechaEntregaDocumentos}
                      onChange={(e) => setCm({ ...cm, fechaEntregaDocumentos: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>Valor del manifiesto</label>
                    <input value={moneda(p.valorFlete)} disabled />
                  </div>
                  <div>
                    <label>Adicional x tiempos de cargue</label>
                    <input type="number" min="0" value={cm.valorAdicionalHorasCargue}
                      onChange={(e) => setCm({ ...cm, valorAdicionalHorasCargue: e.target.value })} />
                  </div>
                  <div>
                    <label>Adicional x tiempos de descargue</label>
                    <input type="number" min="0" value={cm.valorAdicionalHorasDescargue}
                      onChange={(e) => setCm({ ...cm, valorAdicionalHorasDescargue: e.target.value })} />
                  </div>
                  <div>
                    <label>Otros valores adicionales</label>
                    <input type="number" min="0" value={cm.valorAdicionalFlete}
                      onChange={(e) => setCm({ ...cm, valorAdicionalFlete: e.target.value })} />
                  </div>
                  <div>
                    <label>Motivo del adicional</label>
                    <select value={cm.motivoValorAdicional} disabled={!num(cm.valorAdicionalFlete)}
                      onChange={(e) => setCm({ ...cm, motivoValorAdicional: e.target.value })}>
                      <option value="">Elige...</option>
                      {p.motivosAdicional.map((m) => (
                        <option key={m} value={m}>{ETIQUETA_ADICIONAL[m] ?? m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Descuento por tiempos reales</label>
                    <input type="number" min="0" value={cm.valorDescuentoFlete}
                      onChange={(e) => setCm({ ...cm, valorDescuentoFlete: e.target.value })} />
                  </div>
                  <div>
                    <label>Motivo del descuento</label>
                    <select value={cm.motivoDescuento} disabled={!num(cm.valorDescuentoFlete)}
                      onChange={(e) => setCm({ ...cm, motivoDescuento: e.target.value })}>
                      <option value="">Elige...</option>
                      {Object.entries(p.motivosDescuento).map(([k, v]) => (
                        <option key={k} value={k}>{k} - {v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Retencion en la fuente</label>
                    <input type="number" min="0" value={retefuenteManual ?? String(retefuenteCalculada)}
                      onChange={(e) => setRetefuenteManual(e.target.value)} />
                  </div>
                  <div>
                    <label>Retencion FOPAT (0,1%)</label>
                    <input type="number" min="0" value={fopatManual ?? String(fopatCalculado)}
                      onChange={(e) => setFopatManual(e.target.value)} />
                  </div>
                  <div>
                    <label>Sobreanticipos</label>
                    <input type="number" min="0" value={cm.valorSobreanticipo}
                      onChange={(e) => setCm({ ...cm, valorSobreanticipo: e.target.value })} />
                  </div>
                </div>
                <label>Observaciones</label>
                <input value={cm.observaciones} maxLength={200}
                  onChange={(e) => setCm({ ...cm, observaciones: e.target.value })} />
                <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
                  Valor a pagar <strong>{moneda(valorFinal)}</strong> · Neto {moneda(neto)} · Anticipo{" "}
                  {moneda(p.valorAnticipo)} · Saldo a pagar <strong>{moneda(saldo)}</strong>
                </div>
              </>
            )}
            {pendientes.length > 0 && (
              <div className="dato-sec">
                Falta{pendientes.length > 1 ? "n" : ""} cumplir{" "}
                {pendientes.map((r) => r.consecutivoRemesa).join(", ")}.
              </div>
            )}
            {(errorManifiesto || (viaje.mensajeError && viaje.mensajeError.startsWith("Cumplido"))) && (
              <div className="alert danger" style={{ whiteSpace: "pre-wrap", marginTop: "0.6rem" }}>
                {errorManifiesto ?? viaje.mensajeError}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function FormularioCumplido({
  f,
  alCambiar,
  alCumplir,
}: {
  f: FormularioRemesa;
  alCambiar: (cambios: Partial<FormularioRemesa>) => void;
  alCumplir: () => void;
}) {
  const ahora = aInputLocal(new Date());
  return (
    <>
      <div className="campos-cumplido">
        <div>
          <label>Kilos entregados</label>
          <input
            type="number"
            min="0"
            value={f.kilos}
            onChange={(e) => alCambiar({ kilos: e.target.value })}
          />
        </div>
        {TIEMPOS.map(([campo, etiqueta]) => (
          <div key={campo}>
            <label>{etiqueta}</label>
            <input
              type="datetime-local"
              max={ahora}
              value={f[campo]}
              onChange={(e) => alCambiar({ [campo]: e.target.value } as Partial<FormularioRemesa>)}
            />
          </div>
        ))}
      </div>
      <div className="section-desc">
        Vienen con las citas del despacho; corrigelas con las horas reales (hora de Colombia). Si
        el GPS ya reporto la llegada y la salida, el RNDC usa las suyas y solo toma las entradas,
        como en el portal; si no hay GPS, se envian estas.
      </div>
      {f.error && (
        <div className="alert danger" style={{ whiteSpace: "pre-wrap" }}>
          {f.error}
        </div>
      )}
      <button
        className="btn-primary"
        onClick={alCumplir}
        disabled={f.enviando || !f.kilos || TIEMPOS.some(([campo]) => !f[campo])}
      >
        {f.enviando ? "Cumpliendo en el RNDC..." : "Cumplir remesa"}
      </button>
    </>
  );
}

/** Aviso del plazo de 5 dias habiles, con el tono segun lo que falte. */
export function AvisoPlazo({ dias }: { dias: number }) {
  if (dias < 0) {
    return (
      <div className="alert danger">
        El plazo para cumplir vencio hace {-dias} dia{dias === -1 ? "" : "s"} habil
        {dias === -1 ? "" : "es"}. Si los manifiestos vencidos pasan del 20% de los del ultimo
        mes, el RNDC bloquea la expedicion.
      </div>
    );
  }
  return (
    <div className={`alert ${dias <= 1 ? "warning" : "info"}`}>
      Quedan {dias} dia{dias === 1 ? "" : "s"} habil{dias === 1 ? "" : "es"} para cumplir
      (5 desde la entrega, sin contar festivos).
    </div>
  );
}

/**
 * Motivos de "otros valores adicionales" (CMA170 lista C, R y O). La guia solo
 * nombra "Variacion en ruta"; los demas se muestran con su codigo del RNDC.
 */
const ETIQUETA_ADICIONAL: Record<string, string> = {};

/** 63 -> "1 h 3 min". */
function duracion(min: number | null): string {
  if (min === null) return "-";
  const signo = min < 0 ? "-" : "";
  const m = Math.abs(min);
  return `${signo}${Math.floor(m / 60)} h ${m % 60} min`;
}

/**
 * Tiempos logisticos del manifiesto: pactados contra los que registro el GPS
 * (o los del cumplido de cada remesa), y el valor que eso suma o resta con el
 * valor hora de SICETAC. Es la misma comparacion que muestra el portal al
 * cumplir; el valor es una sugerencia que se aplica con un clic.
 */
function TablaTiempos({
  t,
  alUsar,
}: {
  t: TiemposLogisticos;
  alUsar: (campo: "valorAdicionalHorasCargue" | "valorAdicionalHorasDescargue", valor: number) => void;
}) {
  const filas = [
    { nombre: "Cargue", pact: t.pactadoCargue, ejec: t.ejecutadoCargue, valor: t.diferenciaValorCargue, campo: "valorAdicionalHorasCargue" as const },
    { nombre: "Descargue", pact: t.pactadoDescargue, ejec: t.ejecutadoDescargue, valor: t.diferenciaValorDescargue, campo: "valorAdicionalHorasDescargue" as const },
  ];
  const fuentes = [...new Set(t.remesas.map((r) => r.fuente).filter(Boolean))];
  return (
    <div className="tiempos-logisticos">
      <div className="section-title" style={{ fontSize: "var(--texto-sm)" }}>Tiempos logisticos</div>
      <table className="tabla">
        <thead>
          <tr>
            <th />
            <th className="num">Pactado</th>
            <th className="num">Ejecutado (GPS)</th>
            <th className="num">Diferencia</th>
            <th className="num">Valor</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const dif = f.ejec !== null && f.pact !== null ? f.ejec - f.pact : null;
            return (
              <tr key={f.nombre}>
                <td className="principal">{f.nombre}</td>
                <td className="num">{duracion(f.pact)}</td>
                <td className="num">{duracion(f.ejec)}</td>
                <td className="num" style={{ color: dif && dif > 0 ? "var(--aviso-700)" : dif && dif < 0 ? "var(--ok-700)" : undefined }}>
                  {dif === null ? "-" : `${dif > 0 ? "+" : ""}${duracion(dif)}`}
                </td>
                <td className="num">{f.valor === null ? "-" : moneda(f.valor)}</td>
                <td>
                  {f.valor ? (
                    <button type="button" className="btn-link" onClick={() => alUsar(f.campo, f.valor!)}>
                      {f.valor > 0 ? "Usar como adicional" : "Usar como descuento"}
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="dato-sec" style={{ marginTop: "0.4rem" }}>
        Ejecutado = salida menos entrada{fuentes.includes("RNDC") ? ", segun el RNDC (GPS o cumplido de la remesa)" : fuentes.includes("sistema") ? ", segun lo reportado al cumplir las remesas" : ""}.
        {t.valorHora !== null
          ? ` Valor hora de SICETAC para esta via: ${moneda(t.valorHora)}.`
          : ` No se pudo consultar el valor hora de SICETAC${t.errorSicetac ? ` (${t.errorSicetac})` : ""}.`}
      </div>
    </div>
  );
}

/**
 * Lo que quedo registrado en el cumplido de una remesa, leido del RNDC, para
 * revisar que esta bien. Si algo esta mal, se anula el cumplido (proceso 28)
 * y la remesa vuelve al formulario con esos mismos datos para corregirlos.
 */
function DetalleCumplido({
  remesa,
  manifiestoCumplido,
  alAnular,
}: {
  remesa: ViajeRemesa;
  manifiestoCumplido: boolean;
  alAnular: (r: { viaje: Viaje; remesas: ViajeRemesa[] }) => void;
}) {
  const datos = useDatos(() => api.getCumplidoRemesa(remesa.id), [remesa.id]);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("D");
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d: CumplidoRegistrado | null = datos.datos;
  const f = (v: string | null | undefined) => (v ? fechaHora(v) : "-");

  async function anular() {
    setEnviando(true);
    setError(null);
    try {
      alAnular(await api.anularCumplidoRemesa(remesa.id, motivo, observaciones));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo anular el cumplido");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="detalle-cumplido">
      <div className="alert success" style={{ margin: "0 0 0.6rem" }}>
        Cumplida · radicado <strong>{d?.radicado ?? remesa.radicadoCumplido}</strong>
        {d?.fechaRegistro ? ` · registrado ${d.fechaRegistro}` : ""}
      </div>
      {datos.cargando && !d && <div className="dato-sec">Consultando el cumplido en el RNDC...</div>}
      {d && !d.noCumplida && (
        <table className="tabla">
          <tbody>
            <tr><th>Kilos entregados</th><td className="num" colSpan={3}>{d.cantidadEntregada ?? "-"}</td></tr>
            <tr><th /><th>Llegada</th><th>Entrada</th><th>Salida</th></tr>
            <tr><th>Cargue</th><td>{f(d.llegadaCargue)}</td><td>{f(d.entradaCargue)}</td><td>{f(d.salidaCargue)}</td></tr>
            <tr><th>Descargue</th><td>{f(d.llegadaDescargue)}</td><td>{f(d.entradaDescargue)}</td><td>{f(d.salidaDescargue)}</td></tr>
          </tbody>
        </table>
      )}
      {d?.noCumplida && (
        <div className="alert warning">El RNDC no tiene esta remesa como cumplida (puede que se anulo en el portal).</div>
      )}
      {d && (
        <div className="dato-sec" style={{ marginTop: "0.3rem" }}>
          {d.fuente === "RNDC" ? "Datos registrados en el RNDC." : "El RNDC no respondio: datos enviados desde este sistema."}
        </div>
      )}

      {!anulando ? (
        <button type="button" className="btn-link" style={{ marginTop: "0.5rem" }} onClick={() => setAnulando(true)}>
          Algo esta mal: anular este cumplido para corregirlo
        </button>
      ) : (
        <div className="anular-cumplido">
          {manifiestoCumplido && (
            <div className="alert warning">
              El manifiesto ya esta cumplido: el RNDC no deja anular el cumplido de la remesa hasta
              anular primero el del manifiesto (en el portal).
            </div>
          )}
          <div className="campos-cumplido">
            <div>
              <label>Motivo</label>
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option value="D">D - Error de digitacion</option>
                <option value="O">O - Otro</option>
              </select>
            </div>
            <div>
              <label>Observaciones</label>
              <input value={observaciones} maxLength={200} placeholder="Que se va a corregir"
                onChange={(e) => setObservaciones(e.target.value)} />
            </div>
          </div>
          {error && <div className="alert danger" style={{ whiteSpace: "pre-wrap" }}>{error}</div>}
          <button type="button" className="btn-danger" onClick={anular} disabled={enviando}>
            {enviando ? "Anulando en el RNDC..." : "Anular cumplido"}
          </button>{" "}
          <button type="button" className="btn-link" onClick={() => setAnulando(false)}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
