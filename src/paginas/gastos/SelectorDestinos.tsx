/**
 * A quien va un gasto (o la cuota de un credito): se marcan los vehiculos uno
 * por uno, con los atajos "Lopez", "M&C" y "Todos", y se agregan partes
 * directas a socios (valor fijo, porcentaje, o una parte igual a la de un
 * carro). "La empresa" toma una parte de lo que la empresa asume (no se le
 * carga a ningun carro: baja la rentabilidad de la empresa). Debajo, la vista
 * previa de cuanto le toca a cada uno.
 */
import { moneda } from "../../api/cliente";
import type { OpcionesGastos } from "../../api/cliente";
import { placaConGuion } from "../cuadro/facturacion";
import { vehiculosDe, vistaPrevia } from "./destinos";
import type { ParteSocio, SeleccionDestinos } from "./destinos";

const NOMBRE_EMPRESA = { LOPEZ: "Transportes Lopez", MYC: "Transportes M&C" } as const;

/** Selector de vehiculos y socios de un gasto. */
export default function SelectorDestinos({
  opciones,
  monto,
  valor,
  alCambiar,
}: {
  opciones: OpcionesGastos;
  /** Valor del gasto, para la vista previa. */
  monto: number;
  valor: SeleccionDestinos;
  alCambiar: (s: SeleccionDestinos) => void;
}) {
  const marcados = new Set(valor.vehiculos);
  const alternar = (id: number) => alCambiar({ ...valor, vehiculos: marcados.has(id) ? valor.vehiculos.filter((x) => x !== id) : [...valor.vehiculos, id] });
  const cambiarSocio = (i: number, c: Partial<ParteSocio>) => alCambiar({ ...valor, socios: valor.socios.map((p, j) => (j === i ? { ...p, ...c } : p)) });
  const previa = vistaPrevia(monto, valor);
  // Los inactivos solo se muestran si ya estaban marcados (un gasto viejo).
  const visibles = opciones.vehiculos.filter((v) => v.activo || marcados.has(v.id));

  return (
    <div className="selector-destinos">
      <div className="barra-envio" style={{ marginBottom: "0.4rem" }}>
        <span className="dato-sec">Marcar:</span>
        <button type="button" className="boton-barra" onClick={() => alCambiar({ ...valor, vehiculos: vehiculosDe(opciones, "LOPEZ") })}>
          Lopez
        </button>
        <button type="button" className="boton-barra" onClick={() => alCambiar({ ...valor, vehiculos: vehiculosDe(opciones, "MYC") })}>
          M&C
        </button>
        <button type="button" className="boton-barra" onClick={() => alCambiar({ ...valor, vehiculos: vehiculosDe(opciones, "TODOS") })}>
          Todos
        </button>
        <button type="button" className="btn-link" onClick={() => alCambiar({ ...valor, vehiculos: [] })}>
          Ninguno
        </button>
        <label className={`casilla-vehiculo${valor.empresa ? " marcada" : ""}`} title="Lo asume la empresa: no se le carga a ningun carro">
          <input type="checkbox" checked={!!valor.empresa} onChange={() => alCambiar({ ...valor, empresa: !valor.empresa })} />
          <strong>La empresa</strong>
        </label>
        <span className="dato-sec" style={{ marginLeft: "auto" }}>
          {valor.vehiculos.length} vehiculo(s) marcado(s)
        </span>
      </div>
      {(["LOPEZ", "MYC"] as const).map((empresa) => (
        <div key={empresa} className="destinos-empresa">
          <span className="dato-sec">{NOMBRE_EMPRESA[empresa]}</span>
          <div className="destinos-vehiculos">
            {visibles
              .filter((v) => v.empresa === empresa)
              .map((v) => (
                <label key={v.id} className={`casilla-vehiculo${marcados.has(v.id) ? " marcada" : ""}`}>
                  <input type="checkbox" checked={marcados.has(v.id)} onChange={() => alternar(v.id)} />
                  <strong>{placaConGuion(v.placa)}</strong>
                  {v.dueno && <span className="dato-sec">{v.dueno}</span>}
                </label>
              ))}
          </div>
        </div>
      ))}

      <div className="destinos-socios">
        <span className="dato-sec">Partes directas a socios (opcional)</span>
        {valor.socios.map((p, i) => (
          <div key={i} className="linea-abono">
            <select value={p.socioId ?? ""} onChange={(e) => cambiarSocio(i, { socioId: e.target.value ? Number(e.target.value) : null })} aria-label="Socio">
              <option value="">Socio...</option>
              {opciones.socios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <select value={p.modo} onChange={(e) => cambiarSocio(i, { modo: e.target.value as ParteSocio["modo"] })} aria-label="Como se calcula">
              <option value="FIJO">Valor fijo ($)</option>
              <option value="PORCENTAJE">Porcentaje (%)</option>
              <option value="PARTE">Partes (como un carro)</option>
            </select>
            <input
              type="number"
              min={0}
              step="any"
              placeholder={p.modo === "FIJO" ? "Valor" : p.modo === "PORCENTAJE" ? "%" : "Partes"}
              style={{ width: "9rem" }}
              value={p.valor}
              onChange={(e) => cambiarSocio(i, { valor: e.target.value })}
            />
            <button type="button" className="btn-link" onClick={() => alCambiar({ ...valor, socios: valor.socios.filter((_, j) => j !== i) })}>
              Quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-link"
          onClick={() => alCambiar({ ...valor, socios: [...valor.socios, { socioId: null, modo: "FIJO", valor: "" }] })}
        >
          + Agregar parte de un socio
        </button>
      </div>

      <div className={`alert ${previa.problema ? "warning" : "info"}`} style={{ marginTop: "0.5rem" }}>
        {previa.problema ?? (
          <>
            {previa.directo > 0 && <>Directo a socios: {moneda(previa.directo)}. </>}
            {previa.partes > 0 ? (
              <>
                {moneda(previa.resto)} entre {previa.partes} parte(s): <strong>{moneda(Math.round(previa.porParte))}</strong> cada una.
              </>
            ) : (
              "Todo va directo a los socios."
            )}
          </>
        )}
      </div>
    </div>
  );
}
