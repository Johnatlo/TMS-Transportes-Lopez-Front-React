/**
 * Pantalla Usuarios (solo el rol total): crear usuarios con su rol,
 * cambiarles el nombre o el rol, activarlos o desactivarlos y restablecer su
 * clave (temporal, por correo o en pantalla).
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { auth, fechaHora } from "../api/cliente";
import type { EntregaClave } from "../api/cliente";
import { useDatos } from "../ganchos/useDatos";
import { useSesion } from "../ganchos/useSesion";
import { Cargando, ErrorCarga } from "../componentes/Estado";
import Modal from "../componentes/Modal";
import TablaDatos, { Pastilla } from "../componentes/TablaDatos";
import type { Rol, Usuario } from "../api/tipos";
import { NOMBRE_ROL } from "../permisos";

const ROLES: Rol[] = ["TOTAL", "ADMINISTRATIVO", "MYC"];
/** Que ve cada rol (para elegirlo al crear el usuario). */
const DESCRIPCION_ROL: Record<Rol, string> = {
  TOTAL: "todo el aplicativo",
  ADMINISTRATIVO: "lo operativo, sin cuentas de vehiculos ni liquidaciones",
  MYC: "RNDC y las cuentas de los vehiculos de M&C",
};

/**
 * Administracion de usuarios y sus roles: TOTAL (todo), ADMINISTRATIVO (lo
 * operativo sin cuentas de vehiculos) y MYC (RNDC y las cuentas de sus
 * vehiculos). Siempre queda al menos un usuario con acceso total.
 *
 * Las contrasenas temporales las genera el servidor y se muestran UNA sola
 * vez: hay que copiarlas y entregarlas al usuario, que debera cambiarla en su
 * primer ingreso.
 */
export default function Usuarios() {
  const { usuario: yo, actualizarUsuario } = useSesion();
  const lista = useDatos(() => auth.listarUsuarios(), []);
  const [creando, setCreando] = useState(false);
  const [renombrando, setRenombrando] = useState<Usuario | null>(null);
  const [claveMostrada, setClaveMostrada] = useState<{ email: string; clave: string; aviso?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  /** Muestra como se entrego la clave: por correo, o en pantalla si no se pudo. */
  function mostrarEntrega(email: string, r: EntregaClave) {
    if (r.enviadoPorCorreo) {
      setExito(`Se envio la contrasena temporal a ${email}.`);
    } else if (r.claveTemporal) {
      setClaveMostrada({ email, clave: r.claveTemporal, aviso: r.avisoCorreo });
    }
  }

  async function cambiarEstado(u: Usuario) {
    const accion = u.activo ? "desactivar" : "reactivar";
    if (!window.confirm(`¿${accion[0].toUpperCase() + accion.slice(1)} a ${u.nombre}?`)) return;
    setError(null);
    try {
      await auth.actualizarUsuario(u.id, { activo: !u.activo });
      lista.recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo cambiar el estado");
    }
  }

  async function cambiarRol(u: Usuario, rol: Rol) {
    if (rol === u.rol || !window.confirm(`¿Cambiar el rol de ${u.nombre} a "${NOMBRE_ROL[rol]}"?`)) return;
    setError(null);
    try {
      const nuevo = await auth.actualizarUsuario(u.id, { rol });
      setExito(`${u.nombre} ahora tiene el rol ${NOMBRE_ROL[rol]}.`);
      if (u.id === yo?.id && yo) actualizarUsuario({ ...yo, rol: nuevo.rol });
      lista.recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo cambiar el rol");
    }
  }

  async function restablecer(u: Usuario) {
    if (!window.confirm(`¿Restablecer la contrasena de ${u.nombre}? Se cerraran sus sesiones abiertas.`)) return;
    setError(null);
    try {
      setExito(null);
      mostrarEntrega(u.email, await auth.restablecerClave(u.id));
      lista.recargar();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo restablecer");
    }
  }

  if (lista.cargando && !lista.datos) return <Cargando que="usuarios" />;
  if (lista.error) return <ErrorCarga mensaje={lista.error} alReintentar={lista.recargar} />;

  return (
    <>
      {exito && <div className="alert success">{exito}</div>}
      {error && <div className="alert danger">{error}</div>}
      <div className="panel">
        <TablaDatos
          filas={lista.datos ?? []}
          clave={(u) => u.id}
          pestanas={[
            { id: "activos", etiqueta: "Activos", incluye: (u) => u.activo },
            { id: "inactivos", etiqueta: "Inactivos", incluye: (u) => !u.activo },
            { id: "todos", etiqueta: "Todos", incluye: () => true },
          ]}
          placeholderBusqueda="Buscar nombre o email..."
          acciones={
            <button className="btn-primary" onClick={() => setCreando(true)}>
              + Nuevo usuario
            </button>
          }
          columnas={[
            {
              id: "nombre",
              titulo: "Nombre",
              valor: (u) => u.nombre,
              celda: (u) => (
                <>
                  <span className="principal">{u.nombre}</span>
                  {u.id === yo?.id && <span className="dato-sec">(tu)</span>}
                </>
              ),
            },
            { id: "email", titulo: "Email", valor: (u) => u.email, celda: (u) => u.email },
            {
              id: "rol",
              titulo: "Rol",
              filtrable: true,
              valor: (u) => NOMBRE_ROL[u.rol] ?? u.rol,
              celda: (u) => (
                <select value={u.rol} onChange={(e) => cambiarRol(u, e.target.value as Rol)} aria-label={`Rol de ${u.nombre}`}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {NOMBRE_ROL[r]}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              id: "estado",
              titulo: "Estado",
              valor: (u) => (u.activo ? (u.debeCambiarClave ? "Clave temporal" : "Activo") : "Inactivo"),
              celda: (u) =>
                !u.activo ? (
                  <Pastilla tono="neutro">Inactivo</Pastilla>
                ) : u.debeCambiarClave ? (
                  <Pastilla tono="aviso">Clave temporal</Pastilla>
                ) : (
                  <Pastilla tono="ok">Activo</Pastilla>
                ),
            },
            {
              id: "acceso",
              titulo: "Ultimo acceso",
              valor: (u) => u.ultimoAcceso ?? "",
              celda: (u) => (u.ultimoAcceso ? fechaHora(u.ultimoAcceso) : "Nunca"),
            },
            {
              id: "acciones",
              titulo: "",
              etiquetaMovil: null,
              alinear: "derecha",
              celda: (u) => (
                <>
                  <button className="boton-suave" onClick={() => setRenombrando(u)}>
                    Cambiar nombre
                  </button>
                  <button className="boton-suave" style={{ marginLeft: 8 }} onClick={() => restablecer(u)}>
                    Restablecer contrasena
                  </button>
                  {u.id !== yo?.id && (
                    <button className="btn-link" style={{ marginLeft: 8 }} onClick={() => cambiarEstado(u)}>
                      {u.activo ? "Desactivar" : "Reactivar"}
                    </button>
                  )}
                </>
              ),
            },
          ]}
        />
      </div>

      {creando && (
        <NuevoUsuario
          alCerrar={() => setCreando(false)}
          alCrear={(email, entrega) => {
            setCreando(false);
            setExito(null);
            mostrarEntrega(email, entrega);
            lista.recargar();
          }}
        />
      )}

      {renombrando && (
        <CambiarNombre
          usuario={renombrando}
          alCerrar={() => setRenombrando(null)}
          alGuardar={(u) => {
            setRenombrando(null);
            setError(null);
            setExito(`Nombre cambiado a ${u.nombre}.`);
            // El propio nombre tambien se ve arriba: se actualiza sin volver a entrar.
            if (u.id === yo?.id && yo) actualizarUsuario({ ...yo, nombre: u.nombre });
            lista.recargar();
          }}
        />
      )}

      {claveMostrada && <ClaveTemporal {...claveMostrada} alCerrar={() => setClaveMostrada(null)} />}
    </>
  );
}

/**
 * Ventana para crear un usuario con correo y nombre. Al crearlo devuelve como
 * se entrego la clave temporal (por correo o en pantalla).
 */
function NuevoUsuario({ alCerrar, alCrear }: { alCerrar: () => void; alCrear: (email: string, entrega: EntregaClave) => void }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("ADMINISTRATIVO");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const creado = await auth.crearUsuario(email, nombre, rol);
      alCrear(creado.email, creado);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo crear el usuario");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Nuevo usuario" alCerrar={alCerrar}>
      <form onSubmit={enviar}>
        {error && <div className="alert danger">{error}</div>}
        <label htmlFor="nu-nombre">Nombre</label>
        <input id="nu-nombre" autoFocus required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label htmlFor="nu-email">Email</label>
        <input id="nu-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="nu-rol">Rol</label>
        <select id="nu-rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {NOMBRE_ROL[r]}: {DESCRIPCION_ROL[r]}
            </option>
          ))}
        </select>
        <p className="section-desc">
          El sistema genera una contrasena temporal y se la envia por correo. Si el correo no esta configurado, la veras aqui una sola vez. El usuario la
          cambiara en su primer ingreso.
        </p>
        <div className="acciones-formulario">
          <button type="button" className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={enviando}>
            {enviando ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Ventana para cambiar el nombre de un usuario (el propio o el de otro). */
function CambiarNombre({ usuario, alCerrar, alGuardar }: { usuario: Usuario; alCerrar: () => void; alGuardar: (u: Usuario) => void }) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      alGuardar(await auth.actualizarUsuario(usuario.id, { nombre }));
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo cambiar el nombre");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Cambiar nombre" alCerrar={alCerrar}>
      <form onSubmit={enviar}>
        {error && <div className="alert danger">{error}</div>}
        <label htmlFor="cn-nombre">Nombre de {usuario.email}</label>
        <input id="cn-nombre" autoFocus required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <div className="acciones-formulario">
          <button type="button" className="btn-secondary" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={enviando || !nombre.trim() || nombre.trim() === usuario.nombre}>
            {enviando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Muestra UNA vez la clave temporal cuando no se envio por correo (con el
 * motivo, si lo hay), para dictarla o copiarla.
 */
function ClaveTemporal({ email, clave, aviso, alCerrar }: { email: string; clave: string; aviso?: string; alCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(clave);
      setCopiado(true);
    } catch {
      /* sin portapapeles: se copia a mano */
    }
  }
  return (
    <Modal
      titulo="Contrasena temporal"
      alCerrar={alCerrar}
      pie={
        <button className="btn-primary" onClick={alCerrar}>
          Listo, ya la copie
        </button>
      }
    >
      {aviso && <div className="alert warning">{aviso}</div>}
      <p>
        Entrega esta contrasena a <strong>{email}</strong>. <strong>No se volvera a mostrar.</strong> Al entrar, el sistema le pedira crear una propia.
      </p>
      <div className="clave-temporal">
        <code>{clave}</code>
        <button className="boton-suave" onClick={copiar}>
          {copiado ? "✓ Copiada" : "Copiar"}
        </button>
      </div>
    </Modal>
  );
}
