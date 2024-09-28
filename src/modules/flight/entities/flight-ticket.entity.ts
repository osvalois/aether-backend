import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Airport } from './airport.entity';

@Entity('flight_tickets')
export class FlightTicket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 3 })
  origin!: string;

  @Column({ length: 3 })
  destination!: string;

  @Column({ length: 2 })
  airline!: string;

  @Column({ name: 'flight_num', length: 10 })
  flightNum!: string;

  @ManyToOne(() => Airport, { eager: true })
  @JoinColumn({ name: 'origin_airport', referencedColumnName: 'iataCode' })
  originAirport!: Airport;

  @ManyToOne(() => Airport, { eager: true })
  @JoinColumn({ name: 'destination_airport', referencedColumnName: 'iataCode' })
  destinationAirport!: Airport;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}