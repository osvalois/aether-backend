import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FlightService } from '../../flight/services/flight.service';
import { WeatherService } from '../../weather/services/weather.service';
import { FlightWeatherReport } from '../entities/flight-weather-report.entity';
import { ReportGenerationLog } from '../entities/report-generation-log.entity';
import { FlightWeatherReportDto } from '../dto/flight-weather-report.dto';
import { FlightTicket } from '../../flight/entities/flight-ticket.entity';
import { FlightTicketDto } from '../../flight/dto/flight-ticket.dto';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectRepository(FlightWeatherReport)
    private flightWeatherReportRepository: Repository<FlightWeatherReport>,
    @InjectRepository(ReportGenerationLog)
    private reportGenerationLogRepository: Repository<ReportGenerationLog>,
    @InjectRepository(FlightTicket)
    private flightTicketRepository: Repository<FlightTicket>,
    private flightService: FlightService,
    private weatherService: WeatherService,
    private dataSource: DataSource
  ) {}

  async generateReport(flightId: string): Promise<FlightWeatherReportDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const flightDto = await this.flightService.getFlightTicket(flightId);
      if (!flightDto) {
        throw new NotFoundException(`Flight with ID "${flightId}" not found`);
      }

      const [originWeather, destinationWeather] = await Promise.all([
        this.weatherService.getWeatherForAirport(flightDto.origin),
        this.weatherService.getWeatherForAirport(flightDto.destination),
      ]);

      const reportData = this.generateReportData(this.convertDtoToReportFormat(flightDto), originWeather, destinationWeather);

      const report = queryRunner.manager.create(FlightWeatherReport, {
        flight: { id: flightDto.id } as FlightTicket,
        flightId: flightDto.id,
        originWeather,
        destinationWeather,
        reportData,
      });

      await queryRunner.manager.save(report);

      const logEntry = queryRunner.manager.create(ReportGenerationLog, {
        totalProcessed: 1,
        processedTickets: [flightDto],
        processDetails: { reportId: report.id, flightId: flightId },
        errors: [],
      });

      await queryRunner.manager.save(logEntry);

      await queryRunner.commitTransaction();

      return this.mapToDto(report);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to generate report for flight ${flightId}: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async generateReportsForAllFlights(): Promise<void> {
    const batchSize = 100;
    let processedCount = 0;
    let totalFlights = await this.flightTicketRepository.count();
    let errors = [];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      while (processedCount < totalFlights) {
        const flights = await this.flightTicketRepository.find({
          take: batchSize,
          skip: processedCount,
          relations: ['originAirport', 'destinationAirport'],
        });

        const airportCodes = new Set(flights.flatMap(f => [f.origin, f.destination]));
        const weatherData = await this.weatherService.getBulkWeatherForAirports(Array.from(airportCodes));

        const reports = flights.map(flight => {
          const originWeather = weatherData[flight.origin];
          const destinationWeather = weatherData[flight.destination];
          const reportData = this.generateReportData(flight, originWeather, destinationWeather);

          return queryRunner.manager.create(FlightWeatherReport, {
            flight,
            flightId: flight.id,
            originWeather,
            destinationWeather,
            reportData,
          });
        });

        await queryRunner.manager.save(reports);

        processedCount += flights.length;
        
        const logEntry = queryRunner.manager.create(ReportGenerationLog, {
          totalProcessed: processedCount,
          processedTickets: flights,
          processDetails: { batchSize, currentBatch: processedCount / batchSize },
          errors,
        });

        await queryRunner.manager.save(logEntry);

        this.logger.log(`Processed ${processedCount}/${totalFlights} flights`);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to generate reports for all flights: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private convertDtoToReportFormat(flightDto: FlightTicketDto): Pick<FlightTicket, 'flightNum' | 'airline' | 'origin' | 'destination'> {
    return {
      flightNum: flightDto.flightNum,
      airline: flightDto.airline,
      origin: flightDto.origin,
      destination: flightDto.destination,
    };
  }

  private generateReportData(
    flight: Pick<FlightTicket, 'flightNum' | 'airline' | 'origin' | 'destination'>,
    originWeather: any,
    destinationWeather: any
  ): object {
    return {
      flightDetails: {
        flightNumber: flight.flightNum,
        airline: flight.airline,
        origin: flight.origin,
        destination: flight.destination,
      },
      weatherSummary: {
        origin: {
          temperature: originWeather.temperature,
          conditions: originWeather.conditions,
        },
        destination: {
          temperature: destinationWeather.temperature,
          conditions: destinationWeather.conditions,
        },
      },
      potentialImpact: this.analyzePotentialImpact(originWeather, destinationWeather),
    };
  }

  private analyzePotentialImpact(originWeather: any, destinationWeather: any): string {
    if (originWeather.conditions === 'Stormy' || destinationWeather.conditions === 'Stormy') {
      return 'High risk of delay or cancellation';
    } else if (originWeather.conditions === 'Cloudy' || destinationWeather.conditions === 'Cloudy') {
      return 'Moderate risk of delay';
    } else {
      return 'Low risk of weather-related issues';
    }
  }

  async getReportById(id: string): Promise<FlightWeatherReportDto> {
    const report = await this.flightWeatherReportRepository.findOne({ 
      where: { id },
      relations: ['flight'],
    });

    if (!report) {
      throw new NotFoundException(`Report with ID "${id}" not found`);
    }

    return this.mapToDto(report);
  }

  async getLatestReportForFlight(flightId: string): Promise<FlightWeatherReportDto> {
    const report = await this.flightWeatherReportRepository.findOne({
      where: { flightId },
      order: { createdAt: 'DESC' },
      relations: ['flight'],
    });

    if (!report) {
      throw new NotFoundException(`No report found for flight with ID "${flightId}"`);
    }

    return this.mapToDto(report);
  }

  private mapToDto(report: FlightWeatherReport): FlightWeatherReportDto {
    return new FlightWeatherReportDto({
      id: report.id,
      flightId: report.flightId,
      createdAt: report.createdAt,
      originWeather: report.originWeather,
      destinationWeather: report.destinationWeather,
      reportData: report.reportData,
    });
  }

  async getReportGenerationLogs(page: number = 1, limit: number = 10): Promise<ReportGenerationLog[]> {
    return this.reportGenerationLogRepository.find({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async getReportGenerationLogById(id: string): Promise<ReportGenerationLog> {
    const log = await this.reportGenerationLogRepository.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException(`Report generation log with ID "${id}" not found`);
    }
    return log;
  }
}