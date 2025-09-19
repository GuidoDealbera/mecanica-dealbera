import 'reflect-metadata'
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Car } from './car.entity';

@Entity({ name: 'client' })
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { unique: true, nullable: false })
  fullname!: string;

  @Column('varchar', { unique: true, nullable: false })
  phone!: string;

  @Column('varchar', { nullable: false })
  address!: string;

  @Column('varchar', { nullable: false })
  city!: string;

  @Column('varchar', { nullable: true })
  email?: string;

  @OneToMany(() => Car, (car) => car.owner)
  cars!: Car[];

  constructor(partial: Partial<Client>) {
    Object.assign(this, partial);
  }
}
