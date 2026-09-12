import { useState } from "react";
import { useBlocker } from "react-router-dom";
import { useDisclosure } from "@heroui/react";

type FormGuardProps = {
  isDirty: boolean;
  onConfirm: () => void;
};

export const useFormGuard = ({ isDirty, onConfirm }: FormGuardProps) => {
  const [nextLocation, setNextLocation] = useState<string | null>(null);
  const { isOpen, onClose, onOpen } = useDisclosure();

  const blocker = useBlocker((tx) => {
    if (
      !isDirty ||
      (tx.nextLocation.state as { bypassGuard?: boolean } | null)?.bypassGuard
    ) {
      return false;
    }
    setNextLocation(tx.nextLocation.pathname);
    onOpen();
    return true;
  });

  const confirmNavigation = () => {
    if (nextLocation) {
      onClose();
      onConfirm();
      blocker.proceed?.();
    }
  };

  const cancelNavigation = () => {
    onClose();
    setNextLocation(null);
    // `useBlocker` deja el bloqueador en estado `blocked` hasta que se llame a
    // `proceed()` o a `reset()`. Sin este `reset`, quedarse en el formulario lo
    // dejaba trabado: el siguiente intento de salir no volvía a preguntar,
    // porque para React Router seguía habiendo una navegación pendiente.
    blocker.reset?.();
  };

  return {
    isOpen,
    confirmNavigation,
    cancelNavigation,
  };
};
