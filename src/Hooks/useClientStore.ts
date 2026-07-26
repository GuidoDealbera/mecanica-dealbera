import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "../Store/store";
import {
  selectClientsList,
  selectClient,
  selectClientError,
  selectClientLoadingStates,
} from "../Store/selectors";
import {
  fetchClientByName as fetchClientByNameThunk,
  fetchClients as fetchClientsThunk,
  updateClient as updateClientThunk,
} from "../Store/clientAsync.methods";
import { ClientQueryParams, UpdateClientBody } from "../Types/apiTypes";

/**
 * Hook de datos "puro" del slice de clientes: expone el estado del store y
 * acciones que despachan los thunks y devuelven la promesa **desenvuelta**
 * (`.unwrap()`). Sin UI (toasts/navegación/loading local): eso vive en la capa
 * de presentación (`useClientQueries`). Callbacks estables (dependen solo de
 * `dispatch`).
 */
export const useClientStore = () => {
  const dispatch = useDispatch<AppDispatch>();

  const list = useSelector(selectClientsList);
  const client = useSelector(selectClient);
  const error = useSelector(selectClientError);
  const loadingStates = useSelector(selectClientLoadingStates);

  const fetchList = useCallback(
    (params: ClientQueryParams) => dispatch(fetchClientsThunk(params)).unwrap(),
    [dispatch],
  );

  const fetchByName = useCallback(
    (fullname: string) => dispatch(fetchClientByNameThunk(fullname)).unwrap(),
    [dispatch],
  );

  const update = useCallback(
    (body: UpdateClientBody) => dispatch(updateClientThunk(body)).unwrap(),
    [dispatch],
  );

  return {
    // Estado
    list,
    client,
    error,
    loadingStates,
    // Acciones (devuelven la promesa desenvuelta)
    fetchList,
    fetchByName,
    update,
  };
};
