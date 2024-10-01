// report-generation-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('report_generation_logs')
export class ReportGenerationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column('integer', { name: 'total_processed' })
  totalProcessed: number;

  @Column('jsonb', { name: 'processed_tickets' })
  processedTickets: object[];

  @Column('jsonb', { name: 'process_details' })
  processDetails: object;

  @Column('jsonb', { name: 'errors', nullable: true })
  errors: object[];
}
