/**
 * Pantalla Anticipos (como el Excel "cuadro de anticipos"): los anticipos de
 * efectivo y combustible de todos los viajes y las cuentas con la bomba.
 *
 * - Arriba: deuda a la bomba, pagado, abonado por el socio (el Zorro) y cupo
 *   de credito disponible (editable, junto con el precio y el descuento por
 *   galon sugeridos para el cruce).
 * - Vistas: por viaje (un tramo de ida o vuelta por fila), por tanqueo (ida y
 *   vuelta juntas), deuda pendiente, pagado a la bomba, abonos del socio y
 *   cruce con la relacion de la bomba: con los galones del tiquete, el
 *   combustible se calcula como en el Excel (galones x precio - descuento).
 */
import { useEffect, useState } from "react";
import { apiCuadro, moneda } from "../../api/cliente";
import type { AbonoSocio, AnticipoBomba, ResumenBomba } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import ComboBuscable from "../../componentes/ComboBuscable";
import Modal from "../../componentes/Modal";
import Indicador from "../../componentes/Indicador";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "./estadosCuadro";
import { deInput, enInput, placaConGuion } from "./facturacion";
import ImportarAnticipos from "./ImportarAnticipos";
import AnticiposEmpresas from "../seguimiento/AnticiposEmpresas";

/** Un tanqueo: los tramos que salieron de una misma entrega en la bomba. */
interface Tanqueo {
  clave: string;
  tanqueoId: number | null;
  fecha: string;
  placa: string;
  bomba: string | null;
  idaYVuelta: boolean;
  facturaBomba: string | null;
  fechaFacturaBomba: string | null;
  flota: string | null;
  tramos: AnticipoBomba[];
  efectivo: number;
  combustible: number;
  total: number;
}

/** Agrupa los tramos por tanqueo (los anticipos viejos sin tanqueo quedan solos). */
function agruparPorTanqueo(tramos: AnticipoBomba[]): Tanqueo[] {
  const grupos = new Map<string, AnticipoBomba[]>();
  for (const t of tramos) {
    const clave = t.tanqueoId ? `t${t.tanqueoId}` : `a${t.id}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), t]);
  }
  return [...grupos.entries()].map(([clave, ts]) => {
    const ida = ts.find((t) => t.tramo === "IDA") ?? ts[0];
    return {
      clave,
      tanqueoId: ida.tanqueoId,
      fecha: ida.fecha,
      placa: ida.placa ?? "",
      bomba: ida.bomba,
      idaYVuelta: ida.idaYVuelta,
      facturaBomba: ida.facturaBomba,
      fechaFacturaBomba: ida.fechaFacturaBomba,
      flota: ida.flota,
      tramos: [...ts].sort((a, b) => (a.tramo === "IDA" ? -1 : 1) - (b.tramo === "IDA" ? -1 : 1)),
      efectivo: ts.reduce((s, t) => s + t.efectivo, 0),
      combustible: ts.reduce((s, t) => s + t.combustible, 0),
      total: ts.reduce((s, t) => s + t.valor, 0),
    };
  });
}

/** "LOPEZ", "M&C" o "TERCERO" para la columna Empresa del vehiculo. */
const flotaTexto = (f: string | null) => (f === "LOPEZ" ? "LOPEZ" : f === "MYC" ? "M&C" : f === "TERCERO" ? "TERCERO" : "-");

/** Lo que el tramo cambio con el cruce: combustible calculado - lo que se habia registrado. */
const diferencia = (t: AnticipoBomba) => (t.galones === null || t.combustibleEntregado === null ? null : t.combustible - t.combustibleEntregado);

/** Recorrido (empresa del viaje) o la vuelta que aun espera el proximo viaje. */
function Recorrido({ t }: { t: AnticipoBomba }) {
  if (!t.cuadroViajeId) return <span className="texto-vencido">Pendiente: proximo viaje de {placaConGuion(t.placa ?? "")}</span>;
  return (
    <>
      {t.empresa ?? "-"}
      {t.manifiesto && <span className="dato-sec codigo">Manifiesto {t.manifiesto}</span>}
    </>
  );
}

type Vista = "viaje" | "tanqueo" | "deuda" | "pagado" | "abonos" | "cruce" | "empresas";
const VISTAS: Array<{ id: Vista; etiqueta: string }> = [
  { id: "viaje", etiqueta: "Por viaje" },
  { id: "tanqueo", etiqueta: "Por tanqueo" },
  { id: "deuda", etiqueta: "Deuda con la bomba" },
  { id: "pagado", etiqueta: "Pagado a la bomba" },
  { id: "abonos", etiqueta: "Abonos del socio" },
  { id: "cruce", etiqueta: "Cruce con la bomba" },
  // Lo que dan los clientes en sus viajes: aparte de la bomba; se cobra desde Cartera.
  { id: "empresas", etiqueta: "Anticipos de empresas" },
];

/**
 * Pantalla Anticipos. Los anticipos se registran en cada viaje del Cuadro
 * pagos; aqui se ven todos, se corrobora la factura de la bomba, se registra
 * lo pagado y lo abonado por el socio, y se cruza con la relacion de la bomba.
 */
export default function CuadroAnticipos() {
  const carga = useDatos(() => Promise.all([apiCuadro.cuadroAnticipos(), apiCuadro.resumenBomba(), apiCuadro.abonosSocio()]), []);
  const [tramos, setTramos] = useState<AnticipoBomba[] | null>(null);
  const [resumen, setResumen] = useState<ResumenBomba | null>(null);
  const [abonos, setAbonos] = useState<AbonoSocio[]>([]);
  const [vista, setVista] = useState<Vista>("viaje");
  const [error, setError] = useState<string | null>(null);
  const [editandoCupo, setEditandoCupo] = useState(false);
  const [nuevoAbono, setNuevoAbono] = useState(false);
  const [importando, setImportando] = useState(false);

  useEffect(() => {
    if (!carga.datos) return;
    setTramos(carga.datos[0]);
    setResumen(carga.datos[1]);
    setAbonos(carga.datos[2]);
  }, [carga.datos]);

  /** Guarda un cambio de un tramo o tanqueo y refresca el cuadro y las cuentas. */
  async function guardar(accion: () => Promise<AnticipoBomba[]>) {
    setError(null);
    try {
      setTramos(await accion());
      setResumen(await apiCuadro.resumenBomba());
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }

  if (carga.cargando && !tramos) return <Cargando que="los anticipos" />;
  if (carga.error) return <ErrorCarga mensaje={carga.error} alReintentar={carga.recargar} />;
  if (!tramos) return null;

  const conBomba = tramos.filter((t) => t.bombaId !== null);
  const columnaPago: Columna<AnticipoBomba> = {
    id: "pago",
    titulo: "Fecha de pago",
    valor: (t) => t.fechaPago,
    celda: (t) => (
      <input
        type="date"
        value={t.fechaPago ?? ""}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => guardar(() => apiCuadro.actualizarTramo(t.id, { fechaPago: e.target.value }))}
      />
    ),
  };
  const columnasViaje: Columna<AnticipoBomba>[] = [
    { id: "fecha", titulo: "Fecha anticipo", valor: (t) => t.fecha, celda: (t) => fechaCorta(t.fecha) },
    { id: "placa", titulo: "Placa", filtrable: true, valor: (t) => placaConGuion(t.placa ?? ""), celda: (t) => placaConGuion(t.placa ?? "") },
    { id: "empresa", titulo: "Empresa / recorrido", filtrable: true, valor: (t) => t.empresa ?? "Pendiente", celda: (t) => <Recorrido t={t} /> },
    {
      id: "tramo",
      titulo: "Tramo",
      filtrable: true,
      valor: (t) => (t.tramo === "VUELTA" ? "Vuelta" : "Ida"),
      celda: (t) => <Pastilla tono={t.tramo === "VUELTA" ? "info" : "neutro"}>{t.tramo === "VUELTA" ? "Vuelta" : "Ida"}</Pastilla>,
    },
    { id: "efectivo", titulo: "Efectivo", alinear: "derecha", valor: (t) => t.efectivo, celda: (t) => moneda(t.efectivo) },
    { id: "combustible", titulo: "Combust.", alinear: "derecha", valor: (t) => t.combustible, celda: (t) => moneda(t.combustible) },
    { id: "total", titulo: "Valor total", alinear: "derecha", valor: (t) => t.valor, celda: (t) => <strong>{moneda(t.valor)}</strong> },
    { id: "eds", titulo: "EDS", filtrable: true, valor: (t) => t.bomba ?? "Solo efectivo", celda: (t) => t.bomba ?? <span className="dato-sec">Solo efectivo</span> },
    { id: "factura", titulo: "N° factura", valor: (t) => t.facturaBomba, celda: (t) => <span className="codigo">{t.facturaBomba ?? "-"}</span> },
    { id: "fechaFactura", titulo: "Fecha factura", valor: (t) => t.fechaFacturaBomba, celda: (t) => fechaCorta(t.fechaFacturaBomba) },
    { id: "flota", titulo: "Empresa del vehiculo", filtrable: true, valor: (t) => flotaTexto(t.flota), celda: (t) => flotaTexto(t.flota) },
    columnaPago,
  ];

  const columnasTanqueo: Columna<Tanqueo>[] = [
    { id: "fecha", titulo: "Fecha", valor: (g) => g.fecha, celda: (g) => fechaCorta(g.fecha) },
    { id: "placa", titulo: "Placa", filtrable: true, valor: (g) => placaConGuion(g.placa), celda: (g) => placaConGuion(g.placa) },
    {
      id: "recorrido",
      titulo: "Recorrido",
      filtrable: true,
      valor: (g) => (g.idaYVuelta ? "Ida y vuelta" : "Un recorrido"),
      celda: (g) => (
        <>
          <Pastilla tono={g.idaYVuelta ? "info" : "neutro"}>{g.idaYVuelta ? "Ida y vuelta" : "Un recorrido"}</Pastilla>
          {g.tramos.map((t) => (
            <span key={t.id} className="dato-sec">
              {t.tramo === "VUELTA" ? "Vuelta" : "Ida"}: {t.cuadroViajeId ? t.empresa : "pendiente del proximo viaje"} · {moneda(t.valor)}
            </span>
          ))}
        </>
      ),
    },
    { id: "eds", titulo: "EDS", filtrable: true, valor: (g) => g.bomba ?? "Solo efectivo", celda: (g) => g.bomba ?? <span className="dato-sec">Solo efectivo</span> },
    { id: "efectivo", titulo: "Efectivo", alinear: "derecha", valor: (g) => g.efectivo, celda: (g) => moneda(g.efectivo) },
    { id: "combustible", titulo: "Combust.", alinear: "derecha", valor: (g) => g.combustible, celda: (g) => moneda(g.combustible) },
    { id: "total", titulo: "Total", alinear: "derecha", valor: (g) => g.total, celda: (g) => <strong>{moneda(g.total)}</strong> },
    {
      id: "factura",
      titulo: "N° factura bomba",
      valor: (g) => g.facturaBomba,
      celda: (g) =>
        g.tanqueoId ? (
          <input
            defaultValue={g.facturaBomba ?? ""}
            placeholder="AE5027109"
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) =>
              e.target.value.trim() !== (g.facturaBomba ?? "") &&
              guardar(() => apiCuadro.actualizarTanqueo(g.tanqueoId!, { facturaBomba: e.target.value }))
            }
          />
        ) : (
          <span className="dato-sec">Anticipo anterior</span>
        ),
    },
    {
      id: "fechaFactura",
      titulo: "Fecha factura",
      valor: (g) => g.fechaFacturaBomba,
      celda: (g) =>
        g.tanqueoId ? (
          <input
            type="date"
            value={g.fechaFacturaBomba ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => guardar(() => apiCuadro.actualizarTanqueo(g.tanqueoId!, { fechaFacturaBomba: e.target.value }))}
          />
        ) : (
          "-"
        ),
    },
    { id: "flota", titulo: "Empresa del vehiculo", filtrable: true, valor: (g) => flotaTexto(g.flota), celda: (g) => flotaTexto(g.flota) },
  ];

  // Cruce con la relacion quincenal de la bomba (como la columna COMBUST. del
  // Excel): al escribir galones, precio o descuento, el backend recalcula el
  // combustible = round(galones x precio - descuento). Vacio = lo sugerido.
  const campoCruce = (t: AnticipoBomba, campo: "galones" | "precioGalon" | "descuento", ancho: string, sugerido?: number) => (
    <input
      // key con el valor: al recalcular, el campo muestra lo que quedo guardado.
      key={`${t.id}-${campo}-${t[campo]}`}
      type="number"
      min={0}
      step={campo === "galones" ? "0.001" : "1"}
      style={{ width: ancho }}
      defaultValue={enInput(t[campo])}
      placeholder={sugerido === undefined ? "" : String(sugerido)}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => deInput(e.target.value) !== t[campo] && guardar(() => apiCuadro.actualizarTramo(t.id, { [campo]: e.target.value }))}
    />
  );
  const columnasCruce: Columna<AnticipoBomba>[] = [
    { id: "fecha", titulo: "Fecha", valor: (t) => t.fecha, celda: (t) => fechaCorta(t.fecha) },
    { id: "placa", titulo: "Placa", filtrable: true, valor: (t) => placaConGuion(t.placa ?? ""), celda: (t) => placaConGuion(t.placa ?? "") },
    { id: "empresa", titulo: "Viaje", valor: (t) => t.empresa ?? "Pendiente", celda: (t) => <Recorrido t={t} /> },
    { id: "factura", titulo: "N° factura", filtrable: true, valor: (t) => t.facturaBomba ?? "Sin factura", celda: (t) => <span className="codigo">{t.facturaBomba ?? "-"}</span> },
    { id: "galones", titulo: "Galones", valor: (t) => t.galones, celda: (t) => campoCruce(t, "galones", "7rem") },
    {
      id: "precio",
      titulo: "Precio galon",
      valor: (t) => t.precioGalon ?? resumen?.precioGalonBomba,
      celda: (t) => campoCruce(t, "precioGalon", "7rem", resumen?.precioGalonBomba),
    },
    {
      id: "descuento",
      titulo: "Descuento ($)",
      valor: (t) => t.descuento,
      celda: (t) =>
        campoCruce(t, "descuento", "7rem", t.galones !== null && resumen ? Math.round(t.galones * resumen.descuentoGalonBomba) : undefined),
    },
    {
      id: "combustible",
      titulo: "Combustible",
      alinear: "derecha",
      valor: (t) => t.combustible,
      celda: (t) => (
        <>
          <strong>{moneda(t.combustible)}</strong>
          <span className="dato-sec">{t.galones === null ? "Sin cruzar" : "Galones x precio - descuento"}</span>
        </>
      ),
    },
    {
      id: "entregado",
      titulo: "Registrado antes",
      alinear: "derecha",
      valor: (t) => t.combustibleEntregado ?? t.combustible,
      celda: (t) => moneda(t.combustibleEntregado ?? t.combustible),
    },
    {
      id: "diferencia",
      titulo: "Diferencia",
      alinear: "derecha",
      valor: (t) => diferencia(t),
      celda: (t) => {
        const d = diferencia(t);
        if (d === null) return "-";
        return <span className={Math.abs(d) >= 1000 ? "texto-vencido" : "dato-sec"}>{moneda(d)}</span>;
      },
    },
  ];

  const columnasAbonos: Columna<AbonoSocio>[] = [
    { id: "fecha", titulo: "Fecha", valor: (a) => a.fecha, celda: (a) => fechaCorta(a.fecha) },
    { id: "socio", titulo: "Socio", filtrable: true, valor: (a) => a.socio, celda: (a) => a.socio },
    { id: "valor", titulo: "Abonado", alinear: "derecha", valor: (a) => a.valor, celda: (a) => <strong>{moneda(a.valor)}</strong> },
    {
      id: "viajes",
      titulo: "Viajes",
      valor: (a) => a.viajes.map((v) => `${v.placa} ${v.empresa}`).join(" "),
      celda: (a) =>
        a.viajes.map((v) => (
          <span key={v.cuadroViajeId} className="dato-sec">
            {placaConGuion(v.placa ?? "")} · {v.empresa ?? "-"} {v.fecha ? `(${fechaCorta(v.fecha)})` : ""} · {moneda(v.valor)}
          </span>
        )),
    },
    { id: "nota", titulo: "Nota", valor: (a) => a.nota, celda: (a) => a.nota ?? "-" },
    {
      id: "acciones",
      titulo: "",
      celda: (a) => (
        <button
          className="btn-link"
          onClick={async (e) => {
            e.stopPropagation();
            if (!window.confirm(`¿Borrar el abono de ${a.socio} por ${moneda(a.valor)}?`)) return;
            setAbonos(await apiCuadro.borrarAbono(a.id));
            setResumen(await apiCuadro.resumenBomba());
          }}
        >
          Borrar
        </button>
      ),
    },
  ];

  const pestanasViaje: PestanaTabla<AnticipoBomba>[] = [
    { id: "todos", etiqueta: "Todos", incluye: () => true },
    { id: "pendientes", etiqueta: "Vueltas pendientes", incluye: (t) => !t.cuadroViajeId },
    { id: "sinPagar", etiqueta: "Sin pagar a la bomba", incluye: (t) => !t.fechaPago && t.bombaId !== null },
  ];
  const pestanasTanqueo: PestanaTabla<Tanqueo>[] = [
    { id: "todos", etiqueta: "Todos", incluye: () => true },
    { id: "sinFactura", etiqueta: "Sin factura de la bomba", incluye: (g) => !!g.tanqueoId && g.combustible > 0 && !g.facturaBomba },
    { id: "idaYVuelta", etiqueta: "Ida y vuelta", incluye: (g) => g.idaYVuelta },
  ];
  const pestanasCruce: PestanaTabla<AnticipoBomba>[] = [
    { id: "porCruzar", etiqueta: "Sin galones", incluye: (t) => t.galones === null },
    { id: "diferencia", etiqueta: "Con diferencia", incluye: (t) => Math.abs(diferencia(t) ?? 0) >= 1000 },
    { id: "todos", etiqueta: "Todos", incluye: () => true },
  ];

  const r = resumen;
  return (
    <>
      {r && (
        <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
          <Indicador dinero titulo="Deuda con la bomba" valor={moneda(r.pendiente)} detalle={`de ${moneda(r.deuda)} entregado`} />
          <Indicador dinero titulo="Pagado a la bomba" valor={moneda(r.pagado)} />
          <Indicador dinero titulo="Abonado por el socio" valor={moneda(r.abonadoSocio)} detalle={`${abonos.length} abono(s)`} />
          <Indicador
            dinero
            titulo="Cupo disponible"
            valor={moneda(r.cupoDisponible)}
            detalle={`de ${moneda(r.cupoBomba)}`}
            alerta={r.cupoDisponible < r.cupoBomba * 0.1}
          />
        </div>
      )}
      {error && <div className="alert danger">{error}</div>}
      <div className="barra-envio">
        <div className="tabla-pestanas selector-vista" style={{ marginBottom: 0 }}>
          {VISTAS.map((v) => (
            <button key={v.id} className={vista === v.id ? "activa" : ""} onClick={() => setVista(v.id)}>
              {v.etiqueta}
            </button>
          ))}
        </div>
        <button className="boton-barra" style={{ marginLeft: "auto" }} onClick={() => setImportando(true)}>
          Importar Excel de anticipos
        </button>
        <button className="boton-barra" onClick={() => setEditandoCupo(true)}>
          Cupo y precios de la bomba
        </button>
        <button className="btn-primary boton-con-texto" onClick={() => setNuevoAbono(true)}>
          Registrar abono del socio
        </button>
      </div>
      <div className="section-desc" style={{ margin: "0.4rem 0 0.6rem" }} hidden={vista === "empresas"}>
        {vista === "cruce"
          ? `Para cruzar con la relacion de la bomba: escribe los galones del tiquete y el combustible del tramo se calcula como en el Excel: galones x precio - descuento, redondeado. Precio sugerido ${moneda(r?.precioGalonBomba ?? 0)}; descuento sugerido galones x ${moneda(r?.descuentoGalonBomba ?? 0)}. Los dos se pueden cambiar en cada fila; vacios, se usan los sugeridos.`
          : "Los anticipos se registran en cada viaje del Cuadro pagos (el viaje → Anticipos). La deuda con la bomba es todo lo entregado en ella menos lo pagado y lo que abono el socio."}
      </div>
      {vista === "empresas" && <AnticiposEmpresas />}
      <div className="panel" hidden={vista === "empresas"}>
        {vista === "viaje" && (
          <TablaDatos filas={tramos} columnas={columnasViaje} clave={(t) => t.id} pestanas={pestanasViaje} nombreArchivo="anticipos-por-viaje"
            placeholderBusqueda="Buscar placa, empresa, bomba, factura..." vacio="No hay anticipos con estos criterios." />
        )}
        {vista === "tanqueo" && (
          <TablaDatos filas={agruparPorTanqueo(tramos)} columnas={columnasTanqueo} clave={(g) => g.clave} pestanas={pestanasTanqueo}
            nombreArchivo="anticipos-por-tanqueo" placeholderBusqueda="Buscar placa, bomba, factura..." vacio="No hay tanqueos con estos criterios." />
        )}
        {vista === "deuda" && (
          <TablaDatos filas={conBomba.filter((t) => !t.fechaPago)} columnas={columnasViaje} clave={(t) => t.id} nombreArchivo="deuda-bomba"
            placeholderBusqueda="Buscar placa, empresa, factura..." vacio="No hay nada pendiente de pagar a la bomba." />
        )}
        {vista === "pagado" && (
          <TablaDatos filas={conBomba.filter((t) => !!t.fechaPago)} columnas={columnasViaje} clave={(t) => t.id} nombreArchivo="pagado-bomba"
            placeholderBusqueda="Buscar placa, empresa, factura..." vacio="Aun no hay pagos a la bomba registrados." />
        )}
        {vista === "abonos" && (
          <TablaDatos filas={abonos} columnas={columnasAbonos} clave={(a) => a.id} nombreArchivo="abonos-socio"
            placeholderBusqueda="Buscar socio, placa, empresa..." vacio="Aun no hay abonos del socio." />
        )}
        {vista === "cruce" && (
          <TablaDatos filas={conBomba.filter((t) => t.combustible > 0)} columnas={columnasCruce} clave={(t) => t.id} pestanas={pestanasCruce}
            nombreArchivo="cruce-bomba" placeholderBusqueda="Buscar placa, factura..." vacio="No hay tanqueos con estos criterios." />
        )}
      </div>

      {editandoCupo && r && (
        <VentanaCupo
          resumen={r}
          alCerrar={() => setEditandoCupo(false)}
          alGuardar={async () => {
            setEditandoCupo(false);
            setResumen(await apiCuadro.resumenBomba());
          }}
        />
      )}
      {importando && <ImportarAnticipos alCerrar={() => setImportando(false)} alCambiar={() => carga.recargar()} />}
      {nuevoAbono && (
        <VentanaAbono
          alCerrar={() => setNuevoAbono(false)}
          alGuardar={async (lista) => {
            setNuevoAbono(false);
            setAbonos(lista);
            setResumen(await apiCuadro.resumenBomba());
            setVista("abonos");
          }}
        />
      )}
    </>
  );
}

/** Cupo de credito con la bomba y precio / descuento por galon sugeridos para el cruce. */
function VentanaCupo({ resumen, alCerrar, alGuardar }: { resumen: ResumenBomba; alCerrar: () => void; alGuardar: () => void }) {
  const [f, setF] = useState({
    cupoBomba: String(resumen.cupoBomba),
    precioGalonBomba: String(resumen.precioGalonBomba),
    descuentoGalonBomba: String(resumen.descuentoGalonBomba),
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await apiCuadro.guardarParametrosBomba({
        cupoBomba: Number(f.cupoBomba),
        precioGalonBomba: Number(f.precioGalonBomba),
        descuentoGalonBomba: Number(f.descuentoGalonBomba),
      });
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }
  return (
    <Modal
      titulo="Cupo y precios de la bomba"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Cupo de credito con la bomba</label>
          <input type="number" min={0} value={f.cupoBomba} onChange={(e) => setF({ ...f, cupoBomba: e.target.value })} />
          <span className="dato-sec">{moneda(Number(f.cupoBomba) || 0)}</span>
        </div>
        <div>
          <label>Precio por galon sugerido</label>
          <input type="number" min={0} value={f.precioGalonBomba} onChange={(e) => setF({ ...f, precioGalonBomba: e.target.value })} />
        </div>
        <div>
          <label>Descuento por galon sugerido</label>
          <input type="number" min={0} value={f.descuentoGalonBomba} onChange={(e) => setF({ ...f, descuentoGalonBomba: e.target.value })} />
          <span className="dato-sec">Por la sociedad. En el cruce se sugiere galones x este valor, en pesos.</span>
        </div>
      </div>
      <div className="dato-sec" style={{ marginTop: "0.6rem" }}>
        Se sugieren en el cruce de los tramos que no tienen uno propio: combustible = galones x precio - descuento.
      </div>
    </Modal>
  );
}

/** Una linea del abono: viaje y valor. */
interface LineaAbono {
  cuadroViajeId: number | null;
  valor: string;
}

/**
 * Abono del socio directamente a la bomba: quien, cuando y cuanto a cada viaje
 * (los que se cargaron con el). El total es la suma de los viajes.
 */
function VentanaAbono({ alCerrar, alGuardar }: { alCerrar: () => void; alGuardar: (abonos: AbonoSocio[]) => void }) {
  const viajes = useDatos(() => apiCuadro.listar(), []);
  const [socio, setSocio] = useState("EL ZORRO");
  const [fecha, setFecha] = useState(hoyColombia());
  const [nota, setNota] = useState("");
  const [lineas, setLineas] = useState<LineaAbono[]>([{ cuadroViajeId: null, valor: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const opciones = (viajes.datos ?? []).filter((v) => !v.anulado);
  const total = lineas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const completas = lineas.filter((l) => l.cuadroViajeId && Number(l.valor) > 0);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      alGuardar(
        await apiCuadro.registrarAbono({
          socio,
          fecha,
          nota,
          viajes: completas.map((l) => ({ cuadroViajeId: l.cuadroViajeId!, valor: Number(l.valor) })),
        })
      );
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }
  const cambiar = (i: number, c: Partial<LineaAbono>) => setLineas(lineas.map((l, j) => (j === i ? { ...l, ...c } : l)));

  return (
    <Modal
      titulo="Abono del socio a la bomba"
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <span className="dato-sec" style={{ marginRight: "auto" }}>
            Total abonado: <strong>{moneda(total)}</strong>
          </span>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={guardando || !socio.trim() || !fecha || completas.length === 0}>
            {guardando ? "Guardando..." : "Guardar abono"}
          </button>
        </>
      }
    >
      <div className="section-desc" style={{ marginBottom: "0.6rem" }}>
        El socio le paga directamente a la bomba los anticipos de algunos viajes. Lo abonado se descuenta de la deuda con
        la bomba al cruzar con ella.
      </div>
      {error && <div className="alert danger">{error}</div>}
      <div className="campos-cuadro">
        <div>
          <label>Socio</label>
          <input value={socio} onChange={(e) => setSocio(e.target.value.toUpperCase())} />
        </div>
        <div>
          <label>Fecha del abono</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <label>Nota (opcional)</label>
          <input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} />
        </div>
      </div>
      <h4 style={{ margin: "1rem 0 0.4rem" }}>Viajes a los que corresponde</h4>
      {viajes.cargando && !viajes.datos && <Cargando que="los viajes" />}
      {lineas.map((l, i) => (
        <div key={i} className="linea-abono">
          <div style={{ flex: 1 }}>
            <ComboBuscable
              opciones={opciones}
              valor={l.cuadroViajeId}
              alCambiar={(id) => cambiar(i, { cuadroViajeId: id })}
              obtenerId={(v) => v.id}
              obtenerEtiqueta={(v) =>
                `${placaConGuion(v.placa)} · ${fechaCorta(v.fecha)} · ${v.empresa}${v.manifiesto ? ` · ${v.manifiesto}` : ""}`
              }
              placeholder="Busca por placa, fecha o empresa..."
            />
          </div>
          <input type="number" min={0} placeholder="Valor" style={{ width: "10rem" }} value={l.valor} onChange={(e) => cambiar(i, { valor: e.target.value })} />
          <button className="btn-link" onClick={() => setLineas(lineas.length > 1 ? lineas.filter((_, j) => j !== i) : [{ cuadroViajeId: null, valor: "" }])}>
            Quitar
          </button>
        </div>
      ))}
      <button className="btn-link" onClick={() => setLineas([...lineas, { cuadroViajeId: null, valor: "" }])}>
        + Agregar otro viaje
      </button>
    </Modal>
  );
}
