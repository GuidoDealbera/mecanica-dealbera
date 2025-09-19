import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useCarQueries } from "../Hooks/useCarQueries";
import CarsTable from "../Components/Tables/CarsTable";
import { Button, useDisclosure } from "@heroui/react";
import { HiOutlineRefresh } from "react-icons/hi";
import { IoIosAddCircleOutline } from "react-icons/io";
import { useNavigate } from "react-router-dom";
import DeleteCarDialog from "../Components/DeleteCarDialog";
import FilterByLicence from "../Components/SearchBars/FilterLicence";

const CarsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isOpen: isDeleteDialogOpen, onClose, onOpen } = useDisclosure();
  const [selectedLicenceToDelete, setSelectedLicenceToDelete] = useState<
    string | null
  >(null);
  const [licenceFilter, setLicenceFilter] = useState<string>("");

  const {
    allCars,
    loading,
    refreshing,
    getAllCars,
    cleanCars,
    clearError,
    deleteOneCar,
    refresh,
  } = useCarQueries();

  const handleOpenDeleteDialog = useCallback(
    (licence: string) => {
      setSelectedLicenceToDelete(licence);
      onOpen();
    },
    [onOpen]
  );

  const handleConfirmDelete = async () => {
    if (selectedLicenceToDelete) {
      await deleteOneCar(selectedLicenceToDelete);
      await getAllCars();
      onClose();
    }
  };
  const handleCancelDelete = useCallback(() => {
    setSelectedLicenceToDelete(null);
    onClose();
  }, [onClose]);

  const filteredCars = useMemo(() => {
    if (!licenceFilter) return allCars;
    return allCars.filter((car) =>
      car.licensePlate
        .toLowerCase()
        .trim()
        .includes(licenceFilter.toLowerCase().trim())
    );
  }, [allCars, licenceFilter]);

  useEffect(() => {
    getAllCars();

    return () => {
      cleanCars();
      clearError();
    };
  }, [getAllCars, cleanCars, clearError]);

  const isLoading = loading || refreshing;
  return (
    <div className="w-full h-full shadow shadow-primary bg-foreground-800 rounded-md p-3">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-white font-semibold text-4xl text-shadow-2xs text-shadow-primary">
          Listado de vehículos
        </h4>
        <div className="flex justify-center items-center gap-2">
          <Button
            isLoading={isLoading}
            startContent={
              !isLoading ? <HiOutlineRefresh size={20} /> : undefined
            }
            color="primary"
            className="font-bold"
            onPress={refresh}
          >
            {loading && !refreshing
              ? "Cargando..."
              : refreshing && !loading
              ? "Actualizando"
              : "Actualizar"}
          </Button>
          <Button
            isDisabled={isLoading}
            startContent={<IoIosAddCircleOutline size={22} />}
            color="primary"
            className="font-bold"
            onPress={() => navigate("/cars/new")}
          >
            Nuevo vehículo
          </Button>
        </div>
      </div>
      <FilterByLicence onFilterChange={setLicenceFilter} />
      <CarsTable
        cars={filteredCars}
        isLoading={isLoading}
        noRowsLabel={
          licenceFilter
            ? "No hay vehículos coincidentes con la búsqueda"
            : "No hay vehículos registrados"
        }
        deleteCar={handleOpenDeleteDialog}
      />
      <DeleteCarDialog
        isOpen={isDeleteDialogOpen}
        onClose={onClose}
        onConfirm={handleConfirmDelete}
        licence={selectedLicenceToDelete}
        onCancel={handleCancelDelete}
        title="Eliminar automóvil"
      />
    </div>
  );
};

export default CarsPage;
