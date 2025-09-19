import { Button, Input, Tooltip } from "@heroui/react";
import React from "react";
import { MdDelete } from "react-icons/md";

interface Props {
  onFilterChange: (licence: string) => void;
}

const FilterByLicence: React.FC<Props> = ({ onFilterChange }) => {
  const [value, setValue] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [isValid, setIsValid] = React.useState<boolean>(false);

  const handleFilter = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value.toUpperCase();
      setValue(newValue);
      const isValidLicence = /^([A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3})$/.test(
        newValue
      );
      if (newValue === "") {
        setError(null);
        onFilterChange("");
        return;
      }
      if (isValidLicence) {
        setIsValid(true);
        setError(null);
        onFilterChange(newValue);
      } else {
        setIsValid(false);
        setError("Formato de patente incorrecto");
      }
    },
    [onFilterChange]
  );
  return (
    <div className="relative p-1 mt-4 w-fit mb-4">
      <h4 className="text-white text-lg">Buscar automóvil por patente</h4>
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
        >
          <Button
            className="absolute top-8 -right-10"
            color={isValid ? 'primary' : 'danger'}
            isIconOnly
            type="button"
            onPress={() => {
              setValue("");
              setError(null);
              onFilterChange("")
            }}
          >
            <MdDelete size={20} />
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

export default FilterByLicence;
