/**
 * Rentabilidad: cuanto deja cada viaje cuando el cliente le paga a la empresa
 * (reemplaza el Excel "ejemplo rentabilidad"). Una pestana por grupo de
 * carros (TERCEROS, CELSO, MAURICIO, MILLER, SOCIEDAD, JTY-221, SWK-973,
 * XGJ-197); las cuentas las hace el backend (src/rentabilidad.ts) con lo que
 * ya esta en el Cuadro pagos, Anticipos y Pago a terceros.
 *
 * Clic en un viaje: se corrigen a mano la comision, T. Lopez, el descargue,
 * la poliza, el ReteICA del cliente y la fecha en que se repartio la ganancia.
 * Exportar descarga el Excel del grupo con lo filtrado (para sacar el de uno o
 * dos carros, se filtra por placa).
 */
import { useState } from "react";
import { apiCuadro, apiSeguimiento, moneda } from "../../api/cliente";
import type { ClaveRetencion, ComisionCliente, FilaRentabilidad, RetencionCliente } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import Indicador from "../../componentes/Indicador";
import Modal from "../../componentes/Modal";
import MenuMas from "../../componentes/MenuMas";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "../cuadro/estadosCuadro";
import { numeroONulo } from "./liquidacionTerceros";
import { descargarRentabilidad, leerMatrices } from "./excelRentabilidad";

/** Orden de las pestanas (los grupos que no esten aqui van al final). */
const ORDEN_GRUPOS = ["TERCEROS", "CELSO", "MAURICIO", "MILLER", "SOCIEDAD", "JTY-221", "SWK-973", "XGJ-197"];

const PESTANAS: PestanaTabla<FilaRentabilidad>[] = [
  { id: "pagados", etiqueta: "Pagados por el cliente", incluye: (f) => !!f.fechaPagoEmpresa },
  { id: "porCobrar", etiqueta: "Por cobrar", incluye: (f) => f.valorEmpresa > 0 && !f.fechaPagoEmpresa },
  { id: "sinFlete", etiqueta: "Sin flete", incluye: (f) => f.valorEmpresa === 0 },
  { id: "sinPagarDueno", etiqueta: "Cobrados sin pagar al dueno", incluye: (f) => !!f.fechaPagoEmpresa && !f.fechaPagoBeneficiario },
  { id: "sinRepartir", etiqueta: "Ganancia sin repartir", incluye: (f) => !!f.fechaPagoEmpresa && !f.fechaPagoRentabilidad },
  { id: "todos", etiqueta: "Todos", incluye: () => true },
];

/** Retenciones del flete de la empresa (retefuente y FOPAT, ICA y Supertransporte; la comision bancaria no). */
const descuentosEmpresa = (f: FilaRentabilidad) => f.retencion + f.reteIca + f.supertransporte;

/** Lo que sale del flete del tercero o del dueno: comision bancaria (4 x 1000 + 5.000) y otros descuentos con su concepto. */
const columnasDescuentoBeneficiario: Columna<FilaRentabilidad>[] = [
  { id: "bancaria", titulo: "Comision bancaria", alinear: "derecha", valor: (f) => f.bancaria, celda: (f) => moneda(f.bancaria) },
  {
    id: "otros",
    titulo: "Otros descuentos",
    alinear: "derecha",
    valor: (f) => f.otrosDescuentos,
    buscar: (f) => f.rentOtrosConcepto,
    celda: (f) =>
      f.otrosDescuentos ? (
        <>
          {moneda(f.otrosDescuentos)}
          {f.rentOtrosConcepto && <span className="dato-sec">{f.rentOtrosConcepto}</span>}
        </>
      ) : (
        "-"
      ),
  },
];

/** Fecha corta o "-". */
const fechaO = (f: string | null) => (f ? fechaCorta(f) : "-");

/** Columnas comunes al principio de las dos tablas. */
const columnasInicio = (terceros: boolean): Columna<FilaRentabilidad>[] => [
  { id: "fecha", titulo: "Fecha", valor: (f) => f.fecha, celda: (f) => fechaCorta(f.fecha) },
  { id: "mes", titulo: "Mes", filtrable: true, valor: (f) => f.fecha.slice(0, 7), celda: (f) => f.fecha.slice(0, 7) },
  {
    id: "placa",
    titulo: terceros ? "Placa / tercero" : "Placa",
    filtrable: true,
    valor: (f) => f.placa,
    buscar: (f) => f.tercero,
    celda: (f) => (
      <>
        <span className="principal">{f.placa}</span>
        {terceros && f.tercero && <span className="dato-sec">{f.tercero}</span>}
      </>
    ),
  },
  { id: "empresa", titulo: "Empresa", filtrable: true, valor: (f) => f.empresa, celda: (f) => f.empresa },
  {
    id: "remision",
    titulo: "Remision / factura",
    valor: (f) => f.remision ?? f.manifiesto ?? "",
    buscar: (f) => f.facturaNumero,
    celda: (f) => (
      <>
        <span>{f.remision ?? f.manifiesto ?? "-"}</span>
        {f.facturaNumero && <span className="dato-sec">Fact. {f.facturaNumero}</span>}
      </>
    ),
  },
  {
    id: "valor",
    titulo: "Valor empresa",
    alinear: "derecha",
    valor: (f) => f.valorEmpresa,
    celda: (f) => (f.valorEmpresa ? moneda(f.valorEmpresa) : <span className="texto-vencido">Sin flete</span>),
  },
  {
    id: "descuentos",
    titulo: "Retenciones",
    alinear: "derecha",
    valor: descuentosEmpresa,
    celda: (f) => (
      <span title={`Retef. + FOPAT ${moneda(f.retencion)} · ICA ${f.icaPorMil} por mil ${moneda(f.reteIca)} · Supertransporte ${moneda(f.supertransporte)}`}>
        {moneda(descuentosEmpresa(f))}
      </span>
    ),
  },
];

/** Columnas de ganancia y fechas al final (terceros: "Pago al tercero"; socios: "Pago al dueno"). */
const columnasFin = (terceros: boolean): Columna<FilaRentabilidad>[] => [
  {
    id: "ganancia",
    titulo: "Ganancia empresa",
    alinear: "derecha",
    valor: (f) => f.ganancia,
    celda: (f) => <strong className={f.ganancia < 0 ? "texto-vencido" : ""}>{moneda(f.ganancia)}</strong>,
  },
  { id: "pagoCliente", titulo: "Pago del cliente", valor: (f) => f.fechaPagoEmpresa ?? "", celda: (f) => fechaO(f.fechaPagoEmpresa) },
  {
    id: "pagoDueno",
    titulo: terceros ? "Pago al tercero" : "Pago al dueno",
    valor: (f) => f.fechaPagoBeneficiario ?? "",
    celda: (f) => (f.fechaPagoBeneficiario ? fechaCorta(f.fechaPagoBeneficiario) : <span className="dato-sec">Sin pagar</span>),
  },
  { id: "reparto", titulo: "Reparto ganancia", valor: (f) => f.fechaPagoRentabilidad ?? "", celda: (f) => fechaO(f.fechaPagoRentabilidad) },
];

const COLUMNAS_TERCEROS: Columna<FilaRentabilidad>[] = [
  ...columnasInicio(true),
  { id: "saldoEmpresa", titulo: "Saldo empresa", alinear: "derecha", valor: (f) => f.saldoEmpresa, celda: (f) => moneda(f.saldoEmpresa) },
  {
    id: "flete",
    titulo: "Flete tercero",
    alinear: "derecha",
    valor: (f) => f.fleteTercero,
    celda: (f) => (f.fleteTercero ? moneda(f.fleteTercero) : <span className="dato-sec">{f.concepto ? "Reconocido" : "Sin pactar"}</span>),
  },
  ...columnasDescuentoBeneficiario,
  {
    id: "saldoTercero",
    titulo: "Saldo tercero",
    alinear: "derecha",
    valor: (f) => f.saldoBeneficiario,
    celda: (f) => (
      <span title={`Retef. + FOPAT ${moneda(f.retencionTercero)} · ICA ${moneda(f.reteIcaTercero)} · comision bancaria ${moneda(f.bancaria)} · Supertransporte ${moneda(f.supertransporteTercero)} · poliza ${moneda(f.poliza)}`}>
        {moneda(f.saldoBeneficiario)}
      </span>
    ),
  },
  { id: "renta", titulo: "Anticipo renta", alinear: "derecha", valor: (f) => f.anticipoRenta, celda: (f) => moneda(f.anticipoRenta) },
  ...columnasFin(true),
];

const COLUMNAS_SOCIOS: Columna<FilaRentabilidad>[] = [
  ...columnasInicio(false),
  { id: "renta", titulo: "Anticipo renta", alinear: "derecha", valor: (f) => f.anticipoRenta, celda: (f) => moneda(f.anticipoRenta) },
  {
    id: "comision",
    titulo: "Comision + T. Lopez",
    alinear: "derecha",
    valor: (f) => f.comision + f.tLopez,
    celda: (f) => <span title={`Comision ${moneda(f.comision)} · T. Lopez ${moneda(f.tLopez)}`}>{moneda(f.comision + f.tLopez)}</span>,
  },
  {
    id: "descargue",
    titulo: "Descargue + poliza",
    alinear: "derecha",
    valor: (f) => f.descargue + f.poliza,
    celda: (f) => <span title={`Descargue CAME ${moneda(f.descargue)} · planilla-poliza ${moneda(f.poliza)}`}>{moneda(f.descargue + f.poliza)}</span>,
  },
  {
    id: "anticipo",
    titulo: "Anticipo",
    alinear: "derecha",
    valor: (f) => f.anticipo,
    celda: (f) => <span title={`Efectivo ${moneda(f.efectivo)} · combustible ${moneda(f.combustible)} · transferencia ${moneda(f.transferencia)}`}>{moneda(f.anticipo)}</span>,
  },
  ...columnasDescuentoBeneficiario,
  {
    id: "saldo",
    titulo: "Saldo al dueno",
    alinear: "derecha",
    valor: (f) => f.saldoBeneficiario,
    celda: (f) => <span className={f.saldoBeneficiario < 0 ? "texto-vencido" : ""}>{moneda(f.saldoBeneficiario)}</span>,
  },
  ...columnasFin(false),
];

/** Pagina de la rentabilidad. */
export default function Rentabilidad() {
  const datos = useDatos(() => apiSeguimiento.rentabilidad(), []);
  const [grupo, setGrupo] = useState("TERCEROS");
  const [editando, setEditando] = useState<FilaRentabilidad | null>(null);
  const [matrices, setMatrices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (datos.cargando && !datos.datos) return <Cargando que="la rentabilidad" />;
  if (datos.error || !datos.datos) return <ErrorCarga mensaje={datos.error ?? "Sin datos"} alReintentar={datos.recargar} />;

  const filas = datos.datos;
  const presentes = [...new Set(filas.map((f) => f.grupo))];
  const grupos = [...ORDEN_GRUPOS.filter((g) => presentes.includes(g)), ...presentes.filter((g) => !ORDEN_GRUPOS.includes(g)).sort()];
  const actual = grupos.includes(grupo) ? grupo : grupos[0] ?? "TERCEROS";
  const delGrupo = filas.filter((f) => f.grupo === actual);
  const conFlete = delGrupo.filter((f) => f.valorEmpresa > 0);
  const terceros = actual === "TERCEROS";
  const suma = (fs: FilaRentabilidad[], v: (f: FilaRentabilidad) => number) => fs.reduce((s, f) => s + v(f), 0);

  /** Descarga el Excel (una hoja por grupo). */
  async function exportar(lista: Array<{ grupo: string; filas: FilaRentabilidad[] }>, nombre: string) {
    setError(null);
    try {
      await descargarRentabilidad(lista, nombre);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo armar el Excel.");
    }
  }

  return (
    <>
      <div className="tarjeta indicadores" style={{ marginBottom: "0.75rem" }}>
        <Indicador dinero titulo="Fletes cobrados" valor={moneda(suma(conFlete, (f) => f.valorEmpresa))} detalle={`${conFlete.length} viajes con flete`} />
        <Indicador dinero titulo="Ganancia de la empresa" valor={moneda(suma(conFlete, (f) => f.ganancia))} alerta={suma(conFlete, (f) => f.ganancia) < 0} />
        <Indicador
          dinero
          titulo={terceros ? "Para los terceros" : "Para el dueno"}
          valor={moneda(suma(conFlete, (f) => f.saldoBeneficiario))}
          detalle="despues de descuentos"
        />
        <Indicador titulo="Viajes sin flete" valor={delGrupo.length - conFlete.length} detalle="no suman en los totales" />
      </div>
      <div className="dato-sec" style={{ marginBottom: "0.5rem" }}>
        {terceros
          ? "Terceros: retefuente y FOPAT, ReteICA y Supertransporte se calculan dos veces, sobre el flete de la empresa y sobre el del tercero. La comision bancaria sale del flete del tercero. Saldo empresa - saldo tercero = rentabilidad, sin contar los otros descuentos (prestamos, descuentos del cliente), que no son ganancia de la empresa; menos el anticipo de renta 3,5 % = ganancia."
          : "Socios y carros propios: lo que paga el cliente menos retenciones, anticipo de renta, comision bancaria, comision, T. Lopez, descargue, poliza, anticipo y otros descuentos = saldo al dueno. La empresa gana la comision y T. Lopez."}{" "}
        Clic en un viaje para corregir sus valores.
      </div>
      {error && <div className="alert danger">{error}</div>}
      <div className="tabla-pestanas selector-vista">
        {grupos.map((g) => (
          <button key={g} className={g === actual ? "activa" : ""} onClick={() => setGrupo(g)}>
            {g}
            <span className="contador">{filas.filter((f) => f.grupo === g).length}</span>
          </button>
        ))}
      </div>
      <div className="panel">
        <TablaDatos
          key={actual}
          filas={delGrupo}
          columnas={terceros ? COLUMNAS_TERCEROS : COLUMNAS_SOCIOS}
          clave={(f) => f.id}
          pestanas={PESTANAS}
          columnasFijas={1}
          placeholderBusqueda="Buscar placa, tercero, empresa, remision, factura..."
          vacio="No hay viajes con estos criterios."
          alClicFila={setEditando}
          alExportar={(visibles) => exportar([{ grupo: actual, filas: visibles }], `rentabilidad-${actual.toLowerCase()}-${hoyColombia()}`)}
          acciones={
            <MenuMas
              opciones={[
                {
                  etiqueta: "Excel de todos los grupos",
                  alElegir: () => exportar(grupos.map((g) => ({ grupo: g, filas: filas.filter((f) => f.grupo === g) })), `rentabilidad-${hoyColombia()}`),
                },
                { etiqueta: "Matrices de comisiones y retenciones", alElegir: () => setMatrices(true) },
              ]}
            />
          }
        />
      </div>
      {editando && (
        <EditarRentabilidad
          fila={editando}
          alCerrar={() => setEditando(null)}
          alGuardar={() => {
            setEditando(null);
            datos.recargar();
          }}
        />
      )}
      {matrices && (
        <VentanaMatrices
          alCerrar={() => setMatrices(false)}
          alGuardar={() => {
            setMatrices(false);
            datos.recargar();
          }}
        />
      )}
    </>
  );
}

/** Retenciones del flete de la empresa: se editan en todos los carros. */
const RETENCIONES_EMPRESA: Array<[ClaveRetencion, string]> = [
  ["retencion", "Retefuente 1 % + FOPAT 0,1 %"],
  ["reteIca", "ReteICA"],
  ["supertransporte", "Supertransporte 0,1201 %"],
];
/** Retenciones del flete pactado con el tercero. */
const RETENCIONES_TERCERO: Array<[ClaveRetencion, string]> = [
  ["retencionTercero", "Retefuente 1 % + FOPAT 0,1 %"],
  ["reteIcaTercero", "ReteICA"],
  ["supertransporteTercero", "Supertransporte 0,1201 %"],
  ["bancaria", "Comision bancaria (4 x 1000 + 5.000)"],
];
/** La comision bancaria del dueno. */
const RETENCIONES_DUENO: Array<[ClaveRetencion, string]> = [["bancaria", "Comision bancaria (4 x 1000 + 5.000)"]];

/** Texto de un numero para un campo (null = vacio). */
const enCampo = (n: number | null) => (n === null ? "" : String(n));

/**
 * Lo que se corrige a mano en un viaje para la rentabilidad. Vacio = el valor
 * de siempre (el que se muestra en gris).
 */
function EditarRentabilidad({ fila, alCerrar, alGuardar }: { fila: FilaRentabilidad; alCerrar: () => void; alGuardar: () => void }) {
  const terceros = fila.grupo === "TERCEROS";
  const [f, setF] = useState({
    rentComision: enCampo(fila.rentComision),
    rentTLopez: enCampo(fila.rentTLopez),
    rentDescargue: enCampo(fila.rentDescargue),
    rentPoliza: enCampo(fila.rentPoliza),
    rentIcaPorMil: enCampo(fila.rentIcaPorMil),
    fechaPagoRentabilidad: fila.fechaPagoRentabilidad ?? "",
    fechaPagoSaldo: fila.fechaPagoBeneficiario ?? "",
    rentOtrosDescuentos: enCampo(fila.rentOtrosDescuentos),
    rentOtrosConcepto: fila.rentOtrosConcepto ?? "",
  });
  /** Cada retencion: su valor escrito (vacio = el calculado) y si aplica (todas marcadas de entrada). */
  const [retenciones, setRetenciones] = useState<Partial<Record<ClaveRetencion, { valor: string; aplica: boolean }>>>(() =>
    Object.fromEntries(
      Object.entries(fila.rentRetenciones).map(([clave, a]) => [clave, { valor: enCampo(a?.valor ?? null), aplica: a?.aplica !== false }])
    )
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Guarda en el viaje del cuadro (vacio = null = el valor de siempre). */
  async function guardar() {
    setEnviando(true);
    setError(null);
    try {
      await apiCuadro.actualizar(fila.id, {
        rentComision: numeroONulo(f.rentComision),
        rentTLopez: numeroONulo(f.rentTLopez),
        rentDescargue: numeroONulo(f.rentDescargue),
        rentPoliza: numeroONulo(f.rentPoliza),
        rentIcaPorMil: numeroONulo(f.rentIcaPorMil),
        fechaPagoRentabilidad: f.fechaPagoRentabilidad || null,
        // La misma fecha de pago al dueno del Cuadro pagos.
        fechaPagoSaldo: f.fechaPagoSaldo || null,
        rentOtrosDescuentos: numeroONulo(f.rentOtrosDescuentos),
        rentOtrosConcepto: f.rentOtrosConcepto.trim() || null,
        // Solo las que se cambiaron; las demas se calculan y aplican.
        rentRetenciones: JSON.stringify(
          Object.fromEntries(
            Object.entries(retenciones)
              .filter(([, a]) => a && (a.valor !== "" || !a.aplica))
              .map(([clave, a]) => [clave, { valor: numeroONulo(a!.valor), aplica: a!.aplica }])
          )
        ),
      });
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setEnviando(false);
    }
  }

  /** Una retencion: casilla de si aplica y su valor (en gris, el calculado). */
  const retencion = ([clave, etiqueta]: [ClaveRetencion, string]) => {
    const a = retenciones[clave] ?? { valor: "", aplica: true };
    const cambiar = (c: Partial<typeof a>) => setRetenciones({ ...retenciones, [clave]: { ...a, ...c } });
    return (
      <tr key={clave} className={a.aplica ? "" : "dato-sec"}>
        <td>
          <label className="check-linea" style={{ margin: 0 }}>
            <input type="checkbox" checked={a.aplica} onChange={(e) => cambiar({ aplica: e.target.checked })} />
            {etiqueta}
          </label>
        </td>
        <td>
          <input
            type="number"
            min={0}
            aria-label={etiqueta}
            disabled={!a.aplica}
            value={a.valor}
            onChange={(e) => cambiar({ valor: e.target.value })}
            placeholder={String(fila.retencionesCalculadas[clave])}
          />
        </td>
      </tr>
    );
  };

  const campo = (clave: Exclude<keyof typeof f, "rentOtrosConcepto">, etiqueta: string, calculado: number, paso = "1") => (
    <div>
      <label>{etiqueta}</label>
      <input
        type="number"
        min={0}
        step={paso}
        value={f[clave]}
        onChange={(e) => setF({ ...f, [clave]: e.target.value })}
        // Sin nada escrito: el valor de siempre.
        placeholder={f[clave] === "" ? String(calculado) : ""}
      />
    </div>
  );
  const renglon = (etiqueta: string, valor: number, signo = "-") => (
    <tr key={etiqueta}>
      <td>{etiqueta}</td>
      <td className="num">{valor ? `${signo} ${moneda(valor)}` : "-"}</td>
    </tr>
  );

  return (
    <Modal
      ancho="wide"
      titulo={`Rentabilidad · ${fila.placa} · ${fechaCorta(fila.fecha)}`}
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={enviando}>
            {enviando ? "Guardando..." : "Guardar"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="dato-sec" style={{ marginBottom: "0.6rem" }}>
        {fila.empresa} · {fila.remision ?? fila.manifiesto ?? "sin remision"}
        {fila.facturaNumero ? ` · factura ${fila.facturaNumero}` : " · sin factura"} · grupo {fila.grupo}
        {fila.tercero ? ` · ${fila.tercero}` : ""}
      </div>
      <div className="campos-cuadro">
        {campo("rentComision", "Comision", fila.comision)}
        {campo("rentTLopez", "T. Lopez", fila.tLopez)}
        {!terceros && campo("rentDescargue", "Descargue CAME", fila.descargue)}
        {campo("rentPoliza", "Planilla - poliza RCE", fila.poliza)}
        {campo("rentIcaPorMil", "ReteICA del cliente (por mil)", fila.icaPorMil, "0.01")}
        {campo("rentOtrosDescuentos", "Otros descuentos", 0)}
        <div>
          <label>Concepto de otros descuentos</label>
          <input value={f.rentOtrosConcepto} maxLength={200} onChange={(e) => setF({ ...f, rentOtrosConcepto: e.target.value })} placeholder="Bateria, arreglo..." />
        </div>
        <div>
          <label>{terceros ? "Pago al tercero" : "Pago al dueno"}</label>
          <input type="date" value={f.fechaPagoSaldo} onChange={(e) => setF({ ...f, fechaPagoSaldo: e.target.value })} />
        </div>
        <div>
          <label>Pago de la rentabilidad</label>
          <input type="date" value={f.fechaPagoRentabilidad} onChange={(e) => setF({ ...f, fechaPagoRentabilidad: e.target.value })} />
        </div>
      </div>
      <div className="dato-sec">En gris, el valor de siempre (matriz de comisiones, descargue de 198.000, poliza de 3.000). Borrar un campo lo devuelve a ese valor.</div>

      <h4>Retenciones (desmarca las que no aplican)</h4>
      <table className="tabla tabla-compacta" style={{ maxWidth: 560 }}>
        <tbody>
          <tr>
            <th colSpan={2}>Flete de la empresa</th>
          </tr>
          {RETENCIONES_EMPRESA.map(retencion)}
          <tr>
            <th colSpan={2}>{terceros ? "Flete del tercero" : "Flete del dueno"}</th>
          </tr>
          {(terceros ? RETENCIONES_TERCERO : RETENCIONES_DUENO).map(retencion)}
        </tbody>
      </table>
      <div className="dato-sec">Los valores de abajo se actualizan al guardar.</div>

      <table className="tabla" style={{ maxWidth: 560, marginTop: "0.6rem" }}>
        <tbody>
          {renglon("Valor empresa (lo que paga el cliente)", fila.valorEmpresa, "")}
          {renglon("Retefuente 1 % + FOPAT 0,1 %", fila.retencion)}
          {renglon(`ReteICA ${fila.icaPorMil} por mil`, fila.reteIca)}
          {renglon("Supertransporte 0,1201 %", fila.supertransporte)}
          {renglon("T. Lopez", fila.tLopez)}
          {terceros && renglon("Comision", fila.comision)}
          {terceros ? (
            <>
              {renglon("Saldo empresa", fila.saldoEmpresa, "=")}
              {renglon("Flete pactado con el tercero", fila.fleteTercero, "")}
              {renglon("Retefuente 1 % + FOPAT 0,1 % del tercero", fila.retencionTercero)}
              {renglon("ReteICA del tercero", fila.reteIcaTercero)}
              {renglon("Gestion financiera (4 x 1000 + 5.000 + Supertransporte)", fila.bancaria + fila.supertransporteTercero)}
              {renglon("Planilla - poliza RCE", fila.poliza)}
              {renglon(fila.rentOtrosConcepto ? `Otros descuentos (${fila.rentOtrosConcepto})` : "Otros descuentos", fila.otrosDescuentos)}
              {renglon("Saldo al tercero", fila.saldoBeneficiario, "=")}
              {renglon("Rentabilidad (saldo empresa - saldo tercero - otros descuentos)", fila.rentabilidad, "=")}
              {renglon("Anticipo de renta 3,5 %", fila.anticipoRenta)}
            </>
          ) : (
            <>
              {renglon("Anticipo de renta 3,5 %", fila.anticipoRenta)}
              {renglon("Comision bancaria (4 x 1000 + 5.000)", fila.bancaria)}
              {renglon("Comision", fila.comision)}
              {renglon("Descargue CAME", fila.descargue)}
              {renglon("Planilla - poliza RCE", fila.poliza)}
              {renglon("Anticipo (bomba y transferencia)", fila.anticipo)}
              {renglon(fila.rentOtrosConcepto ? `Otros descuentos (${fila.rentOtrosConcepto})` : "Otros descuentos", fila.otrosDescuentos)}
              {renglon("Saldo al dueno", fila.saldoBeneficiario, "=")}
            </>
          )}
          <tr>
            <td>
              <strong>Ganancia de la empresa</strong>
            </td>
            <td className="num">
              <strong className={fila.ganancia < 0 ? "texto-vencido" : ""}>{moneda(fila.ganancia)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="dato-sec" style={{ marginTop: "0.4rem" }}>
        Pago del cliente {fechaO(fila.fechaPagoEmpresa)} · pago {terceros ? "al tercero" : "al dueno"} {fechaO(fila.fechaPagoBeneficiario)}
        {fila.valorEmpresa === 0 && (
          <>
            {" "}
            · <Pastilla tono="aviso">Sin flete: falta facturarlo en el Cuadro pagos</Pastilla>
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * Matrices de la rentabilidad: comision y T. Lopez por cliente, y ReteICA por
 * cliente. Se pueden cargar del Excel (hojas "Matriz Comisiones" y "Matriz
 * Retenciones") y corregir aqui. El nombre del cliente se busca dentro del de
 * la empresa del viaje (CORAME tambien encuentra CARTONES AMERICA).
 */
function VentanaMatrices({ alCerrar, alGuardar }: { alCerrar: () => void; alGuardar: () => void }) {
  const actuales = useDatos(() => apiSeguimiento.matricesRentabilidad(), []);
  const [comisiones, setComisiones] = useState<ComisionCliente[] | null>(null);
  const [retenciones, setRetenciones] = useState<RetencionCliente[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const listaC = comisiones ?? actuales.datos?.comisiones ?? [];
  const listaR = retenciones ?? actuales.datos?.retenciones ?? [];

  /** Carga las dos matrices del Excel (aun no guarda). */
  async function importar(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setTrabajando(true);
    try {
      const m = await leerMatrices(archivo);
      if (!m.comisiones.length && !m.retenciones.length) throw new Error('No se encontraron las hojas "Matriz Comisiones" ni "Matriz Retenciones".');
      if (m.comisiones.length) setComisiones(m.comisiones);
      if (m.retenciones.length) setRetenciones(m.retenciones);
      setAviso(`Leidas ${m.comisiones.length} comisiones y ${m.retenciones.length} retenciones. Revisalas y guarda.`);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo leer el archivo.");
    } finally {
      setTrabajando(false);
    }
  }

  /** Guarda las dos matrices (reemplaza las anteriores). */
  async function guardar() {
    setError(null);
    setTrabajando(true);
    try {
      await apiSeguimiento.guardarMatricesRentabilidad({ comisiones: listaC, retenciones: listaR });
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
      setTrabajando(false);
    }
  }

  const cambiarC = (i: number, c: Partial<ComisionCliente>) => setComisiones(listaC.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const cambiarR = (i: number, c: Partial<RetencionCliente>) => setRetenciones(listaR.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const numero = (t: string) => (t.trim() === "" ? 0 : Number(t));

  return (
    <Modal
      ancho="pantalla"
      titulo="Matrices de comisiones y retenciones"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={trabajando || actuales.cargando}>
            {trabajando ? "Guardando..." : "Guardar las matrices"}
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      {aviso && <div className="alert info">{aviso}</div>}
      {actuales.cargando && <Cargando que="las matrices" />}
      <div className="barra-envio">
        <label className="boton-barra" style={{ cursor: "pointer" }}>
          Cargar desde el Excel de rentabilidad
          <input type="file" accept=".xlsx" hidden onChange={(e) => importar(e.target.files?.[0])} />
        </label>
        <span className="dato-sec">El nombre del cliente se busca dentro del nombre de la empresa del viaje.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "1rem" }}>
        <div>
          <h4>Comisiones ({listaC.length})</h4>
          <div className="tabla-scroll" style={{ maxHeight: "50vh" }}>
            <table className="tabla tabla-compacta">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="num">Comision</th>
                  <th className="num">T. Lopez</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {listaC.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <input value={c.cliente} onChange={(e) => cambiarC(i, { cliente: e.target.value })} />
                    </td>
                    <td>
                      <input type="number" min={0} value={c.comision} onChange={(e) => cambiarC(i, { comision: numero(e.target.value) })} />
                    </td>
                    <td>
                      <input type="number" min={0} value={c.tLopez} onChange={(e) => cambiarC(i, { tLopez: numero(e.target.value) })} />
                    </td>
                    <td>
                      <button className="btn-link" onClick={() => setComisiones(listaC.filter((_, j) => j !== i))}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-link" onClick={() => setComisiones([...listaC, { cliente: "", comision: 0, tLopez: 0 }])}>
            + Agregar cliente
          </button>
        </div>
        <div>
          <h4>ReteICA por cliente ({listaR.length})</h4>
          <div className="tabla-scroll" style={{ maxHeight: "50vh" }}>
            <table className="tabla tabla-compacta">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="num">ReteICA (por mil)</th>
                  <th>Ciudad</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {listaR.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input value={r.cliente} onChange={(e) => cambiarR(i, { cliente: e.target.value })} />
                    </td>
                    <td>
                      <input type="number" min={0} step="0.01" value={r.reteicaPorMil} onChange={(e) => cambiarR(i, { reteicaPorMil: numero(e.target.value) })} />
                    </td>
                    <td>
                      <input value={r.ciudad ?? ""} onChange={(e) => cambiarR(i, { ciudad: e.target.value || null })} />
                    </td>
                    <td>
                      <button className="btn-link" onClick={() => setRetenciones(listaR.filter((_, j) => j !== i))}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-link" onClick={() => setRetenciones([...listaR, { cliente: "", reteicaPorMil: 0, ciudad: null }])}>
            + Agregar cliente
          </button>
        </div>
      </div>
      <div className="dato-sec" style={{ marginTop: "0.5rem" }}>
        Si un cliente sale varias veces (por ciudad), se usa el primero. Sin cliente en la matriz, el ReteICA es el sugerido del sistema.
      </div>
    </Modal>
  );
}
