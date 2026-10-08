/**
 * Muestra todos los datos del manifiesto y de cada remesa tal como van al
 * RNDC, para revisar un viaje con error antes de reintentar.
 */
import { moneda } from "../api/cliente";
import type { DatosRndc } from "../api/tipos";

/**
 * Nombre legible de cada etiqueta del XML. Las que no esten aqui se muestran
 * con la etiqueta tal cual: lo importante es que se vean TODAS.
 */
const NOMBRES: Record<string, string> = {
  // Manifiesto
  NUMMANIFIESTOCARGA: "Numero de manifiesto",
  CODOPERACIONTRANSPORTE: "Tipo de manifiesto / operacion",
  FECHAEXPEDICIONMANIFIESTO: "Fecha de expedicion",
  VIAJESDIA: "Viajes en el dia",
  CODMUNICIPIOORIGENMANIFIESTO: "Municipio origen",
  CODMUNICIPIODESTINOMANIFIESTO: "Municipio destino",
  CODMUNICIPIOINTERMEDIO: "Municipio intermedio",
  CODMUNICIPIOORIGENVACIO1: "Vacio 1 - origen",
  CODMUNICIPIODESTINOVACIO1: "Vacio 1 - destino",
  CODMUNICIPIOORIGENVACIO2: "Vacio 2 - origen",
  CODMUNICIPIODESTINOVACIO2: "Vacio 2 - destino",
  CODVIA: "Via",
  CODIDTITULARMANIFIESTO: "Titular - tipo de documento",
  NUMIDTITULARMANIFIESTO: "Titular - documento",
  NUMPLACA: "Placa",
  NUMPLACAREMOLQUE: "Placa del remolque",
  CODIDCONDUCTOR: "Conductor - tipo de documento",
  NUMIDCONDUCTOR: "Conductor - documento",
  CODIDCONDUCTOR2: "Segundo conductor - tipo de documento",
  NUMIDCONDUCTOR2: "Segundo conductor - documento",
  NITMONITOREOFLOTA: "Empresa de monitoreo (GPS)",
  VALORFLETEPACTADOVIAJE: "Valor a pagar (flete)",
  RETENCIONFUENTEMANIFIESTO: "Retencion en la fuente",
  RETENCIONICAMANIFIESTOCARGA: "Retencion ICA (por mil)",
  RETENCIONFOPAT: "Retencion FOPAT",
  VALORANTICIPOMANIFIESTO: "Anticipo",
  CODMUNICIPIOPAGOSALDO: "Municipio de pago del saldo",
  FECHAPAGOSALDOMANIFIESTO: "Fecha de pago del saldo",
  CODRESPONSABLEPAGOCARGUE: "Responsable del pago del cargue",
  CODRESPONSABLEPAGODESCARGUE: "Responsable del pago del descargue",
  ACEPTACIONELECTRONICA: "Aceptacion electronica",
  OBSERVACIONES: "Observaciones",
  // Remesa
  CONSECUTIVOREMESA: "Numero de remesa",
  CODNATURALEZACARGA: "Naturaleza de la carga",
  MERCANCIAREMESA: "Codigo de mercancia",
  SUBPARTIDA_CODE: "Subpartida",
  CODIGOARANCEL_CODE: "Codigo de arancel",
  DESCRIPCIONCORTAPRODUCTO: "Descripcion del producto",
  UNIDADMEDIDACAPACIDAD: "Unidad de transporte",
  CANTIDADCARGADA: "Cantidad cargada (kg)",
  UNIDADMEDIDAPRODUCTO: "Unidad comercial",
  CANTIDADPRODUCTO: "Cantidad comercial",
  CODTIPOEMPAQUE: "Tipo de empaque",
  EMPAQUEPRIMARIO: "Empaque primario",
  CODTIPOIDREMITENTE: "Remitente - tipo de documento",
  NUMIDREMITENTE: "Remitente - documento",
  CODSEDEREMITENTE: "Remitente - sede",
  CODTIPOIDDESTINATARIO: "Destinatario - tipo de documento",
  NUMIDDESTINATARIO: "Destinatario - documento",
  CODSEDEDESTINATARIO: "Destinatario - sede",
  CODTIPOIDPROPIETARIO: "Propietario de la carga - tipo de documento",
  NUMIDPROPIETARIO: "Propietario de la carga - documento",
  CODSEDEPROPIETARIO: "Propietario de la carga - sede",
  ORDENSERVICIOGENERADOR: "Orden de servicio del generador",
  HORASPACTOCARGA: "Horas pactadas de cargue",
  MINUTOSPACTOCARGA: "Minutos pactados de cargue",
  HORASPACTODESCARGUE: "Horas pactadas de descargue",
  MINUTOSPACTODESCARGUE: "Minutos pactados de descargue",
  FECHACITAPACTADACARGUE: "Cita de cargue - fecha",
  HORACITAPACTADACARGUE: "Cita de cargue - hora",
  FECHACITAPACTADADESCARGUE: "Cita de descargue - fecha",
  HORACITAPACTADADESCARGUEREMESA: "Cita de descargue - hora",
};

/** Etiquetas que son dinero: se muestran con separador de miles. */
const DINERO = new Set([
  "VALORFLETEPACTADOVIAJE",
  "RETENCIONFUENTEMANIFIESTO",
  "RETENCIONFOPAT",
  "VALORANTICIPOMANIFIESTO",
]);

/**
 * Tabla etiqueta / valor de los datos que se envian al RNDC, con el nombre
 * legible de cada etiqueta cuando se conoce (NOMBRES) y los montos con formato
 * de moneda.
 */
function TablaCampos({ datos }: { datos: Record<string, unknown> }) {
  return (
    <table className="tabla-datos-rndc">
      <tbody>
        {Object.entries(datos).map(([etiqueta, valor]) => (
          <tr key={etiqueta}>
            <th>
              {NOMBRES[etiqueta] ?? etiqueta}
              <span className="etiqueta-xml">{etiqueta}</span>
            </th>
            <td>{DINERO.has(etiqueta) ? moneda(Number(valor)) : String(valor)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Todos los datos del manifiesto y de cada remesa tal como van al RNDC.
 *
 * Cuando el RNDC rechaza, el error puede venir de cualquiera de ellos (la via,
 * el piso de SICETAC, el FOPAT, el titular...), asi que se muestran completos,
 * con el nombre legible y la etiqueta original, que es la que cita el error.
 */
export default function DatosRndcEnviados({ datos }: { datos: DatosRndc }) {
  const bajoPiso =
    datos.via?.pisoSicetac != null && datos.valorFlete != null && datos.valorFlete < datos.via.pisoSicetac;

  return (
    <details className="datos-rndc" open>
      <summary>
        Datos del ultimo intento enviado al RNDC (manifiesto y remesas). Si corriges algo,
        este panel se actualiza al volver a enviar.
      </summary>

      <div className="datos-rndc-cuerpo">
        <h4>Via y piso de SICETAC</h4>
        {datos.via ? (
          <div className={`alert ${bajoPiso ? "danger" : "info"}`}>
            Via {datos.via.codVia}: {datos.via.descripcion}.{" "}
            {datos.via.pisoSicetac != null ? (
              <>
                Piso SICETAC {moneda(datos.via.pisoSicetac)}; flete {moneda(datos.valorFlete)}.
                {bajoPiso && " El flete esta POR DEBAJO del piso: el RNDC lo rechaza. Sube el flete y ajusta el FOPAT (0,1%)."}
              </>
            ) : (
              "Sin piso de SICETAC registrado para esta via."
            )}
          </div>
        ) : (
          <p className="section-desc">
            Sin via elegida: el RNDC asigna la estandar de SICETAC para la ruta.
          </p>
        )}

        <h4>Manifiesto</h4>
        {datos.manifiesto ? (
          <TablaCampos datos={datos.manifiesto} />
        ) : (
          <div className="alert danger">No se pudo armar el manifiesto: {datos.errorManifiesto}</div>
        )}

        {datos.remesas.map((r) => (
          <div key={r.consecutivo ?? Math.random()}>
            <h4>
              Remesa {r.consecutivo}{" "}
              <span className={`badge ${r.estado === "CREADA" ? "badge-ok" : "badge-danger"}`}>
                {r.estado === "CREADA" ? `creada en el RNDC · ${r.radicado}` : r.estado}
              </span>
            </h4>
            {r.datos ? (
              <TablaCampos datos={r.datos} />
            ) : (
              <div className="alert danger">No se pudo armar la remesa: {r.error}</div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
