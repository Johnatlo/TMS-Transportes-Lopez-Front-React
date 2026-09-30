/**
 * Iconos de trazo simple (24x24, stroke = currentColor), para el menu y la
 * barra superior. Toman el color del texto que los rodea.
 */
import type { ReactNode } from "react";

function Icono({ children, tamano = 18 }: { children: ReactNode; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconoInicio = () => (
  <Icono>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icono>
);

export const IconoCamion = () => (
  <Icono>
    <path d="M3 6h11v10H3z" />
    <path d="M14 10h4l3 3v3h-7" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </Icono>
);

export const IconoViajes = () => (
  <Icono>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </Icono>
);

export const IconoPlantillas = () => (
  <Icono>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </Icono>
);

export const IconoClientes = () => (
  <Icono>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M16 14.6c2.2.2 3.8 1.6 4.5 4.4" />
  </Icono>
);

export const IconoFlota = () => (
  <Icono>
    <path d="M2 7h12v9H2z" />
    <path d="M14 11h4l3 3v2h-7" />
    <circle cx="6" cy="17.5" r="1.6" />
    <circle cx="17" cy="17.5" r="1.6" />
    <path d="M5 10h5" />
  </Icono>
);

export const IconoConductores = () => (
  <Icono>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2.3" />
    <path d="M5.5 16c.6-1.7 2-2.6 3.5-2.6s2.9.9 3.5 2.6M15 10h3M15 13.5h3" />
  </Icono>
);

export const IconoConfiguracion = () => (
  <Icono>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
  </Icono>
);

export const IconoMas = () => (
  <Icono>
    <path d="M12 5v14M5 12h14" />
  </Icono>
);

export const IconoCampana = () => (
  <Icono>
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </Icono>
);

export const IconoFlecha = () => (
  <Icono tamano={16}>
    <path d="M7 17 17 7M9 7h8v8" />
  </Icono>
);

export const IconoContraer = () => (
  <Icono>
    <path d="M4 6h10M4 12h7M4 18h10M20 8l-4 4 4 4" />
  </Icono>
);

export const IconoCalendario = () => (
  <Icono tamano={16}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icono>
);

export const IconoCheck = () => (
  <Icono tamano={16}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 3 3 5-6" />
  </Icono>
);

export const IconoGrafica = () => (
  <Icono tamano={16}>
    <path d="M4 19h16M7 16v-5M12 16V7M17 16v-8" />
  </Icono>
);

export const IconoMapa = () => (
  <Icono tamano={16}>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
    <path d="M9 4v14M15 6v14" />
  </Icono>
);

export const IconoDocumento = () => (
  <Icono tamano={18}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4M9 13h6M9 17h4" />
  </Icono>
);

export const IconoUsuarios = () => (
  <Icono>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.9-3.5 3.7-5.5 7-5.5s6.1 2 7 5.5" />
  </Icono>
);

export const IconoOjo = () => (
  <Icono tamano={17}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </Icono>
);

export const IconoOjoTachado = () => (
  <Icono tamano={17}>
    <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.3 7.3C3.9 9 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1.1" />
    <path d="M9.9 9.9a2.8 2.8 0 0 0 4 4M3 3l18 18" />
  </Icono>
);
