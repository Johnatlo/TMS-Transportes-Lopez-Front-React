/**
 * Formulario de un gasto. Arriba se elige como es el gasto y los campos
 * cambian:
 * - Pago unico (lo normal): solo la fecha de pago (o, si aun no se paga, la
 *   fecha del gasto). Sin causacion ni cuotas.
 * - Recurrente (arriendo, honorarios, servicios): el valor, cada cuanto se
 *   repite (mes o quincena), desde cuando y hasta cuando. El sistema genera
 *   el gasto de cada periodo por pagar; si el valor cambia, se cambia en
 *   Recurrentes desde una fecha y el historico queda.
 * - Diferido (se paga una vez y se causa en cuotas, como un seguro anual):
 *   fecha de pago, desde cuando se causa y en cuantas cuotas (mensuales o
 *   quincenales).
 * Siempre: proveedor, numero y tipo de factura (credito o debito, para el
 * reporte de la contadora) y el link del soporte. Antes de guardar se buscan
 * gastos repetidos (la factura que llega por correo y en fisico): si hay uno
 * parecido se pregunta si es el mismo, y si lo es no se guarda otra vez.
 */
import { useState } from "react";
import { apiGastos, hoyColombia, moneda } from "../../api/cliente";
import type {
  DatosGasto,
  EmpresaGasto,
  FormaGasto,
  Gasto,
  GastoRecurrente,
  OpcionesGastos,
  Periodicidad,
  PosibleDuplicado,
  TipoFactura,
} from "../../api/cliente";
import Modal from "../../componentes/Modal";
import { fechaCorta } from "../cuadro/estadosCuadro";
import SelectorDestinos from "./SelectorDestinos";
import { aDestinos, aSeleccion, SELECCION_VACIA, vistaPrevia } from "./destinos";
import type { SeleccionDestinos } from "./destinos";
import { NOMBRE_CATEGORIA } from "./nombres";

/** Las opciones de "como es el gasto". */
const FORMAS: Array<[FormaGasto, string, string]> = [
  ["UNICO", "Pago unico (lo normal)", "Una factura o un pago que se hace una vez."],
  ["RECURRENTE", "Recurrente", "Se repite cada mes o cada quincena: arriendo, honorarios, servicios, recibos."],
  ["DIFERIDO", "Diferido en cuotas", "Se paga una vez y se reparte en varios meses o quincenas, como un seguro anual."],
];

/** Formulario para crear, editar o duplicar un gasto, o crear o cambiar un recurrente. */
export default function FormularioGasto({
  opciones,
  gasto,
  base,
  recurrente,
  soloMyc,
  alCerrar,
  alGuardar,
}: {
  opciones: OpcionesGastos;
  /** Gasto que se edita (null = nuevo). */
  gasto: Gasto | null;
  /** Gasto del que se copia todo menos las fechas (duplicar). */
  base: Gasto | null;
  /** Recurrente que se edita (sus datos; el valor se cambia aparte). */
  recurrente?: GastoRecurrente | null;
  /** Transportes M&C solo registra en su empresa. */
  soloMyc: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const origen = gasto ?? base ?? recurrente ?? null;
  const formaInicial: FormaGasto = recurrente ? "RECURRENTE" : gasto?.forma === "DIFERIDO" || (base && base.forma === "DIFERIDO") ? "DIFERIDO" : "UNICO";
  const hoy = hoyColombia();
  const [forma, setForma] = useState<FormaGasto>(formaInicial);
  const [f, setF] = useState({
    empresa: (origen?.empresa ?? (soloMyc ? "MYC" : "LOPEZ")) as EmpresaGasto,
    tipo: origen?.tipo ?? ("GASTO" as Gasto["tipo"]),
    categoria: origen?.categoria ?? "OFICINA",
    descripcion: origen?.descripcion ?? "",
    proveedor: origen?.proveedor ?? "",
    numeroFactura: gasto?.numeroFactura ?? "",
    tipoFactura: (origen?.tipoFactura ?? "") as TipoFactura | "",
    monto: gasto || base ? String((gasto ?? base)!.monto) : "",
    soporteUrl: gasto?.soporteUrl ?? "",
    // Pago unico.
    fechaPago: gasto?.fechaPago ?? (gasto ? "" : hoy),
    pendiente: gasto ? !gasto.fechaPago : false,
    fechaGasto: gasto?.causaDesde ?? hoy,
    // Diferido.
    causaDesde: gasto?.causaDesde ?? hoy,
    causaCuotas: String(gasto?.causaCuotas ?? base?.causaCuotas ?? 12),
    periodicidad: (gasto?.periodicidad ?? base?.periodicidad ?? recurrente?.periodicidad ?? "MENSUAL") as Periodicidad,
    // Recurrente.
    desde: recurrente?.desde ?? hoy,
    hasta: recurrente?.hasta ?? "",
  });
  const [destinos, setDestinos] = useState<SeleccionDestinos>(origen ? aSeleccion(origen.destinos) : SELECCION_VACIA);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [repetidos, setRepetidos] = useState<PosibleDuplicado[] | null>(null);
  const monto = Number(f.monto) || 0;
  const editandoRecurrente = !!recurrente;
  const previa = vistaPrevia(editandoRecurrente ? 1 : monto, destinos);
  const fechasListas =
    forma === "UNICO" ? (f.pendiente ? !!f.fechaGasto : !!f.fechaPago) : forma === "DIFERIDO" ? !!f.causaDesde && Number(f.causaCuotas) >= 1 : !!f.desde;
  const listo = !!f.descripcion.trim() && (editandoRecurrente || monto > 0) && fechasListas && !previa.problema;

  /** Los datos del gasto (pago unico o diferido) para enviar. */
  const datosGasto = (): DatosGasto => ({
    empresa: f.empresa,
    tipo: f.tipo,
    categoria: f.categoria,
    descripcion: f.descripcion,
    monto,
    forma,
    periodicidad: f.periodicidad,
    proveedor: f.proveedor.trim() || null,
    numeroFactura: f.numeroFactura.trim() || null,
    tipoFactura: f.tipoFactura || null,
    soporteUrl: f.soporteUrl.trim() || null,
    destinos: aDestinos(destinos),
    ...(forma === "UNICO"
      ? { fechaPago: f.pendiente ? null : f.fechaPago, causaDesde: f.pendiente ? f.fechaGasto : f.fechaPago, causaCuotas: 1 }
      : { fechaPago: f.fechaPago || null, causaDesde: f.causaDesde, causaCuotas: Number(f.causaCuotas) || 1 }),
  });

  /** Guarda; si es un gasto y parece repetido, primero pregunta (salvo que ya se confirmo que es otro). */
  async function guardar(confirmado = false) {
    setGuardando(true);
    setError(null);
    try {
      if (forma === "RECURRENTE") {
        const datos = {
          empresa: f.empresa,
          tipo: f.tipo,
          categoria: f.categoria,
          descripcion: f.descripcion,
          proveedor: f.proveedor.trim() || null,
          tipoFactura: f.tipoFactura || null,
          destinos: aDestinos(destinos),
          periodicidad: f.periodicidad,
          desde: f.desde,
          hasta: f.hasta || null,
        };
        if (recurrente) await apiGastos.actualizarRecurrente(recurrente.id, datos);
        else await apiGastos.crearRecurrente({ ...datos, monto });
      } else {
        const datos = datosGasto();
        if (!confirmado) {
          const posibles = await apiGastos.duplicados({ ...datos, id: gasto?.id });
          if (posibles.length) {
            setRepetidos(posibles);
            setGuardando(false);
            return;
          }
        }
        if (gasto) await apiGastos.actualizar(gasto.id, { ...datos, confirmarDuplicado: true });
        else await apiGastos.crear({ ...datos, confirmarDuplicado: confirmado });
      }
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  const titulo = recurrente ? "Editar gasto recurrente" : gasto ? "Editar gasto" : base ? "Duplicar gasto" : "Nuevo gasto";
  return (
    <Modal
      titulo={titulo}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        repetidos ? undefined : (
          <>
            <button className="btn-secondary" onClick={alCerrar}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={() => guardar()} disabled={!listo || guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </>
        )
      }
    >
      {error && <div className="alert danger">{error}</div>}
      {repetidos && (
        <div className="alert warning">
          <strong>Este gasto parece ya registrado.</strong> Puede ser la misma factura que llego por correo y en fisico:
          <ul style={{ margin: "0.4rem 0" }}>
            {repetidos.map((r) => (
              <li key={r.id}>
                {r.descripcion} · {fechaCorta(r.fecha)} · {moneda(r.monto)}
                {r.numeroFactura ? ` · factura ${r.numeroFactura}` : ""} <span className="dato-sec">({r.motivo})</span>
              </li>
            ))}
          </ul>
          ¿Es el mismo?
          <div className="detalle-tanqueo-pie">
            <button className="btn-primary" onClick={alCerrar}>
              Si, es el mismo: no guardar
            </button>
            <button className="btn-secondary" onClick={() => guardar(true)} disabled={guardando}>
              No, es otro: guardarlo
            </button>
          </div>
        </div>
      )}
      {!repetidos && (
        <>
          {!gasto && !recurrente && (
            <div className="formas-gasto" role="radiogroup" aria-label="Como es el gasto">
              {FORMAS.map(([id, nombre, ayuda]) => (
                <label key={id} className={`forma-gasto${forma === id ? " marcada" : ""}`}>
                  <input type="radio" name="forma" checked={forma === id} onChange={() => setForma(id)} />
                  <strong>{nombre}</strong>
                  <span className="dato-sec">{ayuda}</span>
                </label>
              ))}
            </div>
          )}
          <div className="campos-cuadro">
            <div>
              <label>Empresa</label>
              <select value={f.empresa} disabled={soloMyc} onChange={(e) => setF({ ...f, empresa: e.target.value as EmpresaGasto })}>
                <option value="LOPEZ">Transportes Lopez C SAS</option>
                <option value="MYC">Transportes M&C SAS</option>
              </select>
            </div>
            <div>
              <label>Tipo</label>
              <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Gasto["tipo"] })}>
                <option value="GASTO">Gasto</option>
                <option value="INGRESO">Ingreso (por ejemplo, lo que paga la otra empresa)</option>
              </select>
            </div>
            <div>
              <label>Categoria</label>
              <select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
                {opciones.categorias.map((c) => (
                  <option key={c} value={c}>
                    {NOMBRE_CATEGORIA[c] ?? c}
                  </option>
                ))}
              </select>
            </div>
            {!editandoRecurrente && (
              <div>
                <label>{forma === "RECURRENTE" ? "Valor de cada pago" : "Valor"}</label>
                <input type="number" min={0} step="any" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
              </div>
            )}
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Descripcion</label>
              <input
                value={f.descripcion}
                maxLength={300}
                onChange={(e) => setF({ ...f, descripcion: e.target.value })}
                placeholder="Honorarios contadora, luz oficina, llantas SZX-880..."
              />
            </div>
            <div>
              <label>Proveedor (opcional)</label>
              <input value={f.proveedor} maxLength={150} onChange={(e) => setF({ ...f, proveedor: e.target.value })} placeholder="Bridgestone, Satrack..." />
            </div>
            {forma !== "RECURRENTE" && (
              <div>
                <label>N° de factura (opcional)</label>
                <input value={f.numeroFactura} maxLength={40} onChange={(e) => setF({ ...f, numeroFactura: e.target.value })} placeholder="FE-12345" />
              </div>
            )}
            <div>
              <label>Tipo de factura</label>
              <select value={f.tipoFactura} onChange={(e) => setF({ ...f, tipoFactura: e.target.value as TipoFactura | "" })}>
                <option value="">Sin factura</option>
                <option value="CREDITO">Credito (se paga despues)</option>
                <option value="DEBITO">Debito (de contado)</option>
              </select>
            </div>

            {forma === "UNICO" && (
              <>
                <div>
                  <label>{f.pendiente ? "Fecha del gasto" : "Fecha de pago"}</label>
                  <input
                    type="date"
                    min={opciones.corte}
                    value={f.pendiente ? f.fechaGasto : f.fechaPago}
                    onChange={(e) => setF(f.pendiente ? { ...f, fechaGasto: e.target.value } : { ...f, fechaPago: e.target.value })}
                  />
                </div>
                <div>
                  <label className="casilla-linea">
                    <input
                      type="checkbox"
                      checked={f.pendiente}
                      onChange={(e) => setF({ ...f, pendiente: e.target.checked, fechaGasto: f.fechaPago || f.fechaGasto })}
                    />
                    Aun no se ha pagado (queda por pagar)
                  </label>
                </div>
              </>
            )}

            {forma === "DIFERIDO" && (
              <>
                <div>
                  <label>Fecha de pago (vacia = por pagar)</label>
                  <input type="date" value={f.fechaPago} onChange={(e) => setF({ ...f, fechaPago: e.target.value })} />
                </div>
                <div>
                  <label>Se reparte desde</label>
                  <input type="date" min={opciones.corte} value={f.causaDesde} onChange={(e) => setF({ ...f, causaDesde: e.target.value })} />
                </div>
                <div>
                  <label>En cuantas cuotas</label>
                  <input type="number" min={1} max={120} value={f.causaCuotas} onChange={(e) => setF({ ...f, causaCuotas: e.target.value })} />
                </div>
                <div>
                  <label>Cada</label>
                  <select value={f.periodicidad} onChange={(e) => setF({ ...f, periodicidad: e.target.value as Periodicidad })}>
                    <option value="MENSUAL">Mes</option>
                    <option value="QUINCENAL">Quincena</option>
                  </select>
                </div>
              </>
            )}

            {forma === "RECURRENTE" && (
              <>
                <div>
                  <label>Se repite cada</label>
                  <select value={f.periodicidad} onChange={(e) => setF({ ...f, periodicidad: e.target.value as Periodicidad })}>
                    <option value="MENSUAL">Mes</option>
                    <option value="QUINCENAL">Quincena</option>
                  </select>
                </div>
                <div>
                  <label>Primer pago</label>
                  <input type="date" min={opciones.corte} value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} />
                </div>
                <div>
                  <label>Hasta (opcional)</label>
                  <input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} />
                </div>
              </>
            )}

            {forma !== "RECURRENTE" && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Link del soporte (Drive, opcional)</label>
                <input
                  type="url"
                  value={f.soporteUrl}
                  maxLength={500}
                  onChange={(e) => setF({ ...f, soporteUrl: e.target.value })}
                  placeholder="https://drive.google.com/..."
                />
              </div>
            )}
          </div>
          {forma === "DIFERIDO" && Number(f.causaCuotas) > 1 && monto > 0 && (
            <div className="dato-sec" style={{ marginTop: "0.3rem" }}>
              Se paga una vez y se reparte en {f.causaCuotas} {f.periodicidad === "QUINCENAL" ? "quincenas" : "meses"}: {moneda(monto / Number(f.causaCuotas))}{" "}
              cada {f.periodicidad === "QUINCENAL" ? "quincena" : "mes"} desde {fechaCorta(f.causaDesde)}.
            </div>
          )}
          {forma === "RECURRENTE" && (
            <div className="dato-sec" style={{ marginTop: "0.3rem" }}>
              {editandoRecurrente
                ? "El valor no se cambia aqui: en Recurrentes se registra el nuevo valor desde una fecha, y los pagos anteriores conservan el suyo."
                : `Cada ${f.periodicidad === "QUINCENAL" ? "quincena" : "mes"} desde el ${fechaCorta(f.desde)} el sistema crea el gasto por pagar${monto > 0 ? ` por ${moneda(monto)}` : ""}. Si el valor cambia, se registra en Recurrentes desde una fecha.`}
            </div>
          )}
          <h4 style={{ margin: "1rem 0 0.4rem" }}>A quien se le descuenta</h4>
          <SelectorDestinos opciones={opciones} monto={editandoRecurrente ? (recurrente?.valorActual ?? 0) : monto} valor={destinos} alCambiar={setDestinos} />
        </>
      )}
    </Modal>
  );
}
