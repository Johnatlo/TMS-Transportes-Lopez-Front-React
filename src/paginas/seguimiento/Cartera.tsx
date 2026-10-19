/**
 * Pantalla Cartera: todo lo que los clientes le deben a la empresa. Cada
 * factura con numero y fecha entra aqui sola (desde el cuadro pagos) hasta
 * que se registra la fecha pago factura. Tambien los saldos de antes de
 * septiembre cargados sin viaje, y se puede ver solo lo de un dueno. Vence en la fecha pago cliente (o, si
 * no esta escrita, a los dias de credito del cliente); pasada, avisa para
 * llamar y cobrar.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiSeguimiento, fechaHora, moneda } from "../../api/cliente";
import type { Cartera as DatosCartera, FacturaCartera, GestionCobro, GrupoDueno, PlazoCliente, ResumenCliente } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Modal from "../../componentes/Modal";
import Indicador from "../../componentes/Indicador";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import { usarShell } from "../../componentes/Shell";
import DetalleCuadro from "../cuadro/DetalleCuadro";
import { fechaCorta, hoyColombia } from "../cuadro/estadosCuadro";
import ImportarCartera from "./ImportarCartera";
import AnticiposEmpresas from "./AnticiposEmpresas";

/** Duenos del filtro (los socios y los terceros), con su nombre en pantalla. */
const NOMBRE_DUENO: Record<GrupoDueno, string> = {
  MAURICIO: "Mauricio",
  CELSO: "Celso",
  MILLER: "Miller",
  LUISA: "Luisa",
  TERCEROS: "Terceros",
};

/** Lo que debe el cliente en total (sin filtro por dueno). */
const totalFactura = (f: FacturaCartera) => Math.max(0, f.valorBruto - f.anticipoCliente);

/** "Vencida hace 12 dias", "Vence hoy", "Vence en 8 dias". */
function textoVencimiento(f: FacturaCartera) {
  if (f.diasVencida > 0) return `Vencida hace ${f.diasVencida} dias`;
  if (f.diasVencida === 0) return "Vence hoy";
  return `Vence en ${-f.diasVencida} dias`;
}

const PESTANAS: PestanaTabla<FacturaCartera>[] = [
  { id: "alerta", etiqueta: "Cobrar hoy", incluye: (f) => !!f.alerta },
  { id: "vencidas", etiqueta: "Vencidas", incluye: (f) => f.diasVencida > 0 },
  { id: "porVencer", etiqueta: "Por vencer", incluye: (f) => f.diasVencida <= 0 },
  { id: "compromiso", etiqueta: "Con compromiso de pago", incluye: (f) => !!f.compromisoPago },
  { id: "todas", etiqueta: "Todas", incluye: () => true },
];

const COLUMNAS: Columna<FacturaCartera>[] = [
  {
    id: "factura",
    titulo: "Factura",
    valor: (f) => f.facturaNumero,
    celda: (f) => (
      <>
        <span className="codigo principal">{f.facturaNumero}</span>
        {f.sinViaje ? (
          <Pastilla tono="neutro">Saldo sin viaje</Pastilla>
        ) : (
          <span className="dato-sec">
            {f.viajes.length} viaje{f.viajes.length === 1 ? "" : "s"}
          </span>
        )}
      </>
    ),
  },
  { id: "empresa", titulo: "Cliente", filtrable: true, valor: (f) => f.empresa, celda: (f) => f.empresa },
  { id: "fecha", titulo: "Fecha factura", valor: (f) => f.facturaFecha, celda: (f) => fechaCorta(f.facturaFecha) },
  {
    id: "vence",
    titulo: "Vence",
    valor: (f) => f.vence,
    celda: (f) => (
      <>
        {fechaCorta(f.vence)}
        <span className={f.diasVencida > 0 ? "dato-sec texto-vencido" : "dato-sec"}>{textoVencimiento(f)}</span>
        <span className="dato-sec">{f.venceManual ? "Fecha pago cliente" : `${f.diasCredito} dias de credito`}</span>
      </>
    ),
  },
  {
    id: "valor",
    titulo: "Valor",
    alinear: "derecha",
    valor: (f) => f.valor,
    celda: (f) => (
      <>
        {moneda(f.valor)}
        {f.valor !== totalFactura(f) && <span className="dato-sec">de {moneda(totalFactura(f))}</span>}
        {f.anticipoCliente > 0 && <span className="dato-sec">Anticipo cliente {moneda(f.anticipoCliente)}</span>}
        {f.viajesSinValor > 0 && <span className="texto-vencido">{f.viajesSinValor} viaje(s) sin flete</span>}
      </>
    ),
  },
  {
    id: "alerta",
    titulo: "Alerta",
    valor: (f) => f.alerta?.motivos.join(" ") ?? "",
    celda: (f) =>
      f.alerta ? (
        <>
          <Pastilla tono={f.alerta.nivel === "urgente" ? "error" : "aviso"}>{f.alerta.nivel === "urgente" ? "Cobrar" : "Atencion"}</Pastilla>
          {f.alerta.motivos.map((m) => (
            <span key={m} className="dato-sec">
              {m}
            </span>
          ))}
        </>
      ) : (
        <Pastilla tono="ok">Al dia</Pastilla>
      ),
  },
  {
    id: "gestion",
    titulo: "Ultima gestion",
    valor: (f) => f.ultimaGestion?.texto ?? "",
    celda: (f) =>
      f.ultimaGestion ? (
        <span className="nota-celda" title={f.ultimaGestion.texto}>
          {f.ultimaGestion.texto.length > 60 ? `${f.ultimaGestion.texto.slice(0, 60)}...` : f.ultimaGestion.texto}
          <span className="dato-sec">
            {fechaHora(f.ultimaGestion.creadaEn)}
            {f.ultimaGestion.autor ? ` · ${f.ultimaGestion.autor}` : ""}
          </span>
          {f.compromisoPago && <span className="dato-sec">Prometio pagar el {fechaCorta(f.compromisoPago)}</span>}
        </span>
      ) : (
        <span className="dato-sec">Sin gestiones</span>
      ),
  },
];

const COLUMNAS_CLIENTES: Columna<ResumenCliente>[] = [
  { id: "empresa", titulo: "Cliente", valor: (c) => c.empresa, celda: (c) => <span className="principal">{c.empresa}</span> },
  { id: "credito", titulo: "Credito", alinear: "derecha", valor: (c) => c.diasCredito, celda: (c) => `${c.diasCredito} dias` },
  { id: "facturas", titulo: "Facturas", alinear: "derecha", valor: (c) => c.facturas, celda: (c) => c.facturas },
  { id: "porVencer", titulo: "Por vencer", alinear: "derecha", valor: (c) => c.porVencer, celda: (c) => moneda(c.porVencer) },
  { id: "v30", titulo: "1-30 dias", alinear: "derecha", valor: (c) => c.vencido1a30, celda: (c) => moneda(c.vencido1a30) },
  { id: "v60", titulo: "31-60 dias", alinear: "derecha", valor: (c) => c.vencido31a60, celda: (c) => moneda(c.vencido31a60) },
  { id: "v90", titulo: "61-90 dias", alinear: "derecha", valor: (c) => c.vencido61a90, celda: (c) => moneda(c.vencido61a90) },
  {
    id: "v90mas",
    titulo: "Mas de 90",
    alinear: "derecha",
    valor: (c) => c.vencidoMas90,
    celda: (c) => <span className={c.vencidoMas90 > 0 ? "texto-vencido" : ""}>{moneda(c.vencidoMas90)}</span>,
  },
  { id: "total", titulo: "Total", alinear: "derecha", valor: (c) => c.total, celda: (c) => <strong>{moneda(c.total)}</strong> },
];

/**
 * Cartera: totales, edades por cliente y facturas por cobrar. Clic en una
 * factura abre sus viajes, las gestiones de cobro y el registro del pago.
 * Abre directo una factura con ?factura=<numero>&empresa=<cliente>.
 */
export default function Cartera() {
  // Filtro por dueno de los vehiculos: el backend devuelve solo su parte.
  const [dueno, setDueno] = useState<GrupoDueno | null>(null);
  const { datos, cargando, error, recargar } = useDatos(() => apiSeguimiento.cartera(dueno), [dueno]);
  const [importando, setImportando] = useState(false);
  const { recargarSeguimiento } = usarShell();
  const [parametros, setParametros] = useSearchParams();
  const [abierta, setAbierta] = useState<{ numero: string; empresa: string } | null>(null);
  const [vista, setVista] = useState<"facturas" | "clientes" | "sinDatos" | "anticipos">("facturas");
  /** Viaje cuyo anticipo de la empresa se abre (desde la alerta de la campana). */
  const [anticipoViaje, setAnticipoViaje] = useState<number | null>(null);
  const [viajeCuadro, setViajeCuadro] = useState<number | null>(null);
  const [plazos, setPlazos] = useState(false);

  useEffect(() => {
    // ?anticipo=<id del cuadro>: abre el anticipo de la empresa de ese viaje.
    const anticipo = Number(parametros.get("anticipo"));
    if (anticipo) {
      setVista("anticipos");
      setAnticipoViaje(anticipo);
      setParametros({}, { replace: true });
      return;
    }
    const numero = parametros.get("factura");
    const empresa = parametros.get("empresa");
    if (numero && empresa) {
      setAbierta({ numero, empresa });
      setParametros({}, { replace: true });
    }
  }, [parametros, setParametros]);

  if (cargando && !datos) return <Cargando que="la cartera" />;
  if (error || !datos) return <ErrorCarga mensaje={error ?? "Sin datos"} alReintentar={recargar} />;

  const alCambiar = () => {
    recargar();
    recargarSeguimiento();
  };
  const total = datos.facturas.reduce((s, f) => s + f.valor, 0);
  const vencido = datos.facturas.filter((f) => f.diasVencida > 0).reduce((s, f) => s + f.valor, 0);
  const proximas = datos.facturas.filter((f) => f.diasVencida <= 0 && f.diasVencida >= -5);
  const factura = abierta ? datos.facturas.find((f) => f.facturaNumero === abierta.numero && f.empresa === abierta.empresa) ?? null : null;

  const pestanasVista = (
    <div className="tabla-pestanas selector-vista">
      <button className={vista === "facturas" ? "activa" : ""} onClick={() => setVista("facturas")}>
        Facturas por cobrar
      </button>
      <button className={vista === "clientes" ? "activa" : ""} onClick={() => setVista("clientes")}>
        Por cliente
      </button>
      <button className={vista === "sinDatos" ? "activa" : ""} onClick={() => setVista("sinDatos")}>
        Sin numero o fecha ({datos.sinDatos.length})
      </button>
      <button className={vista === "anticipos" ? "activa" : ""} onClick={() => setVista("anticipos")}>
        Anticipos de empresas
      </button>
    </div>
  );

  // Anticipos de empresas: vista aparte, con sus propios totales.
  if (vista === "anticipos") {
    return (
      <>
        {pestanasVista}
        <AnticiposEmpresas abrirViaje={anticipoViaje} alCambiar={alCambiar} />
      </>
    );
  }

  return (
    <>
      <div className="tabla-pestanas selector-vista filtro-dueno">
        <span className="dato-sec">Vehiculos de:</span>
        {([null, "MAURICIO", "CELSO", "MILLER", "LUISA", "TERCEROS"] as Array<GrupoDueno | null>).map((g) => (
          <button key={g ?? "todos"} className={dueno === g ? "activa" : ""} onClick={() => setDueno(g)} disabled={cargando}>
            {g ? NOMBRE_DUENO[g] : "Todos"}
          </button>
        ))}
      </div>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador
          dinero
          titulo={dueno ? `Por cobrar · ${NOMBRE_DUENO[dueno]}` : "Por cobrar"}
          valor={moneda(total)}
          detalle={`${datos.facturas.length} facturas`}
        />
        <Indicador
          dinero
          titulo="Vencido"
          valor={moneda(vencido)}
          detalle={`${datos.facturas.filter((f) => f.diasVencida > 0).length} facturas`}
        />
        <Indicador
          dinero
          titulo="Vence en 5 dias"
          valor={moneda(proximas.reduce((s, f) => s + f.valor, 0))}
          detalle={`${proximas.length} facturas`}
        />
        <Indicador
          dinero
          titulo="Facturados sin numero o fecha"
          valor={String(datos.sinDatos.length)}
          detalle="no entran a cartera"
        />
      </div>

      {pestanasVista}

      <div className="panel">
        {vista === "facturas" && (
          <TablaDatos
            filas={datos.facturas}
            columnas={COLUMNAS}
            clave={(f) => `${f.facturaNumero}|${f.empresa}`}
            pestanas={PESTANAS}
            nombreArchivo="cartera"
            placeholderBusqueda="Buscar factura, cliente, gestion..."
            vacio="No hay facturas por cobrar con estos criterios."
            alClicFila={(f) => setAbierta({ numero: f.facturaNumero, empresa: f.empresa })}
            acciones={
              <>
                <button className="boton-barra" onClick={() => setImportando(true)}>
                  Importar Excel de cartera
                </button>
                <button className="boton-barra" onClick={() => setPlazos(true)}>
                  Plazos de clientes
                </button>
              </>
            }
          />
        )}
        {vista === "clientes" && (
          <TablaDatos
            filas={datos.clientes}
            columnas={COLUMNAS_CLIENTES}
            clave={(c) => c.empresa}
            nombreArchivo="cartera-por-cliente"
            placeholderBusqueda="Buscar cliente..."
            vacio="Ningun cliente debe facturas."
            acciones={
              <button className="boton-barra" onClick={() => setPlazos(true)}>
                Plazos de clientes
              </button>
            }
          />
        )}
        {vista === "sinDatos" && (
          <>
            <div className="dato-sec" style={{ marginBottom: "0.6rem" }}>
              Estos viajes estan marcados como facturados pero les falta el numero o la fecha de la factura: sin eso no
              se sabe cuando vence. Clic para completarlos en el cuadro pagos.
            </div>
            <table className="tabla tabla-compacta">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Placa</th>
                  <th>Cliente</th>
                  <th>Manifiesto / remision</th>
                  <th>Factura</th>
                </tr>
              </thead>
              <tbody>
                {datos.sinDatos.map((f) => (
                  <tr key={f.id} className="fila-clic" onClick={() => setViajeCuadro(f.id)}>
                    <td>{fechaCorta(f.fecha)}</td>
                    <td>{f.placa}</td>
                    <td>{f.empresa}</td>
                    <td className="codigo">{f.manifiesto ?? f.remision ?? "-"}</td>
                    <td>{f.facturaNumero ? `${f.facturaNumero} (sin fecha)` : "Sin numero"}</td>
                  </tr>
                ))}
                {datos.sinDatos.length === 0 && (
                  <tr>
                    <td colSpan={5} className="dato-sec">
                      Todos los facturados tienen numero y fecha.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {abierta && !factura && (
        <Modal titulo={`Factura ${abierta.numero}`} alCerrar={() => setAbierta(null)}>
          <div className="alert info">Esta factura ya no esta en cartera (pagada o anulada).</div>
        </Modal>
      )}
      {factura && (
        <DetalleFactura
          factura={factura}
          plazo={datos.plazos.find((p) => p.empresa === factura.empresa) ?? null}
          alCerrar={() => setAbierta(null)}
          alCambiar={alCambiar}
          alAbrirViaje={(id) => setViajeCuadro(id)}
        />
      )}
      {viajeCuadro !== null && <DetalleCuadro id={viajeCuadro} alCerrar={() => setViajeCuadro(null)} alCambiar={alCambiar} />}
      {plazos && <PlazosClientes datos={datos} alCerrar={() => setPlazos(false)} alCambiar={alCambiar} />}
      {importando && <ImportarCartera alCerrar={() => setImportando(false)} alCambiar={alCambiar} />}
    </>
  );
}

/**
 * Una factura por cobrar: sus viajes, el contacto de cobro del cliente, las
 * gestiones (con la fecha que prometio pagar) y el registro del pago.
 */
function DetalleFactura({
  factura,
  plazo,
  alCerrar,
  alCambiar,
  alAbrirViaje,
}: {
  factura: FacturaCartera;
  plazo: PlazoCliente | null;
  alCerrar: () => void;
  alCambiar: () => void;
  alAbrirViaje: (id: number) => void;
}) {
  const gestiones = useDatos(() => apiSeguimiento.gestiones(factura.facturaNumero, factura.empresa), [factura.facturaNumero, factura.empresa]);
  const [lista, setLista] = useState<GestionCobro[] | null>(null);
  const [texto, setTexto] = useState("");
  const [compromiso, setCompromiso] = useState("");
  const [fechaPago, setFechaPago] = useState(hoyColombia());
  const [anticipo, setAnticipo] = useState(factura.anticipoCliente ? String(factura.anticipoCliente) : "");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (gestiones.datos) setLista(gestiones.datos);
  }, [gestiones.datos]);

  async function agregarGestion() {
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      setLista(
        await apiSeguimiento.agregarGestion({
          facturaNumero: factura.facturaNumero,
          empresa: factura.empresa,
          texto,
          compromisoPago: compromiso || null,
        })
      );
      setTexto("");
      setCompromiso("");
      setAviso("Gestion anotada.");
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    } finally {
      setEnviando(false);
    }
  }

  async function guardarAnticipo() {
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      await apiSeguimiento.guardarAnticipoCliente(factura.facturaNumero, factura.empresa, Number(anticipo) || 0);
      setAviso("Anticipo del cliente guardado.");
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar el anticipo.");
    } finally {
      setEnviando(false);
    }
  }

  async function registrarPago() {
    if (!window.confirm(`¿Registrar que ${factura.empresa} pago la factura ${factura.facturaNumero} el ${fechaCorta(fechaPago)}?`)) return;
    setEnviando(true);
    setError(null);
    try {
      await apiSeguimiento.registrarPago(factura.facturaNumero, factura.empresa, fechaPago);
      alCambiar();
      alCerrar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo registrar el pago.");
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo={`Factura ${factura.facturaNumero} · ${factura.empresa}`}
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <button className="btn-secondary" onClick={alCerrar}>
          Cerrar
        </button>
      }
    >
      <div className="detalle-viaje">
        <div className="detalle-cabecera">
          <strong>{moneda(totalFactura(factura))}</strong>
          {factura.sinViaje && <Pastilla tono="neutro">Saldo sin viaje</Pastilla>}
          <span className="dato-sec">Facturada el {fechaCorta(factura.facturaFecha)}</span>
          <span className="dato-sec">
            Vence el {fechaCorta(factura.vence)} (
            {factura.venceManual ? "fecha pago cliente" : `${factura.diasCredito} dias de credito`})
          </span>
          <Pastilla tono={factura.diasVencida > 0 ? "error" : factura.alerta ? "aviso" : "ok"}>{textoVencimiento(factura)}</Pastilla>
        </div>
        {factura.alerta && (
          <div className={`alert ${factura.alerta.nivel === "urgente" ? "danger" : "warning"}`}>
            {factura.alerta.motivos.map((m) => (
              <div key={m}>{m}</div>
            ))}
          </div>
        )}
        {factura.viajesSinValor > 0 && (
          <div className="alert warning">
            {factura.viajesSinValor} viaje(s) no tienen valor de flete: el total de la factura esta incompleto. Completalos
            en el cuadro pagos.
          </div>
        )}
        {error && <div className="alert danger">{error}</div>}
        {aviso && <div className="alert success">{aviso}</div>}

        {factura.sinViaje ? (
          <section className="detalle-seccion">
            <h4>Valor por placa</h4>
            <div className="dato-sec" style={{ marginBottom: "0.4rem" }}>
              Saldo de antes de septiembre cargado del Excel de cartera: no tiene viajes en el sistema.
            </div>
            <table className="tabla tabla-compacta">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Dueno</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {factura.placas.map((p) => (
                  <tr key={p.placa}>
                    <td>{p.placa}</td>
                    <td>{NOMBRE_DUENO[p.dueno]}</td>
                    <td style={{ textAlign: "right" }}>{moneda(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="detalle-seccion">
            <h4>Viajes de la factura</h4>
            <table className="tabla tabla-compacta">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Placa</th>
                  <th>Dueno</th>
                  <th>Manifiesto</th>
                  <th>Remision</th>
                  <th style={{ textAlign: "right" }}>Flete</th>
                </tr>
              </thead>
              <tbody>
                {factura.viajes.map((v) => (
                  <tr key={v.id} className="fila-clic" onClick={() => alAbrirViaje(v.id)}>
                    <td>{fechaCorta(v.fecha)}</td>
                    <td>{v.placa}</td>
                    <td>{NOMBRE_DUENO[v.dueno]}</td>
                    <td className="codigo">{v.manifiesto ?? "-"}</td>
                    <td className="codigo">{v.remision ?? "-"}</td>
                    <td style={{ textAlign: "right" }}>{v.valorFlete === null ? <span className="texto-vencido">Sin flete</span> : moneda(v.valorFlete)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="detalle-seccion">
          <h4>Anticipo del cliente</h4>
          <div className="dato-sec" style={{ marginBottom: "0.4rem" }}>
            Lo que el cliente ya pago de esta factura (anticipo o abono). Se resta: debe {moneda(totalFactura(factura))} de{" "}
            {moneda(factura.valorBruto)}.
          </div>
          <div className="nota-nueva">
            <div>
              <label className="dato-sec">Anticipo del cliente</label>
              <input type="number" min={0} value={anticipo} placeholder="0" onChange={(e) => setAnticipo(e.target.value)} />
            </div>
            <button
              className="btn-secondary"
              onClick={guardarAnticipo}
              disabled={enviando || (Number(anticipo) || 0) === factura.anticipoCliente}
            >
              Guardar anticipo
            </button>
          </div>
        </section>

        <section className="detalle-seccion">
          <h4>Contacto de cobro</h4>
          {plazo && (plazo.contacto || plazo.telefono || plazo.correo) ? (
            <div className="dato-sec">
              {[plazo.contacto, plazo.telefono, plazo.correo].filter(Boolean).join(" · ")}
            </div>
          ) : (
            <div className="dato-sec">Sin contacto anotado. Se agrega en "Plazos de clientes".</div>
          )}
        </section>

        <section className="detalle-seccion">
          <h4>Gestiones de cobro</h4>
          <div className="dato-sec" style={{ marginBottom: "0.4rem" }}>
            Pasada la fecha pago cliente, la factura avisa todos los dias para llamar y cobrar hasta que se registra el
            pago. Anotar una gestion apaga su alerta hasta el dia siguiente.
          </div>
          <div className="nota-nueva">
            <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Llame a tesoreria, dicen que pagan el viernes..." />
            <div>
              <label className="dato-sec">Prometio pagar el</label>
              <input type="date" value={compromiso} onChange={(e) => setCompromiso(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={agregarGestion} disabled={enviando || !texto.trim()}>
              Anotar
            </button>
          </div>
          {gestiones.cargando && !lista && <Cargando que="las gestiones" />}
          <ul className="lista-notas">
            {(lista ?? []).map((g) => (
              <li key={g.id}>
                {g.texto}
                {g.compromisoPago && <strong> · Prometio pagar el {fechaCorta(g.compromisoPago)}</strong>}
                <span className="dato-sec">
                  {fechaHora(g.creadaEn)}
                  {g.autor ? ` · ${g.autor}` : ""}
                </span>
              </li>
            ))}
            {lista && lista.length === 0 && <li className="dato-sec">Aun no hay gestiones de cobro.</li>}
          </ul>
        </section>

        <section className="detalle-seccion">
          <h4>Registrar pago</h4>
          <div className="nota-nueva">
            <div>
              <label className="dato-sec">Fecha pago factura</label>
              <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={registrarPago} disabled={enviando || !fechaPago}>
              Registrar pago de la factura
            </button>
          </div>
          <div className="dato-sec">
            {factura.sinViaje
              ? "El saldo queda pagado y sale de la cartera."
              : `Pone la fecha pago factura en los ${factura.viajes.length} viaje(s): quedan en "Todo pagado" y la factura sale de la cartera.`}
          </div>
        </section>
      </div>
    </Modal>
  );
}

/**
 * Plazo de credito y contacto de cobro de cada cliente. Se listan los
 * clientes con plazo guardado y los que tienen facturas por cobrar; los que no
 * tienen plazo usan 30 dias.
 */
function PlazosClientes({ datos, alCerrar, alCambiar }: { datos: DatosCartera; alCerrar: () => void; alCambiar: () => void }) {
  const inicial = () => {
    const empresas = new Set([...datos.plazos.map((p) => p.empresa), ...datos.clientes.map((c) => c.empresa)]);
    return [...empresas].sort().map(
      (empresa) =>
        datos.plazos.find((p) => p.empresa === empresa) ?? { empresa, diasCredito: 30, contacto: null, telefono: null, correo: null }
    );
  };
  const [filas, setFilas] = useState<PlazoCliente[]>(inicial);
  const [nueva, setNueva] = useState("");
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cambiar = (empresa: string, campo: keyof PlazoCliente, valor: string) =>
    setFilas(filas.map((p) => (p.empresa === empresa ? { ...p, [campo]: campo === "diasCredito" ? Number(valor) : valor } : p)));

  async function guardar(p: PlazoCliente) {
    setGuardando(p.empresa);
    setError(null);
    try {
      await apiSeguimiento.guardarPlazo(p);
      alCambiar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <Modal
      titulo="Plazos de clientes"
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <button className="btn-secondary" onClick={alCerrar}>
          Cerrar
        </button>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.8rem" }}>
        Una factura vence en la fecha pago cliente escrita en el cuadro pagos. Si no la tiene, vence a los dias de
        credito de su cliente contados desde la fecha de la factura (30 dias si el cliente no tiene plazo guardado).
      </div>
      {error && <div className="alert danger">{error}</div>}
      <table className="tabla tabla-compacta">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Dias de credito</th>
            <th>Contacto</th>
            <th>Telefono</th>
            <th>Correo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.empresa}>
              <td>{p.empresa}</td>
              <td>
                <input type="number" min={0} max={365} style={{ width: "6rem" }} value={p.diasCredito} onChange={(e) => cambiar(p.empresa, "diasCredito", e.target.value)} />
              </td>
              <td>
                <input value={p.contacto ?? ""} onChange={(e) => cambiar(p.empresa, "contacto", e.target.value)} />
              </td>
              <td>
                <input value={p.telefono ?? ""} onChange={(e) => cambiar(p.empresa, "telefono", e.target.value)} />
              </td>
              <td>
                <input value={p.correo ?? ""} onChange={(e) => cambiar(p.empresa, "correo", e.target.value)} />
              </td>
              <td>
                <button className="btn-primary" onClick={() => guardar(p)} disabled={guardando === p.empresa}>
                  {guardando === p.empresa ? "Guardando..." : "Guardar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="nota-nueva" style={{ marginTop: "0.8rem" }}>
        <input placeholder="Otro cliente (nombre como en el cuadro pagos)" value={nueva} onChange={(e) => setNueva(e.target.value.toUpperCase())} />
        <button
          className="btn-secondary"
          disabled={!nueva.trim() || filas.some((p) => p.empresa === nueva.trim())}
          onClick={() => {
            setFilas([...filas, { empresa: nueva.trim(), diasCredito: 30, contacto: null, telefono: null, correo: null }]);
            setNueva("");
          }}
        >
          Agregar cliente
        </button>
      </div>
    </Modal>
  );
}
