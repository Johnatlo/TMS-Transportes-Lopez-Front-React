/**
 * Anticipos por tramo, como el cuadro que lleva la empresa: una fila por
 * anticipo entregado (la ida y la vuelta por separado), con fecha, placa,
 * empresa, efectivo, combustible, galones, total, EDS, factura, empresa del
 * vehiculo, pago a la bomba y cruce.
 *
 * - Ida / Vuelta se cambia a mano en cada fila (cuando quedo mal marcado).
 * - Columna "Ida / vuelta sugerida": el otro tramo del mismo tanqueo, o el
 *   tramo suelto de la misma placa ese dia (indicio) con el boton para
 *   juntarlos.
 * - Clic en la fila: el detalle de su tanqueo (cruce, factura, pago).
 */
import type { ReactNode } from "react";
import { apiCuadro, moneda } from "../../api/cliente";
import type { AnticipoBomba } from "../../api/cliente";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna, PestanaTabla, TonoPastilla } from "../../componentes/TablaDatos";
import { fechaCorta, hoyColombia } from "./estadosCuadro";
import { placaConGuion } from "./facturacion";
import { estadoTramo, sugerenciasTramo } from "./tanqueos";
import type { EstadoCruce, Tanqueo } from "./tanqueos";
import { descargarAnticipos } from "./excelAnticipos";

/** Lo que la vista necesita de la pantalla de anticipos. */
interface PropsVistaTramos {
  tramos: AnticipoBomba[];
  tanqueos: Tanqueo[];
  cruce: Record<EstadoCruce, { etiqueta: string; tono: TonoPastilla }>;
  Bomba: (p: { nombre: string | null }) => JSX.Element;
  flotaTexto: (f: string | null) => string;
  guardar: (accion: () => Promise<AnticipoBomba[]>) => Promise<void>;
  /** Detalle del tanqueo al que pertenece el tramo. */
  detalle: (g: Tanqueo) => ReactNode;
}

/** Texto corto de un tramo: empresa, manifiesto y valor. */
const resumenTramo = (t: AnticipoBomba) => `${t.empresa ?? "Sin viaje"}${t.manifiesto ? ` · ${t.manifiesto}` : ""} · ${moneda(t.efectivo + t.combustible)}`;

/** Cuadro de anticipos con una fila por tramo. */
export default function VistaTramos({ tramos, tanqueos, cruce, Bomba, flotaTexto, guardar, detalle }: PropsVistaTramos) {
  const tanqueoDe = (t: AnticipoBomba) => tanqueos.find((g) => g.tramos.some((x) => x.id === t.id) || g.ida.id === t.id);
  const filas = [...tramos].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || placaConGuion(a.placa ?? "").localeCompare(placaConGuion(b.placa ?? "")) || a.id - b.id,
  );

  /** Celda de la sugerencia: la pareja del tanqueo o los posibles con su boton para juntarlos. */
  function Sugerencia({ t }: { t: AnticipoBomba }) {
    const sug = sugerenciasTramo(t, tramos);
    const otroNombre = t.tramo === "VUELTA" ? "Ida" : "Vuelta";
    if (!sug.length) return <span className="dato-sec">-</span>;
    if (sug[0].tipo === "PAREJA") {
      return (
        <span className="dato-sec">
          {sug[0].otro.tramo === "VUELTA" ? "Vuelta" : "Ida"}: {resumenTramo(sug[0].otro)}
        </span>
      );
    }
    return (
      <div className="sugerencias-tramo" onClick={(e) => e.stopPropagation()}>
        {sug.map(({ otro }) => (
          <div key={otro.id}>
            <Pastilla tono="aviso">¿{otroNombre}?</Pastilla> <span className="dato-sec">{resumenTramo(otro)}</span>{" "}
            <button
              type="button"
              className="btn-link"
              onClick={() =>
                window.confirm(`¿Juntar como ida y vuelta? La ida queda ${t.tramo === "VUELTA" ? resumenTramo(otro) : resumenTramo(t)}.`) &&
                guardar(() =>
                  t.tramo === "VUELTA" ? apiCuadro.juntarTanqueos(otro.tanqueoId!, t.tanqueoId!) : apiCuadro.juntarTanqueos(t.tanqueoId!, otro.tanqueoId!),
                )
              }
            >
              Juntar
            </button>
          </div>
        ))}
      </div>
    );
  }

  const columnas: Columna<AnticipoBomba>[] = [
    { id: "fecha", titulo: "Fecha", valor: (t) => t.fecha, celda: (t) => fechaCorta(t.fecha) },
    {
      id: "placa",
      titulo: "Placa",
      filtrable: true,
      valor: (t) => placaConGuion(t.placa ?? ""),
      celda: (t) => <span className="principal">{placaConGuion(t.placa ?? "")}</span>,
    },
    {
      id: "tramo",
      titulo: "Ida / vuelta",
      filtrable: true,
      valor: (t) => (t.tramo === "VUELTA" ? "Vuelta" : "Ida"),
      celda: (t) => (
        <select
          className={`selector-tramo ${t.tramo === "VUELTA" ? "es-vuelta" : "es-ida"}`}
          value={t.tramo}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => guardar(() => apiCuadro.actualizarTramo(t.id, { tramo: e.target.value }))}
          aria-label="Ida o vuelta"
        >
          <option value="IDA">Ida</option>
          <option value="VUELTA">Vuelta</option>
        </select>
      ),
    },
    {
      id: "empresa",
      titulo: "Empresa prov.",
      filtrable: true,
      valor: (t) => t.empresa ?? "Sin viaje",
      celda: (t) =>
        t.cuadroViajeId ? (
          <>
            <span>{t.empresa ?? "-"}</span>
            <span className="dato-sec">{t.manifiesto ? `Manif. ${t.manifiesto}` : "Sin manifiesto"}</span>
          </>
        ) : (
          <span className="texto-vencido">Sin viaje (vuelta pendiente)</span>
        ),
    },
    { id: "efectivo", titulo: "Efectivo", alinear: "derecha", valor: (t) => t.efectivo, celda: (t) => moneda(t.efectivo) },
    { id: "combustible", titulo: "Combust.", alinear: "derecha", valor: (t) => t.combustible, celda: (t) => moneda(t.combustible) },
    {
      id: "galones",
      titulo: "Galones",
      alinear: "derecha",
      valor: (t) => t.galones ?? 0,
      celda: (t) => (t.galones === null ? "-" : t.galones.toLocaleString("es-CO", { maximumFractionDigits: 3 })),
    },
    {
      id: "total",
      titulo: "Valor total",
      alinear: "derecha",
      valor: (t) => t.efectivo + t.combustible,
      celda: (t) => <strong>{moneda(t.efectivo + t.combustible)}</strong>,
    },
    { id: "eds", titulo: "EDS", filtrable: true, valor: (t) => t.bomba ?? "Solo efectivo", celda: (t) => <Bomba nombre={t.bomba} /> },
    {
      id: "factura",
      titulo: "Factura bomba",
      filtrable: true,
      valor: (t) => t.facturaBomba ?? "Sin factura",
      celda: (t) => (
        <>
          <span className="codigo">{t.facturaBomba ?? "-"}</span>
          {t.fechaFacturaBomba && <span className="dato-sec">{fechaCorta(t.fechaFacturaBomba)}</span>}
        </>
      ),
    },
    { id: "flota", titulo: "Empresa del vehiculo", filtrable: true, valor: (t) => flotaTexto(t.flota), celda: (t) => flotaTexto(t.flota) },
    {
      id: "pago",
      titulo: "Pago a la bomba",
      valor: (t) => t.fechaPago ?? "",
      celda: (t) =>
        t.bombaId === null ? <span className="dato-sec">-</span> : t.fechaPago ? fechaCorta(t.fechaPago) : <span className="texto-vencido">Se debe</span>,
    },
    {
      id: "cruce",
      titulo: "Cruce",
      filtrable: true,
      valor: (t) => cruce[estadoTramo(t)].etiqueta,
      celda: (t) => <Pastilla tono={cruce[estadoTramo(t)].tono}>{cruce[estadoTramo(t)].etiqueta}</Pastilla>,
    },
    {
      id: "sugerida",
      titulo: "Ida / vuelta sugerida",
      valor: (t) => {
        const s = sugerenciasTramo(t, tramos);
        return s.length ? `${s[0].tipo === "PAREJA" ? "" : "¿"}${resumenTramo(s[0].otro)}` : "";
      },
      celda: (t) => <Sugerencia t={t} />,
    },
  ];

  const pestanas: PestanaTabla<AnticipoBomba>[] = [
    { id: "todos", etiqueta: "Todos", incluye: () => true },
    { id: "deuda", etiqueta: "Deuda con la bomba", incluye: (t) => t.bombaId !== null && !t.fechaPago },
    { id: "pagados", etiqueta: "Pagados a la bomba", incluye: (t) => !!t.fechaPago },
    { id: "sinCruzar", etiqueta: "Sin cruzar", incluye: (t) => estadoTramo(t) === "SIN_CRUZAR" },
    { id: "diferencia", etiqueta: "Con diferencia", incluye: (t) => estadoTramo(t) === "DIFERENCIA" },
    { id: "idas", etiqueta: "Idas", incluye: (t) => t.tramo !== "VUELTA" },
    { id: "vueltas", etiqueta: "Vueltas", incluye: (t) => t.tramo === "VUELTA" },
    { id: "sinPareja", etiqueta: "Posible ida / vuelta", incluye: (t) => sugerenciasTramo(t, tramos)[0]?.tipo === "POSIBLE" },
    { id: "sinViaje", etiqueta: "Sin viaje", incluye: (t) => !t.cuadroViajeId },
  ];

  return (
    <TablaDatos
      filas={filas}
      columnas={columnas}
      columnasFijas={3}
      clave={(t) => t.id}
      pestanas={pestanas}
      nombreArchivo="anticipos"
      alExportar={(visibles) => {
        // El Excel va por tramo: cada fila visible como un tanqueo de un solo tramo.
        const soloEstos = visibles.map((t) => ({ ...(tanqueoDe(t) as Tanqueo), tramos: [t] }));
        return descargarAnticipos(soloEstos, `anticipos-${hoyColombia()}`);
      }}
      placeholderBusqueda="Buscar placa, empresa, manifiesto, factura..."
      vacio="No hay anticipos con estos criterios."
      claseFila={(t) => (estadoTramo(t) === "CRUZADO" ? "fila-cruzada" : estadoTramo(t) === "DIFERENCIA" ? "fila-diferencia" : undefined)}
      detalle={(t) => {
        const g = tanqueoDe(t);
        return g ? detalle(g) : null;
      }}
    />
  );
}
