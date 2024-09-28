import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { FlightTicket } from '../../flight/entities/flight-ticket.entity';
import { WeatherData } from '../../weather/entities/weather-data.entity';

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

  @ManyToOne(() => WeatherData)
  @JoinColumn({ name: 'origin_weather_id' })
  originWeather: WeatherData;

  @Column({ name: 'origin_weather_id' })
  originWeatherId: string;

  @ManyToOne(() => WeatherData)
  @JoinColumn({ name: 'destination_weather_id' })
  destinationWeather: WeatherData;

  @Column({ name: 'destination_weather_id' })
  destinationWeatherId: string;
}