import React from "react";
import { Button, Tooltip } from "@heroui/react";
import { MdPictureAsPdf } from "react-icons/md";
import { Cars, Jobs } from "../Types/types";
import { DocumentType } from "../Types/apiTypes";
import { useBudgetPDF } from "../Hooks/useBudgetPdf";
import { useToasts } from "../Hooks/useToasts";
import DocumentModal from "./DocumentModal";

interface ClientDocumentButtonProps {
  /** Vehículos del cliente, con sus trabajos cargados. */
  cars: Cars[];
  className?: string;
}

/**
 * Emite **un solo** documento con los trabajos de todos los vehículos del
 * cliente.
 *
 * Hasta ahora el presupuesto y la factura eran por vehículo: un cliente con dos
 * autos en el taller se llevaba dos documentos, con dos números, y tenía que
 * sumar a mano.
 */
const ClientDocumentButton: React.FC<ClientDocumentButtonProps> = ({
  cars,
  className,
}) => {
  const { generateClientPDF, isGenerating } = useBudgetPDF();
  const { showToast } = useToasts();
  const [isOpen, setIsOpen] = React.useState(false);

  const jobs = React.useMemo(
    () => cars.flatMap((car) => car.jobs ?? []),
    [cars]
  );

  // Patente de cada trabajo, para mostrarla al lado en la lista del modal: sin
  // eso, un cliente con dos autos ve una lista de trabajos indistinguibles.
  const plateByJob = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const car of cars) {
      for (const job of car.jobs ?? []) map[job.id] = car.licensePlate;
    }
    return map;
  }, [cars]);

  const handleConfirm = React.useCallback(
    async (type: DocumentType, selected: Jobs[]) => {
      try {
        // Sólo entran los vehículos que aportan algún trabajo elegido: listar
        // un auto sin trabajos en el documento sería ruido.
        const seleccionados = new Set(selected.map((job) => job.id));
        const involucrados = cars.filter((car) =>
          (car.jobs ?? []).some((job) => seleccionados.has(job.id))
        );

        const issued = await generateClientPDF(involucrados, selected, {
          type,
        });
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
    [cars, generateClientPDF, showToast]
  );

  const disabled = jobs.length === 0;

  return (
    <>
      <Tooltip
        content={
          disabled
            ? "El cliente todavía no tiene trabajos"
            : "Emitir un documento con los trabajos de todos sus vehículos"
        }
        color="primary"
        placement="bottom"
        showArrow
      >
        <span className={`inline-flex ${className ?? ""}`}>
          <Button
            color="primary"
            variant="flat"
            startContent={<MdPictureAsPdf size={16} />}
            isDisabled={disabled}
            onPress={() => setIsOpen(true)}
          >
            Documento consolidado
          </Button>
        </span>
      </Tooltip>

      {/* `car` es el primer vehículo sólo para que el modal muestre el titular:
          la cabecera del modal se reemplaza por `subtitle`. */}
      <DocumentModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        car={cars[0]}
        jobs={jobs}
        plateByJob={plateByJob}
        subtitle={`${cars[0]?.owner?.fullname ?? "Cliente"} · ${cars.length} vehículo${
          cars.length === 1 ? "" : "s"
        }`}
        isGenerating={isGenerating}
        onConfirm={handleConfirm}
      />
    </>
  );
};

export default ClientDocumentButton;
