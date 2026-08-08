import { Button, Input, Tooltip } from "@heroui/react";
import React from "react";
import { MdDelete } from "react-icons/md";
import { useDebounce } from "../../Hooks/useDebounce";

interface FilterNameProps {
  onFilterChange: (fullname: string) => void;
  initialValue?: string;
}

const FilterName: React.FC<FilterNameProps> = ({ onFilterChange, initialValue = "" }) => {
  const [value, setValue] = React.useState<string>(initialValue);
  const debouncedValue = useDebounce(value, 250);
  const isFirstRender = React.useRef(true);

  const handleFilter = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
    },
    [],
  );

  const handleClear = React.useCallback(() => {
    setValue("");
  }, []);

  // El filtro efectivo se dispara con el valor debounceado, no en cada tecla.
  // Se envía el valor crudo: la búsqueda se resuelve server-side con LIKE
  // (case-insensitive), consistente con el resto de las búsquedas.
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onFilterChange(debouncedValue.trim());
  }, [debouncedValue, onFilterChange]);

  return (
    <div className="relative p-1 mt-4 w-fit mb-4">
      <h4 className="text-foreground text-lg">Buscar cliente por nombre o apellido</h4>
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
            onPress={handleClear}
          >
            <MdDelete size={20} />
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

export default FilterName;
