import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { ConfigService } from '@nestjs/config';
import { FlightTicket } from '../../modules/flight/entities/flight-ticket.entity';

@Injectable()
export class FlightDataProducer implements OnModuleInit, OnModuleDestroy {
  private producer: KafkaJS.Producer;
  private kafka: KafkaJS.Kafka;

  constructor(private configService: ConfigService) {
    this.kafka = new KafkaJS.Kafka({
      kafkaJS: {
        clientId: process.env.KAFKA_CLIENT_ID || '',
        brokers: [process.env.KAFKA_BROKERS || ''],
       ssl: true,
        sasl: {
          mechanism: 'plain',
          username: process.env.KAFKA_API_KEY || '',
          password: process.env.KAFKA_API_SECRET || '',
        },
      }
    });

    this.producer = this.kafka.producer({
      kafkaJS: {
        allowAutoTopicCreation: true,
        acks: 1,
        compression: KafkaJS.CompressionTypes.GZIP,
      }
    });
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publishFlightData(flightTicket: FlightTicket): Promise<void> {
    const message: KafkaJS.Message = {
      key: flightTicket.id,
      value: JSON.stringify(flightTicket),
      headers: {
        'content-type': 'application/json',
      },
    };

    await this.producer.send({
      topic: 'flight-data-ingested',
      messages: [message],
    });
  }
}