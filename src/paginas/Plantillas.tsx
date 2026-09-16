/**
 * PENDIENTE DE MIGRAR.
 *
 * Equivale a plantillas.component (124 + 175) y plantilla-form.component
 * (213 + 194).
 *
 * Son dos cosas separadas:
 *
 * 1. Lista de plantillas con su tarifa. Directo: useDatos + tabla, como
 *    Historial.tsx.
 *
 * 2. Formulario por pasos para crear una plantilla. Mismo patron de pasos que
 *    Despacho, pero sin cadena de dependencias: es casi todo campos sueltos.
 *    Validar antes de enviar: codigo de mercancia de 4 o 6 digitos, subpartida
 *    y arancel de 2, y municipio intermedio obligatorio si el tipo es 'I'.
 *
 * 3. Actualizacion masiva de tarifas por ruta. Va en dos tiempos a proposito:
 *    primero api.getRutasConTarifas() para elegir la ruta, luego
 *    api.previsualizarTarifa() para MOSTRAR que plantillas se van a tocar, y
 *    solo despues api.actualizarTarifaRuta(). No saltarse la previsualizacion:
 *    es lo que evita cambiarle la tarifa a un cliente con precio negociado.
 */
export default function Plantillas() {
  return (
    <>
      <div className="panel">
        <p className="section-desc">
          Pantalla pendiente de migrar. Mientras tanto se usa la version en Angular.
        </p>
      </div>
    </>
  );
}
