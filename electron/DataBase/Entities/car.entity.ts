import { IsInt, Matches, Min } from "class-validator";
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Client } from "./client.entity";
import { Job } from "./job.entity";
import { CarsBrands } from "../Types/enums";
import type { CarBrand } from "../Types/enums";

@Entity({ name: "car" })
export class Car {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("varchar", { length: 7, unique: true })
  @Matches(/^([A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{3})$/, {
    message: "La patente debe tener el formato AA123BB o ABC123",
  })
  licensePlate!: string;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeLicensePlate() {
    if (this.licensePlate) {
      this.licensePlate = this.licensePlate.toUpperCase().replace(/\s+/g, "");
    }
  }

  @Column("varchar", { nullable: false })
  model!: string;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeModel() {
    if (this.model) {
      this.model = this.model.toUpperCase().trim();
    }
  }

  @Column({ type: "simple-enum", enum: CarsBrands })
  brand!: CarBrand;

  @Column("integer", { nullable: false })
  year!: number;

  // Los trabajos se administran por su propio repositorio; la baja en cascada
  // la garantiza el ON DELETE CASCADE de la FK en la entidad Job.
  @OneToMany(() => Job, (job) => job.car)
  jobs!: Job[];

  @IsInt({ message: "Los kilómetros deben ser un número entero" })
  @Min(0, { message: "Los kilómetros no pueden ser negativos" })
  @Column("integer", { nullable: false })
  kilometers!: number;

  @Column("simple-json", { nullable: true })
  kmHistory!: { km: number; date: string }[];

  // Intervalos de service propios del vehículo. `null` = usar los generales
  // (configuración global). Permite distinguir, por ejemplo, un auto de uso
  // intensivo de uno de fin de semana sin cambiar la configuración de todos.
  @Column("integer", { nullable: true })
  serviceIntervalMonths!: number | null;

  @Column("integer", { nullable: true })
  serviceIntervalKm!: number | null;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "datetime" })
  updatedAt!: Date;

  // La FK ManyToOne no se indexa automáticamente; el índice se crea en la
  // migración AddOwnerIndex1700000003000. Se declara aquí para mantener la
  // entidad y el esquema en sincronía (nombre alineado con la migración).
  @Index("IDX_car_owner")
  @ManyToOne(() => Client, (client) => client.cars, { nullable: true })
  owner!: Client;

  constructor(partial: Partial<Car>) {
    Object.assign(this, partial);
  }
}
