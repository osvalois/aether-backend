// kafka.config.ts
import { registerAs } from '@nestjs/config';
import { KafkaOptions, Transport } from '@nestjs/microservices';

export default registerAs('kafka', (): KafkaOptions => ({
  transport: Transport.KAFKA,
  options: {
    client: {
      clientId: process.env.KAFKA_CLIENT_ID || '',
      brokers: [process.env.KAFKA_BROKERS || ''],
      ssl: true,
      sasl: {
        mechanism: 'plain',
        username: process.env.KAFKA_API_KEY || '',
        password: process.env.KAFKA_API_SECRET || '',
      },
    },
    consumer: {
      groupId: process.env.KAFKA_GROUP_ID || '',
    },
  },
}));
