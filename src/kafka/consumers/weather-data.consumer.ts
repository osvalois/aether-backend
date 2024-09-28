import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { Logger } from '../../utils/logger';
import { WeatherService } from 'src/modules/weather/services/weather.service';

@Injectable()
export class WeatherDataConsumer implements OnModuleInit {
  private readonly logger = new Logger(WeatherDataConsumer.name);
  private consumer: Consumer;

  constructor(private readonly weatherService: WeatherService) {
    const kafka = new Kafka({
      clientId: 'your-client-id', // Cambia esto según tu configuración
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    });
    this.consumer = kafka.consumer({ groupId: 'weather-data-group' }); // Cambia el groupId según tus necesidades
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumeWeatherData();
  }

  async consumeWeatherData() {
    await this.consumer.subscribe({ topic: 'weather-data-updates', fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        await this.processMessage(message);
      },
    });
  }

  private async processMessage(message: any) {
    try {
      const weatherData = JSON.parse(message.value.toString());
      this.logger.log(`Processing weather data for airport: ${weatherData.airportCode}`);

      await this.weatherService.updateWeatherData(weatherData);

      this.logger.log(`Successfully processed weather data for airport: ${weatherData.airportCode}`);
    } catch (error) {
      this.logger.error(`Error processing weather data: ${error.message}`, error.stack);
      // Manejo de errores según tu estrategia (ej. enviar a una cola de errores, reintentar, etc.)
    }
  }

  async onModuleDestroy() {
    await this.consumer.disconnect(); // Desconectar al destruir el módulo
  }
}
