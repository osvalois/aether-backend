import { registerAs } from '@nestjs/config';
import { KafkaOptions, Transport } from '@nestjs/microservices';

export default registerAs('kafka', (): KafkaOptions => ({
  transport: Transport.KAFKA,
  options: {
    client: {
      clientId: process.env.KAFKA_CLIENT_ID || 'aether-backend',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    },
    consumer: {
      groupId: process.env.KAFKA_GROUP_ID || 'aether-consumer-group',
    },
  },
}));