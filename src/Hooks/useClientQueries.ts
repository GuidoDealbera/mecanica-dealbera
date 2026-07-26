import { useCallback, useState } from "react";
import { useClientStore } from "./useClientStore";
import { useToasts } from "./useToasts";
import { ClientQueryParams, UpdateClientBody } from "../Types/apiTypes";

/**
 * Capa de presentación sobre `useClientStore`: agrega toasts y el estado local
 * de carga alrededor de las acciones de datos. Los componentes usan este hook;
 * el acceso "crudo" al store vive en `useClientStore`.
 */
export const useClientQueries = () => {
  const { list, client, error, loadingStates, fetchList, fetchByName, update } =
    useClientStore();
  const { showToast } = useToasts();
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const getClients = useCallback(
    async (params: ClientQueryParams) => {
      setLoading(true);
      try {
        await fetchList(params);
      } catch (error) {
        return error;
      } finally {
        setLoading(false);
      }
    },
    [fetchList],
  );

  const getClientByName = useCallback(
    async (fullname: string) => {
      setLoading(true);
      try {
        await fetchByName(fullname);
      } catch (error) {
        return error;
      } finally {
        setLoading(false);
      }
    },
    [fetchByName],
  );

  const refresh = useCallback(
    async (params: ClientQueryParams) => {
      setRefreshing(true);
      try {
        await fetchList(params);
        showToast("Datos actualizados correctamente", "success", "Actualizar");
      } catch (error) {
        showToast("Error al actualizar los datos", "danger", "Actualizar");
        return error;
      } finally {
        setRefreshing(false);
      }
    },
    [fetchList, showToast],
  );

  const updateOwner = useCallback(
    async (body: UpdateClientBody, isOnly?: boolean) => {
      setLoading(true);
      try {
        await update(body);
        if (isOnly)
          showToast(
            "Cliente actualizado correctamente",
            "success",
            "Actualizar Cliente",
          );
      } catch (error) {
        if (isOnly)
          showToast(
            "Error al actualizar cliente",
            "danger",
            "Actualizar Cliente",
          );
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [update, showToast],
  );

  return {
    loading,
    refreshing,
    list,
    client,
    error,
    loadingStates,
    getClients,
    getClientByName,
    updateOwner,
    refresh,
  };
};
