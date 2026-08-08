import React from "react";
import {
  Kbd,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@heroui/react";
import { MdKeyboard } from "react-icons/md";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Una tecla o secuencia de teclas de un atajo. `keys` se renderiza como una
// serie de <Kbd> separados por "luego" cuando es una secuencia.
type Shortcut = { keys: string[]; label: string };

const NAV_SHORTCUTS: Shortcut[] = [
  { keys: ["G", "I"], label: "Ir a Inicio" },
  { keys: ["G", "C"], label: "Ir a Clientes" },
  { keys: ["G", "A"], label: "Ir a Autos" },
  { keys: ["G", "R"], label: "Ir a Recordatorios" },
  { keys: ["G", "D"], label: "Ir a Gestión de datos" },
];

const ACTION_SHORTCUTS: Shortcut[] = [
  { keys: ["Ctrl", "K"], label: "Búsqueda global" },
  { keys: ["/"], label: "Búsqueda global" },
  { keys: ["N"], label: "Nuevo vehículo" },
  { keys: ["?"], label: "Mostrar esta ayuda" },
  { keys: ["Esc"], label: "Cerrar diálogos y búsqueda" },
];

const ShortcutRow: React.FC<{ shortcut: Shortcut }> = ({ shortcut }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <span className="text-foreground-200 text-sm">{shortcut.label}</span>
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {shortcut.keys.map((key, i) => (
        <React.Fragment key={key}>
          {i > 0 && (
            <span className="text-foreground-500 text-xs">luego</span>
          )}
          <Kbd className="bg-content2 text-foreground">{key}</Kbd>
        </React.Fragment>
      ))}
    </div>
  </div>
);

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      backdrop="blur"
      size="md"
      aria-label="Atajos de teclado"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 text-xl font-bold">
          <MdKeyboard size={24} className="text-primary-400" />
          Atajos de teclado
        </ModalHeader>
        <ModalBody className="pb-6">
          <section>
            <h3 className="text-foreground-400 text-xs font-semibold uppercase tracking-wider mb-1">
              Navegación
            </h3>
            <div className="divide-y divide-divider">
              {NAV_SHORTCUTS.map((s) => (
                <ShortcutRow key={s.label} shortcut={s} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-foreground-400 text-xs font-semibold uppercase tracking-wider mb-1">
              Acciones
            </h3>
            <div className="divide-y divide-divider">
              {ACTION_SHORTCUTS.map((s) => (
                <ShortcutRow key={`${s.label}-${s.keys.join("")}`} shortcut={s} />
              ))}
            </div>
          </section>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ShortcutsModal;
