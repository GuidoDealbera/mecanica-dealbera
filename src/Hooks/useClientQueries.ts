import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../Store/store";
import { useCallback, useState } from "react";
import {
  fetchClientByName,
  fetchClients,
  updateClient,
} from "../Store/clientAsync.methods";
import { useToasts } from "./useToasts";

export const useClientQueries = () => {
  const {showToast} = useToasts()
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const { allClients, client, error, loadingStates } = useSelector(
    (state: RootState) => state.clients
  );

  const getAllClients = useCallback(async () => {
    setLoading(true);
    try {
      await dispatch(fetchClients()).unwrap();
    } catch (error) {
      return error;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  const getClientByName = useCallback(
    async (fullname: string) => {
      setLoading(true);
      try {
        await dispatch(fetchClientByName(fullname)).unwrap();
      } catch (error) {
        return error;
      } finally {
        setLoading(false);
      }
    },
    [dispatch]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchClients()).unwrap();
      showToast("Datos actualizados correctamente", 'success', 'Actualizar');
    } catch (error) {
      showToast("Error al actualizar los datos", 'danger', 'Actualizar');
      return error;
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  const update = useCallback(async (body: any) => {
    setLoading(true);
    try {
      return await dispatch(updateClient(body)).unwrap();
    } catch (error) {
      return error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    refreshing,
    allClients,
    client, 
    error,
    loadingStates,
    getAllClients,
    getClientByName,
    update,
    refresh,
  };
};
