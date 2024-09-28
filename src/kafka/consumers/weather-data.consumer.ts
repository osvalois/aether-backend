import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { Logger } from '../../utils/logger';
import { WeatherService } from 'src/modules/weather/services/weather.service';

@Injectable()
export class WeatherDataConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeatherDataConsumer.name);
  private consumer: KafkaJS.Consumer;
  private kafka: KafkaJS.Kafka;

  constructor(private readonly weatherService: WeatherService) {
    this.kafka = new KafkaJS.Kafka({
      kafkaJS: {
        clientId: process.env.KAFKA_CLIENT_ID || 'aether-backend',
        brokers: ['pkc-zgp5j7.us-south1.gcp.confluent.cloud:9092'],
        ssl: true,
        sasl: {
          mechanism: 'plain',
          username: process.env.KAFKA_API_KEY || '24T6O7XQAMPYNJ6F',
          password: process.env.KAFKA_API_SECRET || 'O/6Y156iyEwlUkONrRTDDDngyCWhtBhOr5PJJQWUZ/oFSrdXgvQoX7h7MO3RJ0QJ',
        },
      }
    });

    this.consumer = this.kafka.consumer({
      kafkaJS: {
        groupId: 'weather-data-group',
        fromBeginning: false,
      },
    });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumeWeatherData();
  }

  async consumeWeatherData() {
    await this.consumer.subscribe({ topic: 'weather-data-updates' });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          await this.processMessage(message);
        } catch (error) {
          this.logger.error(`Error processing message: ${error.message}`, error.stack);
          // Implementa tu estrategia de manejo de errores aquí (por ejemplo, cola de mensajes muertos, mecanismo de reintento)
        }
      },
    });
  }

  private async processMessage(message: KafkaJS.Message) {
    if (!message.value) {
      this.logger.warn('Received message with no value');
      return;
    }

    const weatherData = JSON.parse(message.value.toString());
    this.logger.log(`Processing weather data for airport: ${weatherData.airportCode}`);

    await this.weatherService.updateWeatherData(weatherData);

    this.logger.log(`Successfully processed weather data for airport: ${weatherData.airportCode}`);
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}