import { Button } from '@heroui/react'
import { IoCarSportSharp } from "react-icons/io5";
import { MdPostAdd } from "react-icons/md";
import React from 'react'
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  return (
    <div className='w-full h-full shadow shadow-primary bg-foreground-800 rounded-md flex flex-col justify-evenly items-center'>
        <h1 className='font-michroma text-6xl md:text-7xl lg:text-8xl italic text-primary-500 font-bold text-center'>
            MECÁNICA DEALBERA
        </h1>
        <div className='flex justify-between md:justify-around lg:justify-evenly align-middle w-9/12'>
            <Button
              onPress={() => navigate('/cars/new')}
              startContent={<IoCarSportSharp />}
              color='primary'
              className='text-lg'
            >
              Ingresar Vehículo
            </Button>
            <Button 
              onPress={() => navigate('/cars/add-job')}
              startContent={<MdPostAdd/>}
              color='primary'
              className='text-lg'
            >
              Nuevo Trabajo
            </Button>
        </div>
    </div>
  )
}

export default HomePage