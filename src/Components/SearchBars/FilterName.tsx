import { Button, Input, Tooltip } from "@heroui/react";
import React from "react";
import { MdDelete } from "react-icons/md";
import { normalizeText } from "../../Utils/utils";

interface FilterNameProps {
  onFilterChange: (fullname: string) => void;
}

const FilterName: React.FC<FilterNameProps> = ({ onFilterChange }) => {
  const [value, setValue] = React.useState<string>("");

  const handleFilter = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      const normalizedValue = normalizeText(newValue)
      onFilterChange(normalizedValue);
    },
    [onFilterChange]
  );
  return (
    <div className="relative p-1 mt-4 w-fit mb-4">
      <h4 className="text-white text-lg">
        Buscar cliente por nombre o apellido
      </h4>
      <Input
        fullWidth
        value={value}
        onChange={handleFilter}
        placeholder="Nombre o apellido"
      />
      {value && (
        <Tooltip content="Limpiar filtro" color="primary" showArrow>
          <Button
            className="absolute top-8 -right-10"
            color="primary"
            isIconOnly
            type="button"
            onPress={() => {
              setValue("");
              onFilterChange("");
            }}
          >
            <MdDelete size={20} />
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

export default FilterName;
