import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useCarQueries } from "../Hooks/useCarQueries";
import CarsTable from "../Components/Tables/CarsTable";
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Input,
  useDisclosure,
} from "@heroui/react";
import { HiOutlineRefresh } from "react-icons/hi";
import { IoIosAddCircleOutline } from "react-icons/io";
import { IoCarSportSharp, IoSearch } from "react-icons/io5";
import { useNavigate, useSearchParams } from "react-router-dom";
import DeleteCarDialog from "../Components/DeleteCarDialog";
import FilterByLicence from "../Components/SearchBars/FilterLicence";
import EmptyState from "../Components/EmptyState";
import PageShell from "../Components/PageShell";
import { useDebounce } from "../Hooks/useDebounce";
import { BRANDS_OPTIONS } from "../Utils/utils";
import { clampPage } from "../Utils/pagination";
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
  // Filtros avanzados
  const [brand, setBrand] = useState<string>("");
  const [yearFrom, setYearFrom] = useState<string>("");
  const [yearTo, setYearTo] = useState<string>("");
  // Los años se debouncean para no disparar un fetch por cada tecla.
  const debouncedYearFrom = useDebounce(yearFrom, 350);
  const debouncedYearTo = useDebounce(yearTo, 350);

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

  // La página pedida, acotada a la última que existe. Se deriva al leer en vez
  // de corregirse después con un efecto: ver `clampPage`.
  const effectivePage = clampPage(page, list.total, PAGE_SIZE);

  // Parámetros de la consulta paginada. Al cambiar, se dispara el fetch.
  const params = useMemo<CarQueryParams>(
    () => ({
      page: effectivePage,
      pageSize: PAGE_SIZE,
      search: licenceFilter || undefined,
      brand: brand || undefined,
      yearFrom: debouncedYearFrom ? Number(debouncedYearFrom) : undefined,
      yearTo: debouncedYearTo ? Number(debouncedYearTo) : undefined,
      sortBy: sort.by ?? undefined,
      sortDir: sort.dir,
    }),
    [
      effectivePage,
      licenceFilter,
      brand,
      debouncedYearFrom,
      debouncedYearTo,
      sort,
    ]
  );

  useEffect(() => {
    getCars(params);
  }, [getCars, params]);

  // Limpieza al desmontar (evita que se vea data vieja al volver a entrar).
  useEffect(() => {
    return () => {
      cleanCars();
      clearError();
    };
  }, [cleanCars, clearError]);

  const handleOpenDeleteDialog = useCallback(
    (licence: string) => {
      setCarToDelete(
        list.items.find((c) => c.licensePlate === licence) ?? null
      );
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
    [setSearchParams]
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

  const handleBrandChange = useCallback((v: string) => {
    setBrand(v);
    setPage(1);
  }, []);

  const handleYearFromChange = useCallback((v: string) => {
    setYearFrom(v.replace(/\D/g, "").slice(0, 4));
    setPage(1);
  }, []);

  const handleYearToChange = useCallback((v: string) => {
    setYearTo(v.replace(/\D/g, "").slice(0, 4));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setBrand("");
    setYearFrom("");
    setYearTo("");
    setPage(1);
  }, []);

  const hasAdvancedFilters = !!brand || !!yearFrom || !!yearTo;
  const hasFilters = !!licenceFilter || hasAdvancedFilters;

  const emptyContent = hasFilters ? (
    <EmptyState
      icon={<IoSearch size={28} />}
      title="Sin resultados"
      description="No hay vehículos que coincidan con los filtros aplicados."
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

  // Cabecera fija (título, acciones y filtros): la tabla se queda con el alto
  // restante y scrollea su propio cuerpo.
  const header = (
    <>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-foreground font-semibold text-4xl text-shadow-2xs text-shadow-primary">
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

      {/* Filtros avanzados: marca + rango de año */}
      <span className="ml-1">Filtros</span>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Autocomplete
          label="Marca"
          size="sm"
          className="max-w-[220px]"
          selectedKey={brand || null}
          onSelectionChange={(key) => handleBrandChange((key as string) ?? "")}
          defaultItems={BRANDS_OPTIONS}
          allowsCustomValue={false}
        >
          {(b) => (
            <AutocompleteItem key={b.key} textValue={b.key}>
              {b.label}
            </AutocompleteItem>
          )}
        </Autocomplete>
        <Input
          label="Año desde"
          size="sm"
          className="max-w-[130px]"
          inputMode="numeric"
          placeholder="Ej. 2010"
          value={yearFrom}
          onChange={(e) => handleYearFromChange(e.target.value)}
        />
        <Input
          label="Año hasta"
          size="sm"
          className="max-w-[130px]"
          inputMode="numeric"
          placeholder="Ej. 2024"
          value={yearTo}
          onChange={(e) => handleYearToChange(e.target.value)}
        />
        {hasAdvancedFilters && (
          <Button size="sm" variant="flat" onPress={handleClearFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>
    </>
  );

  return (
    <PageShell header={header} scrollBody={false}>
      <CarsTable
        cars={list.items}
        isLoading={listLoading}
        emptyContent={emptyContent}
        deleteCar={handleOpenDeleteDialog}
        page={effectivePage}
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
    </PageShell>
  );
};

export default CarsPage;
