import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Company } from "./Company.model";

@Entity("people")
export class Person {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  firstName?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  lastName?: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  fullName?: string;

  @Column({ type: "varchar", length: 255, unique: true, nullable: true })
  email?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  phone?: string;

  @Column({ type: "varchar", length: 500, unique: true, nullable: true })
  linkedinUrl?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  title?: string;

  @ManyToOne(() => Company, (company) => company.people, {
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "company_id" })
  company?: Company;

  @Column({ type: "uuid", nullable: true })
  companyId?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  location?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  city?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  state?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  country?: string;

  @Column({ type: "text", nullable: true })
  bio?: string;

  @Column({ type: "varchar", length: 100 })
  dataSource!: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: "boolean", default: false })
  isDeleted!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

