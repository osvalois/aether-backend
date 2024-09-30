import { Injectable } from '@nestjs/common';
import { CreateFlightTicketDto, UpdateFlightTicketDto } from '../dto/flight-ticket.dto';
import { AirportService } from '../services/airport.service';

@Injectable()
export class FlightValidator {
    constructor(private readonly airportService: AirportService) {}

    async validateCreateFlightData(flightTicket: CreateFlightTicketDto): Promise<string[]> {
        const errors: string[] = [];

        if (!flightTicket.origin || !flightTicket.destination) {
            errors.push('Origin and destination are required');
        }

        if (flightTicket.origin === flightTicket.destination) {
            errors.push('Origin and destination must be different');
        }

        if (!flightTicket.airline || !flightTicket.flightNum) {
            errors.push('Airline and flight number are required');
        }

        if (flightTicket.flightNum && !this.isValidFlightNumber(flightTicket.flightNum)) {
            errors.push('Invalid flight number format');
        }
        try {
            await this.airportService.ensureAirportsExist(flightTicket.origin, flightTicket.destination);
        } catch (error) {
            errors.push(error.message);
        }

        return errors;
    }

    async validateUpdateFlightData(flightTicket: UpdateFlightTicketDto): Promise<string[]> {
        const errors: string[] = [];

        if (flightTicket.origin && flightTicket.destination && flightTicket.origin === flightTicket.destination) {
            errors.push('Origin and destination must be different');
        }

        if (flightTicket.flightNum && !this.isValidFlightNumber(flightTicket.flightNum)) {
            errors.push('Invalid flight number format');
        }


        if (flightTicket.origin || flightTicket.destination) {
            try {
                await this.airportService.ensureAirportsExist(
                    flightTicket.origin || '',
                    flightTicket.destination || ''
                );
            } catch (error) {
                errors.push(error.message);
            }
        }

        return errors;
    }

    private isValidFlightNumber(flightNum: string): boolean {
        // This is a simple regex for flight numbers. Adjust as needed for your specific requirements.
        const flightNumRegex = /^[A-Z]{2,3}\d{1,4}[A-Z]?$/;
        return flightNumRegex.test(flightNum);
    }

    private isValidDate(dateString: string): boolean {
        const date = new Date(dateString);
        return !isNaN(date.getTime());
    }
}