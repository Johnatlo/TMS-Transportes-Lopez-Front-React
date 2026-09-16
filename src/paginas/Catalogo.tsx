/**
 * PENDIENTE DE MIGRAR.
 *
 * Equivale a catalogo.component (326 + 174).
 *
 * Son cinco pestanas (vehiculos, remolques, conductores, terceros, empresa)
 * que comparten un modal de formulario generico. En React conviene partirlo:
 * un componente por pestana en vez de un objeto de configuracion con campos
 * dinamicos. Queda mas largo pero mucho mas facil de leer y de tipar.
 *
 * Detalles que no se pueden perder:
 *
 * - Terceros: al guardar, el backend puede devolver `avisoCoordenada`. Hay que
 *   mostrarlo. Es lo que avisa cuando una sede no tiene coordenadas o las
 *   tiene con pocos decimales, y de eso depende la verificacion de GPS del
 *   cargue en el RNDC.
 *
 * - Terceros: el campo codMunicipioRndc NO es opcional en la practica. De ahi
 *   salen el origen y el destino del manifiesto.
 *
 * - Vehiculos: ya no se pregunta por FOPAT. Se hereda de los parametros de
 *   empresa.
 *
 * - Pestana Empresa: es una sola fila, no una lista. Se edita en linea con
 *   api.getParametros() / api.guardarParametros(). La tarifa de retefuente se
 *   muestra como porcentaje y se guarda como fraccion (1% -> 0.01).
 */
export default function Catalogo() {
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
