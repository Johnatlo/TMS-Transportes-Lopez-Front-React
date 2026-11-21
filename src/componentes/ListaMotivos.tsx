/**
 * Motivos de una alerta (por que un viaje o una factura pide atencion), uno
 * por renglon con su vineta y aire entre ellos, en el color del texto (no en
 * gris pequeno), para que se lean de un vistazo.
 */

/** Lista de motivos; `tono` colorea la vineta como la pastilla de la alerta. */
export default function ListaMotivos({ motivos, tono = "aviso" }: { motivos: string[]; tono?: "aviso" | "error" }) {
  if (!motivos.length) return null;
  return (
    <ul className={`lista-motivos ${tono}`}>
      {motivos.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}
