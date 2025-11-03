import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.model";

export enum ScrapingStatus {
  PENDING = "pending",
  ANALYZING = "analyzing",
  SCRAPING = "scraping",
  VALIDATING = "validating",
  COMPLETED = "completed",
  FAILED = "failed",
}

@Entity("scraping_jobs")
export class ScrapingJob {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "text" })
  url!: string;

  @Column({ type: "enum", enum: ScrapingStatus, default: ScrapingStatus.PENDING })
  status!: ScrapingStatus;

  @Column({ type: "varchar", length: 100, nullable: true })
  strategyUsed?: string;

  @Column({ type: "jsonb", nullable: true })
  analysisResult?: Record<string, unknown>;

  @Column({ type: "int", default: 0 })
  recordsExtracted!: number;

  @Column({ type: "varchar", length: 50, nullable: true })
  validationStatus?: string;

  @Column({ type: "jsonb", nullable: true })
  validationErrors?: Record<string, unknown>;

  @Column({ type: "int", default: 0 })
  retryCount!: number;

  @Column({ type: "text", nullable: true })
  errorMessage?: string;

  @Column({ type: "timestamp", nullable: true })
  startedAt?: Date;

  @Column({ type: "timestamp", nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;
}

