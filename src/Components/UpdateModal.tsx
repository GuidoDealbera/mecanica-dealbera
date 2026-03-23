import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
} from "@heroui/react";
import React from "react";
import { MdSystemUpdate, MdDownload, MdInstallDesktop } from "react-icons/md";

interface UpdateModalProps {
  updateVersion: string;
  progress: number | null;
  downloaded: boolean;
  isOpen: boolean;
  onClose: () => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({
  downloaded,
  isOpen,
  onClose,
  progress,
  updateVersion,
}) => {
  const isDownloading = progress !== null && !downloaded;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      // No permitir cerrar mientras se está descargando
      isDismissable={!isDownloading}
      hideCloseButton={isDownloading}
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <MdSystemUpdate size={20} className="text-primary" />
          Actualización disponible
        </ModalHeader>

        <ModalBody className="gap-4">
          <p className="text-foreground-600">
            Hay una nueva versión disponible:{" "}
            <span className="font-bold text-primary">v{updateVersion}</span>
          </p>

          {/* Estado: esperando que el usuario decida */}
          {progress === null && !downloaded && (
            <p className="text-sm text-foreground-500">
              Podés actualizar ahora o más tarde. La descarga se hace en
              segundo plano y no interrumpe el uso de la aplicación.
            </p>
          )}

          {/* Estado: descargando */}
          {isDownloading && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm text-foreground-500">
                <span>Descargando actualización...</span>
                <span className="font-semibold text-primary">{progress}%</span>
              </div>
              <Progress
                value={progress ?? 0}
                color="primary"
                size="sm"
                aria-label="Progreso de descarga"
                className="w-full"
              />
            </div>
          )}

          {/* Estado: descarga completa */}
          {downloaded && (
            <div className="flex items-center gap-2 p-3 bg-success-50 rounded-lg border border-success-200">
              <MdInstallDesktop size={20} className="text-success-600 shrink-0" />
              <p className="text-sm text-success-700">
                La actualización está lista. Al instalar, la aplicación se
                cerrará y se volverá a abrir con la nueva versión.
              </p>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {/* Estado: esperando que el usuario decida */}
          {!isDownloading && !downloaded && (
            <>
              <Button
                color="primary"
                startContent={<MdDownload size={18} />}
                onPress={() => window.updater.startDownload()}
              >
                Actualizar ahora
              </Button>
              <Button variant="light" onPress={onClose}>
                Más tarde
              </Button>
            </>
          )}

          {/* Estado: descargando — solo se puede esperar */}
          {isDownloading && (
            <Button variant="light" isDisabled>
              Descargando...
            </Button>
          )}

          {/* Estado: listo para instalar */}
          {downloaded && (
            <>
              <Button
                color="success"
                startContent={<MdInstallDesktop size={18} />}
                onPress={() => window.updater.installUpdate()}
              >
                Instalar y reiniciar
              </Button>
              <Button variant="light" onPress={onClose}>
                Instalar al cerrar
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default UpdateModal;