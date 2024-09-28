import { EntityRepository, Repository } from 'typeorm';
import { FlightWeatherReport } from '../entities/flight-weather-report.entity';

@EntityRepository(FlightWeatherReport)
export class FlightWeatherReportRepository extends Repository<FlightWeatherReport> {
  async findByFlightId(flightId: string): Promise<FlightWeatherReport[]> {
    return this.find({
      where: { flightId },
      relations: ['flight', 'originWeather', 'destinationWeather'],
    });
  }

  async findLatestByFlightId(flightId: string): Promise<FlightWeatherReport | undefined> {
    return this.findOne({
      where: { flightId },
      relations: ['flight', 'originWeather', 'destinationWeather'],
      order: { createdAt: 'DESC' },
    });
  }
}
