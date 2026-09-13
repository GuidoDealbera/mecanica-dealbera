import { Button, Input, Tooltip } from "@heroui/react";
import React from "react";
import { MdDelete } from "react-icons/md";
import { useDebounce } from "../../Hooks/useDebounce";

interface Props {
  onFilterChange: (licence: string) => void;
  initialValue?: string;
}

const FilterByLicence: React.FC<Props> = ({
  onFilterChange,
  initialValue = "",
}) => {
  const [value, setValue] = React.useState<string>(initialValue);
  const [error, setError] = React.useState<string | null>(null);
  const [isValid, setIsValid] = React.useState<boolean>(false);
  const debouncedValue = useDebounce(value, 250);
  const isFirstRender = React.useRef(true);

  const handleFilter = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value.toUpperCase();
      setValue(newValue);
      // Feedback de validación inmediato (no depende del debounce)
      if (newValue === "") {
        setError(null);
        setIsValid(false);
        return;
      }
      const isValidLicence = /^([A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3})$/.test(
        newValue
      );
      const isPartial = newValue.length < 6;
      if (isValidLicence || isPartial) {
        setIsValid(isValidLicence);
        setError(null);
      } else {
        setIsValid(false);
        setError("Formato de patente incorrecto");
      }
    },
    []
  );

  const handleClear = React.useCallback(() => {
    setValue("");
    setError(null);
    setIsValid(false);
  }, []);

  // El filtro efectivo se dispara con el valor debounceado, no en cada tecla.
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onFilterChange(debouncedValue);
  }, [debouncedValue, onFilterChange]);

  return (
    <div className="relative p-1 mt-4 w-fit mb-4">
      <h4 className="text-foreground text-lg">Buscar automóvil por patente</h4>
      <Input
        fullWidth
        value={value}
        onChange={handleFilter}
        isInvalid={!!error}
        errorMessage={error}
        placeholder="ABC123 ó AB123CD"
      />
      {value && (
        <Tooltip
          content="Limpiar filtro"
          color={isValid ? "primary" : "danger"}
          showArrow
        >
          <Button
            className="absolute top-8 -right-10"
            color={isValid ? "primary" : "danger"}
            isIconOnly
            aria-label="Limpiar el filtro de patente"
            type="button"
            onPress={handleClear}
          >
            <MdDelete size={20} />
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

export default FilterByLicence;
