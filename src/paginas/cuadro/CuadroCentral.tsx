/**
 * Pantalla Cuadro pagos: seguimiento de cada viaje (con o sin manifiesto)
 * desde que carga hasta que todo queda pagado. Reemplaza la hoja de Excel
 * "CUADRO CENTRAL".
 */
import { useState } from "react";
import { apiCuadro, moneda } from "../../api/cliente";
import type { FilaCuadro } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import DetalleCuadro from "./DetalleCuadro";
import { FacturarVarios, NuevoViajeCuadro, VentanaBombas } from "./VentanasCuadro";
import {
  ETIQUETA_FLOTA,
  ETIQUETA_PAPELES,
  etiquetaEstadoCuadro,
  fechaCorta,
  saldoVencido,
  tonoEstadoCuadro,
} from "./estadosCuadro";

/** "2026-09" -> "septiembre 2026", para filtrar por mes como las hojas del Excel. */
const mes = (fecha: string) => {
  const [a, m] = fecha.split("-");
  const nombres = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${nombres[Number(m) - 1]} ${a}`;
};

const PESTANAS: PestanaTabla<FilaCuadro>[] = [
  { id: "activos", etiqueta: "Pendientes", incluye: (f) => !f.anulado && !f.todoPagado },
  { id: "proceso", etiqueta: "En proceso", incluye: (f) => f.estado === "EN_RUTA" },
  { id: "sinRadicar", etiqueta: "Sin radicar", incluye: (f) => f.estado === "SIN_RADICAR" },
  { id: "listoParaFacturar", etiqueta: "Listo para facturar", incluye: (f) => f.estado === "LISTO_PARA_FACTURAR" },
  { id: "sinDatos", etiqueta: "Facturado sin datos", incluye: (f) => f.estado === "FACTURADO_SIN_DATOS" },
  { id: "facturados", etiqueta: "Facturados", incluye: (f) => f.estado === "FACTURADO" },
  { id: "gerencia", etiqueta: "Falta gerencia", incluye: (f) => !f.anulado && !!f.revisadoContabilidadPor && !f.revisadoGerenciaPor },
  { id: "saldos", etiqueta: "Saldos vencidos", incluye: saldoVencido },
  { id: "pagados", etiqueta: "Todo pagado", incluye: (f) => f.todoPagado },
  { id: "anulados", etiqueta: "Anulados", incluye: (f) => f.anulado },
  { id: "todos", etiqueta: "Todos", incluye: () => true },
];

const COLUMNAS: Columna<FilaCuadro>[] = [
  { id: "fecha", titulo: "Fecha", valor: (f) => f.fecha, celda: (f) => fechaCorta(f.fecha) },
  { id: "mes", titulo: "Mes", filtrable: true, valor: (f) => mes(f.fecha), celda: (f) => mes(f.fecha) },
  {
    id: "placa",
    titulo: "Placa",
    filtrable: true,
    valor: (f) => f.placa,
    celda: (f) => (
      <>
        <span className="principal">{f.placa}</span>
        <span className="dato-sec">{ETIQUETA_FLOTA[f.flota]}</span>
      </>
    ),
  },
  {
    id: "empresa",
    titulo: "Empresa",
    filtrable: true,
    valor: (f) => f.empresa,
    celda: (f) => (
      <>
        {f.empresa}
        {f.conductor && <span className="dato-sec">{f.conductor}</span>}
      </>
    ),
  },
  {
    id: "manifiesto",
    titulo: "Manifiesto",
    valor: (f) => f.manifiesto,
    celda: (f) =>
      f.manifiesto ? (
        <>
          <span className="codigo">{f.manifiesto}</span>
          {f.remesa && f.remesa !== f.manifiesto && <span className="dato-sec codigo">Remesa {f.remesa}</span>}
        </>
      ) : (
        <span className="dato-sec">Sin manifiesto</span>
      ),
  },
  { id: "remision", titulo: "Remision", valor: (f) => f.remision, celda: (f) => <span className="codigo">{f.remision ?? "-"}</span> },
  {
    id: "peso",
    titulo: "Peso (kg)",
    alinear: "derecha",
    valor: (f) => f.pesoKg ?? 0,
    celda: (f) => (f.pesoKg === null ? "-" : f.pesoKg.toLocaleString("es-CO")),
  },
  {
    id: "anticipo",
    titulo: "Anticipo bomba",
    alinear: "derecha",
    valor: (f) => f.totalAnticipos,
    celda: (f) =>
      f.totalAnticipos ? (
        <>
          {moneda(f.totalAnticipos)}
          {f.anticiposSinPagar > 0 && <span className="dato-sec">sin pagar a la bomba</span>}
        </>
      ) : (
        "-"
      ),
  },
  {
    id: "flete",
    titulo: "Flete",
    alinear: "derecha",
    valor: (f) => f.valorFlete ?? 0,
    celda: (f) => (
      <>
        {f.valorFlete === null ? "-" : moneda(f.valorFlete)}
        {f.tipoFlete === "KILO" && f.tarifaKilo !== null && (
          <span className="dato-sec">{f.tarifaKilo.toLocaleString("es-CO")} $/kg</span>
        )}
        {f.tipoFlete === "FIJO" && f.valorFijo !== null && <span className="dato-sec">Fijo</span>}
      </>
    ),
  },
  {
    id: "estado",
    titulo: "Estado",
    filtrable: true,
    valor: (f) => etiquetaEstadoCuadro(f),
    celda: (f) => (
      <>
        <Pastilla tono={tonoEstadoCuadro(f)}>{etiquetaEstadoCuadro(f)}</Pastilla>
        {!f.anulado && f.estadoPapeles !== "RADICADO" && f.estadoPapeles !== "EN_RUTA" && (
          <span className="dato-sec">Papeles: {ETIQUETA_PAPELES[f.estadoPapeles].toLowerCase()}</span>
        )}
      </>
    ),
  },
  {
    id: "factura",
    titulo: "Factura",
    valor: (f) => f.facturaNumero,
    celda: (f) =>
      f.facturaNumero ? (
        <>
          <span className="codigo">{f.facturaNumero}</span>
          <span className="dato-sec">{fechaCorta(f.facturaFecha)}</span>
        </>
      ) : (
        "-"
      ),
  },
  { id: "pagoFactura", titulo: "Pago factura", valor: (f) => f.facturaFechaPago, celda: (f) => fechaCorta(f.facturaFechaPago) },
  {
    id: "pagoSaldo",
    titulo: "Pago saldo",
    valor: (f) => f.fechaPagoSaldo ?? f.venceSaldo,
    celda: (f) =>
      f.flota !== "TERCERO" ? (
        <span className="dato-sec">Flota propia</span>
      ) : f.fechaPagoSaldo ? (
        fechaCorta(f.fechaPagoSaldo)
      ) : f.venceSaldo ? (
        <span className={saldoVencido(f) ? "texto-vencido" : "dato-sec"}>Vence {fechaCorta(f.venceSaldo)}</span>
      ) : (
        "-"
      ),
  },
  {
    id: "revision",
    titulo: "Revision",
    valor: (f) => (f.revisadoGerenciaPor ? "Gerencia" : f.revisadoContabilidadPor ? "Contabilidad" : ""),
    celda: (f) => (
      <>
        {f.revisadoContabilidadPor && <Pastilla tono="naranja">Contab.</Pastilla>}
        {f.revisadoGerenciaPor && <Pastilla tono="ok">Gerencia</Pastilla>}
        {!f.revisadoContabilidadPor && !f.revisadoGerenciaPor && "-"}
      </>
    ),
  },
  {
    id: "notas",
    titulo: "Notas",
    valor: (f) => f.ultimaNota,
    celda: (f) =>
      f.ultimaNota ? (
        <span className="nota-celda" title={f.ultimaNota}>
          {f.ultimaNota.length > 60 ? `${f.ultimaNota.slice(0, 60)}...` : f.ultimaNota}
          {f.notas > 1 && <span className="dato-sec">{f.notas} notas</span>}
        </span>
      ) : (
        "-"
      ),
  },
];

/**
 * Cuadro pagos: el control de cada viaje desde que carga hasta que todo
 * queda pagado, tenga o no manifiesto. Reemplaza la hoja "CUADRO PAGOS".
 */
export default function CuadroCentral() {
  const { datos, cargando, error, recargar } = useDatos(() => apiCuadro.listar(), []);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [facturando, setFacturando] = useState(false);
  const [verBombas, setVerBombas] = useState(false);

  if (cargando && !datos) return <Cargando que="el cuadro pagos " />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;
  const filas = datos ?? [];

  return (
    <>
      <div className="panel">
        <TablaDatos
          filas={filas}
          columnas={COLUMNAS}
          clave={(f) => f.id}
          pestanas={PESTANAS}
          nombreArchivo="cuadro-central"
          placeholderBusqueda="Buscar placa, empresa, remision, factura, nota..."
          vacio="No hay viajes con estos criterios."
          alClicFila={(f) => setAbierto(f.id)}
          acciones={
            <>
              <button className="boton-barra" onClick={() => setVerBombas(true)}>
                Bombas
              </button>
              <button className="boton-barra" onClick={() => setFacturando(true)}>
                Facturar varios
              </button>
              <button className="btn-primary boton-con-texto" onClick={() => setNuevo(true)}>
                Nuevo viaje sin manifiesto
              </button>
            </>
          }
        />
      </div>

      {abierto !== null && <DetalleCuadro id={abierto} alCerrar={() => setAbierto(null)} alCambiar={recargar} />}
      {nuevo && (
        <NuevoViajeCuadro
          empresas={[...new Set(filas.map((f) => f.empresa))].sort()}
          alCerrar={() => setNuevo(false)}
          alCrear={(id) => {
            setNuevo(false);
            recargar();
            setAbierto(id);
          }}
        />
      )}
      {facturando && <FacturarVarios filas={filas} alCerrar={() => setFacturando(false)} alTerminar={recargar} />}
      {verBombas && <VentanaBombas alCerrar={() => setVerBombas(false)} />}
    </>
  );
}
