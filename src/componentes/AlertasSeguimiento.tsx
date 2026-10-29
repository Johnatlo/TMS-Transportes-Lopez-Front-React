/**
 * Ventana de alertas de seguimiento (boton del reloj en la barra superior):
 * papeles que hay que perseguir despues del descargue, viajes por facturar y
 * facturas por cobrar. Clic en una alerta lleva a su pantalla con ese viaje o
 * esa factura abiertos.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AlertaSeguimiento, ResumenAlertasSeguimiento, TipoAlerta } from "../api/cliente";
import Modal from "./Modal";
import { Pastilla } from "./TablaDatos";

const GRUPOS: Array<{ tipo: TipoAlerta; etiqueta: string; vacio: string }> = [
  { tipo: "CONTINGENCIA", etiqueta: "Manifiestos de contingencia", vacio: "Ningun manifiesto de contingencia pendiente." },
  { tipo: "PAPELES", etiqueta: "Papeles", vacio: "Ningun papel pendiente de seguimiento hoy." },
  { tipo: "FACTURACION", etiqueta: "Por facturar", vacio: "Nada pendiente de facturar." },
  { tipo: "CARTERA", etiqueta: "Cartera", vacio: "Ninguna factura vencida ni por vencer." },
  { tipo: "ANTICIPO_EMPRESA", etiqueta: "Anticipos de empresas", vacio: "Ningun anticipo de empresa pendiente." },
  { tipo: "BOMBA", etiqueta: "Pagos a la bomba", vacio: "Ninguna factura de la bomba por vencer." },
];

/** Nombre corto de cada tipo para los botones de la barra superior. */
export const ETIQUETA_CORTA: Record<TipoAlerta, string> = {
  PAPELES: "Papeles",
  FACTURACION: "Facturar",
  CARTERA: "Cartera",
  ANTICIPO_EMPRESA: "Anticipos",
  BOMBA: "Bomba",
  CONTINGENCIA: "Contingencia",
};
export const TIPOS_ALERTA: TipoAlerta[] = GRUPOS.map((g) => g.tipo);

/** Ruta de la pantalla que resuelve la alerta, con el viaje o la factura a abrir. */
function rutaDe(a: AlertaSeguimiento): string {
  // Anticipo de la empresa: el del Zorro (se abona a la bomba) en Anticipos;
  // el de los demas (nos lo pagan a nosotros) en Cartera.
  if (a.tipo === "ANTICIPO_EMPRESA") return `${/bomba/i.test(a.motivos.join(" ")) ? "/anticipos" : "/cartera"}?anticipo=${a.cuadroId}`;
  // Factura de la bomba: en Anticipos, con el cruce abierto.
  if (a.tipo === "BOMBA") return "/anticipos?cruce=1";
  // Manifiesto de contingencia: los documentos del viaje en RNDC (reintentar el oficial).
  if (a.tipo === "CONTINGENCIA") return `/historial?documentos=${a.viajeId}`;
  if (a.tipo === "CARTERA") {
    // Una sola factura: se abre esa; varias de la empresa: Cartera filtrada por la empresa.
    if (!a.facturaNumero) return `/cartera?cliente=${encodeURIComponent(a.empresa ?? "")}`;
    return `/cartera?factura=${encodeURIComponent(a.facturaNumero)}&empresa=${encodeURIComponent(a.empresa ?? "")}`;
  }
  return `/cuadro?papeles=${a.cuadroId}`;
}

/**
 * Lista de alertas por grupo. Abre en el grupo pedido (el boton de la barra
 * que se toco) o en el primero que tenga algo.
 */
export default function AlertasSeguimiento({
  resumen,
  alCerrar,
  grupoInicial,
}: {
  resumen: ResumenAlertasSeguimiento;
  alCerrar: () => void;
  grupoInicial?: TipoAlerta;
}) {
  const navegar = useNavigate();
  const cuantas = (t: TipoAlerta) => resumen.alertas.filter((a) => a.tipo === t).length;
  const [grupo, setGrupo] = useState<TipoAlerta>(grupoInicial ?? GRUPOS.find((g) => cuantas(g.tipo) > 0)?.tipo ?? "PAPELES");
  const lista = resumen.alertas.filter((a) => a.tipo === grupo);

  return (
    <Modal titulo="Seguimiento: papeles, facturacion y cartera" ancho="wide" alCerrar={alCerrar}>
      <div className="tabla-pestanas selector-vista">
        {GRUPOS.map((g) => (
          <button key={g.tipo} className={grupo === g.tipo ? "activa" : ""} onClick={() => setGrupo(g.tipo)}>
            {g.etiqueta} ({cuantas(g.tipo)})
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <div className="dato-sec">{GRUPOS.find((g) => g.tipo === grupo)!.vacio}</div>
      ) : (
        <ul className="lista-notas">
          {lista.map((a, i) => (
            <li
              key={`${a.tipo}-${a.cuadroId ?? a.facturaNumero}-${i}`}
              className="fila-clic"
              onClick={() => {
                alCerrar();
                navegar(rutaDe(a));
              }}
            >
              <Pastilla tono={a.nivel === "urgente" ? "error" : "aviso"}>{a.nivel === "urgente" ? "Urgente" : "Atencion"}</Pastilla>{" "}
              <strong>{a.titulo}</strong>
              {a.motivos.map((m) => (
                <span key={m} className="dato-sec" style={{ display: "block" }}>
                  {m}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
