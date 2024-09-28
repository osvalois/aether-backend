import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('weather_data')
export class WeatherData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 3 })
  airportCode: string;

  @Column({ type: 'timestamp with time zone' })
  timestamp: Date;

  @Column('decimal', { precision: 5, scale: 2 })
  temperature: number;

  @Column('decimal', { precision: 5, scale: 2 })
  humidity: number;

  @Column('decimal', { precision: 5, scale: 2 })
  windSpeed: number;

  @Column({ length: 3 })
  windDirection: string;

  @Column({ length: 100, nullable: true })
  condition: string;

  @Column('integer', { nullable: true })
  pressure: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  visibility: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}