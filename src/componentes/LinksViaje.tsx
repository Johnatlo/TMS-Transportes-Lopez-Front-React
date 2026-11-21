/**
 * Botones para abrir la remision y la factura de un viaje (links al Drive
 * dedicado que se llena a diario; se escriben en el viaje del Cuadro pagos).
 * Van en todas las listas de viajes. Sin link, el boton se ve apagado y dice
 * que aun no se ha subido. El sistema no guarda los archivos: solo el link.
 */

/** Links de un viaje: uno o varios (un viaje del RNDC con varias remesas puede tener varios, separados por espacio). */
type Links = string | null | undefined;

/** Separa los links (vienen uno o varios separados por espacio). */
const lista = (l: Links) =>
  String(l ?? "")
    .split(/\s+/)
    .filter((x) => /^https?:\/\//i.test(x));

/** Un boton por link (o uno apagado si no hay). */
function Boton({ links, nombre }: { links: Links; nombre: string }) {
  const urls = lista(links);
  if (!urls.length)
    return (
      <span className="link-viaje apagado" title={`Aun no se ha subido el link de la ${nombre.toLowerCase()} (se pone en el viaje del Cuadro pagos)`}>
        {nombre}
      </span>
    );
  return (
    <>
      {urls.map((u, i) => (
        <a
          key={u}
          className="link-viaje"
          href={u}
          target="_blank"
          rel="noreferrer"
          title={`Abrir la ${nombre.toLowerCase()} en otra pestana`}
          onClick={(e) => e.stopPropagation()}
        >
          {nombre}
          {urls.length > 1 ? ` ${i + 1}` : ""}
        </a>
      ))}
    </>
  );
}

/** Botones "Remision" y "Factura" de un viaje. */
export default function LinksViaje({ remisionUrl, facturaUrl }: { remisionUrl: Links; facturaUrl: Links }) {
  return (
    <span className="links-viaje">
      <Boton links={remisionUrl} nombre="Remision" />
      <Boton links={facturaUrl} nombre="Factura" />
    </span>
  );
}
