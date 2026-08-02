import "reflect-metadata";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Car } from "./car.entity";
import { JobStatus } from "../../../src/Types/apiTypes";

/**
 * Trabajo realizado (o pendiente) sobre un vehículo. Antes vivía como JSON
 * dentro de `Car.jobs`; ahora es una entidad propia con FK a `car`.
 */
@Entity({ name: "job" })
export class Job {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("integer", { default: 0 })
  price!: number;

  @Column("varchar", { default: "" })
  description!: string;

  @Column("boolean", { default: false })
  isThirdParty!: boolean;

  @Column("varchar")
  status!: JobStatus;

  // Repuestos/insumos del trabajo. Se guardan como JSON: son ítems de línea
  // simples (nombre + precio), no ameritan una tabla propia.
  @Column("simple-json", { nullable: true })
  parts!: { name: string; price: number }[];

  // Notas internas del taller. Uso interno: no se muestran al cliente ni se
  // incluyen en el presupuesto/factura.
  @Column("text", { nullable: true })
  notes?: string;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "datetime" })
  updatedAt!: Date;

  @Index("IDX_job_car")
  @ManyToOne(() => Car, (car) => car.jobs, {
    onDelete: "CASCADE",
    nullable: false,
  })
  car!: Car;

  constructor(partial?: Partial<Job>) {
    if (partial) Object.assign(this, partial);
  }
}
