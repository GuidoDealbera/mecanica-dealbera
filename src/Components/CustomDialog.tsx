import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import React from "react";

interface CustomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

const CustomDialog: React.FC<CustomDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  title,
  content,
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
        {/* `whitespace-pre-line` para que los saltos de línea del texto se
            respeten: varios diálogos separan la acción de su advertencia en dos
            párrafos y sin esto quedaban pegados en un bloque. */}
        <ModalBody className="whitespace-pre-line">{content}</ModalBody>
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

export default CustomDialog;
