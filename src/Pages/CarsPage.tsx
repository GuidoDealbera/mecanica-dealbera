import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useCarQueries } from "../Hooks/useCarQueries";
import CarsTable from "../Components/Tables/CarsTable";
import { Button, useDisclosure } from "@heroui/react";
import { HiOutlineRefresh } from "react-icons/hi";
import { IoIosAddCircleOutline } from "react-icons/io";
import { IoCarSportSharp, IoSearch } from "react-icons/io5";
import { useNavigate, useSearchParams } from "react-router-dom";
import DeleteCarDialog from "../Components/DeleteCarDialog";
import FilterByLicence from "../Components/SearchBars/FilterLicence";
import EmptyState from "../Components/EmptyState";
import { CarQueryParams } from "../Types/apiTypes";
import { Cars } from "../Types/types";

const PAGE_SIZE = 8;

const CarsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const licenceFilter = searchParams.get("q") ?? "";
  const { isOpen: isDeleteDialogOpen, onClose, onOpen } = useDisclosure();
  const [carToDelete, setCarToDelete] = useState<Cars | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ by: string | null; dir: "asc" | "desc" }>({
    by: null,
    dir: "asc",
  });

  const {
    list,
    refreshing,
    listLoading,
    getCars,
    cleanCars,
    clearError,
    deleteOneCar,
    refresh,
  } = useCarQueries();

  // Parámetros de la consulta paginada. Al cambiar, se dispara el fetch.
  const params = useMemo<CarQueryParams>(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: licenceFilter || undefined,
      sortBy: sort.by ?? undefined,
      sortDir: sort.dir,
    }),
    [page, licenceFilter, sort],
  );

  useEffect(() => {
    getCars(params);
  }, [getCars, params]);

  // Si la página actual quedó vacía pero hay resultados (p.ej. se borró el
  // último item de la última página), retrocede una página. Autocorrige.
  useEffect(() => {
    if (!listLoading && list.total > 0 && list.items.length === 0 && page > 1) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [listLoading, list.total, list.items.length, page]);

  // Limpieza al desmontar (evita que se vea data vieja al volver a entrar).
  useEffect(() => {
    return () => {
      cleanCars();
      clearError();
    };
  }, [cleanCars, clearError]);

  const handleOpenDeleteDialog = useCallback(
    (licence: string) => {
      setCarToDelete(list.items.find((c) => c.licensePlate === licence) ?? null);
      onOpen();
    },
    [onOpen, list.items]
  );

  const handleConfirmDelete = async () => {
    if (!carToDelete) return;
    await deleteOneCar(carToDelete.licensePlate);
    await getCars(params);
    onClose();
  };

  const handleCancelDelete = useCallback(() => {
    setCarToDelete(null);
    onClose();
  }, [onClose]);

  const handleLicenceFilterChange = useCallback(
    (v: string) => {
      // replace: true para que filtrar no apile entradas de historial
      // (evita tener que hacer varios clicks en el botón "Atrás").
      if (v) setSearchParams({ q: v }, { replace: true });
      else setSearchParams({}, { replace: true });
      setPage(1);
    },
    [setSearchParams],
  );

  // Ciclo de orden por columna: asc → desc → sin orden.
  const handleSortChange = useCallback((columnKey: string) => {
    setSort((prev) => {
      if (prev.by !== columnKey) return { by: columnKey, dir: "asc" };
      if (prev.dir === "asc") return { by: columnKey, dir: "desc" };
      return { by: null, dir: "asc" };
    });
    setPage(1);
  }, []);

  const emptyContent = licenceFilter ? (
    <EmptyState
      icon={<IoSearch size={28} />}
      title="Sin resultados"
      description="No hay vehículos que coincidan con la búsqueda."
    />
  ) : (
    <EmptyState
      icon={<IoCarSportSharp size={28} />}
      title="No hay vehículos registrados"
      description="Registrá el primer vehículo para empezar a gestionarlos."
      action={{
        label: "Nuevo vehículo",
        icon: <IoIosAddCircleOutline size={20} />,
        onPress: () => navigate("/cars/new"),
      }}
    />
  );

  return (
    <div className="w-full h-full shadow shadow-primary bg-foreground-800 rounded-md p-3">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-white font-semibold text-4xl text-shadow-2xs text-shadow-primary">
          Listado de vehículos
        </h4>
        <div className="flex justify-center items-center gap-2">
          <Button
            isLoading={listLoading}
            startContent={
              !listLoading ? <HiOutlineRefresh size={20} /> : undefined
            }
            color="primary"
            className="font-bold"
            onPress={() => refresh(params)}
          >
            {refreshing
              ? "Actualizando"
              : listLoading
                ? "Cargando..."
                : "Actualizar"}
          </Button>
          <Button
            isDisabled={listLoading}
            startContent={<IoIosAddCircleOutline size={22} />}
            color="primary"
            className="font-bold"
            onPress={() => navigate("/cars/new")}
          >
            Nuevo vehículo
          </Button>
        </div>
      </div>
      <FilterByLicence
        initialValue={licenceFilter}
        onFilterChange={handleLicenceFilterChange}
      />
      <CarsTable
        cars={list.items}
        isLoading={listLoading}
        emptyContent={emptyContent}
        deleteCar={handleOpenDeleteDialog}
        page={page}
        pageSize={PAGE_SIZE}
        total={list.total}
        onPageChange={setPage}
        sortBy={sort.by}
        sortDir={sort.dir}
        onSortChange={handleSortChange}
      />
      <DeleteCarDialog
        isOpen={isDeleteDialogOpen}
        onClose={onClose}
        onConfirm={handleConfirmDelete}
        car={carToDelete}
        onCancel={handleCancelDelete}
        title="Eliminar automóvil"
      />
    </div>
  );
};

export default CarsPage;
