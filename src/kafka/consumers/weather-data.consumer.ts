import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { Logger } from '../../utils/logger';
import { WeatherService } from '../../modules/weather/services/weather.service';
import { WeatherDataDto } from '../../modules/weather/dto/weather-data.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WeatherDataConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeatherDataConsumer.name);
  private consumer: KafkaJS.Consumer;
  private kafka: KafkaJS.Kafka;

  constructor(
    private readonly weatherService: WeatherService,
    private configService: ConfigService
  ) {
    this.kafka = new KafkaJS.Kafka({
      kafkaJS: {
        clientId: this.configService.get('KAFKA_CLIENT_ID'),
        brokers: [this.configService.get('KAFKA_BROKERS')],
        ssl: true,
        sasl: {
          mechanism: 'plain',
          username: this.configService.get('KAFKA_API_KEY'),
          password: this.configService.get('KAFKA_API_SECRET'),
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
    await this.consumer.subscribe({ topics: ['weather-data-updates', 'flight-data-ingested'] });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          if (topic === 'weather-data-updates') {
            await this.processWeatherData(message);
          } else if (topic === 'flight-data-ingested') {
            await this.processFlightData(message);
          }
        } catch (error) {
          this.logger.error(`Error processing message: ${error.message}`, error.stack);
          // Implement your error handling strategy here (e.g., dead letter queue, retry mechanism)
        }
      },
    });
  }

  private async processWeatherData(message: KafkaJS.Message) {
    if (!message.value) {
      this.logger.warn('Received weather data message with no value');
      return;
    }

    const weatherData: WeatherDataDto = JSON.parse(message.value.toString());
    this.logger.log(`Processing weather data for airport: ${weatherData.airportCode}`);

    await this.weatherService.updateWeatherData(weatherData);

    this.logger.log(`Successfully processed weather data for airport: ${weatherData.airportCode}`);
  }

  private async processFlightData(message: KafkaJS.Message) {
    if (!message.value) {
      this.logger.warn('Received flight data message with no value');
      return;
    }

    const flightData = JSON.parse(message.value.toString());
    this.logger.log(`Processing flight data for flight: ${flightData.flightNum}`);

    // Trigger weather data fetch for origin and destination airports
    await Promise.all([
      this.weatherService.getWeatherForAirport(flightData.origin),
      this.weatherService.getWeatherForAirport(flightData.destination)
    ]);

    this.logger.log(`Successfully processed flight data for flight: ${flightData.flightNum}`);
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }
}