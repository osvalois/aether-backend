import { EntityRepository, Repository } from 'typeorm';
import { FlightTicket } from '../entities/flight-ticket.entity';

@EntityRepository(FlightTicket)
export class FlightTicketRepository extends Repository<FlightTicket> {
  async findByFlightNumber(airline: string, flightNum: string): Promise<FlightTicket | undefined> {
    return this.findOne({ where: { airline, flightNum } });
  }

  async findByRoute(origin: string, destination: string): Promise<FlightTicket[]> {
    return this.find({ where: { origin, destination } });
  }

  async createFlightTicket(flightTicketData: Partial<FlightTicket>): Promise<FlightTicket> {
    const flightTicket = this.create(flightTicketData);
    return this.save(flightTicket);
  }
}