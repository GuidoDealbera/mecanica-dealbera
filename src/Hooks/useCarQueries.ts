/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCarStore } from "./useCarStore";
import { useToasts } from "./useToasts";
import { CarActions } from "../Constants/car.constants";
import { ensureSuccess } from "../Utils/apiResponse";
import {
  CarQueryParams,
  CreateCarBody,
  CreateCarJob,
  UpdateJobBody,
} from "../Types/apiTypes";

/**
 * Capa de presentación sobre `useCarStore`: agrega los efectos de UI (toasts,
 * navegación y el estado local de carga) alrededor de las acciones de datos.
 * Los componentes usan este hook; el acceso "crudo" al store vive en
 * `useCarStore`.
 */
export const useCarQueries = () => {
  const {
    list,
    listLoaded,
    car,
    carLoaded,
    error,
    loadingStates,
    fetchList,
    fetchByLicence,
    create: createInStore,
    remove: removeInStore,
    update: updateInStore,
    addJob: addJobInStore,
    updateJob: updateJobInStore,
    cleanCar,
    cleanCars,
    clearError,
  } = useCarStore();
  const { showToast } = useToasts();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  /**
   * Estado de carga del listado, listo para pasarle a la tabla. Incluye
   * `!listLoaded` porque el efecto que dispara el fetch corre *después* del
   * primer paint: sin eso habría un frame con la lista vacía y `loading` en
   * `false`, que la tabla pinta como estado vacío (flash).
   */
  const listLoading = loading || refreshing || !listLoaded;

  const create = useCallback(
    async (body: CreateCarBody) => {
      setLoading(true);
      try {
        const data: CreateCarBody = {
          ...body,
          owner: {
            ...body.owner,
            email: body.owner.email ?? undefined,
          },
        };
        const response = await createInStore(data);
        showToast(
          response.message,
          response.status === "failed" ? "danger" : "success",
          CarActions.CREATE
        );
        if (response.status === "success") {
          navigate("/cars", { state: { bypassGuard: true } });
        }
        return response;
      } catch (error: any) {
        showToast(error.message, "danger", CarActions.CREATE);
        return error;
      } finally {
        setLoading(false);
      }
    },
    [createInStore, navigate, showToast]
  );

  const getCars = useCallback(
    async (params: CarQueryParams) => {
      setLoading(true);
      try {
        await fetchList(params);
      } catch (error) {
        return error;
      } finally {
        setLoading(false);
      }
    },
    [fetchList]
  );

  const refresh = useCallback(
    async (params: CarQueryParams) => {
      setRefreshing(true);
      try {
        await fetchList(params);
        showToast(
          "Datos actualizados correctamente",
          "success",
          CarActions.REFRESH
        );
      } catch (error) {
        showToast(
          "Error al actualizar los datos",
          "danger",
          CarActions.REFRESH
        );
        return error;
      } finally {
        setRefreshing(false);
      }
    },
    [fetchList, showToast]
  );

  const refreshCar = useCallback(
    async (licence: string) => {
      setRefreshing(true);
      try {
        await fetchByLicence(licence);
        showToast(
          "Datos actualizados exitosamente",
          "success",
          CarActions.REFRESH
        );
      } catch (error) {
        showToast(
          "Error al actualizar los datos",
          "danger",
          CarActions.REFRESH
        );
        return error;
      } finally {
        setRefreshing(false);
      }
    },
    [fetchByLicence, showToast]
  );

  const getCarDetail = useCallback(
    async (licence: string) => {
      setLoading(true);
      try {
        await fetchByLicence(licence);
      } catch (error: any) {
        showToast(error.message, "danger", CarActions.FETCH);
        return error;
      } finally {
        setLoading(false);
      }
    },
    [fetchByLicence, showToast]
  );

  const deleteOneCar = useCallback(
    async (licence: string) => {
      setLoading(true);
      try {
        const response = await removeInStore(licence);
        showToast(response.message, "success", CarActions.DELETE);
      } catch (error: any) {
        showToast(error.message, "danger", CarActions.DELETE);
        return error;
      } finally {
        setLoading(false);
      }
    },
    [removeInStore, showToast]
  );

  const updateCar = useCallback(
    async (carId: string, kilometers: number, isOnly?: boolean) => {
      setLoading(true);
      try {
        // `ensureSuccess` es lo que hace que un rechazo del backend (por ejemplo
        // bajar los kilómetros) llegue al usuario: el thunk resuelve igual con
        // `status: "failed"`, así que sin esto la pantalla seguía adelante y
        // avisaba que la actualización había salido bien.
        const response = await updateInStore(carId, kilometers);
        ensureSuccess(response);
        if (isOnly) {
          showToast(response.message, "success", CarActions.UPDATE);
        }
      } catch (error: any) {
        if (isOnly) showToast(error.message, "danger", CarActions.UPDATE);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [updateInStore, showToast]
  );

  const addCarJob = useCallback(
    async (licence: string, job: CreateCarJob) => {
      setLoading(true);
      try {
        const response = await addJobInStore(licence, job);
        showToast(
          response.message,
          response.status === "failed" ? "danger" : "success",
          CarActions.JOB_CREATE
        );
        if (response.status === "success") {
          navigate(`/cars/${licence}`, { state: { bypassGuard: true } });
        }
        return response;
      } catch (error: any) {
        showToast(error.message, "danger", CarActions.JOB_CREATE);
        return error;
      } finally {
        setLoading(false);
      }
    },
    [addJobInStore, navigate, showToast]
  );

  const updateJob = useCallback(
    async (licence: string, jobId: string, body: UpdateJobBody) => {
      setLoading(true);
      try {
        const response = await updateJobInStore(licence, jobId, body);
        showToast(response.message as string, "success", CarActions.JOB_UPDATE);
        return response;
      } catch (error: any) {
        showToast(error.message, "danger", CarActions.JOB_UPDATE);
        return { status: "failed" as const, message: error.message as string };
      } finally {
        setLoading(false);
      }
    },
    [updateJobInStore, showToast]
  );

  return {
    loading,
    refreshing,
    listLoading,
    list,
    listLoaded,
    car,
    carLoaded,
    error,
    loadingStates,
    create,
    getCars,
    getCarDetail,
    updateCar,
    addCarJob,
    updateJob,
    refresh,
    deleteOneCar,
    refreshCar,
    clean: cleanCar,
    cleanCars,
    clearError,
  };
};
