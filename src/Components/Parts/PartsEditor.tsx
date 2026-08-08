import React from "react";
import { Button, Chip, Input, Tooltip } from "@heroui/react";
import { MdAdd, MdDelete } from "react-icons/md";
import { formatARS, formatThousands, parseNumber } from "../../Utils/utils";

type Part = { name: string; price: number };

interface PartsEditorProps {
  parts: Part[];
  onChange: (parts: Part[]) => void;
  isDisabled?: boolean;
  compact?: boolean;
}

/**
 * Componente controlado para agregar/eliminar repuestos en un trabajo.
 * Prop `compact` activa el layout de modal (inputs sm, colores más claros).
 */
const PartsEditor: React.FC<PartsEditorProps> = ({
  parts,
  onChange,
  isDisabled = false,
  compact = false,
}) => {
  const [partName, setPartName] = React.useState("");
  const [partPrice, setPartPrice] = React.useState<number | undefined>(
    undefined,
  );
  const [partNameError, setPartNameError] = React.useState("");
  const [partPriceError, setPartPriceError] = React.useState("");

  const totalParts = parts.reduce((acc, p) => acc + p.price, 0);

  const handleAdd = () => {
    let hasError = false;

    if (!partName.trim()) {
      setPartNameError("Ingresá un nombre");
      hasError = true;
    } else {
      setPartNameError("");
    }

    if (!partPrice || partPrice <= 0) {
      setPartPriceError("Ingresá un precio");
      hasError = true;
    } else {
      setPartPriceError("");
    }

    if (hasError) return;

    onChange([...parts, { name: partName.trim(), price: partPrice! }]);
    setPartName("");
    setPartPrice(undefined);
  };

  const handleRemove = (index: number) => {
    onChange(parts.filter((_, i) => i !== index));
  };

  const inputSize = compact ? ("sm" as const) : undefined;

  return (
    <div className="flex flex-col gap-2">
      {/* Fila de inputs para agregar */}
      <div className="flex gap-2 items-start">
        <Input
          size={inputSize}
          label="Nombre del repuesto"
          value={partName}
          onChange={(e) => {
            setPartName(e.target.value);
            if (e.target.value.trim()) setPartNameError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          isDisabled={isDisabled}
          isInvalid={!!partNameError}
          errorMessage={partNameError}
          className="flex-1"
        />
        <Input
          size={inputSize}
          label="Precio"
          type="text"
          inputMode="numeric"
          startContent={
            <span className="text-foreground-900 font-bold">$</span>
          }
          value={formatThousands(partPrice)}
          onChange={(e) => {
            const val = parseNumber(e.target.value);
            setPartPrice(val || undefined);
            if (val > 0) setPartPriceError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          isDisabled={isDisabled}
          isInvalid={!!partPriceError}
          errorMessage={partPriceError}
          className={compact ? "w-32" : "w-36"}
        />
        <Button
          isIconOnly
          size={inputSize}
          color="primary"
          className="mt-1 shrink-0"
          onPress={handleAdd}
          isDisabled={isDisabled}
        >
          <MdAdd size={compact ? 18 : 20} />
        </Button>
      </div>

      {/* Lista de repuestos */}
      <div
        className={
          compact
            ? "flex flex-col gap-2 max-h-50 overflow-auto pr-1"
            : `flex flex-col gap-2 ${totalParts > 0 ? "h-45" : "h-59"} overflow-auto`
        }
      >
        {parts.length === 0 ? (
          <div
            className={`flex items-center justify-center text-foreground-400 border border-dashed border-default-400 rounded-lg ${compact ? "text-xs py-4" : "flex-1 text-sm py-8"}`}
          >
            No hay repuestos agregados
          </div>
        ) : (
          parts.map((part, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-3 rounded-md ${
                compact
                  ? "py-1.5 bg-default-100"
                  : "py-2 bg-content3 border border-default-400"
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Chip
                  size="sm"
                  color="primary"
                  variant="flat"
                  className={compact ? "text-primary" : "text-primary"}
                >
                  {i + 1}
                </Chip>
                <span className="text-sm truncate">{part.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span
                  className={`text-sm font-medium ${compact ? "text-primary-600" : "text-primary"}`}
                >
                  {formatARS(part.price)}
                </span>
                <Tooltip
                  color="danger"
                  content="Eliminar repuesto"
                  showArrow
                  placement="left"
                >
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    color="danger"
                    className="text-danger"
                    onPress={() => handleRemove(i)}
                    isDisabled={isDisabled}
                  >
                    <MdDelete size={compact ? 15 : 16} />
                  </Button>
                </Tooltip>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Total repuestos */}
      {totalParts > 0 && (
        <div
          className={`flex justify-between items-center px-3 py-2 rounded-md border border-primary-700 mt-1 ${
            compact ? "bg-default-200" : "bg-primary-900"
          }`}
        >
          <span
            className={`text-sm ${compact ? "" : "text-primary-100"}`}
          >
            Total repuestos{" "}
            <Chip
              color="primary"
              size="sm"
              variant="flat"
              className="text-primary"
            >
              {parts.length}
            </Chip>
          </span>
          <span
            className={`font-semibold ${compact ? "text-sm text-primary-600" : "text-primary-300"}`}
          >
            {formatARS(totalParts)}
          </span>
        </div>
      )}
    </div>
  );
};

export default PartsEditor;
