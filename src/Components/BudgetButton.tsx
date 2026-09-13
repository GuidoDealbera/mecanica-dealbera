import React from "react";
import { Button, Tooltip } from "@heroui/react";
import { MdPictureAsPdf } from "react-icons/md";
import { Cars, Jobs } from "../Types/types";
import { DocumentType } from "../Types/apiTypes";
import { useBudgetPDF } from "../Hooks/useBudgetPdf";
import { useToasts } from "../Hooks/useToasts";
import DocumentModal from "./DocumentModal";

interface BudgetButtonProps {
  car: Cars;
  jobs: Jobs[];
  className?: string;
}

/**
 * Acceso a la emisión de documentos del vehículo. Abre el modal donde se elige
 * el tipo (presupuesto o factura) y qué trabajos entran; antes era un desplegable
 * que emitía de una con todos los trabajos, sin posibilidad de elegir.
 */
const BudgetButton: React.FC<BudgetButtonProps> = ({
  car,
  jobs,
  className,
}) => {
  const { generatePDF, isGenerating } = useBudgetPDF();
  const { showToast } = useToasts();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleConfirm = React.useCallback(
    async (type: DocumentType, selected: Jobs[]) => {
      try {
        const issued = await generatePDF(car, selected, { type });
        // `null` es que el usuario canceló el diálogo de guardado. No es un
        // error: no se avisa nada y el modal queda abierto, que es lo que
        // permite volver a intentar sin rearmar la selección.
        if (!issued) return;
        showToast(
          `Guardado con éxito — N° ${issued.formatted}`,
          "success",
          type === DocumentType.INVOICE ? "Factura" : "Presupuesto"
        );
        setIsOpen(false);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Error al generar el PDF",
          "danger",
          "Generar PDF"
        );
      }
    },
    [car, generatePDF, showToast]
  );

  return (
    <>
      <Tooltip
        content={
          jobs.length === 0
            ? "El vehículo todavía no tiene trabajos"
            : "Emitir presupuesto o factura"
        }
        color="primary"
        placement="bottom"
        showArrow
      >
        <span className={`inline-flex ${className ?? ""}`}>
          <Button
            color="primary"
            startContent={<MdPictureAsPdf size={16} />}
            isDisabled={jobs.length === 0}
            onPress={() => setIsOpen(true)}
          >
            Presupuesto / Factura
          </Button>
        </span>
      </Tooltip>

      <DocumentModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        car={car}
        jobs={jobs}
        isGenerating={isGenerating}
        onConfirm={handleConfirm}
      />
    </>
  );
};

export default BudgetButton;
