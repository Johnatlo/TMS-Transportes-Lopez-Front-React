/**
 * Pantalla Usuarios: crear usuarios, activarlos o desactivarlos y
 * restablecer su clave (temporal, por correo o en pantalla).
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
import type { Usuario } from "../api/tipos";

/**
 * Administracion de usuarios. Sin roles por ahora: cualquier usuario activo
 * crea, desactiva y restablece cuentas.
 *
 * Las contrasenas temporales las genera el servidor y se muestran UNA sola
 * vez: hay que copiarlas y entregarlas al usuario, que debera cambiarla en su
 * primer ingreso.
 */
export default function Usuarios() {
  const { usuario: yo } = useSesion();
  const lista = useDatos(() => auth.listarUsuarios(), []);
  const [creando, setCreando] = useState(false);
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
                  <button className="boton-suave" onClick={() => restablecer(u)}>
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

      {claveMostrada && <ClaveTemporal {...claveMostrada} alCerrar={() => setClaveMostrada(null)} />}
    </>
  );
}

/**
 * Ventana para crear un usuario con correo y nombre. Al crearlo devuelve como
 * se entrego la clave temporal (por correo o en pantalla).
 */
function NuevoUsuario({
  alCerrar,
  alCrear,
}: {
  alCerrar: () => void;
  alCrear: (email: string, entrega: EntregaClave) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const creado = await auth.crearUsuario(email, nombre);
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
        <p className="section-desc">
          El sistema genera una contrasena temporal y se la envia por correo. Si el correo no
          esta configurado, la veras aqui una sola vez. El usuario la cambiara en su primer
          ingreso.
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

/**
 * Muestra UNA vez la clave temporal cuando no se envio por correo (con el
 * motivo, si lo hay), para dictarla o copiarla.
 */
function ClaveTemporal({
  email,
  clave,
  aviso,
  alCerrar,
}: {
  email: string;
  clave: string;
  aviso?: string;
  alCerrar: () => void;
}) {
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
        Entrega esta contrasena a <strong>{email}</strong>. <strong>No se volvera a mostrar.</strong>{" "}
        Al entrar, el sistema le pedira crear una propia.
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
