/**
 * Tipos del dominio, espejo de los del backend.
 *
 * Son los mismos que tenia el servicio de Angular: no dependen del framework,
 * asi que pasan tal cual. Cuando cambie una interfaz en `backend/src/repo.ts`
 * hay que reflejarla aqui.
 *
 * Las fechas llegan como string porque viajan en JSON. Se convierten a Date
 * solo donde hagan falta, no al recibirlas.
 */

export interface Remolque {
  id: number;
  placa: string;
  numEjes: number | null;
  capacidadKg: number | null;
  fechaVencSoat: string | null;
  fechaVencTecnomecanica: string | null;
  activo: boolean;
}

export interface Vehiculo {
  id: number;
  placa: string;
  placaRemolque: string | null;
  marca: string | null;
  configuracion: string | null;
  capacidadKg: number | null;
  fechaVencSoat: string | null;
  fechaVencTecnomecanica: string | null;
  activo: boolean;
  codTipoIdTenedor: string;
  /** Titular del manifiesto: a quien se le paga el flete. */
  numIdTenedor: string | null;
  codTipoCarroceria: string;
  pesoVehiculoVacio: number | null;
  /** true si el PBV supera 10.5 t: el manifiesto debe llevar aporte FOPAT. */
  aplicaFopat: boolean;
  /** Proveedor de GPS por defecto del vehiculo (NIT de la EMF). */
  nitMonitoreoFlota: string | null;
  /** Propietario segun la tarjeta de propiedad. Informativo. */
  propietarioNit: string | null;
  /** Nombre del titular del manifiesto. Informativo: no viaja al RNDC. */
  nombreTenedor: string | null;
}

/** Empresa de monitoreo de flota registrada en el RNDC. */
export interface EmpresaMonitoreo {
  id: number;
  /** Lo que viaja en NITMONITOREOFLOTA. */
  nit: string;
  nombre: string;
}

export interface Conductor {
  id: number;
  cedula: string;
  nombre: string;
  licencia: string | null;
  categoriaLicencia: string | null;
  fechaVencLicencia: string | null;
  activo: boolean;
  codTipoId: string;
}

export interface Tercero {
  id: number;
  nit: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  rol: string | null;
  codTipoId: string;
  codSede: string;
  /** Coordenadas de la sede, copiadas del maestro de terceros del RNDC. */
  latitud: number | null;
  longitud: number | null;
  /**
   * Codigo DIVIPOLA del municipio de la sede. Precarga la ruta de la plantilla
   * y sirve para validar que la ruta calce con los sitios de cargue/descargue.
   */
  codMunicipioRndc: string | null;
}

/** Municipio del catalogo DIVIPOLA. */
export interface Municipio {
  /** 8 digitos: 5 del municipio + 3 del centro poblado (000 = cabecera). */
  codigo: string;
  nombre: string;
  departamento: string | null;
}

export interface PlantillaViaje {
  id: number;
  nombre: string;
  contratanteId: number;
  remitenteId: number;
  destinatarioId: number;
  /**
   * Ruta del viaje (DIVIPOLA, 8 digitos). Dato propio de la plantilla: se
   * precarga con el municipio del remitente y del destinatario, pero se puede
   * cambiar. Con este par se consultan las vias a SICETAC.
   */
  municipioOrigen: string | null;
  municipioDestino: string | null;
  tipoMercancia: string | null;
  /** Tarifa pactada para la ruta. Se precarga en el despacho. */
  valorFleteBase: number | null;
  fleteActualizadoEn: string | null;
  contratante: Tercero;
  remitente: Tercero;
  destinatario: Tercero;
  tipoOperacionRemesa: string;
  /** G=General, W=Vacio, I=Ida y regreso, M=Multiparada, U=Urbano, D=Varios viajes/dia */
  tipoManifiesto: string;
  codMunicipioIntermedio: string | null;
  codNaturalezaCarga: string;
  codUnidadMedida: string;
  codTipoEmpaque: string;
  codMercancia: string | null;
  subpartidaCode: string | null;
  codigoArancelCode: string | null;
  empaquePrimario: string | null;
  unidadMedidaProducto: string;
  horasPactoCargue: number;
  minutosPactoCargue: number;
  horasPactoDescargue: number;
  minutosPactoDescargue: number;
  /** Factor de ICA (por mil) del municipio de cargue. */
  factorIcaCargue: number;
  retencionIcaManifiesto: number;
  codResponsablePagoCargue: string;
  codResponsablePagoDescargue: string;
  aceptacionElectronica: string;
  codMunicipioPagoSaldo: string | null;
  tarifaRetencionFuente: number;
  titularEsRegimenSimple: boolean;
}

export interface Viaje {
  id: number;
  vehiculoId: number;
  conductorId: number;
  conductor2Id: number | null;
  remolqueId: number | null;
  fechaHoraCargue: string;
  fechaHoraDescargue: string | null;
  estado: string;
  numeroRemesaRndc: string | null;
  numeroManifiestoRndc: string | null;
  consecutivoRemesa: string | null;
  consecutivoManifiesto: string | null;
  mensajeError: string | null;
  /** Codigo de error del RNDC (ej. "REM112"), para soporte. */
  codigoError: string | null;
  errorCrudo: string | null;
  /** Avisos no bloqueantes (ej. manifiesto tardio). Separados por " | ". */
  avisos: string | null;
  fechaCreacion: string;
  valorFleteReal: number | null;
  valorAnticipoManifiesto: number;
  /** FOPAT efectivamente reportado en el manifiesto. */
  retencionFopat: number | null;
  fopatPagado: boolean;
  fechaPagoFopat: string | null;
  fechaPagoSaldo: string | null;
  codVia: string | null;
  nitMonitoreoFlota: string | null;
  viajesDia: number | null;
  vacio1Origen: string | null;
  vacio1Destino: string | null;
  vacio1Valor: number;
  vacio2Origen: string | null;
  vacio2Destino: string | null;
  vacio2Valor: number;
}

/** Una carga del viaje. Un manifiesto ampara hasta 5. */
export interface ViajeRemesa {
  id: number;
  viajeId: number;
  plantillaId: number;
  orden: number;
  consecutivoRemesa: string | null;
  numeroRemesaRndc: string | null;
  pesoReal: number | null;
  cantidadReal: number | null;
  fechaHoraCargue: string;
  fechaHoraDescargue: string;
  ordenServicioGenerador: string | null;
  valorFleteRemesa: number | null;
  estado: string;
  mensajeError: string | null;
}

export interface ParametrosEmpresa {
  tomadorPolizaCarga: string;
  numeroPolizaTransporte: string | null;
  companiaSeguro: string | null;
  fechaVencimientoPolizaCarga: string | null;
  /** Si toda la flota supera 10.5 t, el manifiesto siempre lleva FOPAT. */
  aplicaFopat: boolean;
  tarifaRetencionFuente: number;
  actualizadoEn: string | null;
  /** Del .env del backend, solo lectura. */
  nitEmpresa?: string;
  nombreEmpresa?: string;
  ambienteRndc?: string;
  /** Aviso si la poliza esta vencida o por vencerse. */
  avisoPoliza?: string | null;
}

export interface Via {
  codVia: string;
  descripcion: string;
  /** Piso tarifario: movilizacion mas las horas pactadas. */
  valorSicetac: number | null;
  esEstandar: boolean;
  kilometros?: number | null;
  valorMoviliza?: number | null;
  valorHora?: number | null;
}

export interface RespuestaViasSicetac {
  vias: Via[];
  /** Periodo de SICETAC que finalmente trajo datos. */
  periodoUsado?: string | null;
  periodosSinDatos?: string[];
  /** true si el servicio no respondio y se usaron valores guardados. */
  desdeCache?: boolean;
  error?: string;
}

export interface AlertaDocumento {
  tipo: "SOAT" | "TECNOMECANICA" | "LICENCIA" | "POLIZA";
  sujeto: string;
  identificacion: string | null;
  fechaVencimiento: string | null;
  /** Negativo si ya vencio. */
  diasRestantes: number | null;
  severidad: "VENCIDO" | "POR_VENCER" | "VIGENTE";
  mensaje: string;
}

export interface ResumenAlertas {
  vencidos: AlertaDocumento[];
  porVencer: AlertaDocumento[];
  sinFecha: AlertaDocumento[];
  diasAviso: number;
  revisados: { vehiculos: number; remolques: number; conductores: number };
}

export interface RutaConTarifa {
  codMunicipioOrigen: string;
  codMunicipioDestino: string;
  municipioOrigen: string;
  municipioDestino: string;
  plantillas: number;
  fleteMinimo: number | null;
  fleteMaximo: number | null;
  sinTarifa: number;
  ultimaActualizacion: string | null;
}

/** Una carga dentro de la peticion de despacho. */
export interface RemesaADespachar {
  plantillaId: number;
  fechaHoraCargue: string;
  fechaHoraDescargue: string;
  pesoReal?: number;
  cantidadReal?: number;
  ordenServicioGenerador?: string;
  valorFleteRemesa?: number;
}

export interface PeticionDespacho {
  vehiculoId: number;
  conductorId: number;
  remolqueId: number;
  conductor2Id?: number;
  /** Una entrada por cada cliente o parada del viaje. Maximo 5. */
  remesas: RemesaADespachar[];
  /** Plantilla que aporta los terminos del manifiesto (la de la primera carga). */
  plantillaId?: number;
  /**
   * Numero base del viaje: el manifiesto lo usa tal cual y las remesas
   * adicionales le agregan letra. Vacio = el backend sugiere el siguiente.
   */
  consecutivoBase?: string;
  valorFleteReal?: number;
  valorAnticipoManifiesto?: number;
  /** Si va vacio, el backend calcula el 0.1%. */
  retencionFopat?: number;
  /** Via elegida. Vacia = el RNDC asigna la estandar de SICETAC. */
  codVia?: string;
  /** Empresa de monitoreo del viaje. Vacia = la del vehiculo. */
  nitMonitoreoFlota?: string;
  fechaPagoSaldo?: string;
  viajesDia?: number;
  vacio1Origen?: string;
  vacio1Destino?: string;
  vacio1Valor?: number;
  vacio2Origen?: string;
  vacio2Destino?: string;
  vacio2Valor?: number;
}
