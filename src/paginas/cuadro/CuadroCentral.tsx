/**
 * Pantalla Cuadro pagos: seguimiento de cada viaje (con o sin manifiesto)
 * desde que carga hasta que todo queda pagado. Reemplaza la hoja de Excel
 * "CUADRO CENTRAL".
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiCuadro, moneda } from "../../api/cliente";
import type { FilaCuadro } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { Cargando, ErrorCarga } from "../../componentes/Estado";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla } from "../../componentes/TablaDatos";
import MenuMas from "../../componentes/MenuMas";
import DetalleCuadro from "./DetalleCuadro";
import { FacturarVarios, NuevoViajeCuadro, VentanaBombas } from "./VentanasCuadro";
import EnvioFacturacion from "./EnvioFacturacion";
import Modal from "../../componentes/Modal";
import Papeles from "../seguimiento/Papeles";
import {
  ETIQUETA_FLOTA,
  ETIQUETA_PAPELES,
  fechaCorta,
  hoyColombia,
  saldoVencido,
  textoEstados,
} from "./estadosCuadro";
import PastillasEstado from "./PastillasEstado";

/** Ya paso la fecha pago cliente y la factura no se ha pagado. */
const cobroVencido = (f: FilaCuadro) =>
  !f.anulado && !f.facturaFechaPago && !!f.facturaVence && f.facturaVence < hoyColombia();

/** "ORIGEN → DESTINO" en dos lineas: el origen arriba y el destino debajo. */
function RutaCuadro({ ruta }: { ruta: string | null }) {
  if (!ruta) return <span className="dato-sec">-</span>;
  const [origen, destino] = ruta.split(" → ");
  return destino === undefined ? (
    <>{ruta}</>
  ) : (
    <>
      {origen}
      <span className="dato-sec">→ {destino}</span>
    </>
  );
}

/** Ni anulado ni todo pagado. */
const enCurso = (f: FilaCuadro) => !f.anulado && !f.todoPagado;

const PESTANAS: PestanaTabla<FilaCuadro>[] = [
  { id: "activos", etiqueta: "Pendientes", incluye: (f) => !f.anulado && !f.todoPagado },
  { id: "proceso", etiqueta: "En proceso", incluye: (f) => f.estado === "EN_RUTA" },
  { id: "sinRadicar", etiqueta: "Sin radicar", incluye: (f) => f.estado === "SIN_RADICAR" },
  // Papeles y factura van aparte: "Listo para facturar" y "Radicados" son los
  // que aun no se facturan; las de factura muestran los facturados sin
  // importar en que van los papeles (todo pagado y anulados quedan fuera).
  { id: "listoParaFacturar", etiqueta: "Listo para facturar", incluye: (f) => f.estado === "RADICADO" && f.estadoFactura === "SIN_FACTURAR" },
  { id: "radicados", etiqueta: "Radicados", incluye: (f) => f.estado === "RADICADOS" && f.estadoFactura === "SIN_FACTURAR" },
  { id: "sinDatos", etiqueta: "Facturado sin datos", incluye: (f) => enCurso(f) && f.estadoFactura === "FACTURADO_SIN_DATOS" },
  { id: "facturados", etiqueta: "Facturados", incluye: (f) => enCurso(f) && f.estadoFactura === "FACTURADO" },
  { id: "gerencia", etiqueta: "Falta gerencia", incluye: (f) => !f.anulado && !!f.revisadoContabilidadPor && !f.revisadoGerenciaPor },
  { id: "cobrar", etiqueta: "Cobro vencido", incluye: cobroVencido },
  { id: "saldos", etiqueta: "Saldos vencidos", incluye: saldoVencido },
  { id: "pagados", etiqueta: "Todo pagado", incluye: (f) => f.todoPagado },
  { id: "todos", etiqueta: "Todos", incluye: () => true },
];

const COLUMNAS: Columna<FilaCuadro>[] = [
  { id: "fecha", titulo: "Fecha", valor: (f) => f.fecha, celda: (f) => fechaCorta(f.fecha) },
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
    buscar: (f) => f.conductor,
    celda: (f) => (
      <>
        {f.empresa}
        {f.conductor && <span className="dato-sec">{f.conductor}</span>}
      </>
    ),
  },
  {
    id: "ruta",
    titulo: "Ruta",
    filtrable: true,
    valor: (f) => f.ruta,
    celda: (f) => <RutaCuadro ruta={f.ruta} />,
  },
  {
    id: "manifiesto",
    titulo: "Manifiesto",
    // Los reconocidos de Cartones America se buscan por su concepto y su manifiesto de origen.
    valor: (f) => f.manifiesto ?? (f.concepto ? `${f.concepto} ${f.reconocidoDe ?? ""}` : null),
    celda: (f) =>
      f.manifiesto ? (
        <>
          <span className="codigo">{f.manifiesto}</span>
          {f.remesa && f.remesa !== f.manifiesto && <span className="dato-sec codigo">Remesa {f.remesa}</span>}
        </>
      ) : f.concepto ? (
        // Reconocido de Cartones America: su concepto y el manifiesto que lo origino.
        <>
          <Pastilla tono="morado">{f.concepto}</Pastilla>
          {f.reconocidoDe && <span className="dato-sec codigo">Del manifiesto {f.reconocidoDe}</span>}
        </>
      ) : (
        <span className="dato-sec">Sin manifiesto</span>
      ),
  },
  { id: "remision", titulo: "Remision", valor: (f) => f.remision, celda: (f) => <span className="codigo">{f.remision ?? "-"}</span> },
  // Estado entre la remision y el peso.
  {
    id: "estado",
    titulo: "Estado",
    filtrable: true,
    valor: (f) => textoEstados(f),
    celda: (f) => (
      <>
        <PastillasEstado f={f} />
        {!f.anulado && !["RADICADO", "RADICADOS", "EN_RUTA"].includes(f.estadoPapeles) && (
          <span className="dato-sec">Papeles: {ETIQUETA_PAPELES[f.estadoPapeles].toLowerCase()}</span>
        )}
      </>
    ),
  },
  {
    id: "peso",
    titulo: "Peso (kg)",
    alinear: "derecha",
    valor: (f) => f.pesoKg ?? 0,
    celda: (f) => (f.pesoKg === null ? "-" : f.pesoKg.toLocaleString("es-CO")),
  },
  {
    id: "anticipo",
    titulo: "Anticipos",
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
    buscar: (f) => f.tarifaFlete,
    // Encima, en letra pequena, la tarifa de la matriz de fletes con que se saco el valor.
    celda: (f) => (
      <>
        {f.tarifaFlete && (
          <span className="dato-sec" title="Tarifa de la matriz de fletes">
            {f.tarifaFlete}
          </span>
        )}
        {f.valorFlete !== null ? (
          moneda(f.valorFlete)
        ) : f.tarifasPosibles.length ? (
          // Sin flete exacto: se elige en la ventana del viaje entre las posibles.
          <span className="texto-aviso" title={`Posibles: ${f.tarifasPosibles.map((t) => t.nombre).join(" · ")}`}>
            Elegir tarifa ({f.tarifasPosibles.length})
          </span>
        ) : (
          "-"
        )}
        {f.tipoFlete === "KILO" && f.tarifaKilo !== null && (
          <span className="dato-sec">{f.tarifaKilo.toLocaleString("es-CO")} $/kg</span>
        )}
        {f.tipoFlete === "FIJO" && f.valorFijo !== null && <span className="dato-sec">Fijo</span>}
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
  {
    id: "pagoCliente",
    titulo: "Fecha pago cliente",
    valor: (f) => f.facturaVence,
    celda: (f) =>
      f.facturaVence ? (
        <>
          {fechaCorta(f.facturaVence)}
          {cobroVencido(f) && <span className="texto-vencido">Vencida: cobrar</span>}
        </>
      ) : (
        "-"
      ),
  },
  { id: "pagoFactura", titulo: "Fecha pago factura", valor: (f) => f.facturaFechaPago, celda: (f) => fechaCorta(f.facturaFechaPago) },
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
  const [enviandoFacturar, setEnviandoFacturar] = useState(false);
  /** Ventana de seguimiento de papeles: null cerrada; 0 abierta; id = abierta en ese viaje. */
  const [papeles, setPapeles] = useState<number | null>(null);
  const [parametros, setParametros] = useSearchParams();
  // Las alertas de la campana llegan con ?papeles=<id del cuadro>.
  useEffect(() => {
    const id = parametros.get("papeles");
    if (id !== null) {
      setPapeles(Number(id) || 0);
      setParametros({}, { replace: true });
    }
  }, [parametros, setParametros]);

  if (cargando && !datos) return <Cargando que="el cuadro pagos " />;
  if (error) return <ErrorCarga mensaje={error} alReintentar={recargar} />;
  // Los anulados no van en el cuadro de pagos: se consultan en RNDC.
  const filas = (datos ?? []).filter((f) => !f.anulado);

  return (
    <>
      <div className="panel">
        <TablaDatos
          filas={filas}
          columnas={COLUMNAS}
          columnasFijas={2}
          clave={(f) => f.id}
          pestanas={PESTANAS}
          nombreArchivo="cuadro-central"
          placeholderBusqueda="Buscar placa, empresa, remision, factura, nota..."
          vacio="No hay viajes con estos criterios."
          alClicFila={(f) => setAbierto(f.id)}
          claseFila={(f) => (f.todoPagado ? "fila-todo-pagado" : undefined)}
          acciones={
            <>
              <MenuMas
                opciones={[
                  { etiqueta: "Facturar varios", alElegir: () => setFacturando(true) },
                  { etiqueta: "Seguimiento de papeles", alElegir: () => setPapeles(0) },
                  { etiqueta: "Bombas", alElegir: () => setVerBombas(true) },
                ]}
              />
              <button className="btn-primary boton-con-texto" onClick={() => setEnviandoFacturar(true)}>
                Enviar a facturacion
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
      {papeles !== null && (
        <Modal titulo="Seguimiento de papeles" ancho="wide" alCerrar={() => setPapeles(null)}>
          <Papeles viajeInicial={papeles || null} alCambiarCuadro={recargar} />
        </Modal>
      )}
      {enviandoFacturar && <EnvioFacturacion alCerrar={() => setEnviandoFacturar(false)} alCambiar={recargar} />}
    </>
  );
}
