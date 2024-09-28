import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { FlightTicket } from './flight-ticket.entity';

@Entity('airports')
export class Airport {
  @PrimaryColumn({ length: 3 })
  iataCode: string;

  @Column({ length: 100 })
  name: string;

  @Column('decimal', { precision: 10, scale: 6 })
  latitude: number;

  @Column('decimal', { precision: 10, scale: 6 })
  longitude: number;

  @Column({ length: 50, nullable: true })
  city: string;

  @Column({ length: 50, nullable: true })
  country: string;

  @OneToMany(() => FlightTicket, flightTicket => flightTicket.originAirport)
  departingFlights: FlightTicket[];

  @OneToMany(() => FlightTicket, flightTicket => flightTicket.destinationAirport)
  arrivingFlights: FlightTicket[];
}