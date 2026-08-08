import React from "react";
import { Autocomplete, AutocompleteItem, Button } from "@heroui/react";
import { useClientQueries } from "../Hooks/useClientQueries";
import { HiOutlineRefresh } from "react-icons/hi";
import ClientTable from "../Components/Tables/ClientsTable";
import FilterName from "../Components/SearchBars/FilterName";
import CustomDialog from "../Components/CustomDialog";
import EmptyState from "../Components/EmptyState";
import { useToasts } from "../Hooks/useToasts";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IoSearch, IoCarSportSharp } from "react-icons/io5";
import { MdPersonOutline } from "react-icons/md";
import { ClientQueryParams } from "../Types/apiTypes";

const PAGE_SIZE = 8;

const ClientPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const nameFilter = searchParams.get("q") ?? "";
  const { list, refreshing, listLoading, getClients, refresh, clearOwners } =
    useClientQueries();
  const { showToast } = useToasts();
  const [showInactive, setShowInactive] = React.useState(false);
  const [city, setCity] = React.useState<string>("");
  const [cities, setCities] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);

  // Ciudades distintas para el dropdown de filtro (se cargan una vez).
  React.useEffect(() => {
    window.api.clients
      .getCities()
      .then(setCities)
      .catch(() => {});
  }, []);
  const [sort, setSort] = React.useState<{
    by: string | null;
    dir: "asc" | "desc";
  }>({
    by: null,
    dir: "asc",
  });

  // Toggle active dialog
  const [toggleDialog, setToggleDialog] = React.useState<{
    open: boolean;
    id: string;
    name: string;
    isActive: boolean;
  }>({ open: false, id: "", name: "", isActive: true });

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean;
    id: string;
    name: string;
    carsCount: number;
  }>({ open: false, id: "", name: "", carsCount: 0 });

  const [actionLoading, setActionLoading] = React.useState(false);

  // Parámetros de la consulta paginada. Al cambiar, se dispara el fetch.
  const params = React.useMemo<ClientQueryParams>(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: nameFilter || undefined,
      includeInactive: showInactive,
      city: city || undefined,
      sortBy: sort.by ?? undefined,
      sortDir: sort.dir,
    }),
    [page, nameFilter, showInactive, city, sort],
  );

  React.useEffect(() => {
    getClients(params);
  }, [getClients, params]);

  // Autocorrección: si la página quedó vacía pero hay resultados (p.ej. se
  // desactivó/eliminó el último item de la última página), retrocede una.
  React.useEffect(() => {
    if (!listLoading && list.total > 0 && list.items.length === 0 && page > 1) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [listLoading, list.total, list.items.length, page]);

  React.useEffect(() => {
    return () => {
      clearOwners();
    };
  }, [clearOwners]);

  const handleNameFilterChange = React.useCallback(
    (v: string) => {
      // replace: true para que filtrar no apile entradas de historial
      // (evita tener que hacer varios clicks en el botón "Atrás").
      if (v) setSearchParams({ q: v }, { replace: true });
      else setSearchParams({}, { replace: true });
      setPage(1);
    },
    [setSearchParams],
  );

  const handleToggleShowInactive = React.useCallback(() => {
    setShowInactive((v) => !v);
    setPage(1);
  }, []);

  const handleCityChange = React.useCallback((v: string) => {
    setCity(v);
    setPage(1);
  }, []);

  const cityOptions = React.useMemo(
    () => cities.map((c) => ({ key: c, label: c })),
    [cities],
  );

  // Ciclo de orden por columna: asc → desc → sin orden.
  const handleSortChange = React.useCallback((columnKey: string) => {
    setSort((prev) => {
      if (prev.by !== columnKey) return { by: columnKey, dir: "asc" };
      if (prev.dir === "asc") return { by: columnKey, dir: "desc" };
      return { by: null, dir: "asc" };
    });
    setPage(1);
  }, []);

  const handleToggleActive = React.useCallback(
    (id: string, name: string, isActive: boolean) => {
      setToggleDialog({ open: true, id, name, isActive });
    },
    [],
  );

  const handleDelete = React.useCallback(
    (id: string, name: string) => {
      const carsCount = list.items.find((c) => c.id === id)?.cars?.length ?? 0;
      setDeleteDialog({ open: true, id, name, carsCount });
    },
    [list.items],
  );

  // Texto descriptivo del borrado: incluye la cantidad de vehículos que se
  // eliminarán en cascada (con sus trabajos), con singular/plural.
  const deleteContent = React.useMemo(() => {
    const n = deleteDialog.carsCount;
    const vehiculos =
      n === 0
        ? "No tiene vehículos registrados."
        : n === 1
          ? "Se eliminará también su vehículo y todos sus trabajos."
          : `Se eliminarán también sus ${n} vehículos y todos sus trabajos.`;
    return `¿Eliminar permanentemente a "${deleteDialog.name}"? ${vehiculos} Esta acción es irreversible.`;
  }, [deleteDialog.name, deleteDialog.carsCount]);

  const confirmToggle = async () => {
    setActionLoading(true);
    try {
      const res = await window.api.clients.toggleActive(toggleDialog.id);
      if (res.status === "success") {
        showToast(res.message, "success", "Cliente");
        await getClients(params);
      } else {
        showToast(res.message, "danger", "Cliente");
      }
    } finally {
      setActionLoading(false);
      setToggleDialog({ open: false, id: "", name: "", isActive: true });
    }
  };

  const confirmDelete = async () => {
    setActionLoading(true);
    try {
      const res = await window.api.clients.delete(deleteDialog.id);
      if (res.status === "success") {
        showToast(res.message, "success", "Cliente");
        await getClients(params);
      } else {
        showToast(res.message, "danger", "Cliente");
      }
    } finally {
      setActionLoading(false);
      setDeleteDialog({ open: false, id: "", name: "", carsCount: 0 });
    }
  };

  const emptyContent = nameFilter || city ? (
    <EmptyState
      icon={<IoSearch size={28} />}
      title="Sin resultados"
      description="No hay clientes que coincidan con los filtros aplicados."
    />
  ) : (
    <EmptyState
      icon={<MdPersonOutline size={30} />}
      title="No hay clientes registrados"
      description="Los clientes se registran al cargar un vehículo."
      action={{
        label: "Registrar vehículo",
        icon: <IoCarSportSharp size={18} />,
        onPress: () => navigate("/cars/new"),
      }}
    />
  );

  return (
    <div className="w-full h-full shadow shadow-primary bg-content1 rounded-md p-3">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-foreground font-semibold text-4xl text-shadow-2xs text-shadow-primary">
          Listado de clientes
        </h4>
        <div className="flex gap-2 items-center">
          <Button size="sm" color="default" onPress={handleToggleShowInactive}>
            {showInactive ? "Ocultar inactivos" : "Mostrar inactivos"}
          </Button>
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
        </div>
      </div>

      <FilterName
        initialValue={nameFilter}
        onFilterChange={handleNameFilterChange}
      />

      {/* Filtro avanzado: ciudad */}
      <span className="ml-1">Filtros</span>
      {cityOptions.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <Autocomplete
            label="Ciudad"
            size="sm"
            className="max-w-[220px]"
            selectedKey={city || null}
            onSelectionChange={(key) => handleCityChange((key as string) ?? "")}
            defaultItems={cityOptions}
            allowsCustomValue={false}
          >
            {(c) => (
              <AutocompleteItem key={c.key} textValue={c.key}>
                {c.label}
              </AutocompleteItem>
            )}
          </Autocomplete>
          {city && (
            <Button size="sm" variant="flat" onPress={() => handleCityChange("")}>
              Limpiar
            </Button>
          )}
        </div>
      )}

      <ClientTable
        clients={list.items}
        isLoading={listLoading}
        emptyContent={emptyContent}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        page={page}
        pageSize={PAGE_SIZE}
        total={list.total}
        onPageChange={setPage}
        sortBy={sort.by}
        sortDir={sort.dir}
        onSortChange={handleSortChange}
      />

      {/* Toggle active dialog */}
      <CustomDialog
        isOpen={toggleDialog.open}
        onClose={() =>
          setToggleDialog({ open: false, id: "", name: "", isActive: true })
        }
        onConfirm={confirmToggle}
        isLoading={actionLoading}
        title={toggleDialog.isActive ? "Desactivar cliente" : "Activar cliente"}
        content={
          toggleDialog.isActive
            ? `¿Desactivar a "${toggleDialog.name}"? El cliente no aparecerá en búsquedas activas pero sus datos se conservarán.`
            : `¿Reactivar a "${toggleDialog.name}"?`
        }
        confirmText={toggleDialog.isActive ? "Desactivar" : "Activar"}
      />

      {/* Delete dialog */}
      <CustomDialog
        isOpen={deleteDialog.open}
        onClose={() =>
          setDeleteDialog({ open: false, id: "", name: "", carsCount: 0 })
        }
        onConfirm={confirmDelete}
        isLoading={actionLoading}
        title="Eliminar cliente"
        content={deleteContent}
        confirmText="Eliminar"
      />
    </div>
  );
};

export default ClientPage;
