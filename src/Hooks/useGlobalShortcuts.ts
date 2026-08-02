import { useEffect, useRef } from "react";

// Atajos de navegación por secuencia: se presiona "g" y luego la inicial de la
// sección (en español). Evita disparos accidentales y no colisiona con la
// edición de texto ni con la barra de menú (que se activa con Alt en Windows).
const NAV_KEYS: Record<string, string> = {
  i: "/", // Inicio
  c: "/clients", // Clientes
  a: "/cars", // Autos
  r: "/alerts", // Recordatorios de service
  d: "/backup", // Datos (backup)
};

// Ventana de tiempo (ms) para completar la secuencia "g" + inicial.
const SEQUENCE_TIMEOUT = 900;

export interface GlobalShortcutHandlers {
  /** Abrir la búsqueda global. */
  onSearch: () => void;
  /** Abrir el modal de ayuda de atajos. */
  onHelp: () => void;
  /** Navegar a una ruta (para los atajos de navegación). */
  onNavigate: (path: string) => void;
  /** Ir al alta de un nuevo vehículo. */
  onNewCar: () => void;
}

// Determina si el foco está en un campo editable; en ese caso los atajos de
// tecla simple no deben dispararse (para no robar la escritura del usuario).
const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
};

// Hay un modal/diálogo abierto: los atajos de navegación/acción se suspenden
// para no navegar "por detrás" del diálogo (cada modal maneja su propio Esc).
const isModalOpen = (): boolean =>
  document.querySelector('[aria-modal="true"]') !== null;

/**
 * Registra un único listener global de teclado con todos los atajos del
 * sistema. Los handlers se leen desde una ref para no re-suscribir el listener
 * en cada render (evita perder el estado de la secuencia en curso).
 */
export const useGlobalShortcuts = (handlers: GlobalShortcutHandlers): void => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    // Estado de la secuencia de navegación ("g" pendiente de segunda tecla).
    let awaitingNavKey = false;
    let sequenceTimer: ReturnType<typeof setTimeout> | undefined;

    const resetSequence = () => {
      awaitingNavKey = false;
      if (sequenceTimer) {
        clearTimeout(sequenceTimer);
        sequenceTimer = undefined;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;

      // Ctrl/Cmd+K abre la búsqueda siempre, incluso escribiendo en un campo.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        resetSequence();
        h.onSearch();
        return;
      }

      // El resto de atajos ignora eventos con modificadores, dentro de campos
      // editables o mientras haya un modal/diálogo abierto.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (isModalOpen()) {
        resetSequence();
        return;
      }

      // Segunda tecla de la secuencia de navegación.
      if (awaitingNavKey) {
        const path = NAV_KEYS[e.key.toLowerCase()];
        resetSequence();
        if (path) {
          e.preventDefault();
          h.onNavigate(path);
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case "g":
          awaitingNavKey = true;
          sequenceTimer = setTimeout(resetSequence, SEQUENCE_TIMEOUT);
          break;
        case "/":
          e.preventDefault();
          h.onSearch();
          break;
        case "?":
          e.preventDefault();
          h.onHelp();
          break;
        case "n":
          e.preventDefault();
          h.onNewCar();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      resetSequence();
    };
  }, []);
};
