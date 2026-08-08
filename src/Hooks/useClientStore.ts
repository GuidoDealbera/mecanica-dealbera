import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "../Store/store";
import {
  selectClientsList,
  selectClientsListLoaded,
  selectClient,
  selectClientLoaded,
  selectClientError,
  selectClientLoadingStates,
} from "../Store/selectors";
import {
  fetchClientByName as fetchClientByNameThunk,
  fetchClients as fetchClientsThunk,
  updateClient as updateClientThunk,
} from "../Store/clientAsync.methods";
import { ClientQueryParams, UpdateClientBody } from "../Types/apiTypes";
import { cleanOwnerState, cleanOwners } from "../Store/clientSlice";

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
  const listLoaded = useSelector(selectClientsListLoaded);
  const client = useSelector(selectClient);
  const clientLoaded = useSelector(selectClientLoaded);
  const error = useSelector(selectClientError);
  const loadingStates = useSelector(selectClientLoadingStates);

  const fetchList = useCallback(
    (params: ClientQueryParams) => dispatch(fetchClientsThunk(params)).unwrap(),
    [dispatch]
  );

  const fetchByName = useCallback(
    (fullname: string) => dispatch(fetchClientByNameThunk(fullname)).unwrap(),
    [dispatch]
  );

  const update = useCallback(
    (body: UpdateClientBody) => dispatch(updateClientThunk(body)).unwrap(),
    [dispatch]
  );

  const clearOwners = useCallback(() => dispatch(cleanOwners()), [dispatch]);

  const clearClient = useCallback(
    () => dispatch(cleanOwnerState()),
    [dispatch]
  );

  return {
    // Estado
    list,
    listLoaded,
    client,
    clientLoaded,
    error,
    loadingStates,
    // Acciones (devuelven la promesa desenvuelta)
    fetchList,
    fetchByName,
    update,
    // Limpieza de estado
    clearOwners,
    clearClient,
  };
};
