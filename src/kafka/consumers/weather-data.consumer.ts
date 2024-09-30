import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { Logger } from '../../utils/logger';
import { WeatherService } from '../../modules/weather/services/weather.service';
import { WeatherDataDto } from '../../modules/weather/dto/weather-data.dto';
import { ConfigService } from '@nestjs/config';
import { PrometheusService } from 'src/prometeus/prometheus.service';

@Injectable()
export class WeatherDataConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeatherDataConsumer.name);
  private consumer: KafkaJS.Consumer;
  private kafka: KafkaJS.Kafka;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(
    private readonly weatherService: WeatherService,
    private configService: ConfigService,
    private prometheusService: PrometheusService
  ) {
    this.kafka = new KafkaJS.Kafka({
      kafkaJS: {
        brokers: this.configService.get('KAFKA_BROKERS').split(','),
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
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxBytes: 1048576, // 1MB
        retry: {
          initialRetryTime: 100,
          retries: 8
        }
      },
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  private async connectWithRetry(retries = 0) {
    try {
      await this.consumer.connect();
      this.logger.log('Successfully connected to Kafka');
      await this.consumeData();
    } catch (error) {
      if (retries < this.maxRetries) {
        this.logger.warn(`Failed to connect to Kafka. Retrying in ${this.retryDelay}ms...`);
        setTimeout(() => this.connectWithRetry(retries + 1), this.retryDelay);
      } else {
        this.logger.error(`Failed to connect to Kafka after ${this.maxRetries} attempts: ${error.message}`, error.stack);
        // Implement notification logic here (e.g., send an alert to operations team)
      }
    }
  }

  async consumeData() {
    try {
      await this.consumer.subscribe({ topics: ['weather-data-updates', 'flight-data-ingested'] });
      this.logger.log('Successfully subscribed to Kafka topics');
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          this.logger.log(`Received message from topic: ${topic}, partition: ${partition}, offset: ${message.offset}`);
          try {
            this.logger.log(`Processing data for topic: ${topic}`);
            if (topic === 'weather-data-updates') {
              await this.processWeatherData(message);
            } else if (topic === 'flight-data-ingested') {
              await this.processFlightData(message);
            } else {
              this.logger.warn(`Received message for unexpected topic: ${topic}`);
            }
            this.prometheusService.incrementMessageProcessed(topic);
          } catch (error) {
            this.logger.error(`Error processing message: ${error.message}`, error.stack);
            this.prometheusService.incrementMessageFailed(topic);
            await this.handleProcessingError(topic, message, error);
          }
        },
      });
    } catch (error) {
      this.logger.error(`Failed to consume data: ${error.message}`, error.stack);
      await this.connectWithRetry();
    }
  }

  private async processWeatherData(message: KafkaJS.Message) {
    if (!message.value) {
      this.logger.warn('Received weather data message with no value');
      return;
    }

    const weatherData: WeatherDataDto = JSON.parse(message.value.toString());
    this.logger.log(`Processing weather data for airport: ${weatherData.airportCode}`);

    const startTime = Date.now();
    await this.weatherService.updateWeatherData(weatherData);
    const processingTime = Date.now() - startTime;

    this.logger.log(`Successfully processed weather data for airport: ${weatherData.airportCode} in ${processingTime}ms`);
    this.prometheusService.recordProcessingTime('weather-data-updates', processingTime);
  }

  private async processFlightData(message: KafkaJS.Message) {
    if (!message.value) {
      this.logger.warn('Received flight data message with no value');
      return;
    }
  
    const flightData = JSON.parse(message.value.toString());
    this.logger.log(`Processing flight data for flight: ${flightData.flightNum}`);
  
    const startTime = Date.now();
    await Promise.all([
      this.weatherService.getWeatherForAirport(flightData.origin),
      this.weatherService.getWeatherForAirport(flightData.destination)
    ]);
    const processingTime = Date.now() - startTime;
  
    this.logger.log(`Successfully processed flight data for flight: ${flightData.flightNum} in ${processingTime}ms`);
    this.prometheusService.recordProcessingTime('flight-data-ingested', processingTime);
  }

  private async handleProcessingError(topic: string, message: KafkaJS.Message, error: Error) {
    const retryCount = parseInt(message.headers?.retryCount?.toString() || '0');
    if (retryCount < this.maxRetries) {
      await this.retryMessage(topic, message, retryCount + 1);
    } else {
      await this.sendToDeadLetterQueue(topic, message, error);
    }
  }

  private async retryMessage(topic: string, message: KafkaJS.Message, retryCount: number) {
    this.logger.log(`Retrying message for topic ${topic}. Attempt ${retryCount} of ${this.maxRetries}`);
    const retryMessage = {
      ...message,
      headers: {
        ...message.headers,
        retryCount: Buffer.from(retryCount.toString()),
      },
    };
    await this.kafka.producer().send({
      topic,
      messages: [retryMessage],
    });
  }

  private async sendToDeadLetterQueue(topic: string, message: KafkaJS.Message, error: Error) {
    this.logger.warn(`Sending message to Dead Letter Queue for topic ${topic}`);
    const deadLetterTopic = `${topic}-dead-letter`;
    await this.kafka.producer().send({
      topic: deadLetterTopic,
      messages: [{
        ...message,
        headers: {
          ...message.headers,
          errorMessage: Buffer.from(error.message),
          errorStack: Buffer.from(error.stack || ''),
        },
      }],
    });
  }

  async onModuleDestroy() {
    try {
      await this.consumer.disconnect();
      this.logger.log('Successfully disconnected from Kafka');
    } catch (error) {
      this.logger.error(`Error disconnecting from Kafka: ${error.message}`, error.stack);
    }
  }
}