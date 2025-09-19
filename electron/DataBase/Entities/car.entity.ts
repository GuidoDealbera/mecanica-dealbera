import { IsInt, Matches, Min } from 'class-validator';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { Jobs } from '../Types/car.dto';
import { CarsBrands } from '../Types/enums';
import type {CarBrand} from '../Types/enums'

@Entity({ name: 'car' })
export class Car {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 7, unique: true })
  @Matches(/^([A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3})$/, {
    message: 'La patente debe tener el formato AA123BB o ABC123',
  })
  licensePlate!: string;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeLicensePlate() {
    if (this.licensePlate) {
      this.licensePlate = this.licensePlate.toUpperCase().replace(/\s+/g, '');
    }
  }

  @Column('varchar', { unique: true, nullable: false })
  model!: string;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeModel() {
    if (this.model) {
      this.model = this.model.toUpperCase().trim();
    }
  }

  @Column({type: 'simple-enum', enum: CarsBrands})
  brand!: CarBrand;

  @Column('integer', { nullable: false })
  year!: number;

  @Column('simple-json', { nullable: true })
  jobs!: Jobs[];

  @IsInt({ message: 'Los kilómetros deben ser un número entero' })
  @Min(0, { message: 'Los kilómetros no pueden ser negativos' })
  @Column('integer', { nullable: false })
  kilometers!: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;

  @ManyToOne(() => Client, (client) => client.cars, { nullable: true })
  owner!: Client;

  constructor(partial: Partial<Car>) {
    Object.assign(this, partial);
  }
}
