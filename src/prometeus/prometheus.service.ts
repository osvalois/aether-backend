import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram } from 'prom-client';

@Injectable()
export class PrometheusService {
  private readonly registry: Registry;
  private readonly messagesProcessed: Counter;
  private readonly messagesFailed: Counter;
  private readonly processingTime: Histogram;

  constructor() {
    this.registry = new Registry();

    // Contador para mensajes procesados
    this.messagesProcessed = new Counter({
      name: 'kafka_messages_processed_total',
      help: 'Total number of Kafka messages processed',
      labelNames: ['topic'],
    });

    // Contador para mensajes fallidos
    this.messagesFailed = new Counter({
      name: 'kafka_messages_failed_total',
      help: 'Total number of Kafka messages that failed processing',
      labelNames: ['topic'],
    });

    // Histograma para tiempo de procesamiento
    this.processingTime = new Histogram({
      name: 'kafka_message_processing_duration_seconds',
      help: 'Duration of processing Kafka messages',
      labelNames: ['topic'],
      buckets: [0.1, 0.5, 1, 2, 5], // Buckets en segundos
    });

    // Registrar las métricas
    this.registry.registerMetric(this.messagesProcessed);
    this.registry.registerMetric(this.messagesFailed);
    this.registry.registerMetric(this.processingTime);
  }

  incrementMessageProcessed(topic: string): void {
    this.messagesProcessed.labels(topic).inc();
  }

  incrementMessageFailed(topic: string): void {
    this.messagesFailed.labels(topic).inc();
  }

  recordProcessingTime(topic: string, durationMs: number): void {
    this.processingTime.labels(topic).observe(durationMs / 1000); // Convertir ms a segundos
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}