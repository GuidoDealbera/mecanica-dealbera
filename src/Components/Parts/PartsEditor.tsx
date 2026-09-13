import React from "react";
import { Button, Chip, Input, Tooltip } from "@heroui/react";
import { MdAdd, MdCheck, MdClose, MdDelete, MdEdit } from "react-icons/md";
import {
  formatARS,
  formatThousands,
  normalizeText,
  parseNumber,
} from "../../Utils/utils";

/**
 * Techo del precio de un repuesto.
 *
 * No hay repuesto de cien millones: un número así es un cero de más, y sin
 * techo pasa derecho al total del presupuesto.
 */
const PRECIO_MAXIMO = 100_000_000;

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
    undefined
  );
  const [partNameError, setPartNameError] = React.useState("");
  const [partPriceError, setPartPriceError] = React.useState("");
  /**
   * Qué repuesto se está corrigiendo, o `null` si se está agregando uno nuevo.
   *
   * Antes sólo se podía agregar y borrar: corregir el precio de un repuesto
   * obligaba a borrarlo y volver a cargarlo, con el nombre otra vez.
   */
  const [editando, setEditando] = React.useState<number | null>(null);

  const totalParts = parts.reduce((acc, p) => acc + p.price, 0);

  const limpiar = () => {
    setPartName("");
    setPartPrice(undefined);
    setPartNameError("");
    setPartPriceError("");
    setEditando(null);
  };

  const handleAdd = () => {
    let hasError = false;
    const nombre = partName.trim();

    if (!nombre) {
      setPartNameError("Ingresá un nombre");
      hasError = true;
    } else if (
      // Repetido: casi siempre es cargar dos veces lo mismo sin darse cuenta, y
      // el documento saldría con el renglón duplicado. Se compara sin acentos ni
      // mayúsculas, que es como lo ve el que lo lee.
      parts.some(
        (p, i) =>
          i !== editando && normalizeText(p.name) === normalizeText(nombre)
      )
    ) {
      setPartNameError("Ya agregaste un repuesto con ese nombre");
      hasError = true;
    } else {
      setPartNameError("");
    }

    if (!partPrice || partPrice <= 0) {
      setPartPriceError("Ingresá un precio");
      hasError = true;
    } else if (partPrice > PRECIO_MAXIMO) {
      // Sin techo, un cero de más pasa derecho al total del presupuesto.
      setPartPriceError("Ese precio parece un error de tipeo");
      hasError = true;
    } else {
      setPartPriceError("");
    }

    if (hasError) return;

    const repuesto = { name: nombre, price: partPrice! };
    onChange(
      editando === null
        ? [...parts, repuesto]
        : parts.map((p, i) => (i === editando ? repuesto : p))
    );
    limpiar();
  };

  const handleEdit = (index: number) => {
    setEditando(index);
    setPartName(parts[index].name);
    setPartPrice(parts[index].price);
    setPartNameError("");
    setPartPriceError("");
  };

  const handleRemove = (index: number) => {
    // Si se borra el que se estaba corrigiendo, el formulario vuelve a "agregar":
    // si no, el índice quedaría apuntando a otro repuesto.
    if (editando === index) limpiar();
    else if (editando !== null && index < editando) setEditando(editando - 1);
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
          aria-label={
            editando === null ? "Agregar repuesto" : "Guardar el repuesto"
          }
          size={inputSize}
          color="primary"
          className="mt-1 shrink-0"
          onPress={handleAdd}
          isDisabled={isDisabled}
        >
          {editando === null ? (
            <MdAdd size={compact ? 18 : 20} />
          ) : (
            <MdCheck size={compact ? 18 : 20} />
          )}
        </Button>
        {editando !== null && (
          <Button
            isIconOnly
            aria-label="Cancelar la corrección"
            size={inputSize}
            variant="flat"
            className="mt-1 shrink-0"
            onPress={limpiar}
            isDisabled={isDisabled}
          >
            <MdClose size={compact ? 18 : 20} />
          </Button>
        )}
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
                <Tooltip color="primary" content="Corregir" showArrow>
                  <Button
                    isIconOnly
                    aria-label={`Corregir ${part.name}`}
                    size="sm"
                    variant="flat"
                    onPress={() => handleEdit(i)}
                    isDisabled={isDisabled}
                  >
                    <MdEdit size={compact ? 15 : 16} />
                  </Button>
                </Tooltip>
                <Tooltip
                  color="danger"
                  content="Eliminar repuesto"
                  showArrow
                  placement="left"
                >
                  <Button
                    isIconOnly
                    // Con el nombre del repuesto: en una lista de cinco, "botón
                    // eliminar" cinco veces no le sirve a nadie.
                    aria-label={`Eliminar ${part.name}`}
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
          <span className={`text-sm ${compact ? "" : "text-primary-100"}`}>
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
