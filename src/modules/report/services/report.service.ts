import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FlightWeatherReportRepository } from '../repositories/flight-weather-report.repository';
import { FlightService } from '../../flight/services/flight.service';
import { WeatherService } from '../../weather/services/weather.service';
import { FlightWeatherReport } from '../entities/flight-weather-report.entity';
import { FlightWeatherReportDto } from '../dto/flight-weather-report.dto';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(FlightWeatherReportRepository)
    private flightWeatherReportRepository: FlightWeatherReportRepository,
    private flightService: FlightService,
    private weatherService: WeatherService,
  ) {}

  async generateReport(flightId: string): Promise<FlightWeatherReportDto> {
    const flight = await this.flightService.getFlightTicket(flightId);
    if (!flight) {
      throw new NotFoundException(`Flight with ID "${flightId}" not found`);
    }

    const [originWeather, destinationWeather] = await Promise.all([
      this.weatherService.getWeatherForAirport(flight.origin),
      this.weatherService.getWeatherForAirport(flight.destination),
    ]);

    const report = this.flightWeatherReportRepository.create({
      flight,
      originWeather,
      destinationWeather,
    });

    await this.flightWeatherReportRepository.save(report);

    return this.mapToDto(report);
  }

  async getReportById(id: string): Promise<FlightWeatherReportDto> {
    const report = await this.flightWeatherReportRepository.findOne({ where: { id }, relations: ['flight', 'originWeather', 'destinationWeather'] }); // Ajuste aquí

    if (!report) {
      throw new NotFoundException(`Report with ID "${id}" not found`);
    }

    return this.mapToDto(report);
  }

  async getLatestReportForFlight(flightId: string): Promise<FlightWeatherReportDto> {
    const report = await this.flightWeatherReportRepository.findLatestByFlightId(flightId);

    if (!report) {
      throw new NotFoundException(`No report found for flight with ID "${flightId}"`);
    }

    return this.mapToDto(report);
  }

  private mapToDto(report: FlightWeatherReport): FlightWeatherReportDto {
    return {
      id: report.id,
      flightId: report.flight.id,
      createdAt: report.createdAt,
      originWeather: report.originWeather,
      destinationWeather: report.destinationWeather,
    };
  }
}
