import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Airport } from './airport.entity';

@Entity('flight_tickets')
export class FlightTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 3 })
  origin: string;

  @Column({ length: 3 })
  destination: string;

  @Column({ length: 2 })
  airline: string;

  @Column({ name: 'flight_num', length: 10 })
  flightNum: string;

  @ManyToOne(() => Airport)
  @JoinColumn({ name: 'origin', referencedColumnName: 'iataCode' })
  originAirport: Airport;

  @ManyToOne(() => Airport)
  @JoinColumn({ name: 'destination', referencedColumnName: 'iataCode' })
  destinationAirport: Airport;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}

