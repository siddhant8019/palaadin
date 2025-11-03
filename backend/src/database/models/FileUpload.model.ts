import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.model";

export enum FileProcessingStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

@Entity("file_uploads")
export class FileUpload {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 500 })
  filename!: string;

  @Column({ type: "varchar", length: 50 })
  fileType!: string;

  @Column({ type: "int" })
  fileSize!: number;

  @Column({ type: "text" })
  filePath!: string;

  @Column({
    type: "enum",
    enum: FileProcessingStatus,
    default: FileProcessingStatus.PENDING,
  })
  processingStatus!: FileProcessingStatus;

  @Column({ type: "int", default: 0 })
  recordsProcessed!: number;

  @Column({ type: "jsonb", nullable: true })
  columnMapping?: Record<string, unknown>;

  @Column({ type: "jsonb", nullable: true })
  processingErrors?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: "timestamp", nullable: true })
  processedAt?: Date;
}

