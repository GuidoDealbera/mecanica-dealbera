import React from "react";
import { useLocation } from "react-router-dom";
import { Button, Input, Pagination } from "@heroui/react";
import { IoSearch } from "react-icons/io5";
import { MdCheckCircle, MdClose } from "react-icons/md";
import AddJobForm from "../Components/Forms/AddJobForm";
import { useCarQueries } from "../Hooks/useCarQueries";
import { useDebounce } from "../Hooks/useDebounce";
import CarsList from "./Components/CarsList";
import { CarQueryParams, CreateCarJob } from "../Types/apiTypes";
import { Cars } from "../Types/types";

const PICKER_PAGE_SIZE = 12;

const AddJobPage: React.FC = () => {
  const { state } = useLocation();
  const { list, listLoading, loadingStates, addCarJob, getCars, cleanCars } =
    useCarQueries();
  // Se puede llegar con un vehículo ya elegido desde su ficha; en ese caso sólo
  // viaja la patente. Se toma como valor inicial, igual que el buscador.
  const [selectedLicense, setSelectedLicense] = React.useState<string>(
    () => state?.license ?? ""
  );
  // El vehículo elegido se guarda entero, no sólo la patente: hace falta para
  // el resumen de arriba, que tiene que seguir visible aunque el auto ya no esté
  // en la página del listado que se está viendo.
  const [pickedCar, setPickedCar] = React.useState<Cars | null>(null);
  const [search, setSearch] = React.useState<string>(
    () => state?.license ?? ""
  );
  const [page, setPage] = React.useState(1);
  const debouncedSearch = useDebounce(search, 250);

  const params = React.useMemo<CarQueryParams>(
    () => ({
      page,
      pageSize: PICKER_PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
    }),
    [page, debouncedSearch]
  );

  React.useEffect(() => {
    getCars(params);
  }, [getCars, params]);

  React.useEffect(() => {
    return () => cleanCars();
  }, [cleanCars]);

  // Los datos del vehículo elegido salen del listado en curso, y si ahí no está
  // —porque se cambió de página— del que se guardó al elegirlo. Antes esto era
  // un efecto que completaba el estado en cuanto el auto aparecía en el
  // listado, con el render en cascada que eso implica; derivarlo cubre los dos
  // casos, incluido el de llegar con la patente ya elegida desde su ficha.
  const selectedCar =
    list.items.find((car) => car.licensePlate === selectedLicense) ??
    pickedCar ??
    null;

  const handleSelect = (license: string) => {
    setSelectedLicense(license);
    setPickedCar(
      list.items.find((car) => car.licensePlate === license) ?? null
    );
  };

  const handleClearSelection = () => {
    setSelectedLicense("");
    setPickedCar(null);
  };

  const handleSubmit = async (data: CreateCarJob) => {
    return await addCarJob(selectedLicense, data);
  };

  const pages = Math.max(1, Math.ceil(list.total / PICKER_PAGE_SIZE));

  return (
    <div className="text-foreground shadow shadow-primary bg-content1 rounded-md p-3 h-full min-h-0 overflow-y-auto overflow-x-hidden">
      <h4 className="mb-1 font-semibold text-4xl text-shadow-2xs text-shadow-primary">
        Registrar nuevo trabajo
      </h4>
      <h5 className="mt-4 mb-2 font-semibold w-fit text-2xl py-2 px-4 bg-primary-700 text-white rounded-md shadow shadow-primary-500">
        Seleccione un automóvil
      </h5>

      <Input
        className="max-w-xs"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value.toUpperCase());
          setPage(1);
        }}
        placeholder="Buscar por patente..."
        startContent={<IoSearch className="text-foreground-400" />}
        isClearable
        onClear={() => {
          setSearch("");
          setPage(1);
        }}
      />

      {/* Resumen del vehículo elegido. Se muestra siempre que haya una
          selección, sin depender de que la tarjeta esté en la página visible:
          antes, si el auto no caía en la primera página, no se veía nada
          marcado y parecía que no se había seleccionado. */}
      {selectedLicense && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border-2 border-primary-400 bg-primary-700 px-4 py-3 text-white shadow shadow-primary-900/40">
          <MdCheckCircle size={20} className="flex-shrink-0" />
          <div className="flex flex-col">
            <span className="text-xs text-primary-200">
              Vehículo seleccionado
            </span>
            <span className="text-lg font-semibold tracking-wide">
              {selectedLicense}
            </span>
          </div>
          {selectedCar && (
            <>
              <div className="flex flex-col">
                <span className="text-xs text-primary-200">Vehículo</span>
                <span className="text-sm font-medium">
                  {selectedCar.brand} {selectedCar.model} ({selectedCar.year})
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-primary-200">Titular</span>
                <span className="text-sm font-medium">
                  {selectedCar.owner?.fullname ?? "---"}
                </span>
              </div>
            </>
          )}
          <Button
            size="sm"
            variant="flat"
            className="ml-auto bg-primary-600 text-white"
            startContent={<MdClose size={16} />}
            onPress={handleClearSelection}
          >
            Quitar
          </Button>
        </div>
      )}

      {/* `listLoading` incluye "todavía no se pidió", así que no aparece el
          estado vacío por un frame antes de que arranque la primera consulta. */}
      <CarsList
        cars={list.items}
        selectedLicense={selectedLicense}
        onSelect={handleSelect}
        isLoading={listLoading}
        skeletonCount={PICKER_PAGE_SIZE}
      />

      {pages > 1 && (
        <div className="flex justify-center mt-4">
          <Pagination
            showControls
            showShadow
            page={page}
            total={pages}
            onChange={setPage}
          />
        </div>
      )}

      {/* Sólo el alta del trabajo bloquea el formulario: con el `loading`
          general, paginar el selector deshabilitaba los campos. */}
      <AddJobForm
        license={selectedLicense}
        onSubmit={handleSubmit}
        isLoading={loadingStates.creating}
      />
    </div>
  );
};

export default AddJobPage;
