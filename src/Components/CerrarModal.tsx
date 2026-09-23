import React from "react";

/**
 * El botón de cerrar de los modales, con su nombre en castellano.
 *
 * HeroUI le pone `aria-label="Close"` escrito a mano, y el `locale` del
 * provider no lo alcanza: no sale de las traducciones de react-aria. Tampoco
 * deja cambiarlo pasándole un botón propio en `closeButton`, porque lo clona y
 * le **pisa** las props con las suyas.
 *
 * Pero clona lo que se le dé: un componente propio recibe esas props —la clase,
 * el foco, los manejadores que cierran— y puede pisar la etiqueta a su vez. Se
 * usa en todos los modales que muestran la cruz, y lo fija
 * `botonesConNombre.test.ts`.
 *
 * El dibujo es el mismo ícono que usa HeroUI, para que no cambie nada a la
 * vista.
 */
const CerrarModal: React.FC<React.ComponentProps<"button">> = (props) => (
  <button type="button" {...props} aria-label="Cerrar">
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1em"
      role="presentation"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width="1em"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  </button>
);

export default CerrarModal;
