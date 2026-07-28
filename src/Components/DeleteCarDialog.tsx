import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import React from "react";
import { MdWarning } from "react-icons/md";
import LicenceTable from "./Licenses/LicenceTable";
import { Cars } from "../Types/types";

interface DeleteCarDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  car: Cars | null;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

const DeleteCarDialog: React.FC<DeleteCarDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  title,
  car,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isLoading,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      placement="center"
      hideCloseButton
      backdrop="blur"
    >
      <ModalContent>
        <ModalHeader className="text-xl font-bold">{title}</ModalHeader>
        <ModalBody className="flex flex-col gap-3">
          <span className="text-center text-foreground-300">
            Estás por eliminar este vehículo:
          </span>
          {car && (
            <div className="flex flex-col items-center gap-2">
              <LicenceTable licence={car.licensePlate} dialog />
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">
                  {car.brand} {car.model}
                </span>
                <Chip size="sm" variant="flat" color="primary" className="text-primary">
                  {car.year}
                </Chip>
              </div>
              <span className="text-foreground-400 text-sm">
                Titular: {car.owner?.fullname ?? "—"}
              </span>
            </div>
          )}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-danger-900/30 border border-danger-700/50">
            <MdWarning size={18} className="text-danger-400 flex-shrink-0 mt-0.5" />
            <p className="text-danger-300 text-sm">
              Se eliminarán también todos sus trabajos y el historial de
              kilometraje. Esta acción es{" "}
              <span className="font-semibold">irreversible</span>.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onPress={onCancel || onClose} color="danger">
            {cancelText}
          </Button>
          <Button onPress={onConfirm} isLoading={isLoading} color="primary">
            {confirmText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default DeleteCarDialog;
