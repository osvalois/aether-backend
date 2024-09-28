import { Entity, Column, PrimaryColumn } from 'typeorm';

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
}