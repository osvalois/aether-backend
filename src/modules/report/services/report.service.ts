// report.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightService } from '../../flight/services/flight.service';
import { WeatherService } from '../../weather/services/weather.service';
import { FlightWeatherReport } from '../entities/flight-weather-report.entity';
import { FlightWeatherReportDto } from '../dto/flight-weather-report.dto';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(FlightWeatherReport)
    private flightWeatherReportRepository: Repository<FlightWeatherReport>,
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

  async generateReportsForAllFlights(): Promise<void> {
    const flightData = await this.flightService.getAllFlightTickets();
    
    const errors = [];
    
    for (const flight of flightData.tickets) {
      try {
        await this.generateReport(flight.id);
      } catch (error) {
        errors.push({ flightId: flight.id, error: error.message });
      }
    }
  
    if (errors.length > 0) {
      console.error(`Failed to generate reports for ${errors.length} flights:`, errors);
    }
  }

  async getReportById(id: string): Promise<FlightWeatherReportDto> {
    const report = await this.flightWeatherReportRepository.findOne({ 
      where: { id }, 
      relations: ['flight', 'originWeather', 'destinationWeather'] 
    });

    if (!report) {
      throw new NotFoundException(`Report with ID "${id}" not found`);
    }

    return this.mapToDto(report);
  }

  async getLatestReportForFlight(flightId: string): Promise<FlightWeatherReportDto> {
    const report = await this.flightWeatherReportRepository.findOne({
      where: { flight: { id: flightId } },
      order: { createdAt: 'DESC' },
      relations: ['flight', 'originWeather', 'destinationWeather']
    });

    if (!report) {
      throw new NotFoundException(`No report found for flight with ID "${flightId}"`);
    }

    return this.mapToDto(report);
  }

  private mapToDto(report: FlightWeatherReport): FlightWeatherReportDto {
    return new FlightWeatherReportDto({
      id: report.id,
      flightId: report.flight.id,
      createdAt: report.createdAt,
      originWeather: report.originWeather,
      destinationWeather: report.destinationWeather,
    });
  }
}