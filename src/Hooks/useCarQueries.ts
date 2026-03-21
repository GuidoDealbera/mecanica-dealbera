/* eslint-disable @typescript-eslint/no-explicit-any */
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../Store/store";
import { CreateCarBody, CreateCarJob, UpdateJobBody } from "../Types/apiTypes";
import {
  createCar,
  fetchCarByLicence,
  fetchCars,
  deleteCar,
  updateJobInCar,
  updatedCar,
  addJob,
} from "../Store/carAsync.methods";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cleanCarsState, cleanCarState, cleanError } from "../Store/carSlice";
import { setByPassNavigation } from "../Utils/utils";
import { useToasts } from "./useToasts";
import { CarActions } from "../Constants/car.constants";

export const useCarQueries = () => {
  const { showToast } = useToasts();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { allCars, car, loadingStates, error } = useSelector(
    (state: RootState) => state.cars,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

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
        const response = await dispatch(createCar(data)).unwrap();
        showToast(response.message, "success", CarActions.CREATE);
        setByPassNavigation(true);
        navigate("/cars");
        return response;
      } catch (error: any) {
        showToast(error.message, "danger", CarActions.CREATE);
        return error;
      } finally {
        setLoading(false);
      }
    },
    [dispatch, navigate, showToast],
  );

  const getAllCars = useCallback(async () => {
    setLoading(true);
    try {
      await dispatch(fetchCars()).unwrap();
    } catch (error) {
      return error;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchCars()).unwrap();
      showToast(
        "Datos actualizados correctamente",
        "success",
        CarActions.REFRESH,
      );
    } catch (error) {
      showToast("Error al actualizar los datos", "danger", CarActions.REFRESH);
      return error;
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, showToast]);

  const refreshCar = useCallback(
    async (licence: string) => {
      setRefreshing(true);
      try {
        await dispatch(fetchCarByLicence(licence)).unwrap();
        showToast(
          "Datos actualizados exitosamente",
          "success",
          CarActions.REFRESH,
        );
      } catch (error) {
        showToast(
          "Error al actualizar los datos",
          "danger",
          CarActions.REFRESH,
        );
        return error;
      } finally {
        setRefreshing(false);
      }
    },
    [dispatch, showToast],
  );

  const getCarDetail = useCallback(
    async (licence: string) => {
      setLoading(true);
      try {
        await dispatch(fetchCarByLicence(licence));
      } catch (error: any) {
        showToast(error.message, "danger", CarActions.FETCH);
        return error;
      } finally {
        setLoading(false);
      }
    },
    [dispatch, showToast],
  );

  const deleteOneCar = useCallback(
    async (licence: string) => {
      setLoading(true);
      try {
        const response = await dispatch(deleteCar(licence)).unwrap();
        showToast(response.message, "success", CarActions.DELETE);
      } catch (error: any) {
        showToast(error.message, "danger", CarActions.DELETE);
        return error;
      } finally {
        setLoading(false);
      }
    },
    [dispatch, showToast],
  );

  const updateCar = useCallback(
    async (carId: string, kilometers: number, isOnly?: boolean) => {
      setLoading(true);
      try {
        const response = await dispatch(
          updatedCar({ carId, kilometers }),
        ).unwrap();
        if (isOnly) {
          showToast(
            response.message,
            response.result ? "success" : "warning",
            CarActions.UPDATE,
          );
        }
      } catch (error: any) {
        showToast(error.message, "danger", CarActions.UPDATE);
      } finally {
        setLoading(false);
      }
    },
    [dispatch, showToast],
  );

  const addCarJob = useCallback(
    async (licence: string, job: CreateCarJob) => {
      setLoading(true);
      try {
        const response = await dispatch(addJob({ licence, job })).unwrap();
        showToast(response.message, "success", CarActions.JOB_CREATE);
        return response;
      } catch (error: any) {
        showToast(error.message, "danger", CarActions.JOB_CREATE);
        return error;
      } finally {
        setLoading(false);
      }
    },
    [showToast, dispatch],
  );

  const updateJob = useCallback(
    async (licence: string, jobId: string, body: UpdateJobBody) => {
      setLoading(true);
      try {
        const response = await dispatch(
          updateJobInCar({ licence, jobId, body }),
        ).unwrap();
        showToast(response.message as string, "success", CarActions.JOB_UPDATE);
        return response;
      } catch (error: any) {
        showToast(error.message, "danger", CarActions.JOB_UPDATE);
        return error;
      } finally {
        setLoading(false);
      }
    },
    [dispatch, showToast],
  );

  const clean = useCallback(() => {
    dispatch(cleanCarState());
  }, [dispatch]);

  const cleanCars = useCallback(() => {
    dispatch(cleanCarsState());
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch(cleanError());
  }, [dispatch]);

  return {
    loading,
    refreshing,
    allCars,
    car,
    error,
    loadingStates,
    create,
    getAllCars,
    getCarDetail,
    updateCar,
    addCarJob,
    updateJob,
    refresh,
    deleteOneCar,
    refreshCar,
    clean,
    cleanCars,
    clearError,
  };
};
