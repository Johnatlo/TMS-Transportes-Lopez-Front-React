import { useState } from "react";
import type { FormEvent } from "react";
import { useSesion } from "../ganchos/useSesion";
import { auth } from "../api/cliente";
import PantallaAcceso from "../componentes/PantallaAcceso";
import { IconoOjo, IconoOjoTachado } from "../componentes/Iconos";

/**
 * Pantalla de inicio de sesion: email y contrasena.
 *
 * Es un <form> de verdad (no botones sueltos): asi Enter envia, el navegador
 * ofrece guardar la contrasena y los gestores de claves la reconocen.
 */
export default function Login() {
  const { entrar } = useSesion();
  const [recuperando, setRecuperando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault(); // sin esto el navegador recargaria la pagina
    setEnviando(true);
    setError(null);
    try {
      await entrar(email, clave);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo iniciar sesion");
      setClave("");
    } finally {
      setEnviando(false);
    }
  }

  if (recuperando) {
    return (
      <PantallaAcceso>
        <Recuperar
          emailInicial={email}
          alVolver={(mensaje) => {
            setRecuperando(false);
            setAviso(mensaje ?? null);
          }}
        />
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso>
      <form className="tarjeta-acceso" onSubmit={enviar}>
        <h1>Bienvenido</h1>
        <p className="acceso-subtitulo">Ingresa con tu correo y contrasena para gestionar los despachos.</p>

        {aviso && <div className="alert success">{aviso}</div>}
        {error && <div className="alert danger">{error}</div>}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="tucorreo@empresa.com"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="fila-etiqueta">
          <label htmlFor="clave">Contrasena</label>
          <button type="button" className="enlace-pequeno" onClick={() => setRecuperando(true)}>
            ¿Olvidaste tu contrasena?
          </button>
        </div>
        <CampoClave
          id="clave"
          autoComplete="current-password"
          valor={clave}
          alCambiar={setClave}
        />

        <button className="btn-primary boton-ancho" type="submit" disabled={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </PantallaAcceso>
  );
}

/**
 * Campo de contrasena con el boton del ojo para verla. El boton solo cambia el
 * `type` del input entre "password" y "text"; el valor es el mismo.
 */
function CampoClave({
  id,
  autoComplete,
  valor,
  alCambiar,
}: {
  id: string;
  autoComplete: string;
  valor: string;
  alCambiar: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="campo-clave">
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder="••••••••"
        required
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
      />
      <button
        type="button"
        className="boton-ojo"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contrasena" : "Mostrar contrasena"}
        title={visible ? "Ocultar contrasena" : "Mostrar contrasena"}
      >
        {visible ? <IconoOjoTachado /> : <IconoOjo />}
      </button>
    </div>
  );
}

/**
 * Recuperar la contrasena en dos pasos: pedir un codigo al correo y luego,
 * con ese codigo, crear la contrasena nueva.
 */
function Recuperar({ emailInicial, alVolver }: { emailInicial: string; alVolver: (mensaje?: string) => void }) {
  const [paso, setPaso] = useState<"pedir" | "confirmar">("pedir");
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [minutos, setMinutos] = useState(15);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pedir(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await auth.recuperar(email);
      setMinutos(r.minutos);
      setPaso("confirmar");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo enviar el codigo");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nueva !== repetida) {
      setError("Las dos contrasenas no coinciden.");
      return;
    }
    setEnviando(true);
    try {
      await auth.confirmarRecuperacion(email, codigo, nueva);
      alVolver("Contrasena actualizada. Ya puedes entrar con la nueva.");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "No se pudo cambiar la contrasena");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="tarjeta-acceso" onSubmit={paso === "pedir" ? pedir : confirmar}>
      <h1>Recuperar contrasena</h1>
      {error && <div className="alert danger">{error}</div>}

      {paso === "pedir" ? (
        <>
          <p className="section-desc">Te enviaremos un codigo de 6 digitos a tu correo.</p>
          <label htmlFor="rec-email">Email</label>
          <input id="rec-email" type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn-primary boton-ancho" type="submit" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviarme el codigo"}
          </button>
        </>
      ) : (
        <>
          <div className="alert info">
            Si <strong>{email}</strong> tiene cuenta, le llego un codigo. Vence en {minutos} minutos.
            Revisa tambien la carpeta de correo no deseado.
          </div>
          <label htmlFor="rec-codigo">Codigo</label>
          <input
            id="rec-codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          />
          <label htmlFor="rec-nueva">Contrasena nueva</label>
          <input id="rec-nueva" type="password" autoComplete="new-password" required value={nueva} onChange={(e) => setNueva(e.target.value)} />
          <p className="section-desc">Minimo 8 caracteres, con letras y numeros.</p>
          <label htmlFor="rec-repetida">Repite la contrasena nueva</label>
          <input id="rec-repetida" type="password" autoComplete="new-password" required value={repetida} onChange={(e) => setRepetida(e.target.value)} />
          <button className="btn-primary boton-ancho" type="submit" disabled={enviando}>
            {enviando ? "Guardando..." : "Guardar contrasena"}
          </button>
          <button type="button" className="btn-link boton-ancho" onClick={() => setPaso("pedir")}>
            No me llego: pedir otro codigo
          </button>
        </>
      )}
      <button type="button" className="btn-link boton-ancho" onClick={() => alVolver()}>
        Volver a iniciar sesion
      </button>
    </form>
  );
}
