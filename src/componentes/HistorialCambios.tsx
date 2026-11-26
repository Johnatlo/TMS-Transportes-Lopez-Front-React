/**
 * Historial de cambios de un registro (un viaje del cuadro, un gasto...):
 * quien cambio que y cuando, con el valor de antes y el de despues, incluidos
 * los cambios de lo que cuelga de el (los anticipos y notas de un viaje). Lo
 * guarda la bitacora de Control interno. Solo lo ve el rol de acceso total.
 *
 * Tambien exporta lo que usan las pantallas de Control interno para mostrar
 * los cambios: el nombre de un campo, un valor y la lista de cambios.
 */
import { useState } from "react";
import { apiControl } from "../api/cliente";
import type { RegistroBitacora } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { useSesion } from "../ganchos/useSesion";
import { puede } from "../permisos";
import { Cargando, ErrorCarga } from "./Estado";
import Modal from "./Modal";
import { Pastilla } from "./TablaDatos";
import type { TonoPastilla } from "./TablaDatos";

/** "valorFlete" -> "Valor flete"; "facturaFechaPago" -> "Factura fecha pago". */
export function nombreCampo(campo: string): string {
  const t = campo
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Un valor guardado, legible: vacio, numeros con miles, fechas dd/mm/aaaa. */
export function valorTexto(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vacio)";
  if (typeof v === "number") return v.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  const s = String(v);
  const f = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s);
  if (f) return `${f[3]}/${f[2]}/${f[1]}${f[4] && `${f[4]}:${f[5]}` !== "00:00" ? ` ${f[4]}:${f[5]}` : ""}`;
  if (/^-?\d+(\.\d+)?$/.test(s) && s.length < 16) return Number(s).toLocaleString("es-CO", { maximumFractionDigits: 2 });
  return s.length > 140 ? `${s.slice(0, 140)}...` : s;
}

/** Color y nombre de cada accion. */
export const ACCION: Record<RegistroBitacora["accion"], { texto: string; tono: TonoPastilla }> = {
  CREAR: { texto: "Creo", tono: "ok" },
  CAMBIAR: { texto: "Cambio", tono: "azul" },
  BORRAR: { texto: "Borro", tono: "error" },
};

/** Los campos de un registro de la bitacora: "Campo: antes -> despues" (al crear o borrar, el valor). */
export function ListaCambios({ r, maximo }: { r: RegistroBitacora; maximo?: number }) {
  const [todos, setTodos] = useState(false);
  // El numero del registro ya va en el titulo.
  const campos = r.cambios.filter((c) => r.accion === "CAMBIAR" || c.campo !== "id");
  const lista = todos || !maximo ? campos : campos.slice(0, maximo);
  return (
    <ul className="lista-cambios">
      {lista.map((c) => (
        <li key={c.campo}>
          <span className="nombre-campo">{nombreCampo(c.campo)}:</span>{" "}
          {r.accion === "CAMBIAR" ? (
            <>
              <span className="valor-antes">{valorTexto(c.antes)}</span> → <strong>{valorTexto(c.despues)}</strong>
            </>
          ) : (
            <span>{valorTexto(r.accion === "CREAR" ? c.despues : c.antes)}</span>
          )}
        </li>
      ))}
      {maximo && campos.length > maximo && (
        <li>
          <button
            className="btn-link"
            onClick={(e) => {
              e.stopPropagation();
              setTodos(!todos);
            }}
          >
            {todos ? "Ver menos" : `Ver los ${campos.length} campos`}
          </button>
        </li>
      )}
    </ul>
  );
}

/** Fecha y hora de un registro, en hora de Colombia. */
export const cuandoTexto = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));

/** Ventana con el historial de un registro. */
function VentanaHistorial({ tabla, id, titulo, alCerrar }: { tabla: string; id: number | string; titulo: string; alCerrar: () => void }) {
  const carga = useDatos(() => apiControl.historial(tabla, id), [tabla, id]);
  return (
    <Modal titulo={`Historial de cambios · ${titulo}`} ancho="wide" alCerrar={alCerrar}>
      {carga.cargando && !carga.datos ? (
        <Cargando que="el historial" />
      ) : carga.error || !carga.datos ? (
        <ErrorCarga mensaje={carga.error ?? "Sin datos"} alReintentar={carga.recargar} />
      ) : carga.datos.length === 0 ? (
        <div className="dato-sec">Sin cambios registrados (la bitacora guarda los cambios desde que se activo).</div>
      ) : (
        <ul className="lista-notas">
          {carga.datos.map((r) => (
            <li key={r.id}>
              <Pastilla tono={ACCION[r.accion].tono}>{ACCION[r.accion].texto}</Pastilla> <strong>{r.que}</strong>{" "}
              {r.tabla !== tabla && <span className="dato-sec">#{r.registroId}</span>}
              <span className="dato-sec" style={{ display: "block" }}>
                {cuandoTexto(r.en)} · {r.usuario ?? "Sistema (proceso automatico)"}
              </span>
              <ListaCambios r={r} maximo={8} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Boton "Historial de cambios" (solo acceso total) que abre el historial del registro. */
export default function HistorialCambios({ tabla, id, titulo }: { tabla: string; id: number | string; titulo: string }) {
  const { usuario } = useSesion();
  const [abierto, setAbierto] = useState(false);
  if (!puede(usuario?.rol, "CONTROL")) return null;
  return (
    <>
      <button
        className="btn-link"
        onClick={(e) => {
          e.stopPropagation();
          setAbierto(true);
        }}
      >
        Historial de cambios
      </button>
      {abierto && <VentanaHistorial tabla={tabla} id={id} titulo={titulo} alCerrar={() => setAbierto(false)} />}
    </>
  );
}
