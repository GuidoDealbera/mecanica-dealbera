import React from "react";
import { Button } from "@heroui/react";
import { useClientQueries } from "../Hooks/useClientQueries";
import { HiOutlineRefresh } from "react-icons/hi";
import ClientTable from "../Components/Tables/ClientsTable";
import FilterName from "../Components/SearchBars/FilterName";
import CustomDialog from "../Components/CustomDialog";
import { useToasts } from "../Hooks/useToasts";

const ClientPage: React.FC = () => {
  const [fullnameFilter, setFullnameFilter] = React.useState<string>("");
  const { allClients, loading, refreshing, getAllClients, refresh } = useClientQueries();
  const { showToast } = useToasts();
  const [showInactive, setShowInactive] = React.useState(false);

  // Toggle active dialog
  const [toggleDialog, setToggleDialog] = React.useState<{
    open: boolean; id: string; name: string; isActive: boolean;
  }>({ open: false, id: "", name: "", isActive: true });

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean; id: string; name: string;
  }>({ open: false, id: "", name: "" });

  const [actionLoading, setActionLoading] = React.useState(false);

  const filteredClients = React.useMemo(() => {
    let list = allClients;
    if (!showInactive) list = list.filter((c) => c.isActive);
    if (fullnameFilter)
      list = list.filter((c) =>
        c.fullname.toLowerCase().includes(fullnameFilter.toLowerCase())
      );
    return list;
  }, [allClients, fullnameFilter, showInactive]);

  React.useEffect(() => { getAllClients(); }, [getAllClients]);

  const handleToggleActive = React.useCallback(
    (id: string, name: string, isActive: boolean) => {
      setToggleDialog({ open: true, id, name, isActive });
    }, []
  );

  const handleDelete = React.useCallback((id: string, name: string) => {
    setDeleteDialog({ open: true, id, name });
  }, []);

  const confirmToggle = async () => {
    setActionLoading(true);
    try {
      const res = await window.api.clients.toggleActive(toggleDialog.id);
      if (res.status === "success") {
        showToast(res.message, "success", "Cliente");
        await getAllClients();
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
        await getAllClients();
      } else {
        showToast(res.message, "danger", "Cliente");
      }
    } finally {
      setActionLoading(false);
      setDeleteDialog({ open: false, id: "", name: "" });
    }
  };

  const isLoading = loading || refreshing;

  return (
    <div className="w-full h-full shadow shadow-primary bg-foreground-800 rounded-md p-3">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-white font-semibold text-4xl text-shadow-2xs text-shadow-primary">
          Listado de clientes
        </h4>
        <div className="flex gap-2 items-center">
          <Button
            size="sm"
            color="default"
            onPress={() => setShowInactive((v) => !v)}
          >
            {showInactive ? "Ocultar inactivos" : "Mostrar inactivos"}
          </Button>
          <Button
            isLoading={isLoading}
            startContent={!isLoading ? <HiOutlineRefresh size={20} /> : undefined}
            color="primary"
            className="font-bold"
            onPress={refresh}
          >
            {isLoading ? "Actualizando" : "Actualizar"}
          </Button>
        </div>
      </div>

      <FilterName onFilterChange={setFullnameFilter} />

      <ClientTable
        clients={filteredClients}
        isLoading={isLoading}
        noRowsLabel={
          fullnameFilter
            ? "No hay clientes que coincidan con la búsqueda"
            : "No hay clientes registrados"
        }
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
      />

      {/* Toggle active dialog */}
      <CustomDialog
        isOpen={toggleDialog.open}
        onClose={() => setToggleDialog({ open: false, id: "", name: "", isActive: true })}
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
        onClose={() => setDeleteDialog({ open: false, id: "", name: "" })}
        onConfirm={confirmDelete}
        isLoading={actionLoading}
        title="Eliminar cliente"
        content={`¿Eliminar permanentemente a "${deleteDialog.name}" y todos sus vehículos? Esta acción es irreversible.`}
        confirmText="Eliminar"
      />
    </div>
  );
};

export default ClientPage;
