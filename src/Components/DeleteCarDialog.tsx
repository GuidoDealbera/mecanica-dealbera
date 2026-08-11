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
import { MdInfoOutline, MdWarning } from "react-icons/md";
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
          <span className="text-center text-foreground-400">
            Estás por eliminar este vehículo:
          </span>
          {car && (
            <div className="flex flex-col items-center gap-2">
              <LicenceTable licence={car.licensePlate} dialog />
              <div className="flex items-center gap-2">
                <span className="text-foreground-700 font-semibold">
                  {car.brand} {car.model}
                </span>
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="text-primary"
                >
                  {car.year}
                </Chip>
              </div>
              <span className="text-foreground-600 text-sm">
                Titular: {car.owner?.fullname ?? "—"}
              </span>
            </div>
          )}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-danger border border-danger-600">
            <MdWarning size={18} className="text-white flex-shrink-0 mt-0.5" />
            <p className="text-white text-sm">
              Se eliminarán también todos sus trabajos, el historial de
              kilometraje y su recordatorio de service. Esta acción es{" "}
              <span className="font-bold">irreversible</span>.
            </p>
          </div>
          {/* Qué NO se borra: el titular se conserva aunque este sea su único
              vehículo. Decirlo evita la duda de si borrar el auto se lleva al
              cliente (antes se lo llevaba, y sin avisar). */}
          {car?.owner?.fullname && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <MdInfoOutline
                size={18}
                className="text-primary flex-shrink-0 mt-0.5"
              />
              <p className="text-foreground-500 text-sm">
                <span className="text-foreground font-semibold">
                  {car.owner.fullname}
                </span>{" "}
                se conserva como cliente. Si querés darlo de baja, podés hacerlo
                desde la pantalla de Clientes.
              </p>
            </div>
          )}
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
