import React from 'react'
import { Cars } from '../../Types/types'
import AddCarForm from '../../Components/Forms/AddCarForm'
import { CreateCarBody, UpdateCar } from '../../Types/apiTypes'
import { useCarQueries } from '../../Hooks/useCarQueries'

interface DetailCarProps {
    car: Cars
    isLoading: boolean
    isEditing: boolean
}

const DetailCar: React.FC<DetailCarProps> = ({
    car,
    isLoading,
    isEditing
}) => {
  const {updateCar} = useCarQueries()
  const onEdit = React.useCallback(async(data: CreateCarBody) => {
    const formattedData: UpdateCar = {
      owner: data.owner,
      kilometers: data.kilometers
    }
    await updateCar(car.id, formattedData)
  }, [updateCar])
  return (
    <div>
        <AddCarForm onSubmit={onEdit} initialValues={car} readonly={!isEditing} isEditing={isEditing} isLoading={isLoading}/>
    </div>
  )
}

export default DetailCar