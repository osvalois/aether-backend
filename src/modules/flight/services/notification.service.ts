import { Injectable, Logger } from '@nestjs/common';
import { AirportDto, BulkIngestionResultDto, FlightTicketDto } from '../dto/flight-ticket.dto';
import { WebSocketService } from 'src/ws/web-socket.service';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(private readonly webSocketService: WebSocketService) {}

    // Flight Notifications
    notifyFlightTicketRetrieved(ticket: FlightTicketDto): void {
        this.sendNotification('flightTicketRetrieved', ticket);
    }

    notifyNewFlightTicket(ticket: FlightTicketDto): void {
        this.sendNotification('newFlightTicket', ticket);
    }

    notifyFlightTicketUpdated(ticket: FlightTicketDto): void {
        this.sendNotification('flightTicketUpdated', ticket);
    }

    notifyFlightTicketDeleted(id: string): void {
        this.sendNotification('flightTicketDeleted', { id });
    }

    notifyNewFlightTickets(tickets: FlightTicketDto[]): void {
        this.sendNotification('newFlightTickets', tickets);
    }

    notifyBulkFlightTicketsDeleted(result: { deletedCount: number; ids: string[] }): void {
        this.sendNotification('bulkFlightTicketsDeleted', result);
    }

    notifyAllFlightTicketsRetrieved(data: { page: number; limit: number; totalCount: number }): void {
        this.sendNotification('allFlightTicketsRetrieved', data);
    }

    notifyBulkIngestionResult(result: BulkIngestionResultDto): void {
        this.sendNotification('bulkIngestionResult', result);
    }

    notifyBacklogProcessed(data: { processedCount: number }): void {
        this.sendNotification('backlogProcessed', data);
    }

    // Airport Notifications
    notifyNewAirport(airport: AirportDto): void {
        this.sendNotification('newAirport', airport);
    }

    notifyAirportUpdated(airport: AirportDto): void {
        this.sendNotification('airportUpdated', airport);
    }

    notifyAirportDeleted(iataCode: string): void {
        this.sendNotification('airportDeleted', { iataCode });
    }

    notifyBulkAirportsUpserted(count: number): void {
        this.sendNotification('bulkAirportsUpserted', { count });
    }

    // Search Notifications
    notifyFlightSearchResults(data: { origin: string; destination: string; resultsCount: number }): void {
        this.sendNotification('flightSearchResults', data);
    }

    // Generic Notification Method
    private sendNotification(event: string, data: any): void {
        try {
            this.webSocketService.sendToAll(event, data);
            this.logger.debug(`Sent ${event} notification`);
        } catch (error) {
            this.logger.error(`Failed to send ${event} notification: ${error.message}`);
        }
    }

    // Targeted Notifications
    sendToUser(userId: string, event: string, data: any): void {
        try {
            this.webSocketService.sendToUser(userId, event, data);
            this.logger.debug(`Sent ${event} notification to user ${userId}`);
        } catch (error) {
            this.logger.error(`Failed to send ${event} notification to user ${userId}: ${error.message}`);
        }
    }


    // System Notifications
    notifySystemError(error: Error): void {
        this.sendNotification('systemError', {
            message: error.message,
            stack: error.stack
        });
    }

    notifySystemStatus(status: string): void {
        this.sendNotification('systemStatus', { status });
    }

    // Maintenance Notifications
    notifyMaintenanceScheduled(data: { startTime: Date; endTime: Date; description: string }): void {
        this.sendNotification('maintenanceScheduled', data);
    }

    notifyMaintenanceStarted(): void {
        this.sendNotification('maintenanceStarted', { time: new Date() });
    }

    notifyMaintenanceEnded(): void {
        this.sendNotification('maintenanceEnded', { time: new Date() });
    }
}