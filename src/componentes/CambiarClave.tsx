/**
 * Formulario para cambiar la propia contrasena (obligatorio con clave
 * temporal, o voluntario desde el menu del avatar).
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { auth } from "../api/cliente";
import { useSesion } from "../ganchos/useSesion";

/**
 * Formulario para cambiar la propia contrasena. Se usa en dos lugares:
 * - Obligatorio, a pantalla completa, cuando se entra con una clave temporal.
 * - Voluntario, desde el menu del avatar.
 */
export default function CambiarClave({
  obligatorio = false,
  alTerminar,
}: {
  obligatorio?: boolean;
  alTerminar?: () => void;
}) {
  const { actualizarUsuario, salir } = useSesion();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva !== repetida) {
      setError("Las dos contrasenas nuevas no coinciden.");
      return;
    }
    setEnviando(true);
    try {
      actualizarUsuario(await auth.cambiarClave(actual, nueva));
      alTerminar?.();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo cambiar la contrasena");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className={obligatorio ? "tarjeta-acceso" : ""} onSubmit={enviar}>
      {obligatorio && (
        <>
          <h1>Crea tu contrasena</h1>
          <p className="section-desc">
            Entraste con una contrasena temporal. Elige una propia para continuar.
          </p>
        </>
      )}
      {error && <div className="alert danger">{error}</div>}

      <label htmlFor="actual">{obligatorio ? "Contrasena temporal" : "Contrasena actual"}</label>
      <input id="actual" type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />

      <label htmlFor="nueva">Contrasena nueva</label>
      <input id="nueva" type="password" autoComplete="new-password" required value={nueva} onChange={(e) => setNueva(e.target.value)} />
      <p className="section-desc">Minimo 8 caracteres, con letras y numeros.</p>

      <label htmlFor="repetida">Repite la contrasena nueva</label>
      <input id="repetida" type="password" autoComplete="new-password" required value={repetida} onChange={(e) => setRepetida(e.target.value)} />

      <button className="btn-primary boton-ancho" type="submit" disabled={enviando}>
        {enviando ? "Guardando..." : "Guardar contrasena"}
      </button>
      {obligatorio && (
        <button type="button" className="btn-link boton-ancho" onClick={() => salir()}>
          Salir
        </button>
      )}
    </form>
  );
}
