// flight-weather-report.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { FlightTicket } from '../../flight/entities/flight-ticket.entity';

@Entity('flight_weather_reports')
export class FlightWeatherReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FlightTicket)
  @JoinColumn({ name: 'flight_id' })
  flight: FlightTicket;

  @Column({ name: 'flight_id' })
  flightId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column('jsonb', { name: 'origin_weather' })
  originWeather: object;

  @Column('jsonb', { name: 'destination_weather' })
  destinationWeather: object;

  @Column('jsonb', { name: 'report_data', nullable: true })
  reportData: object;
}