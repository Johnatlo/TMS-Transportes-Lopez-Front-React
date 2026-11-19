/**
 * Efectivo o combustible de un tramo de anticipo, editable ahi mismo (en el
 * Cuadro pagos y en el cuadro de anticipos). Sirve para reemplazar el valor
 * autorizado cuando el vale de la bomba llega con otro: se guarda al salir
 * del campo (o con Enter) como el valor registrado, sin borrar el anticipo.
 * Los dos cuadros leen el mismo tramo, asi que el cambio se ve en ambos (y en
 * Rentabilidad y Utilidades).
 */
import { moneda } from "../../api/cliente";
import type { AnticipoBomba } from "../../api/cliente";

/** Campo de efectivo o combustible de un tramo. `alGuardar` recibe el valor nuevo con reemplazar: true. */
export default function CampoValorAnticipo({
  t,
  campo,
  alGuardar,
}: {
  t: AnticipoBomba;
  campo: "efectivo" | "combustible";
  alGuardar: (datos: { efectivo?: number; combustible?: number; reemplazar: true }) => void;
}) {
  const actual = t[campo];
  return (
    <span className="campo-valor-anticipo">
      <input
        key={`${t.id}-${campo}-${actual}`}
        type="number"
        min={0}
        defaultValue={actual}
        aria-label={campo === "efectivo" ? "Efectivo" : "Combustible"}
        title={`Escribe el valor real (por ejemplo, el del vale de la bomba) y sal del campo. Antes: ${moneda(actual)}`}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        onBlur={(e) => {
          const valor = Number(e.target.value) || 0;
          if (valor === actual) return;
          // Con galones el combustible sale de la formula; si se reemplaza a mano, los galones ya no cuadran y se quitan.
          if (
            campo === "combustible" &&
            t.galones !== null &&
            !window.confirm(`Este combustible salio de ${t.galones} galones. ¿Reemplazarlo por ${moneda(valor)}? Se quitan los galones.`)
          ) {
            e.target.value = String(actual);
            return;
          }
          alGuardar({ [campo]: valor, reemplazar: true });
        }}
      />
    </span>
  );
}
