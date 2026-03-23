import React from "react";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Tooltip,
} from "@heroui/react";
import { MdPictureAsPdf } from "react-icons/md";
import { IoChevronDown } from "react-icons/io5";
import { Cars, Jobs } from "../Types/types";
import { useBudgetPDF } from "../Hooks/useBudgetPdf";
import { useToasts } from "../Hooks/useToasts";
import { HiDownload } from "react-icons/hi";

interface BudgetButtonProps {
  car: Cars;
  jobs: Jobs[];
  compact?: boolean;
  className?: string;
}

const BudgetButton: React.FC<BudgetButtonProps> = ({
  car,
  jobs,
  compact = false,
  className,
}) => {
  const { generatePDF, isGenerating } = useBudgetPDF();
  const { showToast } = useToasts();

  const handleGenerate = React.useCallback(
    async (onlyCompleted: boolean) => {
      try {
        await generatePDF(car, jobs, {
          title: onlyCompleted
            ? "Factura de Trabajos"
            : "Presupuesto de Trabajo",
          onlyCompleted,
        });
        showToast(
          "Descargado con éxito",
          "success",
          onlyCompleted ? "Factura" : "Presupuesto",
        );
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Error al generar el PDF",
          "danger",
          "Generar PDF",
        );
      }
    },
    [car, jobs, generatePDF, showToast],
  );

  if (compact) {
    return (
      <Tooltip
        content="Imprimir presupuesto"
        placement="bottom"
        color="primary"
        showArrow
      >
        <Button
          isIconOnly
          color="primary"
          isLoading={isGenerating}
          className={className}
          onPress={() => handleGenerate(false)}
        >
          {!isGenerating && <MdPictureAsPdf size={20} />}
        </Button>
      </Tooltip>
    );
  }

  return (
    <div className={`flex items-center ${className ?? ""}`}>
      <Dropdown isDisabled={isGenerating || jobs.length === 0} showArrow>
        <DropdownTrigger>
          <Button
            color="primary"
            isLoading={isGenerating}
            endContent={<IoChevronDown size={14} />}
            startContent={!isGenerating ? <HiDownload size={14} /> : undefined}
            isDisabled={isGenerating || jobs.length === 0}
          >
            {isGenerating ? "Descargando..." : "Descargar"}
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Opciones de PDF">
          <DropdownItem
            key="all"
            startContent={<MdPictureAsPdf size={16} />}
            description="Incluye todos los trabajos"
            onPress={() => handleGenerate(false)}
          >
            Presupuesto completo
          </DropdownItem>
          <DropdownItem
            key="completed"
            startContent={<MdPictureAsPdf size={16} />}
            description="Solo trabajos completados y entregados"
            onPress={() => handleGenerate(true)}
          >
            Factura (solo completados)
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </div>
  );
};

export default BudgetButton;
