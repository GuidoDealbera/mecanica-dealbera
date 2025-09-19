import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import React from "react";
import LicenceTable from "./Licenses/LicenceTable";

interface DeleteCarDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  licence: string | null;
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
  licence,
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
        <ModalBody className="flex flex-col justify-center items-center">
          <span className="text-center">Estás por eliminar el vehículo con la siguiente patente</span>
          {!!licence && (
            <div className="flex justify-center">
              <LicenceTable licence={licence} dialog />
            </div>
          )}
          <span className="text-center">
            ¿Estás seguro de querer eliminarlo? Esta acción es irreversible
          </span>
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
