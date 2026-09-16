/**
 * PENDIENTE DE MIGRAR. Es la pantalla mas grande y la ultima que conviene pasar.
 *
 * Equivale a despacho.component.ts (498 lineas) + .html (242).
 *
 * Lo que hay que reproducir, en orden de dificultad:
 *
 * 1. Asistente de 3 pasos: vehiculo/conductor, cargas, valores.
 *    En Angular era `pasoActual`; aqui basta un useState<number>.
 *
 * 2. Lista de hasta 5 cargas (multiparada). Cada una con plantilla, citas,
 *    peso y orden de servicio. En Angular era un arreglo mutado en sitio; en
 *    React hay que reemplazarlo: setRemesas(remesas.map(...)), nunca
 *    remesas[i].peso = x, porque mutar no dispara el re-render.
 *
 * 3. Cadena de dependencias. Es la parte que de verdad ensena React:
 *      vehiculo o plantillas cambian -> se consultan las vias a SICETAC
 *      via cambia                    -> cambia el piso tarifario
 *      flete cambia                  -> se recalcula el FOPAT (0.1%)
 *    En Angular eran metodos alCambiarX(). Aqui van como useEffect con las
 *    dependencias correctas. Cuidado con el bucle: el efecto que escribe el
 *    flete no puede depender del flete.
 *
 * 4. Campos que solo aparecen segun el caso:
 *      - cantidad comercial: solo si la unidad de la plantilla no es KGM
 *      - viajes dia: solo si tipoManifiesto === 'D'
 *      - trayectos en vacio: detras de un checkbox
 *
 * 5. Banderas de "ya lo toco el usuario" (fleteEditado, fopatEditado,
 *    descargueEditado). Sin ellas, el autocalculo pisa lo que la persona
 *    escribio a mano. Es el detalle que mas molesta si se pierde.
 *
 * 6. Al enviar: api.despachar(...) y leer la respuesta. Si el backend responde
 *    422, el viaje viene dentro de ErrorApi.cuerpo con mensajeError y avisos.
 */
export default function Despacho() {
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
