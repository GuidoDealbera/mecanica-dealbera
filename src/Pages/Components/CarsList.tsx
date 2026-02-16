import React from 'react'
import { Cars } from '../../Types/types'
import CarCard from './CarCard'

interface CarsListProps {
    cars: Cars[]
    selectedLicense: string
    onSelect: (license: string) => void
}

const CarsList: React.FC<CarsListProps> = ({cars, selectedLicense, onSelect}) => {
  return (
    <div className='bg-white m-3 grid grid-cols-12 p-3 rounded-lg'>
        {cars.map(car => (
            <CarCard key={car.id} {...car} isSelected={car.licensePlate === selectedLicense} onSelect={onSelect}/>
        ))}
    </div>
  )
}

export default CarsList