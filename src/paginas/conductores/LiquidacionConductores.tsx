/**
 * Pantalla Cuentas conductores: las cuentas de viaje de cada vehiculo de la
 * flota propia y la liquidacion de sus conductores, mes a mes. Solo el rol
 * total y M&C (M&C solo ve sus vehiculos; el rol total filtra por empresa,
 * Lopez o M&C, para llevar las cuentas de cada dueno).
 *
 * La cuenta de cada vehiculo (el cuadro SWK-973) esta en Rentabilidad.
 * - Cuentas de viaje: por vehiculo, la hoja de gastos de cada viaje (ver
 *   CuentasViaje.tsx).
 * - Liquidacion: por conductor, el producido conductor de sus viajes, lo de
 *   la nomina, el saldo de sus cuentas de viaje y los prestamos; el total a
 *   pagar y la marca de pagado (ver Liquidacion.tsx).
 * - Prestamos: monto, saldo y lo descontado cada mes (ver Prestamos.tsx).
 * - Fletes conductor: la matriz con que se calcula el producido conductor
 *   (ver FletesConductor.tsx). Solo se ve aqui.
 */
import { useState } from "react";
import { hoyColombia } from "../../api/cliente";
import { soloGastosConductores } from "../../permisos";
import type { EmpresaGasto } from "../../api/cliente";
import { useSesion } from "../../ganchos/useSesion";
import { nombreMes } from "../gastos/nombres";
import CuentasViaje from "./CuentasViaje";
import FletesConductor from "./FletesConductor";
import Liquidacion from "./Liquidacion";
import Prestamos from "./Prestamos";

type Vista = "cuentas" | "liquidacion" | "prestamos" | "fletes";

/** Empresa elegida en el filtro (el rol total); TODAS = las dos. */
export type FiltroEmpresa = EmpresaGasto | "TODAS";

const VISTAS: Array<[Vista, string]> = [
  ["cuentas", "Cuentas de viaje"],
  ["liquidacion", "Liquidacion de conductores"],
  ["prestamos", "Prestamos"],
  ["fletes", "Fletes conductor"],
];

/** Pantalla del modulo. */
export default function LiquidacionConductores() {
  const { usuario } = useSesion();
  // M&C solo ve lo suyo (lo filtra el servidor): no necesita el filtro.
  const soloMyc = usuario?.rol === "MYC";
  // Las administrativas: solo las cuentas de viaje (sin producido ni saldo del conductor).
  const soloGastos = soloGastosConductores(usuario?.rol);
  const vistas = soloGastos ? VISTAS.filter(([id]) => id === "cuentas") : VISTAS;
  const [vista, setVista] = useState<Vista>("cuentas");
  const [mes, setMes] = useState(hoyColombia().slice(0, 7));
  const [empresa, setEmpresa] = useState<FiltroEmpresa>("TODAS");
  return (
    <>
      <div className="barra-envio">
        <div className="selector-vista" role="group" aria-label="Vista">
          {vistas.map(([id, etiqueta]) => (
            <button key={id} type="button" className={vista === id ? "activo" : ""} onClick={() => setVista(id)}>
              {etiqueta}
            </button>
          ))}
        </div>
        {!soloMyc && vista !== "fletes" && (
          <div className="selector-vista" role="group" aria-label="Empresa">
            {(
              [
                ["TODAS", "Todos los vehiculos"],
                ["LOPEZ", "T. Lopez"],
                ["MYC", "T. M&C"],
              ] as Array<[FiltroEmpresa, string]>
            ).map(([id, etiqueta]) => (
              <button key={id} type="button" className={empresa === id ? "activo" : ""} onClick={() => setEmpresa(id)}>
                {etiqueta}
              </button>
            ))}
          </div>
        )}
        {(vista === "liquidacion" || vista === "cuentas") && (
          <label className="selector-mes">
            <span className="dato-sec">Mes de los viajes</span>
            <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
            <span className="dato-sec">{nombreMes(mes)}</span>
          </label>
        )}
      </div>
      {vista === "cuentas" && <CuentasViaje mes={mes} empresa={empresa} />}
      {vista === "liquidacion" && <Liquidacion mes={mes} empresa={empresa} irACuentas={() => setVista("cuentas")} />}
      {vista === "prestamos" && <Prestamos mes={mes} empresa={empresa} />}
      {vista === "fletes" && <FletesConductor />}
    </>
  );
}
