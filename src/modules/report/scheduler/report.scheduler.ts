// report.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReportService } from 'src/modules/report/services/report.service';
@Injectable()
export class ReportScheduler {
  private readonly logger = new Logger(ReportScheduler.name);

  constructor(private readonly reportService: ReportService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    this.logger.log('Generating reports for all flights');
    try {
      await this.reportService.generateReportsForAllFlights();
      this.logger.log('Reports generated successfully');
    } catch (error) {
      this.logger.error('Error generating reports', error.stack);
    }
  }
}