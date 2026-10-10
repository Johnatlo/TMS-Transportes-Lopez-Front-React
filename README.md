# TMS Transportes López — Frontend

Aplicación web del TMS de **Transportes López C S.A.S.**, hecha en **React +
TypeScript** con **Vite**. Es la pantalla con la que se despachan los viajes
ante el RNDC, se cumplen y anulan, se lleva el **Cuadro pagos** y se
administran los catálogos y los usuarios. Toda la lógica de negocio y la
comunicación con el RNDC están en el backend; el frontend llama a su API.

> **Documentación relacionada**
> - [`../backend/README.md`](../backend/README.md): API, flujos con el RNDC y modelo de datos.
> - [`GUIA-UI.md`](GUIA-UI.md): guía visual (colores, fuentes, tablas, botones).
> - [`PRUEBAS.md`](PRUEBAS.md): pruebas unitarias.
> - Cada función y componente tiene un comentario que explica qué hace y cómo;
>   la [sección 8](#8-referencia-de-funciones-y-componentes) los reúne todos.

## Contenido

1. [Pantallas](#1-pantallas)
2. [Tecnologías](#2-tecnologías)
3. [Cómo correrlo](#3-cómo-correrlo)
4. [Estructura del código](#4-estructura-del-código)
5. [Cómo está hecho](#5-cómo-está-hecho)
6. [Componentes compartidos](#6-componentes-compartidos)
7. [Compilar y desplegar](#7-compilar-y-desplegar)
8. [Referencia de funciones y componentes](#8-referencia-de-funciones-y-componentes)

---

## 1. Pantallas

| Menú | Archivo | Para qué sirve |
|---|---|---|
| **Inicio** | `paginas/Dashboard.tsx` | Indicadores, documentos más urgentes, viajes de hoy, últimos viajes, viajes por semana y mapa de seguimiento (posición estimada). |
| **Despachar** | `paginas/Despacho.tsx` | Asistente de tres pasos (vehículo y conductor, cargas, valores) que expide remesas y manifiesto en el RNDC. También corrige y reintenta un viaje fallido (`/despacho?viaje=N`). |
| **Viajes** | `paginas/Historial.tsx` | Todos los despachos con su estado y plazo del cumplido, y sus acciones: imprimir, cumplir, corregir y reintentar, anular. Vista "Consecutivos manifiestos y remesas" (una fila por remesa). Clic en una fila: todo lo registrado al despachar. |
| **Cuadro pagos** | `paginas/cuadro/CuadroCentral.tsx` | Seguimiento de cada viaje, con o sin manifiesto: papeles, radicación, factura, anticipos de bomba, pago al dueño, revisiones y notas. Reemplaza la hoja de Excel "CUADRO CENTRAL". |
| **Plantillas** | `paginas/Plantillas.tsx` | Plantillas de viaje (cliente, ruta, mercancía, tiempos y flete) y actualización de tarifas por ruta. |
| **Clientes**, **Flota**, **Conductores**, **Configuración** | `paginas/Catalogo.tsx` | Catálogos: terceros; vehículos (flota López/MYC o tercero), remolques y empresas de monitoreo; conductores; parámetros de la empresa. |
| **Usuarios** | `paginas/Usuarios.tsx` | Crear usuarios, activarlos o desactivarlos y restablecer su clave. |
| (sin sesión) | `paginas/Login.tsx` | Inicio de sesión y recuperación de contraseña por código al correo. |

**Ventanas principales:**

| Ventana | Archivo | Qué hace |
|---|---|---|
| Cumplir viaje | `componentes/CumplirViaje.tsx` | Cumple cada remesa (tiempos del GPS puestos y editables) y el manifiesto con el piso SICETAC del cumplido. Adopta lo cumplido en el portal. |
| Anular viaje | `componentes/AnularViaje.tsx` | Muestra qué se anulará y en qué orden, pide los motivos y muestra los radicados. |
| Corregir y reintentar | `componentes/ReintentarViaje.tsx` | Explica el error y deja corregir los datos del manifiesto antes de reenviar. |
| Documentos del viaje | `componentes/DocumentosViaje.tsx` | PDF oficial del manifiesto (con o sin logo) y remesas imprimibles. |
| Detalle del viaje | `componentes/DetalleViaje.tsx` | Todo lo registrado al despachar, de solo lectura. |
| Datos enviados al RNDC | `componentes/DatosRndc.tsx` | Los datos exactos del manifiesto y de cada remesa tal como van al RNDC. |
| Alertas de documentos | `componentes/AlertasDocumentos.tsx` | Documentos vencidos o por vencer, con la fecha editable en la misma fila. |
| Detalle del cuadro | `paginas/cuadro/DetalleCuadro.tsx` | Un viaje del cuadro pagos completo. |

---

## 2. Tecnologías

| Uso | Tecnología |
|---|---|
| Interfaz | React 18 con TypeScript |
| Compilación y servidor de desarrollo | Vite |
| Navegación | React Router 6 |
| Mapa | Leaflet |
| Pruebas | Vitest |
| Estilos | CSS propio (`estilos.css` + `tema.css`, ver `GUIA-UI.md`) |

---

## 3. Cómo correrlo

```bash
cd frontend-react
npm install
npm run dev        # http://localhost:4200
```

El backend debe estar corriendo en el puerto 3000. Vite reenvía `/api` hacia
allá (`vite.config.ts`), así que en desarrollo no hay CORS de por medio.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga al guardar |
| `npm run build` | Revisa los tipos (`tsc -b`) y compila a `dist/` |
| `npm run preview` | Sirve `dist/` en local para probar el build |
| `npm test` / `npm run test:watch` | Pruebas unitarias |
| `npm run docs` | Regenera la sección 8 de este README desde los comentarios del código |

---

## 4. Estructura del código

```
frontend-react/src/
├── main.tsx               Arranque: React, enrutador, sesión y estilos
├── App.tsx                Login / cambio de clave / marco y rutas (cada pantalla se carga al abrirla)
├── api/
│   ├── cliente.ts         Todas las llamadas a la API y los formatos (moneda, fechas)
│   ├── tipos.ts           Tipos de datos (espejo de los del backend)
│   └── mercancias.ts      Códigos de mercancía más usados
├── ganchos/
│   ├── useDatos.ts        Cargar datos con estados de carga, error y recarga
│   ├── useSesion.tsx      Sesión del usuario (contexto)
│   └── useMunicipios.ts   Municipios para buscar por nombre
├── componentes/           Piezas compartidas y ventanas (sección 6 y tabla de ventanas)
├── paginas/               Una pantalla por archivo (sección 1)
│   ├── cuadro/            Cuadro pagos: pantalla, detalle, ventanas y estados
│   └── estadosViaje.ts    Nombres y colores de los estados del viaje
├── estilos.css, tema.css  Estilos (tema.css redefine colores y fuentes)
└── **/*.test.ts           Pruebas unitarias
herramientas/
└── generar-referencia.cjs Regenera la sección 8 de este README
```

---

## 5. Cómo está hecho

Conceptos de React que se repiten en todo el código:

- **Cargar datos:** `useDatos(() => api.getAlgo(), [dependencias])` devuelve
  `{ datos, cargando, error, recargar }`. Las pantallas muestran
  `<Cargando />` o `<ErrorCarga />` mientras tanto.
- **Promesas, no observables:** cada llamada de `api` devuelve una Promise y se
  usa con `await`. Si el backend responde con error, se lanza `ErrorApi` con
  el mensaje y el cuerpo completo (por ejemplo, el viaje con el error del RNDC).
- **No se muta el estado:** para cambiar una lista se crea una nueva
  (`setRemesas(remesas.map(...))`); mutarla no redibuja la pantalla.
- **Cálculos en el cuerpo del componente:** un total se calcula con una
  constante antes del `return` y se recalcula en cada render.
- **Sesión:** la cookie la maneja el navegador. Si el backend responde que la
  sesión venció, `cliente.ts` dispara un evento y la aplicación vuelve al login.
- **Fechas:** todo se muestra en hora de Colombia, sin importar la zona del
  equipo. Las fechas sin hora (columnas DATE) se muestran tal cual, sin pasar
  por la zona horaria, para que no se corran un día.
- **Carga por pantalla:** cada página se descarga la primera vez que se abre
  (`React.lazy` en `App.tsx`); mientras tanto el menú sigue visible.

---

## 6. Componentes compartidos

| Componente | Archivo | Uso |
|---|---|---|
| `TablaDatos` | `componentes/TablaDatos.tsx` | Todo listado: pestañas con contador, buscador sin tildes, filtros por columna, orden, páginas de 50 y exportar a CSV. |
| `Pastilla` | `componentes/TablaDatos.tsx` | Estado con color (incluye los colores del cuadro pagos). |
| `Modal` | `componentes/Modal.tsx` | Ventana: se cierra con la X o Escape (no con clic fuera), se maximiza o cambia de tamaño. |
| `ComboBuscable` | `componentes/ComboBuscable.tsx` | Lista desplegable con buscador para muchos registros. |
| `FormularioGenerico` | `componentes/FormularioGenerico.tsx` | Formularios de catálogo a partir de una lista de campos. |
| `Cargando`, `ErrorCarga`, `Vacio`, `Avisos` | `componentes/Estado.tsx` | Mensajes de carga, error, lista vacía y avisos. |
| `Shell` | `componentes/Shell.tsx` | Marco con menú lateral y barra superior. |
| `PantallaAcceso` | `componentes/PantallaAcceso.tsx` | Marco de las pantallas sin sesión. |
| `MapaSeguimiento` | `componentes/MapaSeguimiento.tsx` | Mapa con la posición estimada de los vehículos en camino. |
| Iconos | `componentes/Iconos.tsx` | Íconos SVG del menú y la barra. |

---

## 7. Compilar y desplegar

```bash
npm run build                                          # genera dist/
scp -r dist root@<servidor>:/opt/frontend-react/dist-nuevo
```

En el servidor se respalda la versión actual, se vacía `dist` y se copia
**adentro** la nueva (no se renombran carpetas: Caddy está pegado a esa
carpeta exacta). Los pasos completos están en `../backend/DEPLOY.md`.

---

## 8. Referencia de funciones y componentes

Generada a partir de los comentarios del código con `npm run docs`. Cada
entrada indica la firma, el tipo (función, componente, método) y qué hace y
cómo.

<!-- REFERENCIA:INICIO -->
_256 funciones, componentes, métodos y rutas en 37 archivos._

- [`src/App.tsx`](#srcapptsx) (1)
- [`src/api/cliente.ts`](#srcapiclientets) (99)
- [`src/componentes/AlertasDocumentos.tsx`](#srccomponentesalertasdocumentostsx) (4)
- [`src/componentes/AnularViaje.tsx`](#srccomponentesanularviajetsx) (3)
- [`src/componentes/CambiarClave.tsx`](#srccomponentescambiarclavetsx) (1)
- [`src/componentes/ComboBuscable.tsx`](#srccomponentescombobuscabletsx) (1)
- [`src/componentes/CumplirViaje.tsx`](#srccomponentescumplirviajetsx) (9)
- [`src/componentes/DatosRndc.tsx`](#srccomponentesdatosrndctsx) (2)
- [`src/componentes/DetalleViaje.tsx`](#srccomponentesdetalleviajetsx) (4)
- [`src/componentes/DocumentosViaje.tsx`](#srccomponentesdocumentosviajetsx) (2)
- [`src/componentes/Estado.tsx`](#srccomponentesestadotsx) (4)
- [`src/componentes/EstadoSincronizacion.tsx`](#srccomponentesestadosincronizaciontsx) (3)
- [`src/componentes/FormularioGenerico.tsx`](#srccomponentesformulariogenericotsx) (2)
- [`src/componentes/Iconos.tsx`](#srccomponentesiconostsx) (22)
- [`src/componentes/LibroConsecutivos.tsx`](#srccomponenteslibroconsecutivostsx) (6)
- [`src/componentes/MapaSeguimiento.tsx`](#srccomponentesmapaseguimientotsx) (2)
- [`src/componentes/Modal.tsx`](#srccomponentesmodaltsx) (1)
- [`src/componentes/PantallaAcceso.tsx`](#srccomponentespantallaaccesotsx) (1)
- [`src/componentes/ReintentarViaje.tsx`](#srccomponentesreintentarviajetsx) (4)
- [`src/componentes/Shell.tsx`](#srccomponentesshelltsx) (3)
- [`src/componentes/TablaDatos.tsx`](#srccomponentestabladatostsx) (7)
- [`src/ganchos/useDatos.ts`](#srcganchosusedatosts) (1)
- [`src/ganchos/useMunicipios.ts`](#srcganchosusemunicipiosts) (1)
- [`src/ganchos/useSesion.tsx`](#srcganchosusesesiontsx) (2)
- [`src/paginas/Catalogo.tsx`](#srcpaginascatalogotsx) (19)
- [`src/paginas/Dashboard.tsx`](#srcpaginasdashboardtsx) (15)
- [`src/paginas/Despacho.tsx`](#srcpaginasdespachotsx) (6)
- [`src/paginas/FormularioPlantilla.tsx`](#srcpaginasformularioplantillatsx) (4)
- [`src/paginas/Historial.tsx`](#srcpaginashistorialtsx) (2)
- [`src/paginas/Login.tsx`](#srcpaginaslogintsx) (3)
- [`src/paginas/Plantillas.tsx`](#srcpaginasplantillastsx) (2)
- [`src/paginas/Usuarios.tsx`](#srcpaginasusuariostsx) (3)
- [`src/paginas/cuadro/CuadroCentral.tsx`](#srcpaginascuadrocuadrocentraltsx) (2)
- [`src/paginas/cuadro/DetalleCuadro.tsx`](#srcpaginascuadrodetallecuadrotsx) (5)
- [`src/paginas/cuadro/VentanasCuadro.tsx`](#srcpaginascuadroventanascuadrotsx) (3)
- [`src/paginas/cuadro/estadosCuadro.ts`](#srcpaginascuadroestadoscuadrots) (6)
- [`src/paginas/estadosViaje.ts`](#srcpaginasestadosviajets) (1)

### `src/App.tsx`

> Raiz de la aplicacion: sin sesion muestra el login; con clave temporal, el
> cambio obligatorio de clave; con sesion, el marco (Shell) y las rutas de
> cada pantalla, que se descargan al abrirlas por primera vez (React.lazy).

- **`App()`** · _componente React_
  Clientes, Flota, Conductores y Configuracion son el mismo Catalogo con
  distintas pestanas. La `key` distinta hace que React monte uno nuevo al
  pasar de una seccion a otra: si no, reutilizaria el anterior y se quedaria
  con su pestana y su busqueda.

### `src/api/cliente.ts`

> Cliente de la API del backend.
>
> Reemplaza al ApiService de Angular. La diferencia de fondo: aqui cada
> funcion devuelve una Promise en vez de un Observable, asi que se consume con
> `await` y no con `.subscribe()`.
>
> Las URL son relativas (`/api/...`) y no absolutas a localhost:3000: el proxy
> de Vite las redirige al backend en desarrollo, y en produccion se sirven
> desde el mismo origen. Asi no hay que tocar CORS ni cambiar la URL al
> desplegar.

- **`ErrorApi`** · _clase_
  Error con el cuerpo que devolvio el backend.

  Importa conservarlo: cuando el RNDC rechaza un despacho, el backend responde
  422 con el viaje completo adentro (mensajeError, codigoError, avisos). Si se
  pierde ese cuerpo, la pantalla no puede explicar que paso.

  - **`ErrorApi.constructor(mensaje, estado, cuerpo)`** · _método_
    mensaje: texto para mostrar; estado: codigo HTTP (0 = sin conexion);
    cuerpo: la respuesta completa del backend (por ejemplo el viaje con su error).

- **`pedir(ruta, opciones)`** · _función_
  Hace una peticion a la API (/api + ruta) y devuelve el JSON de respuesta.

  Como funciona:
  1. fetch con Content-Type JSON; la cookie de sesion la manda el navegador.
  2. Sin conexion: ErrorApi con estado 0 y un mensaje claro.
  3. Respuesta vacia (204): devuelve null.
  4. Error HTTP: si es 401 por sesion vencida avisa a toda la aplicacion
     (EVENTO_SESION_VENCIDA, vuelve el login) y lanza ErrorApi con el mensaje
     del backend y el cuerpo completo.

- **`get(ruta)`** · _función_
  GET a la API.

- **`post(ruta, datos)`** · _función_
  POST a la API con el cuerpo en JSON.

- **`put(ruta, datos)`** · _función_
  PUT a la API con el cuerpo en JSON.

- **`del(ruta)`** · _función_
  DELETE a la API.

- **`auth`** · _módulo_
  Sesion y usuarios. La cookie de sesion la maneja el navegador solo.

  - **`auth.sesion()`** · _método_
    Usuario de la sesion actual (401 si no hay sesion).

  - **`auth.login(email, clave)`** · _método_
    Inicia sesion con correo y clave; el backend pone la cookie.

  - **`auth.logout()`** · _método_
    Cierra la sesion y borra la cookie.

  - **`auth.cambiarClave(actual, nueva)`** · _método_
    Cambia la clave propia (pide la actual).

  - **`auth.listarUsuarios()`** · _método_
    Usuarios del sistema.

  - **`auth.crearUsuario(email, nombre)`** · _método_
    La clave temporal se envia por correo. Solo si el correo no esta
    configurado o falla, llega en la respuesta (una sola vez).

  - **`auth.actualizarUsuario(id, datos)`** · _método_
    Cambia nombre y/o estado activo de un usuario.

  - **`auth.restablecerClave(id)`** · _método_
    Genera una clave temporal nueva para un usuario (por correo, o en la respuesta).

  - **`auth.recuperar(email)`** · _método_
    "Olvide mi contrasena": envia un codigo de 6 digitos al correo.

  - **`auth.confirmarRecuperacion(email, codigo, nueva)`** · _método_
    Crea la clave nueva con el codigo de 6 digitos que llego al correo.

- **`api`** · _módulo_
  Llamadas de catalogo, despacho, cumplidos e impresion. Cada una corresponde
  a una ruta del backend (/api/catalogo/... y /api/despacho/...).

  - **`api.getVehiculos()`** · _método_
    Vehiculos del catalogo (activos e inactivos; sin los eliminados).

  - **`api.crearVehiculo(datos)`** · _método_
    Crea un vehiculo (o recupera uno eliminado con la misma placa).

  - **`api.actualizarVehiculo(id, datos)`** · _método_
    Lo que no se mande conserva su valor actual.

  - **`api.eliminarVehiculo(id)`** · _método_
    Borrado logico: el vehiculo sale de todas las listas pero se conserva
    para los viajes que ya lo usaron. Crear otra vez la misma placa lo recupera.

  - **`api.getEmpresasMonitoreo()`** · _método_
    Empresas de monitoreo de flota (GPS) activas.

  - **`api.crearEmpresaMonitoreo(datos)`** · _método_
    Registra una empresa de monitoreo de flota (GPS).

  - **`api.actualizarEmpresaMonitoreo(id, datos)`** · _método_
    Cambia NIT y/o nombre de una empresa de monitoreo.

  - **`api.eliminarEmpresaMonitoreo(id)`** · _método_
    Desactiva una empresa de monitoreo.

  - **`api.fijarMonitoreoVehiculo(vehiculoId, nitMonitoreoFlota)`** · _método_
    Proveedor de GPS por defecto de un vehiculo.

  - **`api.getConductores()`** · _método_
    Conductores del catalogo.

  - **`api.crearConductor(datos)`** · _método_
    Crea un conductor.

  - **`api.actualizarConductor(id, datos)`** · _método_
    Edita un conductor; lo que no se mande no cambia.

  - **`api.getRemolques()`** · _método_
    Remolques del catalogo.

  - **`api.crearRemolque(datos)`** · _método_
    Crea un remolque.

  - **`api.actualizarRemolque(id, datos)`** · _método_
    Edita un remolque; lo que no se mande no cambia.

  - **`api.getTerceros()`** · _método_
    Clientes, remitentes y destinatarios.

  - **`api.crearTercero(datos)`** · _método_
    Crea un tercero. avisoCoordenada trae el problema de su coordenada, si hay.

  - **`api.actualizarTercero(id, datos)`** · _método_
    Edita un tercero. avisoCoordenada trae el problema de su coordenada, si hay.

  - **`api.getPlantillas()`** · _método_
    Plantillas de viaje activas, con sus terceros.

  - **`api.crearPlantilla(datos)`** · _método_
    Crea una plantilla de viaje.

  - **`api.actualizarPlantilla(id, datos)`** · _método_
    Lo que no se mande conserva su valor actual.

  - **`api.eliminarPlantilla(id)`** · _método_
    "Elimina" (desactiva) una plantilla que ya no se usa.

  - **`api.getMunicipios()`** · _método_
    Catalogo DIVIPOLA. Vacio si aun no se importo el CSV de municipios.

  - **`api.getVias(origen, destino)`** · _método_
    Ultimo resultado guardado, sin consultar al Ministerio.

  - **`api.getViasSicetac(origen, destino, configuracion, horas)`** · _método_
    Vias consultadas en linea a SICETAC, con el piso de cada una.
    `horas` son las horas pactadas de cargue y descargue: entran en el piso.

  - **`api.getRutasConTarifas()`** · _método_
    Rutas de las plantillas activas con cuantas plantillas tiene cada una y su
    rango de tarifas: punto de partida para actualizar tarifas por ruta.

  - **`api.previsualizarTarifa(origen, destino)`** · _método_
    Plantillas que cambiarian al actualizar el flete base de una ruta, con su valor actual.

  - **`api.actualizarTarifaRuta(origen, destino, valorFleteBase)`** · _método_
    Fija el flete base de todas las plantillas de una ruta. Devuelve cuantas cambiaron.

  - **`api.getAlertas(dias, inactivos)`** · _método_
    `inactivos` agrega los documentos de vehiculos, remolques y conductores inactivos.

  - **`api.getParametros()`** · _método_
    Parametros de la empresa (poliza, retencion...) y aviso de vigencia de la poliza.

  - **`api.guardarParametros(datos)`** · _método_
    Guarda los parametros enviados; los demas no cambian.

  - **`api.despachar(datos)`** · _método_
    Despacha un viaje: el backend valida, expide las remesas y el manifiesto en
    el RNDC y devuelve el viaje (con su error si el RNDC lo rechazo).

  - **`api.getHistorial()`** · _método_
    Todos los viajes, con el plazo del cumplido de los que ya descargaron.

  - **`api.getConsecutivos()`** · _método_
    Libro de consecutivos: una fila por remesa, como la hoja de control.

  - **`api.getSincronizacion()`** · _método_
    Estado de la sincronizacion automatica con el RNDC (cada 10 minutos).

  - **`api.sincronizarRndc(completa)`** · _método_
    Sincroniza ya: los ultimos dias, o todo desde septiembre con completa=true.

  - **`api.getDetalleViaje(viajeId)`** · _método_
    Todo lo que se registro al despachar un viaje.

  - **`api.getSugerencias(vehiculoId)`** · _método_
    Remolque y conductor que suele usar el vehiculo (historial o catalogo).

  - **`api.getSiguienteConsecutivo()`** · _método_
    Siguiente numero de manifiesto disponible. Es una sugerencia, no una reserva.

  - **`api.reintentarViaje(viajeId, cambios)`** · _método_
    Retoma un viaje a medias: reutiliza las remesas ya creadas en el RNDC y
    envia lo que falte. `cambios` corrige datos del manifiesto (vehiculo,
    conductor, remolque, EMF, valores, numero). Si el RNDC vuelve a rechazar,
    lanza ErrorApi con el viaje actualizado en `cuerpo`.

  - **`api.getPreviaAnulacion(viajeId)`** · _método_
    Que se anularia y en que orden, con los motivos validos y el tope mensual.

  - **`api.anularViaje(viajeId, datos)`** · _método_
    Anula en el RNDC: cumplido inicial (54), manifiesto (32) y remesas (9).
    Si un paso falla, lanza ErrorApi con el viaje actualizado en `cuerpo`.

  - **`api.getRemesasDeViaje(viajeId)`** · _método_
    Remesas de un viaje, en orden.

  - **`api.getViaje(viajeId)`** · _método_
    Un viaje con sus remesas.

  - **`api.getDatosRndc(viajeId)`** · _método_
    Todo lo que el viaje envia al RNDC, sin enviar nada.

  - **`api.usarRemesaExistente(remesaId)`** · _método_
    El RNDC dijo "DUPLICADO": la remesa (o el manifiesto) ya existia de un
    intento anterior. Se toma ese radicado, despues de que la persona confirma
    que es el mismo documento.

  - **`api.usarManifiestoExistente(viajeId)`** · _método_
    Toma el radicado de un manifiesto que el RNDC reporto como ya existente.

  - **`api.cumplirRemesa(remesaId, datos)`** · _método_
    Cumplido normal de una remesa (proceso 5). Fechas en ISO.

  - **`api.getGpsRemesa(remesaId)`** · _método_
    Tiempos que ya reporto el GPS (cumplido inicial, proceso 45). En el
    formulario vienen puestos y se pueden corregir.

  - **`api.getCumplidoRemesa(remesaId)`** · _método_
    Lo que quedo registrado en el cumplido de una remesa (leido del RNDC).

  - **`api.anularCumplidoRemesa(remesaId, motivo, observaciones)`** · _método_
    Anula el cumplido de una remesa (proceso 28) para corregirlo.

  - **`api.getPreviaCumplidoManifiesto(viajeId)`** · _método_
    Valores de partida para la ventana de cumplido del manifiesto.

  - **`api.sincronizarCumplido(viajeId)`** · _método_
    Adopta los cumplidos hechos en el portal del RNDC (solo lectura alla).

  - **`api.cumplirManifiesto(viajeId, datos)`** · _método_
    Cumple el manifiesto (proceso 6) con la fecha de entrega, adicionales,
    descuentos y retenciones. Antes adopta lo cumplido en el portal; el RNDC
    exige todas las remesas cumplidas y lo dice con su error si falta alguna.

  - **`api.getResumenFopat()`** · _método_
    FOPAT causado y pendiente de pago, por mes.

  - **`api.urlPdfManifiesto(viajeId, original)`** · _método_
    PDF oficial del RNDC; por defecto con el logo de la empresa estampado.

  - **`api.urlImprimirRemesa(remesaId)`** · _método_
    Remesa imprimible (HTML con el formato oficial), para abrir en otra pestana.

- **`aInputLocal(fecha)`** · _función_
  Formato que entiende <input type="datetime-local">: YYYY-MM-DDTHH:mm.
  Se arma con los componentes locales y no con toISOString(), que convierte a
  UTC y en Colombia adelantaria el reloj cinco horas.

- **`moneda(valor)`** · _función_
  Valor en pesos con punto de miles (4.019.761); "-" sin valor.

- **`fechaHora(valor)`** · _función_
  Fecha para mostrar, en hora de Colombia.

  Se fija la zona a proposito: el backend guarda y entrega en UTC, y dejar que
  el navegador use la suya haria que un cargue de madrugada se viera con otra
  fecha segun donde este el equipo.

- **`soloDia(valor)`** · _función_
  Para columnas DATE (vencimientos de SOAT, tecnomecanica, licencia...).

  El backend las entrega como medianoche UTC ("2029-04-06T00:00:00.000Z").
  soloFecha() las pasa a hora de Bogota y quedaban UN DIA ANTES (05/04/2029).
  Aqui se lee el dia tal cual, sin zona horaria.

- **`hoyColombia()`** · _función_
  Hoy en Colombia como "AAAA-MM-DD", para comparar contra columnas DATE.

- **`soloFecha(valor)`** · _función_
  Solo la fecha (DD/MM/AAAA) de un instante, en hora de Colombia; "-" sin valor.

- **`separarAvisos(avisos)`** · _función_
  Los avisos del backend vienen en un solo campo separados por " | ".

- **`apiCuadro`** · _módulo_
  Llamadas del cuadro pagos (/api/cuadro). Las que cambian algo devuelven el
  viaje actualizado con sus anticipos y notas.

  - **`apiCuadro.listar()`** · _método_
    Todos los viajes del cuadro.

  - **`apiCuadro.obtener(id)`** · _método_
    Un viaje con anticipos y notas.

  - **`apiCuadro.crear(datos)`** · _método_
    Crea un viaje sin manifiesto.

  - **`apiCuadro.actualizar(id, datos)`** · _método_
    Guarda los campos enviados de un viaje.

  - **`apiCuadro.borrar(id)`** · _método_
    Borra un viaje creado a mano.

  - **`apiCuadro.revisar(id, quien, revisado)`** · _método_
    Marca o quita la revision de contabilidad o de gerencia.

  - **`apiCuadro.facturar(ids, facturaNumero, facturaFecha)`** · _método_
    Asigna una factura (numero y fecha) a varios viajes.

  - **`apiCuadro.agregarNota(id, texto)`** · _método_
    Agrega una nota al viaje.

  - **`apiCuadro.borrarNota(id, notaId)`** · _método_
    Borra una nota.

  - **`apiCuadro.agregarAnticipo(id, datos)`** · _método_
    Registra un anticipo de bomba.

  - **`apiCuadro.actualizarAnticipo(id, anticipoId, datos)`** · _método_
    Cambia la fecha de pago a la bomba o la nota de un anticipo.

  - **`apiCuadro.borrarAnticipo(id, anticipoId)`** · _método_
    Quita un anticipo.

  - **`apiCuadro.bombas()`** · _método_
    Catalogo de bombas aliadas.

  - **`apiCuadro.crearBomba(datos)`** · _método_
    Crea una bomba.

  - **`apiCuadro.actualizarBomba(id, datos)`** · _método_
    Cambia nombre, ciudad o si esta activa; devuelve la lista.

### `src/componentes/AlertasDocumentos.tsx`

> Ventana de documentos vencidos o por vencer (SOAT, tecnomecanica, licencia,
> poliza), con la fecha editable en la misma fila para ponerla al dia.

- **`llave(a)`** · _función_
  Llave estable de una alerta: el registro y el campo del que sale. Con el
  indice de la lista como llave, al refrescar (el documento corregido sale de
  la lista) React le pasaria el estado de edicion a la fila de abajo.

- **`actualizarOrigen(origen, cambio)`** · _función_
  Aplica un cambio al registro del que sale la alerta: la nueva fecha de
  vencimiento, o `activo: true` para reactivarlo.

- **`AlertasDocumentos({...})`** · _componente React_
  Documentos vencidos o por vencer, en una ventana aparte para no ocupar la
  pantalla de inicio. Se abre desde el boton "Documentos" de la barra
  superior o desde el indicador del Inicio.

  Cada fila se puede actualizar ahi mismo: se escribe la nueva fecha de
  vencimiento y se guarda en el vehiculo, remolque, conductor o empresa.

- **`FilaAlerta({...})`** · _componente React_
  Una alerta. Tiene su propio estado de edicion: cada fila se edita por
  separado sin afectar a las demas.

### `src/componentes/AnularViaje.tsx`

> Ventana para anular un viaje en el RNDC: muestra que se anulara y en que
> orden, pide los motivos y muestra los radicados de anulacion.

- **`esAnulable(v)`** · _función_
  true si el viaje se puede anular desde Viajes (estados de ESTADOS_ANULABLES).

- **`AnularViaje({...})`** · _componente React_
  Ventana para anular un viaje en el RNDC.

  Primero muestra que se va a anular y en que orden (lo calcula el backend),
  los motivos que acepta el RNDC y como va el tope mensual. Anular no se puede
  deshacer y el numero del viaje no se puede volver a usar, por eso se pide
  una confirmacion explicita.

- **`ResultadoAnulado({...})`** · _componente React_
  Mensaje final de una anulacion correcta, con los radicados de anulacion del
  manifiesto y de cada remesa.

### `src/componentes/CambiarClave.tsx`

> Formulario para cambiar la propia contrasena (obligatorio con clave
> temporal, o voluntario desde el menu del avatar).

- **`CambiarClave({...})`** · _componente React_
  Formulario para cambiar la propia contrasena. Se usa en dos lugares:
  - Obligatorio, a pantalla completa, cuando se entra con una clave temporal.
  - Voluntario, desde el menu del avatar.

### `src/componentes/ComboBuscable.tsx`

> Lista desplegable con buscador, para elegir entre muchos registros
> (vehiculos, conductores, terceros, plantillas, municipios).

- **`ComboBuscable({...})`** · _componente React_
  Select con busqueda: en vez de desplegar la lista completa (placas, nombres
  de clientes, cedulas...), se escribe encima y se filtra.

  Reemplaza los <select> que se llenan con datos de la base (vehiculos,
  conductores, remolques, terceros, plantillas). Los <select> de opciones fijas
  (tipo de identificacion, tipo de manifiesto) no necesitan esto: son pocas
  opciones y no hace falta buscar entre ellas.

  El id suele ser numerico (el id de la base), pero puede ser texto: los
  codigos DIVIPOLA empiezan por cero (05001000) y como numero lo perderian.
  `K` es ese tipo; TypeScript lo deduce de `obtenerId`, asi que los usos
  existentes con ids numericos no cambian.

### `src/componentes/CumplirViaje.tsx`

> Ventana para cumplir un viaje en el RNDC: cada remesa (proceso 5) con sus
> tiempos (los del GPS vienen puestos) y luego el manifiesto (proceso 6) con
> valores, retenciones y el piso SICETAC del cumplido. Al abrir trae del RNDC
> lo que ya se cumplio en el portal.

- **`esCumplible(v)`** · _función_
  Solo se cumplen viajes con manifiesto vigente (ver despacho.ts).

- **`formularioInicial(r)`** · _función_
  Valores iniciales de una remesa: lo cargado y las citas que se pusieron al
  despachar. Llegada y entrada a la hora de la cita, salida una hora despues.
  Nada puede ser futuro: si la cita del descargue aun no llega, se propone la
  hora actual. Todo se puede corregir antes de enviar.

- **`CumplirViaje({...})`** · _componente React_
  Ventana para cumplir un viaje en el RNDC: primero cada remesa (proceso 5) y,
  cuando todas estan cumplidas, el manifiesto (proceso 6). Es el orden que
  exige el RNDC [Guia Cumplido de Remesa y Manifiesto, pag. 3].

  Cada remesa tiene su propio formulario y su propio estado de envio: se
  guardan en un objeto indexado por el id de la remesa, asi cumplir una no
  reinicia lo que se escribio en otra.

- **`FormularioCumplido({...})`** · _componente React_
  Formulario del cumplido de UNA remesa: kilos entregados y los seis tiempos
  logisticos.

  Los tiempos que reporto el GPS vienen puestos con la pastilla "GPS"; si se
  cambian, se marcan "Editado" con el valor original y un boton para volver
  al del GPS. Ninguna hora puede ser futura. El boton se habilita con kilos y
  las seis horas llenas.

- **`PisoSicetac({...})`** · _componente React_
  Piso SICETAC contra el valor a pagar del cumplido. El RNDC rechaza un valor
  a pagar menor [Guia Cumplido 3.4 y 3.9.1], salvo flota propia (valor 0).

- **`AvisoPlazo({...})`** · _componente React_
  Aviso del plazo de 5 dias habiles, con el tono segun lo que falte.

- **`duracion(min)`** · _función_
  63 -> "1 h 3 min".

- **`TablaTiempos({...})`** · _componente React_
  Tiempos logisticos del manifiesto: pactados contra los que registro el GPS
  (o los del cumplido de cada remesa), y el valor que eso suma o resta con el
  valor hora de SICETAC. Es la misma comparacion que muestra el portal al
  cumplir; el valor es una sugerencia que se aplica con un clic.

- **`DetalleCumplido({...})`** · _componente React_
  Lo que quedo registrado en el cumplido de una remesa, leido del RNDC, para
  revisar que esta bien. Si algo esta mal, se anula el cumplido (proceso 28)
  y la remesa vuelve al formulario con esos mismos datos para corregirlos.

### `src/componentes/DatosRndc.tsx`

> Muestra todos los datos del manifiesto y de cada remesa tal como van al
> RNDC, para revisar un viaje con error antes de reintentar.

- **`TablaCampos({...})`** · _componente React_
  Tabla etiqueta / valor de los datos que se envian al RNDC, con el nombre
  legible de cada etiqueta cuando se conoce (NOMBRES) y los montos con formato
  de moneda.

- **`DatosRndcEnviados({...})`** · _componente React_
  Todos los datos del manifiesto y de cada remesa tal como van al RNDC.

  Cuando el RNDC rechaza, el error puede venir de cualquiera de ellos (la via,
  el piso de SICETAC, el FOPAT, el titular...), asi que se muestran completos,
  con el nombre legible y la etiqueta original, que es la que cita el error.

### `src/componentes/DetalleViaje.tsx`

> Ventana de solo lectura con todo lo registrado al despachar un viaje.

- **`Datos({...})`** · _componente React_
  Pares etiqueta / valor en dos columnas. Lo vacio se muestra como "-".

- **`Seccion({...})`** · _componente React_
  Bloque con titulo dentro del detalle del viaje.

- **`tercero(t)`** · _función_
  Nombre de un tercero y debajo su identificacion, sede y ciudad.

- **`DetalleViaje({...})`** · _componente React_
  Todo lo que se registro al despachar un viaje, de solo lectura: documentos
  y radicados, vehiculo y conductores, valores, cada remesa con sus partes y
  su mercancia, y quien expidio, cumplio o anulo.

### `src/componentes/DocumentosViaje.tsx`

> Documentos de un viaje expedido: PDF oficial del manifiesto (con o sin logo)
> y remesas imprimibles.

- **`DocumentosViaje({...})`** · _componente React_
  Documentos que el conductor debe llevar en el viaje: el manifiesto
  electronico de carga (PDF oficial del RNDC, con el logo de la empresa) y la
  remesa de cada carga.

  El manifiesto es el documento que exige la autoridad en via: el policia
  escanea su QR para verificar que es el original del RNDC. El logo se
  estampa lejos del QR, que queda intacto.

- **`VentanaDocumentosViaje({...})`** · _componente React_
  Los mismos documentos en una ventana, para abrirlos desde una lista.

### `src/componentes/Estado.tsx`

> Bloques que se repiten en toda pantalla que consulta la API: el mensaje de
> "cargando", el de error y el de lista vacia.

- **`Cargando({...})`** · _componente React_
  Mensaje "Cargando ..." mientras llegan los datos.

- **`ErrorCarga({...})`** · _componente React_
  Mensaje de error al cargar datos, con boton "Reintentar" si se da alReintentar.

- **`Vacio({...})`** · _componente React_
  Mensaje para una lista sin resultados.

- **`Avisos({...})`** · _componente React_
  Los avisos del backend no son errores: la operacion salio bien pero hay algo
  que el despachador debe saber (manifiesto tardio, coordenada sin precision).

### `src/componentes/EstadoSincronizacion.tsx`

> Barra con el estado de la sincronizacion automatica con el RNDC: cuando
> corrio por ultima vez, que trajo (manifiestos del portal, cumplidos,
> anulaciones) y un boton para sincronizar ya sin esperar la siguiente vuelta.

- **`hace(iso)`** · _función_
  "hace 3 min", "hace 2 h"... desde una fecha ISO.

- **`textoResumen(r)`** · _función_
  Frase con lo que cambio en la ultima sincronizacion, o null si no cambio nada.

- **`EstadoSincronizacion({...})`** · _componente React_
  Estado de la sincronizacion. `alSincronizar` se llama despues de una
  sincronizacion manual, para recargar la lista de la pantalla.

### `src/componentes/FormularioGenerico.tsx`

> Formulario construido a partir de una descripcion de campos.
>
> Equivale a form-modal.component de Angular. Se conserva el enfoque para las
> pantallas de catalogo, donde los formularios son listas planas de campos sin
> dependencias entre si. Para el despacho NO se usa: alli los campos dependen
> unos de otros y conviene escribirlos a mano.

- **`FormularioGenerico({...})`** · _componente React_
  Pinta un formulario por secciones (titulo y descripcion a la izquierda,
  campos a la derecha) a partir de la lista de campos. Cada cambio entrega un
  modelo NUEVO a alCambiar (nunca se muta el actual, para que React redibuje).

- **`Campo({...})`** · _componente React_
  Un campo segun su tipo: casilla, lista desplegable o caja de texto, numero o
  fecha, con su ayuda debajo si la tiene.

### `src/componentes/Iconos.tsx`

> Iconos de trazo simple (24x24, stroke = currentColor), para el menu y la
> barra superior. Toman el color del texto que los rodea.

- **`Icono({...})`** · _componente React_
  Lienzo SVG comun de los iconos (24x24, trazo del color del texto, 18 px por defecto).

- **`IconoInicio()`** · _componente React_
  Icono del menu Inicio.

- **`IconoCamion()`** · _componente React_
  Icono del menu Despachar.

- **`IconoViajes()`** · _componente React_
  Icono del menu Viajes.

- **`IconoPlantillas()`** · _componente React_
  Icono del menu Plantillas.

- **`IconoClientes()`** · _componente React_
  Icono del menu Clientes.

- **`IconoFlota()`** · _componente React_
  Icono del menu Flota.

- **`IconoConductores()`** · _componente React_
  Icono del menu Conductores.

- **`IconoConfiguracion()`** · _componente React_
  Icono del menu Configuracion.

- **`IconoMas()`** · _componente React_
  Icono para crear.

- **`IconoCampana()`** · _componente React_
  Icono de alertas.

- **`IconoFlecha()`** · _componente React_
  Icono de flecha a la derecha.

- **`IconoContraer()`** · _componente React_
  Icono para contraer el menu lateral.

- **`IconoMenu()`** · _componente React_
  Icono del menu en el celular.

- **`IconoCalendario()`** · _componente React_
  Icono de calendario.

- **`IconoCheck()`** · _componente React_
  Icono de confirmacion.

- **`IconoGrafica()`** · _componente React_
  Icono de grafica.

- **`IconoMapa()`** · _componente React_
  Icono de mapa.

- **`IconoDocumento()`** · _componente React_
  Icono de documento (Cuadro pagos).

- **`IconoUsuarios()`** · _componente React_
  Icono del menu Usuarios.

- **`IconoOjo()`** · _componente React_
  Icono para mostrar la contrasena.

- **`IconoOjoTachado()`** · _componente React_
  Icono para ocultar la contrasena.

### `src/componentes/LibroConsecutivos.tsx`

> Libro de consecutivos de manifiestos y remesas: una fila por remesa, con
> las columnas de la hoja de control de la empresa.

- **`estadoFila(f)`** · _función_
  Estado de la fila: el del viaje, salvo que la remesa ya este cumplida.

- **`tonoFila(f)`** · _función_
  Color de la pastilla de estado: gris si anulado, verde si cumplido, y si no
  el tono del estado del viaje.

- **`dia(fecha)`** · _función_
  Dia en hora de Colombia (el servidor guarda en UTC: de noche ya es el dia siguiente).

- **`mesDe(fecha)`** · _función_
  "julio de 2026", para filtrar por mes como las hojas mensuales del Excel.

- **`persona(tipo, nit, nombre)`** · _función_
  Nombre de remitente o destinatario y debajo su NIT o CC.

- **`LibroConsecutivos({...})`** · _componente React_
  Libro de consecutivos de manifiestos y remesas: una fila por remesa, con
  las columnas de la hoja de control que llevaba la empresa. El viaje de
  varias remesas ocupa varias filas (00006193, 00006193B...); el valor del
  manifiesto y el FOPAT van solo en la primera. Clic en una fila abre todo lo
  que se registro al despachar.

### `src/componentes/MapaSeguimiento.tsx`

> Mapa (Leaflet) con la posicion ESTIMADA de los vehiculos en camino: en
> linea recta entre cargue y descargue segun el tiempo entre las citas.

- **`coordenadaValida(lat, lon)`** · _función_
  Colombia continental, aproximado: descarta coordenadas de relleno (999...).

- **`MapaSeguimiento({...})`** · _componente React_
  Mapa con los vehiculos en camino.

  El sistema no recibe GPS: la posicion es ESTIMADA, en linea recta entre el
  sitio de cargue y el de descargue, segun el tiempo transcurrido entre las
  dos citas. Sirve para ver de un vistazo que viaje va por donde; la posicion
  real la tiene la empresa de monitoreo.

  Leaflet maneja el mapa por su cuenta (no es un componente de React): se crea
  una sola vez en un useEffect y en otro se redibujan los puntos cuando
  cambian. El cleanup destruye el mapa al salir de la pantalla.

### `src/componentes/Modal.tsx`

> Ventana modal comun: se cierra con la X o Escape (no con clic fuera), se
> puede maximizar o cambiar de tamano, y puede mostrar pasos de un asistente.

- **`Modal({...})`** · _componente React_
  Ventana modal. Equivale a modal.component de Angular y reutiliza sus mismas
  clases de CSS (.modal-overlay, .modal-card, .stepper-header).

  `pasos` dibuja el indicador del asistente cuando la ventana tiene varios
  pasos; si se omite, la ventana es simple.

  Solo se cierra con la X o con Escape: un clic fuera no la cierra, para no
  perder lo escrito. Se puede maximizar con el boton de la cabecera o cambiar
  de tamano arrastrando la esquina inferior derecha.

### `src/componentes/PantallaAcceso.tsx`

> Marco de las pantallas sin sesion: tarjeta con logo y formulario a la
> izquierda y foto a la derecha.

- **`PantallaAcceso({...})`** · _componente React_
  Marco de las pantallas sin sesion (login, recuperar contrasena y el cambio
  obligatorio de la clave temporal).

  Una tarjeta centrada sobre la foto de fondo, partida en dos: a la izquierda
  el logo y el formulario que llegue como `children`; a la derecha una foto
  con el nombre del sistema. Las dos fotos van en el CSS (.pantalla-acceso y
  .acceso-foto), asi se cambian sin tocar el componente.

  En pantallas angostas la mitad de la foto se oculta y queda solo el formulario.

### `src/componentes/ReintentarViaje.tsx`

> Ventana para retomar un viaje fallido: explica el error, muestra que
> remesas ya estan en el RNDC y deja corregir los datos del manifiesto.

- **`radicadoDuplicado(texto)`** · _función_
  Radicado que el RNDC informa cuando un documento ya existe ("DUPLICADO:123").

- **`esReintentable(v)`** · _función_
  true si el viaje quedo en un estado de error desde el que se puede reintentar.

- **`correccionDe(v)`** · _función_
  Valores iniciales del formulario de correccion: los datos actuales del manifiesto.

- **`ReintentarViaje({...})`** · _componente React_
  Ventana para retomar un viaje que quedo a medias.

  Muestra el error, que remesas ya estan en el RNDC y deja corregir los datos
  del manifiesto. Lo que se corrija en el Catalogo (por ejemplo el titular del
  vehiculo) tambien se toma: el backend relee todo al reintentar.

### `src/componentes/Shell.tsx`

> Marco de la aplicacion con sesion: menu lateral, barra superior (alertas,
> usuario) y el contenido de la pantalla actual.

- **`usarShell()`** · _función_
  Las paginas leen el contexto del marco con este gancho. Es el mecanismo de
  React Router para pasar datos del layout a las rutas hijas sin props: el
  Shell lo entrega en <Outlet context={...}> y la pagina lo recibe aqui.

- **`leerContraido()`** · _función_
  Preferencia del menu contraido. Solo es comodidad: si falla, se ignora.

- **`Shell()`** · _componente React_
  Marco de la aplicacion, siguiendo el template de docs/template de ejemplo.png:
  menu lateral claro con iconos, la empresa abajo y el boton para contraerlo;
  barra superior con el titulo, "+" (nuevo despacho), la campana de alertas y
  el avatar.

  Las alertas de documentos se cargan aqui una sola vez: la campana se ve en
  todas las pantallas y el Inicio reutiliza los mismos datos.

### `src/componentes/TablaDatos.tsx`

- **`texto(v)`** · _función_
  Valor de una celda como texto (null y undefined -> "").

- **`sinTildes(s)`** · _función_
  Texto sin tildes y en minuscula, para buscar sin importar acentos ni mayusculas.

- **`TablaDatos({...})`** · _componente React_
  Tabla de listados con pestanas, busqueda, filtros, orden, exportacion y paginas.

  Como funciona (en este orden, con useMemo para no recalcular de mas):
  1. Pestanas: filtra por la pestana activa y cuenta las filas de cada una.
  2. Busqueda: compara el texto sin tildes contra el 'valor' de cada columna.
  3. Filtros: un desplegable por columna 'filtrable' con sus valores reales.
  4. Orden: clic en el encabezado (ascendente, descendente, sin orden).
  5. Paginas de 50; al cambiar busqueda, filtros u orden vuelve a la primera.
  Exportar descarga un CSV (separado por ';', con BOM para que Excel lea las
  tildes) con todo lo filtrado, no solo la pagina visible.

- **`Paginacion({...})`** · _componente React_
  "1-50 de 312" y los botones de pagina. Tambien la usan tablas que no son TablaDatos.

- **`Pastilla({...})`** · _componente React_
  Pastilla de estado con punto de color (ver GUIA-UI.md, "Estados").

- **`IconoFiltro()`** · _componente React_
  Icono del boton Filtros.

- **`IconoExportar()`** · _componente React_
  Icono del boton Exportar.

### `src/ganchos/useDatos.ts`

> Gancho para cargar datos de la API con estados de carga, error y recarga.

- **`useDatos(cargar, dependencias)`** · _función_
  Carga datos de la API y expone los tres estados que toda pantalla necesita:
  cargando, error y datos.

  En Angular esto se resolvia con `subscribe()` dentro de `ngOnInit`. Aqui se
  encapsula para no repetir el mismo `useState` triple en cada pantalla.

  `recargar` sirve despues de guardar algo: vuelve a pedir sin recargar la
  pagina.

  Ojo con `dependencias`: es el arreglo que decide cuando se vuelve a pedir,
  igual que en useEffect. Si la funcion usa una variable que cambia (el id de
  un vehiculo, por ejemplo), esa variable tiene que estar aqui.

### `src/ganchos/useMunicipios.ts`

> Gancho con los municipios DIVIPOLA para buscar por nombre.

- **`useMunicipios(terceros)`** · _función_
  Municipios para elegir y mostrar la ruta de una plantilla.

  La fuente principal es el catalogo DIVIPOLA del backend. Si todavia no se
  importo (tabla vacia), se arma una lista con los municipios de los terceros
  que ya se conocen, para que el despachador pueda buscar por nombre igual.

  `useMemo` evita recalcular la lista en cada render: solo se rehace cuando
  cambia el catalogo o la lista de terceros. Sin el, cada tecla escrita en
  cualquier campo del formulario volveria a recorrer cientos de terceros.

### `src/ganchos/useSesion.tsx`

> Sesion del usuario: proveedor de contexto y gancho para leerla. Vuelve al
> login cuando el backend avisa que la sesion vencio.

- **`ProveedorSesion({...})`** · _componente React_
  Guarda quien esta conectado y lo comparte con toda la aplicacion.

  Es un Context de React: un valor que cualquier componente de adentro puede
  leer con useSesion(), sin pasarlo de mano en mano por props. Al montarse
  pregunta al backend "quien soy" (la cookie la manda el navegador solo); y
  escucha el evento de sesion vencida que dispara el cliente de la API ante
  un 401, para volver al login sin importar en que pantalla se estaba.

- **`useSesion()`** · _función_
  Sesion actual (estado, usuario, entrar, salir). Debe usarse dentro de <ProveedorSesion>.

### `src/paginas/Catalogo.tsx`

> Pantallas de catalogo: Flota (vehiculos, remolques, monitoreo),
> Conductores, Clientes (terceros) y Configuracion (parametros de la
> empresa). Listas con su estado de documentos y formularios de crear/editar.

- **`Catalogo({...})`** · _componente React_
  El catalogo se usa desde varias entradas del menu (Flota, Conductores,
  Clientes, Configuracion): cada una muestra solo sus pestanas. Sin la prop,
  se ven todas.

- **`Tabla({...})`** · _componente React_
  Tabla simple del catalogo con paginas de 50: muestra "Cargando" o el error
  mientras corresponde, y vuelve a la primera pagina cuando cambia la lista.

- **`EstadoRegistro({...})`** · _componente React_
  Insignia del registro: Inactivo, Al dia o Revisar (documento vencido).

- **`Vencimiento({...})`** · _componente React_
  Fecha de vencimiento, en rojo si ya paso.

- **`PanelEmpresa()`** · _componente React_
  Parametros de la empresa: poliza, FOPAT y tarifa de retefuente.
  Es una sola fila, no una lista, asi que se edita en linea.

- **`aModelo(registro)`** · _función_
  Copia del registro lista para el formulario.

- **`soloCambios(original, actual)`** · _función_
  Solo lo que cambio respecto al original. Mandar el registro completo
  revalidaria campos que nadie toco (por ejemplo una configuracion vieja) y
  haria fallar una edicion que no tenia nada que ver.

- **`coincide(texto, ...campos)`** · _función_
  Busca el texto en cualquiera de los campos (sin distinguir mayusculas).

- **`titularEsEmpresa(v, nitEmpresa)`** · _función_
  Misma regla que mismaIdentificacion() del backend: iguales, o distintos solo
  por el digito de verificacion al final.

- **`configuracionValida(c)`** · _función_
  true si la configuracion del vehiculo es una de las que acepta SICETAC.

- **`vigente(fecha)`** · _función_
  Vigente si no tiene fecha o si vence hoy o despues (comparando el dia, no la hora).

- **`kg(valor)`** · _función_
  Kilos con punto de miles y "kg"; "-" sin valor.

- **`iniciales(nombre)`** · _función_
  Iniciales de las dos primeras palabras de un nombre (para el avatar).

- **`textoNuevo(p)`** · _función_
  Texto del boton de crear de cada pestana: "Nuevo vehiculo", "Nueva empresa de monitoreo"...

- **`tituloModal(p, edicion, modelo)`** · _función_
  Titulo de la ventana: "Nuevo vehiculo" o "Editar vehiculo SKN250".

- **`seccionEstado(que)`** · _función_
  Seccion "Estado" del formulario (casilla Activo): un registro inactivo no
  aparece en el despacho pero se conserva para el historial.

- **`seccionesDe(p, empresas, edicion)`** · _función_
  Secciones del formulario segun la pestana. Al editar se agrega la seccion
  de estado (activo/inactivo), que al crear no tiene sentido.

- **`seccionesVehiculo(empresas)`** · _función_
  El formulario de vehiculos incluye el proveedor de GPS, cuyas opciones salen
  del catalogo de empresas de monitoreo y por eso no pueden ser fijas.

- **`SelectorGps({...})`** · _componente React_
  Cambia en linea el proveedor de GPS de un vehiculo ya registrado. Es lo que
  permite completar la flota que ya estaba cargada sin reimportarla.

### `src/paginas/Dashboard.tsx`

> Pantalla de inicio: indicadores, documentos mas urgentes, viajes de hoy,
> ultimos viajes, viajes por semana y mapa de seguimiento.

- **`Dashboard()`** · _componente React_
  Pantalla de inicio, organizada como docs/template de ejemplo.png:
  indicadores arriba, los documentos mas urgentes, los viajes de hoy, los
  ultimos viajes, los viajes por semana y el mapa de seguimiento.

  Todo se calcula en el navegador con listas que ya existen (historial de
  viajes, vehiculos, conductores y plantillas). Si el volumen crece, conviene
  mover los conteos al backend.

  Un viaje cumplido es "Finalizado"; los demas toman su estado de las CITAS de
  cargue y descargue del manifiesto (el sistema no recibe la posicion GPS).

- **`estadoViaje(v, ahora)`** · _función_
  Estado para el tablero: Anulado, Finalizado (cumplido o ya paso la cita de
  descargue), Con incidencia (cualquier error), Programado (aun no carga) o En
  camino (entre la cita de cargue y la de descargue).

- **`claseEstado(e)`** · _función_
  Clase CSS del color de cada estado del tablero.

- **`avance(v, ahora)`** · _función_
  Fraccion del viaje recorrida (0 a 1) segun la hora actual entre la cita de
  cargue y la de descargue. Para la barra de progreso.

- **`claveDia(d)`** · _función_
  "AAAA-MM-DD" del dia en Colombia.

- **`hora(valor)`** · _función_
  "HH:MM" en hora de Colombia; vacio sin valor.

- **`fechaCorta(valor)`** · _función_
  "DD/MM" en hora de Colombia (no del texto UTC: de noche seria el dia siguiente).

- **`ruta(p)`** · _función_
  "Ciudad origen -> ciudad destino" de una plantilla, con el municipio corto.

- **`corto(ciudad)`** · _función_
  "SOACHA CUNDINAMARCA" -> "Soacha": el municipio sin el departamento.

- **`variacion(actual, previo)`** · _función_
  Variacion porcentual; null si no hay base para comparar.

- **`viajesPorSemana(viajes, ahora)`** · _función_
  Viajes confirmados por semana (lunes a domingo, hora de Colombia), por fecha
  de expedicion. Devuelve la semana actual y las 4 anteriores.

- **`Indicador({...})`** · _componente React_
  Tarjeta de indicador del tablero: icono, titulo, valor y la variacion
  frente al periodo anterior (con signo y flecha, no solo color).

- **`AlertaDestacada({...})`** · _componente React_
  Tarjeta con el documento mas urgente (o un mensaje si no hay): quien, que
  documento y en cuantos dias vence. Al hacer clic abre todas las alertas.

- **`AvatarConductor({...})`** · _componente React_
  Circulo con las iniciales del conductor (su nombre completo al pasar el mouse).

- **`GraficaSemana({...})`** · _componente React_
  Viajes por dia de la semana elegida. Cada dia lleva dos barras: la semana
  anterior en azul claro (de fondo, para comparar) y la elegida en azul. Una
  sola metrica, dos periodos: el claro es solo referencia.

### `src/paginas/Despacho.tsx`

> Pantalla Despachar: asistente para expedir un viaje (remesas y manifiesto)
> en el RNDC, y para corregir y reintentar un viaje fallido.

- **`radicadoDuplicado(texto)`** · _función_
  Radicado que el RNDC informa cuando un documento ya existe ("DUPLICADO:123").

- **`consecutivoRemesa(base, orden)`** · _función_
  Consecutivo de cada remesa a partir del numero base del viaje.

  Convencion de la empresa: la primera remesa lleva el numero tal cual (el
  mismo del manifiesto) y las siguientes agregan una letra. Es la misma regla
  que aplica el backend; aqui esta solo para mostrar la vista previa.

- **`proximaHoraEnPunto()`** · _función_
  Hoy, a la siguiente hora en punto. Es la cita de cargue mas frecuente.

- **`filaVacia()`** · _función_
  Carga nueva vacia: cargue en la proxima hora en punto y descargue un dia despues.

- **`Despacho({...})`** · _componente React_
  Pantalla Despachar: asistente de tres pasos para expedir un viaje.

  1. Vehiculo y conductor (con el remolque y conductor habituales sugeridos).
  2. Cargas: una o varias remesas, cada una desde una plantilla, con citas y peso.
  3. Valores: flete, anticipo y via con su piso SICETAC.
  Al enviar, el backend expide las remesas y el manifiesto en el RNDC y la
  pantalla muestra los documentos. Si se abre con ?viaje=N, carga un viaje
  fallido completo para corregirlo y reintentarlo.

- **`diasDesdeHoy(n)`** · _función_
  "AAAA-MM-DD" de hoy + n dias, en hora de Colombia (para inputs type="date").

### `src/paginas/FormularioPlantilla.tsx`

> Formulario para crear o editar una plantilla de viaje: terceros, ruta,
> mercancia, tiempos pactados y valores.

- **`partidaDe(codigo)`** · _función_
  "004707" -> "4707": la lista trabaja con los 4 digitos.

- **`FormularioPlantilla({...})`** · _componente React_
  Crea o edita una plantilla.

  Si llega `plantilla`, el formulario abre en modo edicion con sus valores.
  El valor que recibe `useState(...)` solo se usa en el PRIMER render: por eso
  basta con pasarle el dato de la plantilla ahi y no hace falta un useEffect
  para "copiar" la plantilla al estado.

- **`SelectorMunicipio({...})`** · _componente React_
  Municipio con buscador por nombre, mas el codigo DIVIPOLA editable a mano.

  Los dos controles escriben el MISMO estado (`valor`): elegir en la lista
  llena el codigo, y escribir el codigo selecciona el municipio si esta en la
  lista. El campo de codigo existe porque la lista puede no traer el municipio
  que se necesita (por ejemplo, donde arranca un tramo en vacio).

- **`SelectorTercero({...})`** · _componente React_
  Lista desplegable para elegir un tercero (cliente, remitente o destinatario).

### `src/paginas/Historial.tsx`

> Pantalla Viajes: lista de despachos y libro de consecutivos, con las
> acciones de cada viaje.

- **`Historial()`** · _componente React_
  Pantalla Viajes: todos los despachos con su estado, plazo del cumplido y
  acciones (imprimir, cumplir, corregir y reintentar, anular). Tiene dos
  vistas: "Viajes" (uno por fila) y "Consecutivos manifiestos y remesas"
  (una fila por remesa, como el libro de control). Clic en una fila abre todo
  lo que se registro al despachar.

- **`PlazoCumplido({...})`** · _componente React_
  Dias habiles que quedan para cumplir, en la columna de estado.

### `src/paginas/Login.tsx`

> Pantalla de inicio de sesion y recuperacion de contrasena por codigo al correo.

- **`Login()`** · _componente React_
  Pantalla de inicio de sesion: email y contrasena.

  Es un <form> de verdad (no botones sueltos): asi Enter envia, el navegador
  ofrece guardar la contrasena y los gestores de claves la reconocen.

- **`CampoClave({...})`** · _componente React_
  Campo de contrasena con el boton del ojo para verla. El boton solo cambia el
  `type` del input entre "password" y "text"; el valor es el mismo.

- **`Recuperar({...})`** · _componente React_
  Recuperar la contrasena en dos pasos: pedir un codigo al correo y luego,
  con ese codigo, crear la contrasena nueva.

### `src/paginas/Plantillas.tsx`

> Pantalla Plantillas: lista de plantillas de viaje y actualizacion de tarifas por ruta.

- **`Plantillas()`** · _componente React_
  Pantalla Plantillas: lista de plantillas de viaje (nombre, ruta,
  contratante, mercancia y tarifa); crear, editar y eliminar (desactivar), y
  actualizar tarifas por ruta.

- **`ModalTarifas({...})`** · _componente React_
  Actualizacion masiva de tarifas por ruta.

  Va en dos tiempos a proposito: primero se elige la ruta, luego se MUESTRA que
  plantillas se van a tocar, y solo despues aparece el campo del nuevo valor.
  Saltarse la previsualizacion es como se le cambia sin querer la tarifa a un
  cliente con precio negociado.

### `src/paginas/Usuarios.tsx`

> Pantalla Usuarios: crear usuarios, activarlos o desactivarlos y
> restablecer su clave (temporal, por correo o en pantalla).

- **`Usuarios()`** · _componente React_
  Administracion de usuarios. Sin roles por ahora: cualquier usuario activo
  crea, desactiva y restablece cuentas.

  Las contrasenas temporales las genera el servidor y se muestran UNA sola
  vez: hay que copiarlas y entregarlas al usuario, que debera cambiarla en su
  primer ingreso.

- **`NuevoUsuario({...})`** · _componente React_
  Ventana para crear un usuario con correo y nombre. Al crearlo devuelve como
  se entrego la clave temporal (por correo o en pantalla).

- **`ClaveTemporal({...})`** · _componente React_
  Muestra UNA vez la clave temporal cuando no se envio por correo (con el
  motivo, si lo hay), para dictarla o copiarla.

### `src/paginas/cuadro/CuadroCentral.tsx`

> Pantalla Cuadro pagos: seguimiento de cada viaje (con o sin manifiesto)
> desde que carga hasta que todo queda pagado. Reemplaza la hoja de Excel
> "CUADRO CENTRAL".

- **`mes(fecha)`** · _función_
  "2026-09" -> "septiembre 2026", para filtrar por mes como las hojas del Excel.

- **`CuadroCentral()`** · _componente React_
  Cuadro pagos: el control de cada viaje desde que carga hasta que todo
  queda pagado, tenga o no manifiesto. Reemplaza la hoja "CUADRO PAGOS".

### `src/paginas/cuadro/DetalleCuadro.tsx`

> Ventana de un viaje del cuadro pagos: papeles, datos, flete, factura, pago
> al dueno, revisiones, anticipos de bomba y notas.

- **`aFormulario(d)`** · _función_
  Viaje -> valores del formulario, todos como texto (asi trabajan los inputs).

- **`Seccion({...})`** · _componente React_
  Bloque con titulo (y algo extra al lado del titulo) dentro del detalle.

- **`DetalleCuadro({...})`** · _componente React_
  Un viaje del cuadro pagos: papeles, datos, flete, factura, pagos,
  revisiones, anticipos de bomba y notas. Papeles, revisiones, anticipos y
  notas se guardan al instante; los demas datos con "Guardar cambios".

- **`Anticipos({...})`** · _componente React_
  Anticipos entregados por las bombas aliadas (aparte del anticipo del manifiesto).

- **`Notas({...})`** · _componente React_
  Notas con autor y fecha, la mas reciente arriba.

### `src/paginas/cuadro/VentanasCuadro.tsx`

> Ventanas auxiliares del cuadro pagos: nuevo viaje sin manifiesto, facturar
> varios viajes y catalogo de bombas aliadas.

- **`NuevoViajeCuadro({...})`** · _componente React_
  Viaje sin manifiesto de la empresa: urbanos, o viajes que planilla el mismo
  generador de carga. Solo lo minimo; el resto se completa en el detalle.

- **`FacturarVarios({...})`** · _componente React_
  Una factura para varios viajes a la vez (los urbanos se facturan juntos).
  Lista los viajes sin numero de factura; se filtran por empresa y se marcan.

- **`VentanaBombas({...})`** · _componente React_
  Bombas aliadas que entregan anticipos.

### `src/paginas/cuadro/estadosCuadro.ts`

> Nombres, colores y reglas de presentacion del cuadro pagos (estados,
> papeles, flota, fechas y vencimiento de saldos).

- **`tonoEstadoCuadro(f)`** · _función_
  Color de la pastilla de estado, con el significado de los colores del Excel.
  Todo pagado siempre es amarillo.

- **`etiquetaEstadoCuadro(f)`** · _función_
  Nombre del estado para mostrar; "Todo pagado" cuando ya se pago todo.

- **`pasosPapeles(flujoCorame)`** · _función_
  Pasos de los papeles. Parqueadero y oficina solo para CORAME / Cartones America.

- **`hoyColombia()`** · _función_
  Fecha de hoy en Colombia, "AAAA-MM-DD".

- **`fechaCorta(f)`** · _función_
  "2026-09-30" -> "30/09/2026" (sin pasar por Date: no se corre de dia).

- **`saldoVencido(f)`** · _función_
  Saldo de un tercero sin pagar y ya vencido (15 dias despues de descargar).

### `src/paginas/estadosViaje.ts`

> Estados del viaje para mostrar: nombre para la gente y tono de color.

- **`tonoEstado(estado)`** · _función_
  Color de la pastilla de un estado de viaje: verde cumplido, azul expedido,
  gris anulado, amarillo mientras se envia, rojo los errores.

<!-- REFERENCIA:FIN -->
