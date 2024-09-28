import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, Message } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { FlightTicket } from '../../modules/flight/entities/flight-ticket.entity';

@Injectable()
export class FlightDataProducer implements OnModuleInit, OnModuleDestroy {
  private producer: Producer;

  constructor(private configService: ConfigService) {
    const kafka = new Kafka({
      clientId: 'aether-backend',
      brokers: this.configService.get<string[]>('kafka.brokers'),
    });
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publishFlightData(flightTicket: FlightTicket): Promise<void> {
    const message: Message = {
      key: flightTicket.id,
      value: JSON.stringify(flightTicket),
    };

    await this.producer.send({
      topic: 'flight-data-ingested',
      messages: [message],
    });
  }
}