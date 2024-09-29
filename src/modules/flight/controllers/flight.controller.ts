import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpStatus, UseInterceptors, HttpException, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { FlightService } from '../services/flight.service';
import { CreateFlightTicketDto, UpdateFlightTicketDto, FlightTicketDto, BulkCreateFlightTicketDto, BulkIngestionResultDto } from '../dto/flight-ticket.dto';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';
import { Logger } from 'src/utils/logger';

@ApiTags('flights')
@Controller('flights')
@UseInterceptors(TransformInterceptor)
export class FlightController {
  private readonly logger = new Logger(FlightController.name);

  constructor(private readonly flightService: FlightService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new flight ticket' })
  @ApiBody({ type: CreateFlightTicketDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'The flight ticket has been successfully created.', type: FlightTicketDto })
  async createFlightTicket(@Body(new ValidationPipe()) createFlightTicketDto: CreateFlightTicketDto): Promise<FlightTicketDto> {
    try {
      const result = await this.flightService.bulkIngestFlightData([createFlightTicketDto]);
      if (result.successCount === 1) {
        return result.successfulTickets[0];
      } else {
        throw new HttpException('Failed to create flight ticket', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } catch (error) {
      this.logger.error(`Failed to create flight ticket: ${error.message}`, error.stack);
      throw new HttpException('Failed to create flight ticket', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create flight tickets' })
  @ApiBody({ type: BulkCreateFlightTicketDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Flight tickets have been successfully created.', type: BulkIngestionResultDto })
  async bulkCreateFlightTickets(@Body(new ValidationPipe({ transform: true, validateCustomDecorators: true })) bulkCreateFlightTicketDto: BulkCreateFlightTicketDto): Promise<BulkIngestionResultDto> {
    try {
      const result = await this.flightService.bulkIngestFlightData(bulkCreateFlightTicketDto.flightTickets);
      if (result.failureCount > 0) {
        throw new HttpException({
          message: 'Partial success in bulk ingestion',
          result: result
        }, HttpStatus.PARTIAL_CONTENT);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Bulk ingestion failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get a flight ticket by id' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return the flight ticket.', type: FlightTicketDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Flight ticket not found.' })
  async getFlightTicket(@Param('id') id: string): Promise<FlightTicketDto> {
    try {
      return await this.flightService.getFlightTicket(id);
    } catch (error) {
      this.logger.error(`Failed to get flight ticket: ${error.message}`, error.stack);
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Search for flights' })
  @ApiQuery({ name: 'origin', required: false })
  @ApiQuery({ name: 'destination', required: false })
  @ApiQuery({ name: 'page', required: false, type: 'number' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns a list of flight tickets matching the criteria.', type: [FlightTicketDto] })
  async searchFlights(
    @Query('origin') origin?: string,
    @Query('destination') destination?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ): Promise<{ tickets: FlightTicketDto[], total: number }> {
    try {
      if (origin || destination) {
        const tickets = await this.flightService.searchFlights(origin, destination);
        return { tickets, total: tickets.length };
      } else {
        return await this.flightService.getAllFlightTickets(page, limit);
      }
    } catch (error) {
      this.logger.error(`Failed to search flights: ${error.message}`, error.stack);
      throw new HttpException('Failed to search flights', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a flight ticket' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateFlightTicketDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'The flight ticket has been successfully updated.', type: FlightTicketDto })
  async updateFlightTicket(
    @Param('id') id: string,
    @Body(new ValidationPipe()) updateFlightTicketDto: UpdateFlightTicketDto
  ): Promise<FlightTicketDto> {
    try {
      return await this.flightService.updateFlightTicket(id, updateFlightTicketDto);
    } catch (error) {
      this.logger.error(`Failed to update flight ticket: ${error.message}`, error.stack);
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a flight ticket' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The flight ticket has been successfully deleted.' })
  async deleteFlightTicket(@Param('id') id: string): Promise<void> {
    try {
      await this.flightService.deleteFlightTicket(id);
    } catch (error) {
      this.logger.error(`Failed to delete flight ticket: ${error.message}`, error.stack);
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @Delete('bulk')
  @ApiOperation({ summary: 'Bulk delete flight tickets' })
  @ApiBody({ type: [String] })
  @ApiResponse({ status: HttpStatus.OK, description: 'The flight tickets have been successfully deleted.', type: Object })
  async bulkDeleteFlightTickets(@Body() ids: string[]): Promise<{ deletedCount: number }> {
    try {
      return await this.flightService.bulkDeleteFlightTickets(ids);
    } catch (error) {
      this.logger.error(`Failed to bulk delete flight tickets: ${error.message}`, error.stack);
      throw new HttpException('Failed to bulk delete flight tickets', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}