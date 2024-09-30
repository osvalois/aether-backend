import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { PrometheusService } from './prometheus.service';
import { TransformInterceptor } from 'src/common/interceptors/transform.interceptor';

@Controller('metrics')
@Controller('metrics')
@UseInterceptors(TransformInterceptor)
export class MetricsController {
  constructor(private prometheusService: PrometheusService) {}

  @Get()
  async getMetrics(): Promise<string> {
    return this.prometheusService.getMetrics();
  }
}