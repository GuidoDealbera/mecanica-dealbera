import { useState } from "react";
import { useBlocker } from "react-router-dom";
import { getByPassNavigation, setByPassNavigation } from "../Utils/utils";
import { useDisclosure } from "@heroui/react";

type FormGuardProps = {
  isDirty: boolean;
  onConfirm: () => void;
};

export const useFormGuard = ({ isDirty, onConfirm }: FormGuardProps) => {
  const [nextLocation, setNextLocation] = useState<string | null>(null);
  const {isOpen, onClose, onOpen} = useDisclosure()

  const blocker = useBlocker((tx) => {
    if (!isDirty || getByPassNavigation()) {
      setByPassNavigation(false);
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
  };

  return {
    isOpen,
    confirmNavigation,
    cancelNavigation,
  };
};
