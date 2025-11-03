import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./User.model";

@Entity("user_sessions")
export class UserSession {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "jsonb", default: [] })
  conversationHistory!: unknown[];

  @Column({ type: "jsonb", default: {} })
  sessionData!: Record<string, unknown>;

  @Column({ type: "text", nullable: true })
  lastQuery?: string;

  @Column({ type: "timestamp", nullable: true })
  lastQueryTimestamp?: Date;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

