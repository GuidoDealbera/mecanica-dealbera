import "reflect-metadata";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
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
  //
  // Los índices los repuso esa misma migración al quitar los `UNIQUE`, que los
  // traían de regalo: de ellos dependen el orden del listado y la búsqueda del
  // duplicado. Se declaran para que la entidad describa la tabla que hay.
  @Index("IDX_client_fullname")
  @Column("varchar", { nullable: false })
  fullname!: string;

  @Index("IDX_client_phone")
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

  // El parámetro es opcional como en el resto de las entidades. TypeORM las
  // instancia **sin argumentos** al hidratar una fila: con el parámetro
  // obligatorio eso andaba de casualidad, porque `Object.assign(this, undefined)`
  // no hace nada, y el tipo decía lo contrario de lo que ocurre.
  constructor(partial?: Partial<Client>) {
    Object.assign(this, partial);
  }
}
