// report.controller.ts (sin cambios, pero incluido para completitud)
import { Controller, Get, Post, Param, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReportService } from '../services/report.service';
import { FlightWeatherReportDto } from '../dto/flight-weather-report.dto';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';

@ApiTags('reports')
@Controller('reports')
@UseInterceptors(TransformInterceptor)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post(':flightId')
  @ApiOperation({ summary: 'Generate a weather report for a flight' })
  @ApiResponse({ status: 201, description: 'The report has been successfully generated.', type: FlightWeatherReportDto })
  async generateReport(@Param('flightId') flightId: string): Promise<FlightWeatherReportDto> {
    return await this.reportService.generateReport(flightId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a weather report by id' })
  @ApiResponse({ status: 200, description: 'Return the weather report.', type: FlightWeatherReportDto })
  async getReport(@Param('id') id: string): Promise<FlightWeatherReportDto> {
    return await this.reportService.getReportById(id);
  }

  @Get('latest/:flightId')
  @ApiOperation({ summary: 'Get the latest weather report for a flight' })
  @ApiResponse({ status: 200, description: 'Return the latest weather report for the flight.', type: FlightWeatherReportDto })
  async getLatestReport(@Param('flightId') flightId: string): Promise<FlightWeatherReportDto> {
    return await this.reportService.getLatestReportForFlight(flightId);
  }
}