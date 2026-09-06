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
import { JobStatus, ServiceType } from "../../../src/Types/apiTypes";

/**
 * Trabajo realizado (o pendiente) sobre un vehículo. Antes vivía como JSON
 * dentro de `Car.jobs`; ahora es una entidad propia con FK a `car`.
 */
// El índice se crea en la migración AddJobStatusIndex1700000008000 (ahí está el
// porqué del compuesto y las mediciones). Se declara acá para mantener la
// entidad y el esquema en sincronía, con el mismo nombre que la migración.
@Index("IDX_job_status_updated", ["status", "updatedAt"])
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

  // Observación **para el cliente**: sí se imprime en el presupuesto y en la
  // factura, debajo de la descripción del trabajo. Es un campo aparte de
  // `notes` justamente para que nunca se filtre lo interno.
  @Column("text", { nullable: true })
  clientNote?: string;

  // Si el trabajo es un service, de qué tipo. Al pasarlo a completado/entregado
  // se cierra el recordatorio vigente de ese tipo y se genera el siguiente.
  // `null` = trabajo común (no afecta los recordatorios).
  @Column("varchar", { nullable: true })
  serviceType?: ServiceType | null;

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
