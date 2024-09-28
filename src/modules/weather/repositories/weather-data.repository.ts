import { Between, EntityRepository, Repository } from 'typeorm';
import { WeatherData } from '../entities/weather-data.entity';

@EntityRepository(WeatherData)
export class WeatherDataRepository extends Repository<WeatherData> {
  async findLatestByAirportCode(airportCode: string): Promise<WeatherData | undefined> {
    return this.findOne({
      where: { airportCode },
      order: { timestamp: 'DESC' },
    });
  }

  async findByAirportCodeAndDateRange(
    airportCode: string,
    startDate: Date,
    endDate: Date,
  ): Promise<WeatherData[]> {
    return this.find({
      where: {
        airportCode,
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'ASC' },
    });
  }
}