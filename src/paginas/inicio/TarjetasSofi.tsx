/**
 * Tarjetas del Inicio que salen del resumen (useResumen): "Sofi te cuenta" y
 * las de dinero (cifras del mes, dias de cobro, rentabilidad y reparto).
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { moneda } from "../../api/cliente";
import type { GrupoSofi, ParteResumen, PrioridadSofi, ResumenInicio } from "../../api/cliente";
import Indicador from "../../componentes/Indicador";
import { IconoCalendario, IconoCheck, IconoGrafica, IconoTorta } from "../../componentes/Iconos";
import { BotonIr, ErrorTarjeta, Esqueleto, Marco } from "./MarcoTarjeta";
import { useResumen } from "./ResumenInicio";
import { variacion } from "./reglasInicio";

/** Nombre de un mes: "2026-11" -> "noviembre de 2026". */
export function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 15)));
}

/** "2026-12-01" -> "lun 01/12". */
export function diaCobro(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const semana = new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, d))).replace(".", "");
  return `${semana} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** $ 634.669.761 -> "$634,7 M" (para cifras grandes en poco espacio). */
export function millones(valor: number): string {
  if (Math.abs(valor) < 1_000_000) return moneda(valor);
  return `$${(valor / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
}

/**
 * La parte del resumen de una tarjeta: el esqueleto mientras llega, el error
 * con reintentar, o la tarjeta con sus datos.
 */
function ConParte<K extends ParteResumen>({
  parte,
  titulo,
  icono,
  acciones,
  children,
}: {
  parte: K;
  titulo: string;
  icono?: ReactNode;
  acciones?: ReactNode;
  children: (datos: NonNullable<ResumenInicio[K]>) => ReactNode;
}) {
  const { resumen, cargando, error, recargar } = useResumen();
  const datos = resumen?.[parte];
  return (
    <Marco titulo={titulo} icono={icono} acciones={acciones}>
      {datos ? (
        children(datos as NonNullable<ResumenInicio[K]>)
      ) : cargando ? (
        <Esqueleto filas={4} />
      ) : (
        <ErrorTarjeta mensaje={error ?? "No se pudo cargar."} alReintentar={recargar} />
      )}
    </Marco>
  );
}

/** Un grupo de una prioridad: sus primeros pendientes y "Ver los N". */
function GrupoPendientes({ g }: { g: GrupoSofi }) {
  const navegar = useNavigate();
  return (
    <div className="sofi-grupo">
      <div className="sofi-grupo-cabeza">
        <span>{g.titulo}</span>
        {g.total > 0 ? (
          <span className="dato-sec">
            {g.urgentes > 0 && <span className="texto-vencido">{g.urgentes} urgente(s) · </span>}
            {g.total} en total
          </span>
        ) : (
          <span className="texto-ok">Al dia</span>
        )}
      </div>
      {g.items.length > 0 && (
        <ul className="sofi-items">
          {g.items.map((i, n) => (
            <li key={n}>
              <button className={`sofi-item ${i.nivel}`} onClick={() => navegar(i.ruta)}>
                <span className="sofi-punto" aria-hidden="true" />
                <span className="sofi-texto">
                  <strong>{i.texto}</strong>
                  {i.detalle && <span className="dato-sec">{i.detalle}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {g.total > g.items.length && (
        <button className="btn-link sofi-ver" onClick={() => navegar(g.ruta)}>
          Ver los {g.total}
        </button>
      )}
    </div>
  );
}

/** Una prioridad con sus grupos; se puede plegar. Abierta si tiene pendientes. */
function Prioridad({ p }: { p: PrioridadSofi }) {
  const total = p.grupos.reduce((s, g) => s + g.total, 0);
  const urgentes = p.grupos.reduce((s, g) => s + g.urgentes, 0);
  return (
    <details className="sofi-prioridad" open={total > 0}>
      <summary>
        <span className={`sofi-numero${urgentes ? " urgente" : total ? " atencion" : " al-dia"}`}>{p.numero}</span>
        <span className="sofi-titulo">{p.titulo}</span>
        <span className="sofi-conteo">{total ? `${total}${urgentes ? ` · ${urgentes} urgente(s)` : ""}` : <IconoCheck />}</span>
      </summary>
      {p.grupos.map((g) => (
        <GrupoPendientes key={g.titulo} g={g} />
      ))}
    </details>
  );
}

/**
 * Sofi te cuenta: lo pendiente en orden de prioridad (1. documentos por
 * vencer, 2. papeles, 3. facturacion, 4. incidencias del sistema). Cada cosa
 * lleva a la pantalla que la resuelve.
 */
function SofiTeCuenta() {
  const { recargar, cargando } = useResumen();
  return (
    <ConParte
      parte="sofi"
      titulo="Sofi te cuenta"
      icono={
        <span className="sofi-marca" aria-hidden="true">
          ✦
        </span>
      }
      acciones={
        <button className="boton-suave" onClick={recargar} disabled={cargando}>
          {cargando ? "Revisando..." : "Revisar de nuevo"}
        </button>
      }
    >
      {(prioridades) => {
        const urgentes = prioridades.reduce((s, p) => s + p.grupos.reduce((t, g) => t + g.urgentes, 0), 0);
        const total = prioridades.reduce((s, p) => s + p.grupos.reduce((t, g) => t + g.total, 0), 0);
        return (
          <div className="sofi">
            <p className="sofi-saludo">
              {total === 0
                ? "Todo esta al dia. No hay nada pendiente."
                : urgentes
                  ? `Hay ${urgentes} cosa(s) urgente(s). Empieza por arriba: van en orden de prioridad.`
                  : `Hay ${total} cosa(s) por revisar, ninguna urgente.`}
            </p>
            {prioridades.map((p) => (
              <Prioridad key={p.numero} p={p} />
            ))}
          </div>
        );
      }}
    </ConParte>
  );
}

/** Cifras del mes de los carros que el rol ve, contra el mes anterior hasta el mismo dia. */
function CifrasDelMes() {
  return (
    <ConParte parte="cifras" titulo="Cifras del mes" icono={<IconoGrafica />} acciones={<BotonIr ruta="/cuadro" texto="Cuadro pagos" />}>
      {(c) => (
        <div className="cifras-inicio">
          <p className="dato-sec cifras-mes">{nombreMes(c.mes)} · contra el mes anterior al mismo dia</p>
          <div className="cifras-rejilla">
            <Indicador titulo="Viajes" valor={c.viajes} variacion={variacion(c.viajes, c.viajesMesAnteriorAlDia)} />
            <Indicador titulo="Fletes" valor={millones(c.fletes)} variacion={variacion(c.fletes, c.fletesMesAnteriorAlDia)} dinero />
            <Indicador titulo="Facturado" valor={millones(c.facturado)} dinero />
            <Indicador titulo="Cobrado" valor={millones(c.cobrado)} dinero />
            <Indicador titulo="Por cobrar" valor={millones(c.porCobrar)} detalle="facturado sin pagar" dinero />
            <Indicador titulo="Sin facturar" valor={millones(c.sinFacturar)} detalle="viajes sin factura" dinero alerta={c.sinFacturar > 0} />
          </div>
        </div>
      )}
    </ConParte>
  );
}

/** Dias de cobro: la cartera vencida y lo que vence en los proximos 15 dias, por dia. */
function DiasDeCobro() {
  const navegar = useNavigate();
  return (
    <ConParte parte="cobros" titulo="Dias de cobro" icono={<IconoCalendario />} acciones={<BotonIr ruta="/cartera" texto="Cartera" />}>
      {(c) => (
        <div className="cobros-inicio">
          {c.vencido.facturas > 0 ? (
            <button className="cobro-vencido" onClick={() => navegar("/cartera")}>
              <strong>{moneda(c.vencido.total)} vencido</strong>
              <span>
                {c.vencido.facturas} factura(s) de {c.vencido.clientes} cliente(s): llamar y cobrar.
              </span>
            </button>
          ) : (
            <p className="texto-ok">No hay facturas vencidas.</p>
          )}
          {c.proximos.length === 0 ? (
            <p className="dato-sec">No vence nada en los proximos 15 dias.</p>
          ) : (
            <ul className="cobros-dias">
              {c.proximos.map((d) => (
                <li key={d.fecha}>
                  <span className="cobro-dia">{diaCobro(d.fecha)}</span>
                  <span className="cobro-clientes dato-sec" title={d.facturas.map((f) => `${f.numero} · ${f.cliente} · ${moneda(f.valor)}`).join("\n")}>
                    {[...new Set(d.facturas.map((f) => f.cliente))].join(", ")}
                  </span>
                  <strong>{moneda(d.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ConParte>
  );
}

/** Rentabilidad del mes: lo que dejan los carros (y la empresa, solo el rol total) y los que mas y menos dejan. */
function RentabilidadDelMes() {
  return (
    <ConParte parte="rentabilidad" titulo="Rentabilidad del mes" icono={<IconoGrafica />} acciones={<BotonIr ruta="/rentabilidad" texto="Rentabilidad" />}>
      {(r) => (
        <div className="rentabilidad-inicio">
          <p className="dato-sec">{nombreMes(r.mes)} · va en curso (cambia con cada viaje y gasto)</p>
          <table className="tabla-tablero">
            <thead>
              <tr>
                <th>Grupo</th>
                <th className="num">Ingresos</th>
                <th className="num">Costos</th>
                <th className="num">Utilidad</th>
              </tr>
            </thead>
            <tbody>
              {r.grupos.map((g) => (
                <tr key={g.nombre}>
                  <td>{g.nombre}</td>
                  <td className="num">{millones(g.ingresos)}</td>
                  <td className="num">{millones(g.costos)}</td>
                  <td className={`num${g.utilidad < 0 ? " texto-vencido" : ""}`}>
                    <strong>{millones(g.utilidad)}</strong>
                  </td>
                </tr>
              ))}
              {r.grupos.length > 1 && (
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td />
                  <td />
                  <td className="num">
                    <strong>{millones(r.total)}</strong>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {r.mejores.length > 0 && (
            <p className="rentabilidad-placas">
              <span className="dato-sec">Mas dejan:</span>{" "}
              {r.mejores.map((v) => (
                <span key={v.placa} className="pastilla-placa">
                  {v.placa} {millones(v.utilidad)}
                </span>
              ))}
            </p>
          )}
          {r.peores.length > 0 && (
            <p className="rentabilidad-placas">
              <span className="dato-sec">Menos dejan:</span>{" "}
              {r.peores.map((v) => (
                <span key={v.placa} className="pastilla-placa baja">
                  {v.placa} {millones(v.utilidad)}
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </ConParte>
  );
}

/** Reparto a socios del mes anterior: lo de cada socio y si ya se aprobo. */
function RepartoDelMes() {
  return (
    <ConParte parte="reparto" titulo="Reparto a socios" icono={<IconoTorta />} acciones={<BotonIr ruta="/reparto" texto="Reparto" />}>
      {(r) => (
        <div className="reparto-inicio">
          <p>
            <strong>{nombreMes(r.mes)}</strong>{" "}
            {r.aprobado ? (
              <span className="texto-ok">· aprobado</span>
            ) : r.cerrado ? (
              <span className="texto-aviso">· cerrado, falta aprobarlo</span>
            ) : (
              <span className="texto-aviso">· falta cerrar el mes en Gastos</span>
            )}
          </p>
          {r.pendientes.length > 0 && <p className="dato-sec">Meses anteriores sin aprobar: {r.pendientes.map(nombreMes).join(", ")}.</p>}
          {r.socios.length === 0 ? (
            <p className="dato-sec">Sin reparto para mostrar.</p>
          ) : (
            <ul className="reparto-socios">
              {r.socios.map((s) => (
                <li key={s.nombre}>
                  <span>{s.nombre}</span>
                  <strong className={s.neto < 0 ? "texto-vencido" : undefined}>{moneda(s.neto)}</strong>
                </li>
              ))}
            </ul>
          )}
          {!r.aprobado && <p className="dato-sec">Es lo que da el calculo hoy; cambia hasta que se apruebe.</p>}
        </div>
      )}
    </ConParte>
  );
}

/** Tarjetas del resumen, por id (ver catalogoInicio.ts). */
export const TARJETAS_SOFI: Record<string, () => JSX.Element> = {
  sofi: SofiTeCuenta,
  "cifras-mes": CifrasDelMes,
  "dias-cobro": DiasDeCobro,
  "rentabilidad-mes": RentabilidadDelMes,
  "reparto-mes": RepartoDelMes,
};
