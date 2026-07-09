/* eslint-disable @typescript-eslint/no-explicit-any */
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "../Store/store";
import {
  selectAllClients,
  selectClient,
  selectClientError,
  selectClientLoadingStates,
} from "../Store/selectors";
import { useCallback, useState } from "react";
import {
  fetchClientByName,
  fetchClients,
  updateClient,
} from "../Store/clientAsync.methods";
import { useToasts } from "./useToasts";
import { Client } from "../Types/types";

export const useClientQueries = () => {
  const { showToast } = useToasts();
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const allClients = useSelector(selectAllClients);
  const client = useSelector(selectClient);
  const error = useSelector(selectClientError);
  const loadingStates = useSelector(selectClientLoadingStates);

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
    [dispatch],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchClients()).unwrap();
      showToast("Datos actualizados correctamente", "success", "Actualizar");
    } catch (error) {
      showToast("Error al actualizar los datos", "danger", "Actualizar");
      return error;
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, showToast]);

  const updateOwner = useCallback(
    async (body: Partial<Client>, isOnly?: boolean) => {
      setLoading(true);
      try {
        await dispatch(updateClient(body)).unwrap();
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
    [dispatch, showToast],
  );

  return {
    loading,
    refreshing,
    allClients,
    client,
    error,
    loadingStates,
    getAllClients,
    getClientByName,
    updateOwner,
    refresh,
  };
};
