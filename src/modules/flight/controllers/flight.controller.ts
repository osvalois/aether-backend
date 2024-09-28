import { Controller, Get, Post, Body, Param, UseInterceptors, NotFoundException, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FlightService } from '../services/flight.service';
import { CreateFlightTicketDto } from '../dto/create-flight-ticket.dto';
import { FlightTicketDto } from '../dto/flight-ticket.dto';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';
import { FlightTicket } from '../entities/flight-ticket.entity';

@ApiTags('flights')
@Controller('flights')
@UseInterceptors(TransformInterceptor)
export class FlightController {
  constructor(private readonly flightService: FlightService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new flight ticket' })
  @ApiResponse({ status: 201, description: 'The flight ticket has been successfully created.', type: FlightTicketDto })
  async createFlightTicket(@Body() createFlightTicketDto: CreateFlightTicketDto): Promise<FlightTicketDto> {
    const flightTicket = await this.flightService.ingestFlightData([createFlightTicketDto]);
    return new FlightTicketDto(flightTicket);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a flight ticket by id' })
  @ApiResponse({ status: 200, description: 'Return the flight ticket.', type: FlightTicketDto })
  async getFlightTicket(@Param('id') id: string): Promise<FlightTicketDto> {
    const flightTicket = await this.flightService.getFlightTicket(id);
    if (!flightTicket) {
      throw new NotFoundException(`Flight ticket with id ${id} not found.`);
    }
    return new FlightTicketDto(flightTicket);
  }

  @Get()
  @ApiOperation({ summary: 'Search for flights by origin and destination' })
  @ApiResponse({ status: 200, description: 'Returns a list of flight tickets matching the criteria.', type: FlightTicketDto, isArray: true })
  async searchFlights(@Query('origin') origin: string, @Query('destination') destination: string): Promise<FlightTicketDto[]> {
    const flightTickets = await this.flightService.searchFlights(origin, destination);
    return flightTickets.map(ticket => new FlightTicketDto(ticket));
  }
}
