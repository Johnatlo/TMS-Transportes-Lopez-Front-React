/**
 * Las seis tablas de pendientes del Inicio, una por modulo de la barra
 * lateral (se agregan arrastrando su pestana al Inicio). Cada una pide sus
 * datos a la API de su modulo (las mismas reglas de esa pantalla) solo
 * cuando esta puesta, y lleva a la pantalla completa.
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { apiConductores, apiCuadro, apiGastos, apiSeguimiento, hoyColombia, moneda, soloDia } from "../../api/cliente";
import { useDatos } from "../../ganchos/useDatos";
import { IconoBomba, IconoCartera, IconoCuentaViaje, IconoDocumento, IconoRecibo, IconoViajes } from "../../componentes/Iconos";
import { agruparPorTanqueo } from "../cuadro/tanqueos";
import { useInicio } from "./DatosInicio";
import { BotonIr, ErrorTarjeta, Esqueleto, Marco } from "./MarcoTarjeta";

/** Cuantas filas se pintan (el resto se ve en la pantalla del modulo). */
const FILAS = 30;

/** Una columna de una tabla del Inicio. */
interface Columna<T> {
  titulo: string;
  celda: (f: T) => ReactNode;
  num?: boolean;
}

/**
 * Tabla de una tarjeta: encabezado con el conteo (y el total si hay), las
 * primeras FILAS filas (cada una abre su registro) y un vacio amable.
 */
function TablaTarjeta<T>({
  titulo,
  icono,
  ruta,
  estado,
  filas,
  columnas,
  clave,
  abrir,
  resumen,
  vacio,
}: {
  titulo: string;
  icono: ReactNode;
  ruta: string;
  estado: { cargando: boolean; error: string | null; recargar: () => void };
  filas: T[] | null;
  columnas: Columna<T>[];
  clave: (f: T) => string | number;
  abrir: (f: T) => string;
  resumen?: ReactNode;
  vacio: string;
}) {
  const navegar = useNavigate();
  return (
    <Marco titulo={titulo} icono={icono} acciones={<BotonIr ruta={ruta} />}>
      {!filas ? (
        estado.error ? (
          <ErrorTarjeta mensaje={estado.error} alReintentar={estado.recargar} />
        ) : (
          <Esqueleto filas={4} />
        )
      ) : (
        <>
          <p className="dato-sec tabla-inicio-resumen">
            {filas.length === 1 ? "1 registro" : `${filas.length} registros`}
            {resumen}
            {filas.length > FILAS ? ` · se ven los primeros ${FILAS}` : ""}
          </p>
          <table className="tabla-tablero tabla-inicio">
            <thead>
              <tr>
                {columnas.map((c) => (
                  <th key={c.titulo} className={c.num ? "num" : undefined}>
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.slice(0, FILAS).map((f) => (
                <tr key={clave(f)} className="fila-clic" onClick={() => navegar(abrir(f))}>
                  {columnas.map((c) => (
                    <td key={c.titulo} className={c.num ? "num" : undefined}>
                      {c.celda(f)}
                    </td>
                  ))}
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={columnas.length} className="vacio-tablero">
                    {vacio}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </Marco>
  );
}

/** " · total $1.234.567" */
const conTotal = (valor: number) => ` · total ${moneda(valor)}`;

/** Cuadro pagos por facturar: listos para facturar y enviados sin factura (la alerta de facturacion de cada viaje). */
function PorFacturar() {
  const d = useDatos(() => apiSeguimiento.papeles(), []);
  const filas = d.datos ? d.datos.filter((f) => f.alertaFacturacion).sort((a, b) => a.fecha.localeCompare(b.fecha)) : null;
  return (
    <TablaTarjeta
      titulo="Cuadro pagos: por facturar"
      icono={<IconoDocumento />}
      ruta="/cuadro"
      estado={d}
      filas={filas}
      resumen={filas ? conTotal(filas.reduce((s, f) => s + (f.valorFlete ?? 0), 0)) : null}
      clave={(f) => f.id}
      abrir={(f) => `/cuadro?viaje=${f.id}`}
      vacio="No hay viajes por facturar."
      columnas={[
        { titulo: "Fecha", celda: (f) => soloDia(f.fecha) },
        { titulo: "Placa", celda: (f) => f.placa },
        { titulo: "Cliente", celda: (f) => f.empresa },
        {
          titulo: "Que falta",
          celda: (f) => <span className={f.alertaFacturacion!.nivel === "urgente" ? "texto-vencido" : "texto-aviso"}>{f.alertaFacturacion!.motivos[0]}</span>,
        },
        { titulo: "Flete", num: true, celda: (f) => moneda(f.valorFlete) },
      ]}
    />
  );
}

/** Anticipos sin cruzar con los vales de la bomba (la pestana "Sin cruzar" de Anticipos). */
function AnticiposSinCruzar() {
  const d = useDatos(() => apiCuadro.cuadroAnticipos(), []);
  const filas = d.datos ? agruparPorTanqueo(d.datos).filter((t) => t.cruce === "SIN_CRUZAR") : null;
  return (
    <TablaTarjeta
      titulo="Anticipos sin cruzar"
      icono={<IconoBomba />}
      ruta="/anticipos"
      estado={d}
      filas={filas}
      resumen={filas ? conTotal(filas.reduce((s, t) => s + t.total, 0)) : null}
      clave={(t) => t.clave}
      abrir={() => "/anticipos"}
      vacio="Todos los anticipos estan cruzados."
      columnas={[
        { titulo: "Fecha", celda: (t) => soloDia(t.fecha) },
        { titulo: "Placa", celda: (t) => t.placa },
        { titulo: "Bomba", celda: (t) => t.bomba ?? "-" },
        { titulo: "Combustible", num: true, celda: (t) => moneda(t.combustible) },
        { titulo: "Efectivo", num: true, celda: (t) => moneda(t.efectivo) },
      ]}
    />
  );
}

/** Cartera vencida: las facturas vencidas, de la mas vieja a la mas nueva. */
function CarteraVencida() {
  const d = useDatos(() => apiSeguimiento.cartera(), []);
  const filas = d.datos ? d.datos.facturas.filter((f) => f.diasVencida > 0 && f.valor > 0).sort((a, b) => b.diasVencida - a.diasVencida) : null;
  return (
    <TablaTarjeta
      titulo="Cartera vencida"
      icono={<IconoCartera />}
      ruta="/cartera"
      estado={d}
      filas={filas}
      resumen={filas ? conTotal(filas.reduce((s, f) => s + f.valor, 0)) : null}
      clave={(f) => `${f.facturaNumero}|${f.empresa}`}
      abrir={(f) => `/cartera?factura=${encodeURIComponent(f.facturaNumero)}&empresa=${encodeURIComponent(f.empresa)}`}
      vacio="No hay facturas vencidas."
      columnas={[
        { titulo: "Factura", celda: (f) => f.facturaNumero },
        { titulo: "Cliente", celda: (f) => f.cliente },
        { titulo: "Vencio", celda: (f) => <span className="texto-vencido">hace {f.diasVencida} dias</span> },
        { titulo: "Valor", num: true, celda: (f) => moneda(f.valor) },
      ]}
    />
  );
}

/** Un pendiente del RNDC: manifiesto de contingencia o viaje entregado sin cumplir. */
interface PendienteRndc {
  id: number;
  placa: string;
  manifiesto: string;
  que: string;
  urgente: boolean;
}

/** RNDC: los manifiestos de contingencia (falta el oficial) y los viajes entregados sin cumplir. */
function RndcPendientes() {
  const d = useInicio();
  const placa = (vehiculoId: number | null, placaRndc?: string | null) => d.vehiculo(vehiculoId)?.placa ?? placaRndc ?? "-";
  const contingencias: PendienteRndc[] = d.viajes
    .filter((v) => v.contingenciaEn && v.estado !== "ANULADO")
    .map((v) => ({
      id: v.id,
      placa: placa(v.vehiculoId, v.placaRndc),
      manifiesto: v.consecutivoManifiesto ?? "-",
      que: "Contingencia: falta el oficial",
      urgente: true,
    }));
  const porCumplir: PendienteRndc[] = d.porCumplir.map((v) => {
    const p = v.plazoCumplido!;
    return {
      id: v.id,
      placa: placa(v.vehiculoId, v.placaRndc),
      manifiesto: v.consecutivoManifiesto ?? "-",
      que: p.vencido ? `Cumplido vencido (${p.diasHabilesTranscurridos} dias habiles)` : `Por cumplir: quedan ${p.diasHabilesRestantes} dias habiles`,
      urgente: p.vencido,
    };
  });
  const filas = d.cargando ? null : [...contingencias, ...porCumplir.sort((a, b) => Number(b.urgente) - Number(a.urgente))];
  return (
    <TablaTarjeta
      titulo="RNDC: contingencias y por cumplir"
      icono={<IconoViajes />}
      ruta="/historial"
      estado={{ cargando: d.cargando, error: d.error, recargar: d.recargar }}
      filas={filas}
      clave={(f) => `${f.que.slice(0, 4)}-${f.id}`}
      abrir={(f) => `/historial?documentos=${f.id}`}
      vacio="Nada pendiente en el RNDC."
      columnas={[
        { titulo: "Manifiesto", celda: (f) => f.manifiesto },
        { titulo: "Placa", celda: (f) => f.placa },
        { titulo: "Que falta", celda: (f) => <span className={f.urgente ? "texto-vencido" : "texto-aviso"}>{f.que}</span> },
      ]}
    />
  );
}

/** Gastos del mes: lo que se causa este mes de cada gasto (sin anulados ni ingresos). */
function GastosDelMes() {
  const mes = hoyColombia().slice(0, 7);
  const d = useDatos(() => apiGastos.listar(), []);
  const filas = d.datos
    ? d.datos
        .filter((g) => !g.anulado && g.tipo === "GASTO")
        .map((g) => ({ g, delMes: g.causaciones.filter((c) => c.fecha.startsWith(mes)).reduce((s, c) => s + c.monto, 0) }))
        .filter((x) => x.delMes > 0)
        .sort((a, b) => b.delMes - a.delMes)
    : null;
  return (
    <TablaTarjeta
      titulo="Gastos del mes"
      icono={<IconoRecibo />}
      ruta="/gastos"
      estado={d}
      filas={filas}
      resumen={filas ? conTotal(filas.reduce((s, x) => s + x.delMes, 0)) : null}
      clave={(x) => x.g.id}
      abrir={() => "/gastos"}
      vacio="Aun no hay gastos este mes."
      columnas={[
        { titulo: "Descripcion", celda: (x) => x.g.descripcion },
        { titulo: "Categoria", celda: (x) => x.g.categoria },
        { titulo: "Empresa", celda: (x) => x.g.empresa },
        { titulo: "Del mes", num: true, celda: (x) => moneda(x.delMes) },
      ]}
    />
  );
}

/** Mes de las cuentas de los conductores que va hoy (corte el 26: del 27 en adelante ya es el siguiente). */
export function mesConductorDeHoy(hoy: string): string {
  const [a, m, dia] = hoy.split("-").map(Number);
  if (dia <= 26) return hoy.slice(0, 7);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

/** Cuentas conductores: viajes del periodo que va sin cuenta de viaje. */
function SinCuenta() {
  const mes = mesConductorDeHoy(hoyColombia());
  const d = useDatos(() => apiConductores.viajes(mes), [mes]);
  const filas = d.datos ? d.datos.filter((v) => !v.cuenta).sort((a, b) => a.fecha.localeCompare(b.fecha)) : null;
  return (
    <TablaTarjeta
      titulo="Cuentas conductores: sin cuenta"
      icono={<IconoCuentaViaje />}
      ruta="/cuentas-conductores"
      estado={d}
      filas={filas}
      clave={(v) => v.cuadroViajeId}
      abrir={() => "/cuentas-conductores"}
      vacio="Todos los viajes del periodo tienen su cuenta."
      columnas={[
        { titulo: "Fecha", celda: (v) => soloDia(v.fecha) },
        { titulo: "Placa", celda: (v) => v.placa },
        { titulo: "Conductor", celda: (v) => v.conductor ?? <span className="texto-aviso">Sin conductor</span> },
        { titulo: "Cliente", celda: (v) => v.cliente },
      ]}
    />
  );
}

/** Tablas por id (ver catalogoInicio.ts). */
export const TABLAS_INICIO: Record<string, () => JSX.Element> = {
  "tabla-por-facturar": PorFacturar,
  "tabla-anticipos": AnticiposSinCruzar,
  "tabla-cartera": CarteraVencida,
  "tabla-rndc": RndcPendientes,
  "tabla-gastos": GastosDelMes,
  "tabla-sin-cuenta": SinCuenta,
};
