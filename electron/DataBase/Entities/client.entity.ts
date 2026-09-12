import "reflect-metadata";
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Car } from "./car.entity";

@Entity({ name: "client" })
export class Client {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // Ni el nombre ni el teléfono son únicos: dos clientes pueden llamarse igual
  // y una familia puede compartir un número. Al cliente se lo identifica por
  // `id`; el duplicado se avisa al cargarlo, no se impide. Ver la migración
  // `AllowHomonymClients`.
  @Column("varchar", { nullable: false })
  fullname!: string;

  @Column("varchar", { nullable: false })
  phone!: string;

  @Column("varchar", { nullable: false })
  address!: string;

  @Column("varchar", { nullable: false })
  city!: string;

  @Column("varchar", { nullable: true })
  email?: string;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;

  @OneToMany(() => Car, (car) => car.owner)
  cars!: Car[];

  constructor(partial: Partial<Client>) {
    Object.assign(this, partial);
  }
}
