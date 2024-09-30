// src/kafka/producers/weather-data.producer.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { ConfigService } from '@nestjs/config';
import { WeatherData } from '../../modules/weather/entities/weather-data.entity';

@Injectable()
export class WeatherDataProducer implements OnModuleInit, OnModuleDestroy {
  private producer: KafkaJS.Producer;
  private kafka: KafkaJS.Kafka;

  constructor(private configService: ConfigService) {
    this.kafka = new KafkaJS.Kafka({
      kafkaJS: {
        brokers: [this.configService.get('KAFKA_BROKERS')],
        ssl: true,
        sasl: {
          mechanism: 'plain',
          username: this.configService.get('KAFKA_API_KEY'),
          password: this.configService.get('KAFKA_API_SECRET'),
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

  async publishWeatherData(weatherData: WeatherData): Promise<void> {
    const message: KafkaJS.Message = {
      key: weatherData.airportCode,
      value: JSON.stringify(weatherData),
      headers: {
        'content-type': 'application/json',
      },
    };

    await this.producer.send({
      topic: 'weather-data-updates',
      messages: [message],
    });
  }
}