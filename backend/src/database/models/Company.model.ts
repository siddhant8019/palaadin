import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { Person } from "./Person.model";

@Entity("companies")
export class Company {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 500 })
  name!: string;

  @Column({ type: "varchar", length: 255, unique: true, nullable: true })
  domain?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  industry?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  companySize?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  location?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  city?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  state?: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  country?: string;

  @Column({ type: "varchar", length: 500, unique: true, nullable: true })
  linkedinUrl?: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  website?: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "int", nullable: true })
  foundedYear?: number;

  @Column({ type: "varchar", length: 100, nullable: true })
  fundingStage?: string;

  @Column({ type: "varchar", length: 100 })
  dataSource!: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ type: "boolean", default: false })
  isDeleted!: boolean;

  @OneToMany(() => Person, (person) => person.company)
  people!: Person[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

