/**
 * Fondos y reparto del mes (como la hoja de la SWK-973): por vehiculo, el
 * saldo del mes anterior + la utilidad - lo que se le pago al dueno por los
 * viajes = lo que hay antes de repartir; menos la base (lo que se deja por si
 * el carro se accidenta o necesita un arreglo mayor) = disponible. El rol
 * total escribe cuanto se reparte de cada carro ("Repartimos"; se sugiere el
 * disponible), recalcula y aprueba. Debajo, lo que le toca a cada socio:
 * su parte de lo repartido menos el 4 x 1000, su parte de lo liquidado menos
 * lo que el recibio, menos sus gastos propios = neto del mes.
 */
import { useEffect, useState } from "react";
import { apiUtilidades, moneda } from "../../api/cliente";
import type { ConfigFondo, UtilidadesMes } from "../../api/cliente";
import Modal from "../../componentes/Modal";
import TablaDatos, { Pastilla } from "../../componentes/TablaDatos";
import type { Columna } from "../../componentes/TablaDatos";
import { fechaCorta } from "../cuadro/estadosCuadro";
import { placaConGuion } from "../cuadro/facturacion";
import { exportarFondos, exportarReparto } from "./excelUtilidades";
import { nombreMes } from "./pasos";

type FilaVehiculo = UtilidadesMes["vehiculos"][number];
type FilaSocio = UtilidadesMes["socios"][number];

/** Fondos, "Repartimos", aprobacion y reparto por socio del mes. */
export default function FondosReparto({ datos, total, alCambiar }: { datos: UtilidadesMes; total: boolean; alCambiar: () => void }) {
  // Lo que se muestra: lo que llega del servidor o la ultima simulacion.
  const [u, setU] = useState(datos);
  const [repartimos, setRepartimos] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [configurar, setConfigurar] = useState(false);
  useEffect(() => {
    setU(datos);
    setRepartimos(Object.fromEntries(datos.vehiculos.filter((v) => v.fondo).map((v) => [v.vehiculoId, String(v.fondo!.repartimos)])));
  }, [datos]);
  const editable = total && !u.aprobado;
  const antesDelInicio = u.mes < u.inicio;
  const montos = () => Object.fromEntries(Object.entries(repartimos).map(([k, v]) => [Number(k), Number(v || 0)]));
  const cambiado = u.vehiculos.some((v) => v.fondo && Number(repartimos[v.vehiculoId] ?? v.fondo.repartimos) !== v.fondo.repartimos);

  /** Ejecuta una accion del servidor. */
  async function hacer(fn: () => Promise<unknown>) {
    setError(null);
    setOcupado(true);
    try {
      await fn();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  }

  if (antesDelInicio)
    return (
      <div className="panel vacio">
        Los fondos y el reparto arrancan en {nombreMes(u.inicio)} (la fecha de inicio de los gastos). Elige ese mes o uno posterior.
      </div>
    );

  const placa = (id: number) => placaConGuion(u.vehiculos.find((v) => v.vehiculoId === id)?.placa ?? "?");
  const num = (titulo: string, f: (x: NonNullable<FilaVehiculo["fondo"]>) => number, fuerte = false): Columna<FilaVehiculo> => ({
    id: titulo,
    titulo,
    alinear: "derecha",
    valor: (v) => (v.fondo ? Math.round(f(v.fondo)) : 0),
    celda: (v) => {
      if (!v.fondo) return "-";
      const x = f(v.fondo);
      return fuerte ? (
        <strong className={x < 0 ? "texto-vencido" : undefined}>{moneda(x)}</strong>
      ) : (
        <span className={x < 0 ? "texto-vencido" : undefined}>{moneda(x)}</span>
      );
    },
  });
  const columnas: Columna<FilaVehiculo>[] = [
    {
      id: "placa",
      titulo: "Vehiculo",
      valor: (v) => v.placa,
      celda: (v) => (
        <>
          <span className="principal">{placaConGuion(v.placa)}</span>
          <span className="dato-sec">
            {v.participaciones.map((p) => (p.porcentaje === 100 ? p.socio : `${p.socio} ${p.porcentaje} %`)).join(" + ") || "Sin participacion"}
          </span>
        </>
      ),
    },
    num("Saldo anterior", (f) => f.saldoAnterior),
    num("+ Utilidad", (f) => f.utilidad),
    num("- Pagado al dueno", (f) => f.liquidado),
    num("= Antes de repartir", (f) => f.antesDeRepartir, true),
    num("Base", (f) => f.base),
    num("Disponible", (f) => f.disponible),
    {
      id: "repartimos",
      titulo: "Repartimos",
      alinear: "derecha",
      valor: (v) => (v.fondo ? Math.round(v.fondo.repartimos) : 0),
      celda: (v) =>
        !v.fondo ? (
          "-"
        ) : editable ? (
          <input
            type="number"
            min={0}
            step="any"
            style={{ width: "8.5rem", textAlign: "right" }}
            value={repartimos[v.vehiculoId] ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRepartimos({ ...repartimos, [v.vehiculoId]: e.target.value })}
            aria-label={`Repartimos ${v.placa}`}
          />
        ) : (
          <strong>{moneda(v.fondo.repartimos)}</strong>
        ),
    },
    num("Saldo final", (f) => f.saldoFinal, true),
  ];

  const columnasSocio: Columna<FilaSocio>[] = [
    {
      id: "socio",
      titulo: "Socio",
      valor: (s) => s.nombre,
      celda: (s) => (
        <>
          <span className="principal">{s.nombre}</span>
          {s.externo && <Pastilla tono="morado">Externo</Pastilla>}
        </>
      ),
    },
    { id: "repartido", titulo: "Su parte de lo repartido", alinear: "derecha", valor: (s) => Math.round(s.repartido), celda: (s) => moneda(s.repartido) },
    { id: "gmf", titulo: `- ${u.gmfPorMil} x 1000`, alinear: "derecha", valor: (s) => Math.round(s.gmf), celda: (s) => (s.gmf ? moneda(s.gmf) : "-") },
    {
      id: "liquidado",
      titulo: "+ Su parte de lo pagado por viajes",
      alinear: "derecha",
      valor: (s) => Math.round(s.liquidado),
      celda: (s) => (s.liquidado ? moneda(s.liquidado) : "-"),
    },
    {
      id: "recibido",
      titulo: "- Lo que el recibio",
      alinear: "derecha",
      valor: (s) => Math.round(s.recibido),
      celda: (s) => (s.recibido ? moneda(s.recibido) : "-"),
    },
    {
      id: "gastos",
      titulo: "- Gastos propios",
      alinear: "derecha",
      valor: (s) => Math.round(s.totalGastosPropios),
      celda: (s) => (s.totalGastosPropios ? moneda(s.totalGastosPropios) : "-"),
    },
    {
      id: "neto",
      titulo: "= Neto del mes",
      alinear: "derecha",
      valor: (s) => Math.round(s.neto),
      celda: (s) => (
        <strong
          className={s.neto < 0 ? "texto-vencido" : undefined}
          title={s.neto < 0 ? "Lo que el socio debe (pasa a su cuenta)" : "Lo que se le debe (pasa a su cuenta)"}
        >
          {moneda(s.neto)}
        </strong>
      ),
    },
  ];

  const totalRepartimos = u.vehiculos.reduce((t, v) => t + (v.fondo ? Number(repartimos[v.vehiculoId] ?? v.fondo.repartimos) || 0 : 0), 0);

  return (
    <>
      {error && <div className="alert danger">{error}</div>}
      <div className="barra-envio" style={{ marginBottom: "0.5rem" }}>
        {u.aprobado ? (
          <Pastilla tono="ok">Reparto aprobado</Pastilla>
        ) : u.cerrado ? (
          <Pastilla tono="info">Mes cerrado</Pastilla>
        ) : (
          <Pastilla tono="aviso">Mes abierto: los valores pueden cambiar</Pastilla>
        )}
        <span className="dato-sec">
          {u.aprobado
            ? `Aprobado por ${u.aprobado.por ?? "-"} el ${fechaCorta(u.aprobado.en.slice(0, 10))}: es la foto de ese dia.`
            : `Se reparten ${moneda(totalRepartimos)} en total.`}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {editable && (
            <button
              className="btn-secondary"
              disabled={ocupado || !cambiado}
              onClick={() => hacer(async () => setU(await apiUtilidades.simular(u.mes, montos())))}
            >
              Recalcular
            </button>
          )}
          {editable && (
            <button
              className="btn-primary"
              disabled={ocupado || !u.cerrado || u.pendientes.length > 0}
              title={!u.cerrado ? "Primero cierra el mes en Gastos" : u.pendientes.length ? `Primero aprueba ${u.pendientes.join(", ")}` : undefined}
              onClick={() =>
                window.confirm(`¿Aprobar ${nombreMes(u.mes)} repartiendo ${moneda(totalRepartimos)}? Queda guardado tal como esta.`) &&
                hacer(async () => {
                  await apiUtilidades.aprobar(u.mes, montos());
                  alCambiar();
                })
              }
            >
              Aprobar reparto
            </button>
          )}
          {total && u.aprobado && (
            <button
              className="btn-secondary"
              disabled={ocupado}
              onClick={() =>
                window.confirm("¿Anular la aprobacion? El mes se vuelve a calcular con los datos actuales.") &&
                hacer(async () => {
                  await apiUtilidades.anular(u.mes);
                  alCambiar();
                })
              }
            >
              Anular aprobacion
            </button>
          )}
          {total && (
            <button className="btn-link" onClick={() => setConfigurar(true)}>
              Base y saldo inicial
            </button>
          )}
        </span>
      </div>
      {u.pendientes.length > 0 && (
        <div className="alert warning">
          Faltan por aprobar {u.pendientes.map(nombreMes).join(", ")}: el saldo anterior de los fondos sale del ultimo mes aprobado (o del saldo inicial).
        </div>
      )}
      {u.sinParticipacion.length > 0 && (
        <div className="alert warning">
          {u.sinParticipacion.map(placaConGuion).join(", ")} reparte o liquida algo sin participacion que sume 100 %: registrala en Participaciones.
        </div>
      )}
      <div className="panel">
        <TablaDatos
          filas={u.vehiculos}
          columnas={columnas}
          clave={(v) => v.vehiculoId}
          nombreArchivo={`fondos-${u.mes}`}
          alExportar={() => exportarFondos(u)}
          placeholderBusqueda="Buscar placa o socio..."
        />
      </div>
      <h4 style={{ margin: "1rem 0 0.4rem" }}>Lo que le toca a cada socio</h4>
      <div className="section-desc" style={{ marginBottom: "0.5rem" }}>
        Neto del mes = su parte de lo repartido - {u.gmfPorMil} x 1000 + su parte de lo pagado por los viajes - lo que el recibio de los viajes (el dueno en
        Flota) - sus gastos propios. Pasa a su cuenta (pestana Socios): si es negativo, lo debe y se acumula para el mes siguiente.
      </div>
      <div className="panel">
        <TablaDatos
          filas={u.socios}
          columnas={columnasSocio}
          clave={(s) => s.socioId}
          nombreArchivo={`reparto-${u.mes}`}
          alExportar={() => exportarReparto(u)}
          vacio="Nada que repartir en el mes."
          detalle={(s) => (
            <div className="detalle-tanqueo" onClick={(e) => e.stopPropagation()}>
              <div className="detalle-nomina">
                <div>
                  <h5>Por vehiculo</h5>
                  {s.porVehiculo.map((v) => (
                    <div key={v.vehiculoId} className="concepto-nomina">
                      <span>
                        {placa(v.vehiculoId)} ({v.porcentaje ? `${v.porcentaje} %` : "recibio la liquidacion"})
                      </span>
                      <span>
                        {v.repartido ? `repartido ${moneda(v.repartido)}` : ""} {v.liquidado ? `· viajes ${moneda(v.liquidado)}` : ""}{" "}
                        {v.recibido ? `· recibio ${moneda(v.recibido)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <h5>Gastos propios</h5>
                  {s.gastosPropios.length ? (
                    s.gastosPropios.map((g, i) => (
                      <div key={i} className="concepto-nomina">
                        <span>{g.descripcion}</span>
                        <span>{g.monto < 0 ? `+ ${moneda(-g.monto)}` : `- ${moneda(g.monto)}`}</span>
                      </div>
                    ))
                  ) : (
                    <span className="dato-sec">Ninguno en el mes.</span>
                  )}
                </div>
              </div>
            </div>
          )}
        />
      </div>
      {configurar && (
        <VentanaFondos
          gmfPorMil={u.gmfPorMil}
          alCerrar={() => setConfigurar(false)}
          alGuardar={() => {
            setConfigurar(false);
            alCambiar();
          }}
        />
      )}
    </>
  );
}

/** Base y saldo inicial del fondo de cada vehiculo, y el 4 x 1000 (rol total). */
function VentanaFondos({ gmfPorMil, alCerrar, alGuardar }: { gmfPorMil: number; alCerrar: () => void; alGuardar: () => void }) {
  const [fondos, setFondos] = useState<ConfigFondo[] | null>(null);
  const [gmf, setGmf] = useState(String(gmfPorMil));
  const [error, setError] = useState<string | null>(null);
  const [cambios, setCambios] = useState<Record<number, { base: string; saldoInicial: string }>>({});
  useEffect(() => {
    apiUtilidades
      .fondos()
      .then(setFondos)
      .catch((exc) => setError(exc instanceof Error ? exc.message : "No se pudieron cargar los fondos."));
  }, []);
  async function guardar() {
    setError(null);
    try {
      for (const f of fondos ?? []) {
        const c = cambios[f.vehiculoId];
        if (!c) continue;
        await apiUtilidades.guardarFondo(f.vehiculoId, { base: Number(c.base), saldoInicial: Number(c.saldoInicial), nota: f.nota });
      }
      if (Number(gmf) !== gmfPorMil) await apiUtilidades.guardarGmf(Number(gmf));
      alGuardar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo guardar.");
    }
  }
  const valor = (f: ConfigFondo, k: "base" | "saldoInicial") => cambios[f.vehiculoId]?.[k] ?? String(f[k]);
  const cambiar = (f: ConfigFondo, k: "base" | "saldoInicial", v: string) =>
    setCambios({ ...cambios, [f.vehiculoId]: { base: valor(f, "base"), saldoInicial: valor(f, "saldoInicial"), [k]: v } });
  return (
    <Modal
      titulo="Fondos de los vehiculos"
      ancho="wide"
      alCerrar={alCerrar}
      pie={
        <>
          <button className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={guardar} disabled={!fondos}>
            Guardar
          </button>
        </>
      }
    >
      {error && <div className="alert danger">{error}</div>}
      <div className="section-desc" style={{ marginBottom: "0.6rem" }}>
        Base: lo que se deja en cada carro y no se reparte (por si se accidenta o necesita un arreglo mayor). Saldo inicial: con lo que arranca el fondo en el
        mes de inicio (el "mes anterior" de la hoja de cada carro); despues de aprobar un mes ya no se cambia.
      </div>
      {!fondos ? (
        <div className="dato-sec">Cargando...</div>
      ) : (
        <table className="tabla tabla-compacta">
          <thead>
            <tr>
              <th>Vehiculo</th>
              <th className="num">Base</th>
              <th className="num">Saldo inicial</th>
            </tr>
          </thead>
          <tbody>
            {fondos.map((f) => (
              <tr key={f.vehiculoId}>
                <td>{placaConGuion(f.placa)}</td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    style={{ width: "9rem", textAlign: "right" }}
                    value={valor(f, "base")}
                    onChange={(e) => cambiar(f, "base", e.target.value)}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    style={{ width: "9rem", textAlign: "right" }}
                    value={valor(f, "saldoInicial")}
                    onChange={(e) => cambiar(f, "saldoInicial", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="campos-cuadro" style={{ marginTop: "0.8rem" }}>
        <div>
          <label>4 x 1000 al repartir (por mil)</label>
          <input type="number" min={0} step="any" value={gmf} onChange={(e) => setGmf(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
