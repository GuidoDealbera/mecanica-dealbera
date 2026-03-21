import React from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { KmRecord } from "../../Types/types";

interface KmHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  kmHistory: KmRecord[];
  currentKm: number;
  licensePlate: string;
}

const KmHistoryModal: React.FC<KmHistoryModalProps> = ({
  isOpen,
  onClose,
  kmHistory,
  currentKm,
  licensePlate,
}) => {
  const sorted = React.useMemo(
    () => [...(kmHistory ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [kmHistory]
  );

  const maxKm = sorted.length > 0 ? Math.max(...sorted.map((r) => r.km)) : currentKm;
  const minKm = sorted.length > 0 ? Math.min(...sorted.map((r) => r.km)) : 0;
  const range = maxKm - minKm || 1;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" placement="center" backdrop="blur">
      <ModalContent>
        <ModalHeader className="text-xl font-bold">
          Historial de kilometraje — {licensePlate}
        </ModalHeader>
        <ModalBody className="max-h-96 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-center text-foreground-400 py-8">
              Sin registros de kilometraje
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((record, i) => {
                const prev = sorted[i + 1];
                const diff = prev ? record.km - prev.km : null;
                const barWidth = ((record.km - minKm) / range) * 100;

                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="text-xs text-foreground-400 w-28 flex-shrink-0 text-right">
                      {formatDate(record.date)}
                    </div>
                    <div className="flex-1 relative h-8 bg-foreground-700 rounded overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded transition-all"
                        style={{ width: `${Math.max(barWidth, 4)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 text-white text-xs font-semibold">
                        {record.km.toLocaleString("es-AR")} km
                      </span>
                    </div>
                    {diff !== null && (
                      <div className="text-xs w-20 text-right flex-shrink-0">
                        <span className={diff > 0 ? "text-success-400" : "text-foreground-500"}>
                          {diff > 0 ? `+${diff.toLocaleString("es-AR")}` : "---"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ModalBody>
        <ModalFooter className="flex justify-between items-center">
          <span className="text-sm text-foreground-400">
            Total registros: <strong>{sorted.length}</strong>
          </span>
          <Button color="primary" onPress={onClose}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default KmHistoryModal;
