/**
 * Ventana de un viaje del cuadro pagos: papeles, datos, flete, factura, pago
 * al dueno, revisiones, anticipos (efectivo y combustible) y notas.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiCuadro, fechaHora, moneda } from "../../api/cliente";
import type { DetalleCuadro as Detalle, EstadoPapeles } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import CampoFecha from "../../componentes/CampoFecha";
import Modal from "../../componentes/Modal";
import Seccion from "../../componentes/Seccion";
import { Pastilla } from "../../componentes/TablaDatos";
import {
  ETIQUETA_FLOTA,
  ETIQUETA_PAPELES,
  fechaCorta,
  hoyColombia,
  pasosPapeles,
  saldoVencido,
} from "./estadosCuadro";
import PastillasEstado from "./PastillasEstado";
import CampoValorAnticipo from "./CampoValorAnticipo";
import { combustibleDelTramo } from "./tanqueos";
import type { TramoCombustible } from "./tanqueos";

/** Campos del formulario: todo como texto, igual que los inputs. */
const CAMPOS = [
  "fecha", "placa", "empresa", "conductor", "rutaManual", "manifiesto", "remision", "remisionUrl", "pesoKg", "fechaDescargue",
  "pesoFacturadoKg", "notaFactura",
  "tipoFlete", "tarifaKilo", "valorFijo", "fleteAdicional", "anticipoEmpresa", "anticipoEmpresaFechaPago", "facturaNumero", "facturaFecha", "facturaVence", "facturaFechaPago", "facturaUrl", "fechaPagoSaldo",
] as const;
type Campo = (typeof CAMPOS)[number];
type Formulario = Record<Campo, string>;

/** Viaje -> valores del formulario, todos como texto (asi trabajan los inputs). */
const aFormulario = (d: Detalle): Formulario =>
  Object.fromEntries(CAMPOS.map((c) => [c, d[c] === null || d[c] === undefined ? "" : String(d[c])])) as Formulario;

/**
 * Un viaje del cuadro pagos: papeles, datos, flete, factura, pagos,
 * revisiones, anticipos y notas. Papeles, revisiones, anticipos y
 * notas se guardan al instante; los demas datos con "Guardar cambios".
 */
export default function DetalleCuadro({
  id,
  alCerrar,
  alCambiar,
  enAnticipos = false,
}: {
  id: number;
  alCerrar: () => void;
  alCambiar: () => void;
  /** Abre el viaje directo en sus anticipos (desde el cuadro de anticipos). */
  enAnticipos?: boolean;
}) {
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

  const campo = (c: Campo, etiqueta: string, tipo: "text" | "number" | "date" | "url" = "text", props: Record<string, unknown> = {}) =>
    f && (
      <div>
        <label>{etiqueta}</label>
        <input type={tipo} value={f[c]} onChange={(e) => setF({ ...f, [c]: e.target.value })} {...props} />
      </div>
    );

  /** Link (Drive) de la remision o de la factura, con un boton para abrir el que ya esta guardado. */
  const campoLink = (c: "remisionUrl" | "facturaUrl", nombre: string) =>
    f && (
      <div>
        <label>
          Link de la {nombre} (Drive){" "}
          {d?.[c] && (
            <a href={d[c]!} target="_blank" rel="noreferrer">
              Abrir
            </a>
          )}
        </label>
        <input type="url" value={f[c]} maxLength={500} placeholder="https://drive.google.com/..." onChange={(e) => setF({ ...f, [c]: e.target.value })} />
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
            <PastillasEstado f={d} />
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
            {/* Lo registrado en Seguimiento papeles (al comunicarse con el conductor). */}
            {d.papelesRevisadoEn && (
              <div className="dato-sec">
                Ultimo seguimiento: {fechaHora(d.papelesRevisadoEn)}
                {d.papelesRevisadoPor ? ` por ${d.papelesRevisadoPor}` : ""}
                {d.papelesTiene ? ` · los tiene ${d.papelesTiene}` : ""}
                {d.papelesCompletos === true ? " · completos" : ""}
                {d.papelesCompletos === false ? ` · faltan: ${d.papelesFaltan ?? "?"}` : ""}
              </div>
            )}
          </Seccion>

          <Seccion titulo="Viaje">
            <div className="campos-cuadro">
              {campo("fecha", "Fecha", "date")}
              {campo("placa", "Placa")}
              {campo("empresa", "Empresa")}
              {campo("conductor", "Conductor")}
              {/* Con manifiesto la ruta viene del RNDC y solo se consulta; sin manifiesto se escribe. */}
              {d.viajeId ? (
                <div>
                  <label>Ruta (del RNDC)</label>
                  <input value={d.ruta ?? "Sin datos del RNDC"} disabled />
                </div>
              ) : (
                campo("rutaManual", "Ruta (origen - destino)", "text", { placeholder: "SOACHA - CALI" })
              )}
              {campo("manifiesto", "Manifiesto", "text", { disabled: !!d.viajeId })}
              {campo("remision", "Remision")}
              {campoLink("remisionUrl", "remision")}
              {campo("pesoKg", "Peso real (kg)", "number", { min: 0 })}
              {campo("fechaDescargue", "Fecha de descargue", "date")}
            </div>
          </Seccion>

          <Seccion titulo="Flete">
            {/* Sin flete exacto: las tarifas de la matriz que podrian ser (no se pone una que no es). */}
            {d.tarifasPosibles.length > 0 && (
              <div className="alert info" style={{ marginBottom: "0.6rem" }}>
                {d.tarifasPosibles.length === 1 ? "Tarifa de la matriz para este viaje:" : "No se pudo saber la tarifa exacta. Elige la que es:"}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.4rem" }}>
                  {d.tarifasPosibles.map((t) => (
                    <button
                      key={t.id}
                      className="boton-suave"
                      disabled={t.valor === null}
                      title={t.valor === null ? "Sin valor en la matriz: escribe el flete a mano" : undefined}
                      onClick={() => aplicar(() => apiCuadro.aplicarTarifa(id, t.id), `Flete puesto con ${t.nombre}.`)}
                    >
                      {t.nombre} · {t.valor === null ? "sin valor" : t.tipo === "FIJO" ? moneda(t.valor) : `${moneda(t.valor)}/t`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="campos-cuadro">
              <div>
                <label>Se cobra</label>
                <select value={f.tipoFlete} onChange={(e) => setF({ ...f, tipoFlete: e.target.value })}>
                  <option value="KILO">Por kilo</option>
                  <option value="FIJO">Valor fijo</option>
                </select>
              </div>
              {f.tipoFlete === "KILO" ? campo("tarifaKilo", "Tarifa ($ por kilo)", "number", { min: 0, max: 1000, step: "0.01" }) : campo("valorFijo", "Valor fijo", "number", { min: 0 })}
              {f.tipoFlete === "KILO" &&
                campo("pesoFacturadoKg", "Peso facturado (kg)", "number", { min: 0, placeholder: f.pesoKg || "Igual al real" })}
              {/* POR (2 clientes) suma 300.000 y POR3 (3 clientes) 600.000. */}
              {f.tipoFlete === "KILO" && campo("fleteAdicional", "Adicional por clientes", "number", { min: 0, step: "300000", placeholder: "0" })}
              <div>
                <label>Valor del flete</label>
                <div className="valor-calculado">
                  {f.tipoFlete === "KILO"
                    ? (f.pesoFacturadoKg || f.pesoKg) && f.tarifaKilo
                      ? moneda(
                          Math.round(Number(f.pesoFacturadoKg || f.pesoKg) * Number(f.tarifaKilo)) + Number(f.fleteAdicional || 0)
                        )
                      : "Falta peso o tarifa"
                    : f.valorFijo
                      ? moneda(Number(f.valorFijo))
                      : "-"}
                </div>
                {d.tarifaFlete && <span className="dato-sec">Tarifa de la matriz: {d.tarifaFlete}</span>}
              </div>
            </div>
            <div style={{ marginTop: "0.6rem" }}>
              <label>Nota de la factura (para la contadora)</label>
              <textarea
                rows={2}
                style={{ width: "100%" }}
                value={f.notaFactura}
                onChange={(e) => setF({ ...f, notaFactura: e.target.value })}
              />
              {d.enviadoFacturarEn && <div className="dato-sec">Enviado a facturacion el {fechaHora(d.enviadoFacturarEn)}.</div>}
            </div>
          </Seccion>

          <Seccion titulo="Factura">
            <label className="check-linea">
              <input
                type="checkbox"
                checked={d.facturado}
                disabled={!!d.facturaNumero && !!d.facturaFecha}
                onChange={(e) => aplicar(() => apiCuadro.actualizar(id, { facturado: e.target.checked }))}
              />
              Ya se facturo (aunque aun no tenga consecutivo y fecha)
            </label>
            <div className="campos-cuadro">
              {campo("facturaNumero", "Consecutivo de factura")}
              {campo("facturaFecha", "Fecha de factura", "date")}
              {campo("facturaVence", "Fecha pago cliente (vence)", "date")}
              {campo("facturaFechaPago", "Fecha pago factura", "date")}
              {campoLink("facturaUrl", "factura")}
            </div>
            <div className="dato-sec">
              Queda "Facturado" con consecutivo y fecha de factura. La fecha pago cliente es cuando vence: si pasa sin
              pago, la cartera avisa para llamar y cobrar. Con la fecha pago factura queda "Todo pagado" (fila verde).
            </div>
          </Seccion>

          {(d.estadoAnticipoEmpresa !== "NO_APLICA" || d.anticipoEmpresaNoAplica) && (
            <Seccion titulo="Anticipo de la empresa">
              <div className="dato-sec" style={{ marginBottom: "0.4rem" }}>
                Lo que da el cliente en este viaje (clientes del Zorro, Aburra Limpio y viajes sin manifiesto). Es aparte
                de los anticipos de la bomba: la empresa lo debe hasta que se escribe la fecha en que lo pago. Se cobra
                desde Cartera &gt; Anticipos de empresas.
              </div>
              {!d.anticipoEmpresaNoAplica && (
                <div className="campos-cuadro">
                  {campo("anticipoEmpresa", "Anticipo que da la empresa", "number", { min: 0 })}
                  {campo("anticipoEmpresaFechaPago", "Fecha en que lo pago", "date")}
                </div>
              )}
              <label className="check-linea">
                <input
                  type="checkbox"
                  checked={d.anticipoEmpresaNoAplica}
                  onChange={(e) => aplicar(() => apiCuadro.actualizar(id, { anticipoEmpresaNoAplica: e.target.checked }))}
                />
                Este viaje no lleva anticipo de la empresa (por ejemplo, un urbano)
              </label>
            </Seccion>
          )}

          <Seccion titulo="Pago al dueno del vehiculo">
            {/* Todos los vehiculos: a los terceros se les paga el saldo y a los socios se les reparte la ganancia (Rentabilidad). */}
            <div className="campos-cuadro">{campo("fechaPagoSaldo", "Fecha de pago al dueno", "date")}</div>
            {d.flota === "TERCERO" && !d.dueno ? (
              <>
                {!d.fechaPagoSaldo && d.venceSaldo && (
                  <div className={saldoVencido(d) ? "texto-vencido" : "dato-sec"}>
                    Se le paga el viernes {fechaCorta(d.venceSaldo)} (descargue lunes o martes: el viernes de esa
                    semana; de miercoles en adelante: el de la siguiente).
                  </div>
                )}
                <div className="dato-sec">
                  El valor pactado, los anticipos y las retenciones se llevan en{" "}
                  <Link to={`/terceros?viaje=${d.id}`}>Pago a terceros</Link>.
                </div>
                {!d.fechaDescargue && <div className="dato-sec">Escribe la fecha de descargue para calcular el vencimiento.</div>}
              </>
            ) : (
              <div className="dato-sec">
                {d.dueno ? `Vehiculo de ${d.dueno} (socio)` : `Vehiculo de la flota propia (${ETIQUETA_FLOTA[d.flota]})`}: la fecha en que se
                le pago o se le repartio lo del viaje. Lo que le toca se ve en <Link to="/liquidacion-viajes">Liquidacion de viajes</Link>.
              </div>
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

          <Anticipos d={d} aplicar={aplicar} enfocar={enAnticipos} />
          <Notas d={d} aplicar={aplicar} />
        </div>
      )}
    </Modal>
  );
}

type Aplicar = (accion: () => Promise<Detalle>, mensaje?: string) => Promise<void>;

/** Formulario vacio de un anticipo nuevo (con la fecha de hoy al momento de pedirlo). */
const anticipoVacio = () => ({
  bombaId: "",
  fecha: hoyColombia(),
  efectivo: "",
  combustible: "",
  galones: "",
  precioGalon: "",
  descuento: "",
  idaYVuelta: false,
  efectivoVuelta: "",
  combustibleVuelta: "",
  galonesVuelta: "",
  precioGalonVuelta: "",
  descuentoVuelta: "",
  facturaBomba: "",
  nota: "",
});
type FormularioAnticipo = ReturnType<typeof anticipoVacio>;

/** Numero de un campo de pesos ("" -> 0). */
const pesos = (v: string) => (v.trim() === "" ? 0 : Number(v) || 0);

/**
 * Anticipos del viaje (aparte del anticipo del manifiesto): cada tramo con su
 * efectivo y su combustible (bomba / EDS). Si el anticipo es de ida y vuelta,
 * el de vuelta queda guardado y se suma solo al proximo viaje de la placa.
 */
function Anticipos({ d, aplicar, enfocar }: { d: Detalle; aplicar: Aplicar; enfocar?: boolean }) {
  const bombas = useDatos(() => apiCuadro.bombas(), []);
  const [nuevo, setNuevo] = useState(anticipoVacio);
  // Precio por galon de la bomba y descuento por galon de cada bomba en la fecha del anticipo.
  const precios = useDatos(() => apiCuadro.resumenBomba(), []);
  const descuentos = useDatos(() => apiCuadro.descuentosGalon(nuevo.fecha || undefined), [nuevo.fecha]);
  const seccion = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (enfocar) seccion.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [enfocar]);
  const activas = (bombas.datos ?? []).filter((b) => b.activa);
  const fijar = (c: Partial<FormularioAnticipo>) => setNuevo({ ...nuevo, ...c });
  const precioSugerido = precios.datos?.precioGalonBomba ?? 0;
  const descuentoGalon = descuentos.datos?.find((x) => String(x.bombaId) === nuevo.bombaId)?.descuentoGalon ?? 0;
  const ida = combustibleDelTramo(nuevo, precioSugerido, descuentoGalon);
  const vuelta = combustibleDelTramo(
    { combustible: nuevo.combustibleVuelta, galones: nuevo.galonesVuelta, precioGalon: nuevo.precioGalonVuelta, descuento: nuevo.descuentoVuelta },
    precioSugerido,
    descuentoGalon,
  );
  const totalIda = pesos(nuevo.efectivo) + ida.combustible;
  const totalVuelta = pesos(nuevo.efectivoVuelta) + vuelta.combustible;
  const hayCombustible = ida.combustible + (nuevo.idaYVuelta ? vuelta.combustible : 0) > 0;
  /** Lo que se envia: el combustible ya calculado y, si hay galones, el precio y el descuento con que se calculo. */
  const datosAnticipo = () => ({
    ...nuevo,
    combustible: ida.combustible,
    galones: ida.galones ?? "",
    precioGalon: ida.galones ? ida.precio : "",
    descuento: ida.galones ? ida.descuento : "",
    combustibleVuelta: vuelta.combustible,
    galonesVuelta: vuelta.galones ?? "",
    precioGalonVuelta: vuelta.galones ? vuelta.precio : "",
    descuentoVuelta: vuelta.galones ? vuelta.descuento : "",
  });
  /** Reemplaza el efectivo o el combustible de un anticipo ya guardado y recarga el viaje. */
  const reemplazar = (anticipoId: number, datos: Record<string, unknown>) =>
    aplicar(async () => {
      await apiCuadro.actualizarTramo(anticipoId, datos);
      return apiCuadro.obtener(d.id);
    });
  /** Galones, precio, descuento y combustible de un tramo (sufijo "" la ida, "Vuelta" la vuelta). */
  const camposCombustible = (sufijo: "" | "Vuelta", c: TramoCombustible) => {
    const k = (campo: "galones" | "precioGalon" | "descuento" | "combustible") => `${campo}${sufijo}` as keyof FormularioAnticipo;
    const de = sufijo ? " de vuelta" : "";
    const texto = (campo: "galones" | "precioGalon" | "descuento" | "combustible") => String(nuevo[k(campo)]);
    const cambiar = (campo: "galones" | "precioGalon" | "descuento" | "combustible", v: string) => fijar({ [k(campo)]: v });
    return (
      <>
        <div>
          <label>Galones{de}</label>
          <input type="number" min="0" step="0.001" value={texto("galones")} onChange={(e) => cambiar("galones", e.target.value)} />
        </div>
        <div>
          <label>Precio por galon{de}</label>
          <input
            type="number"
            min="0"
            value={texto("precioGalon")}
            placeholder={precioSugerido ? String(precioSugerido) : ""}
            onChange={(e) => cambiar("precioGalon", e.target.value)}
          />
        </div>
        <div>
          <label>Descuento ($){de}</label>
          <input
            type="number"
            min="0"
            value={texto("descuento")}
            placeholder={c.galones ? String(c.descuento) : descuentoGalon ? `${descuentoGalon} por galon` : "0"}
            onChange={(e) => cambiar("descuento", e.target.value)}
          />
        </div>
        <div>
          <label>Combustible{de}</label>
          <input
            type="number"
            min="0"
            value={texto("combustible")}
            placeholder={c.calculado ? String(c.combustible) : ""}
            onChange={(e) => cambiar("combustible", e.target.value)}
          />
          {c.calculado && <span className="dato-sec">{moneda(c.combustible)} con los galones</span>}
        </div>
      </>
    );
  };
  const listo =
    !!nuevo.fecha && totalIda > 0 && (!nuevo.idaYVuelta || totalVuelta > 0) && (!hayCombustible || !!nuevo.bombaId);

  return (
    <div ref={seccion}>
    <Seccion titulo="Anticipos" extra={d.totalAnticipos ? <span className="dato-sec"> · total {moneda(d.totalAnticipos)}</span> : null}>
      {d.anticipos.length > 0 && (
        <table className="tabla tabla-compacta">
          <thead>
            <tr>
              <th>Tramo</th>
              <th>Fecha</th>
              <th className="num">Efectivo</th>
              <th className="num">Combustible</th>
              <th className="num">Total</th>
              <th>Bomba / factura</th>
              <th>Pagado a la bomba</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.anticipos.map((a) => (
              <tr key={a.id}>
                <td>
                  <Pastilla tono={a.tramo === "VUELTA" ? "info" : "neutro"}>{a.tramo === "VUELTA" ? "Vuelta" : "Ida"}</Pastilla>
                  {a.tramo === "VUELTA" && <span className="dato-sec">De un anticipo de ida y vuelta</span>}
                  {a.nota && <span className="dato-sec">{a.nota}</span>}
                </td>
                <td>{fechaCorta(a.fecha)}</td>
                {/* Se reemplazan ahi mismo (el vale llego con otro valor): cambia tambien en el cuadro de anticipos. */}
                <td className="num">
                  <CampoValorAnticipo t={a} campo="efectivo" alGuardar={(datos) => void reemplazar(a.id, datos)} />
                </td>
                <td className="num">
                  <CampoValorAnticipo t={a} campo="combustible" alGuardar={(datos) => void reemplazar(a.id, datos)} />
                  {a.galones != null && <span className="dato-sec">{a.galones} gal</span>}
                </td>
                <td className="num">{moneda(a.valor)}</td>
                <td>
                  {a.bomba ?? "Solo efectivo"}
                  {a.facturaBomba && <span className="dato-sec">Factura {a.facturaBomba}</span>}
                </td>
                <td>
                  <CampoFecha valor={a.fechaPago} alGuardar={(f) => aplicar(() => apiCuadro.actualizarAnticipo(d.id, a.id, { fechaPago: f }))} />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() =>
                      window.confirm(
                        a.tramo === "IDA" && a.idaYVuelta
                          ? "¿Quitar este anticipo? Si su vuelta aun no se asigno a otro viaje, tambien se quita."
                          : "¿Quitar este anticipo?"
                      ) && aplicar(() => apiCuadro.borrarAnticipo(d.id, a.id))
                    }
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
          <label>Efectivo</label>
          <input type="number" min="0" value={nuevo.efectivo} onChange={(e) => fijar({ efectivo: e.target.value })} />
        </div>
        <div>
          <label>Bomba</label>
          <select value={nuevo.bombaId} onChange={(e) => fijar({ bombaId: e.target.value })}>
            <option value="">{hayCombustible ? "Elige la bomba..." : "Ninguna (solo efectivo)"}</option>
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
          <label>Fecha</label>
          <input type="date" value={nuevo.fecha} onChange={(e) => fijar({ fecha: e.target.value })} />
        </div>
        {camposCombustible("", ida)}
        <div>
          <label>N° factura de la bomba (opcional)</label>
          <input value={nuevo.facturaBomba} maxLength={40} onChange={(e) => fijar({ facturaBomba: e.target.value })} />
        </div>
        <div>
          <label>Nota (opcional)</label>
          <input value={nuevo.nota} maxLength={200} onChange={(e) => fijar({ nota: e.target.value })} />
        </div>
      </div>
      <div className="dato-sec">
        Combustible = galones x precio por galon - descuento (el descuento por galon es el de la bomba elegida). Si escribes el combustible, manda ese
        valor.
      </div>

      <div className="pregunta-recorrido">
        <strong>¿El anticipo es de ida y vuelta o de un solo recorrido?</strong>
        <label className="check-linea">
          <input type="radio" name={`recorrido-${d.id}`} checked={!nuevo.idaYVuelta} onChange={() => fijar({ idaYVuelta: false })} />
          Un solo recorrido
        </label>
        <label className="check-linea">
          <input type="radio" name={`recorrido-${d.id}`} checked={nuevo.idaYVuelta} onChange={() => fijar({ idaYVuelta: true })} />
          Ida y vuelta
        </label>
      </div>
      {nuevo.idaYVuelta && (
        <>
          <div className="campos-cuadro">
            <div>
              <label>Efectivo de vuelta</label>
              <input type="number" min="0" value={nuevo.efectivoVuelta} onChange={(e) => fijar({ efectivoVuelta: e.target.value })} />
            </div>
            {camposCombustible("Vuelta", vuelta)}
          </div>
          <div className="dato-sec">
            El anticipo de vuelta ({moneda(totalVuelta)}) se guarda con la misma bomba y fecha y se suma solo al
            proximo viaje de {d.placa}.
          </div>
        </>
      )}
      <button
        type="button"
        className="btn-primary"
        style={{ marginTop: "0.5rem" }}
        disabled={!listo}
        onClick={async () => {
          // Antes de guardar: avisa si se repite con otro anticipo de la placa ese dia.
          const datos = datosAnticipo();
          const { avisos } = await apiCuadro.revisarAnticipo(d.id, datos).catch(() => ({ avisos: [] as string[] }));
          if (avisos.length && !window.confirm(`Revisa antes de guardar:\n\n- ${avisos.join("\n- ")}\n\n¿Guardar el anticipo de todas formas?`)) return;
          await aplicar(() => apiCuadro.agregarAnticipo(d.id, datos), "Anticipo agregado.");
          setNuevo(anticipoVacio());
        }}
      >
        Agregar anticipo{totalIda ? ` (${moneda(totalIda + (nuevo.idaYVuelta ? totalVuelta : 0))})` : ""}
      </button>
    </Seccion>
    </div>
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
