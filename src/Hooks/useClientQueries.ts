/* eslint-disable @typescript-eslint/no-explicit-any */
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "../Store/store";
import {
  selectClientsList,
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
import { ClientQueryParams, UpdateClientBody } from "../Types/apiTypes";

export const useClientQueries = () => {
  const { showToast } = useToasts();
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const list = useSelector(selectClientsList);
  const client = useSelector(selectClient);
  const error = useSelector(selectClientError);
  const loadingStates = useSelector(selectClientLoadingStates);

  const getClients = useCallback(
    async (params: ClientQueryParams) => {
      setLoading(true);
      try {
        await dispatch(fetchClients(params)).unwrap();
      } catch (error) {
        return error;
      } finally {
        setLoading(false);
      }
    },
    [dispatch],
  );

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

  const refresh = useCallback(
    async (params: ClientQueryParams) => {
      setRefreshing(true);
      try {
        await dispatch(fetchClients(params)).unwrap();
        showToast("Datos actualizados correctamente", "success", "Actualizar");
      } catch (error) {
        showToast("Error al actualizar los datos", "danger", "Actualizar");
        return error;
      } finally {
        setRefreshing(false);
      }
    },
    [dispatch, showToast],
  );

  const updateOwner = useCallback(
    async (body: UpdateClientBody, isOnly?: boolean) => {
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
