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
import { ReminderStatus, ServiceType } from "../../../src/Types/apiTypes";

/**
 * Recordatorio de service de un vehículo.
 *
 * Es una entidad persistida (y no un cálculo al vuelo como las alertas
 * anteriores) por dos razones:
 * - **Estado**: poder posponer, marcar como contactado, hecho o descartado. Sin
 *   eso la lista muestra siempre lo mismo y se vuelve ruido.
 * - **Historial**: queda registro de cuándo se avisó y de los services hechos.
 *
 * Invariante que mantienen los endpoints: como máximo **un recordatorio
 * vigente** (`pending`/`snoozed`) por vehículo y tipo de service.
 *
 * A diferencia de `Document`, sí se borra en cascada con el vehículo: un
 * recordatorio de un auto que ya no existe no tiene sentido.
 */
@Entity({ name: "service_reminder" })
@Index("IDX_service_reminder_status_due", ["status", "dueDate"])
export class ServiceReminder {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("IDX_service_reminder_car")
  @ManyToOne(() => Car, { onDelete: "CASCADE", nullable: false })
  car!: Car;

  @Column("varchar", { default: ServiceType.GENERAL })
  type!: ServiceType;

  @Column("varchar", { default: ReminderStatus.PENDING })
  status!: ReminderStatus;

  /** Vencimiento por fecha. `null` si el recordatorio es sólo por kilometraje. */
  @Column("datetime", { nullable: true })
  dueDate!: Date | null;

  /** Vencimiento por kilometraje. `null` si es sólo por fecha. */
  @Column("integer", { nullable: true })
  dueKm!: number | null;

  /** Hasta cuándo está postergado (aplica con `status = snoozed`). */
  @Column("datetime", { nullable: true })
  snoozedUntil!: Date | null;

  /** Última vez que se contactó al titular por este recordatorio. */
  @Column("datetime", { nullable: true })
  contactedAt!: Date | null;

  @Column("text", { nullable: true })
  notes?: string;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "datetime" })
  updatedAt!: Date;

  constructor(partial?: Partial<ServiceReminder>) {
    if (partial) Object.assign(this, partial);
  }
}
