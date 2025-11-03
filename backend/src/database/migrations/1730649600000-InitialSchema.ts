import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1730649600000 implements MigrationInterface {
  name = "InitialSchema1730649600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(255) UNIQUE NOT NULL,
        "passwordHash" varchar(255) NOT NULL,
        "role" varchar(50) NOT NULL DEFAULT 'user',
        "isActive" boolean NOT NULL DEFAULT true,
        "emailVerified" boolean NOT NULL DEFAULT false,
        "lastLogin" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create companies table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "companies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(500) NOT NULL,
        "domain" varchar(255) UNIQUE,
        "industry" varchar(255),
        "companySize" varchar(50),
        "location" varchar(255),
        "city" varchar(255),
        "state" varchar(255),
        "country" varchar(255),
        "linkedinUrl" varchar(500) UNIQUE,
        "website" varchar(500),
        "description" text,
        "foundedYear" integer,
        "fundingStage" varchar(100),
        "dataSource" varchar(100) NOT NULL,
        "metadata" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create people table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "people" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "firstName" varchar(255),
        "lastName" varchar(255),
        "fullName" varchar(500),
        "email" varchar(255) UNIQUE,
        "phone" varchar(50),
        "linkedinUrl" varchar(500) UNIQUE,
        "title" varchar(255),
        "companyId" uuid REFERENCES "companies"("id") ON DELETE SET NULL,
        "location" varchar(255),
        "city" varchar(255),
        "state" varchar(255),
        "country" varchar(255),
        "bio" text,
        "dataSource" varchar(100) NOT NULL,
        "metadata" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create scraping_jobs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scraping_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "url" text NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'pending',
        "strategyUsed" varchar(100),
        "analysisResult" jsonb,
        "recordsExtracted" integer DEFAULT 0,
        "validationStatus" varchar(50),
        "validationErrors" jsonb,
        "retryCount" integer DEFAULT 0,
        "errorMessage" text,
        "startedAt" timestamp,
        "completedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create user_sessions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "conversationHistory" jsonb DEFAULT '[]',
        "sessionData" jsonb DEFAULT '{}',
        "lastQuery" text,
        "lastQueryTimestamp" timestamp,
        "isActive" boolean DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create file_uploads table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "file_uploads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "filename" varchar(500) NOT NULL,
        "fileType" varchar(50) NOT NULL,
        "fileSize" integer NOT NULL,
        "filePath" text NOT NULL,
        "processingStatus" varchar(50) DEFAULT 'pending',
        "recordsProcessed" integer DEFAULT 0,
        "columnMapping" jsonb,
        "processingErrors" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "processedAt" timestamp
      )
    `);

    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "token" varchar(500) UNIQUE NOT NULL,
        "expiresAt" timestamp NOT NULL,
        "isRevoked" boolean DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "action" varchar(100) NOT NULL,
        "entityType" varchar(100),
        "entityId" uuid,
        "changes" jsonb,
        "ipAddress" varchar(50),
        "userAgent" text,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for users
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users"("role")`);

    // Create indexes for companies
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_companies_name" ON "companies"("name")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_companies_domain" ON "companies"("domain")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_companies_industry" ON "companies"("industry")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_companies_location" ON "companies"("location")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_companies_linkedin" ON "companies"("linkedinUrl")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_companies_data_source" ON "companies"("dataSource")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_companies_metadata" ON "companies" USING gin("metadata")`);

    // Create indexes for people
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_people_email" ON "people"("email")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_people_linkedin" ON "people"("linkedinUrl")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_people_company" ON "people"("companyId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_people_name" ON "people"("firstName", "lastName")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_people_full_name" ON "people"("fullName")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_people_data_source" ON "people"("dataSource")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_people_metadata" ON "people" USING gin("metadata")`);

    // Create indexes for scraping_jobs
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_scraping_jobs_user" ON "scraping_jobs"("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_scraping_jobs_status" ON "scraping_jobs"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_scraping_jobs_created" ON "scraping_jobs"("createdAt" DESC)`);

    // Create indexes for user_sessions
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_sessions_user" ON "user_sessions"("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_user_sessions_active" ON "user_sessions"("isActive")`);

    // Create indexes for file_uploads
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_file_uploads_user" ON "file_uploads"("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_file_uploads_status" ON "file_uploads"("processingStatus")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_file_uploads_type" ON "file_uploads"("fileType")`);

    // Create indexes for refresh_tokens
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user" ON "refresh_tokens"("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_token" ON "refresh_tokens"("token")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_expires" ON "refresh_tokens"("expiresAt")`);

    // Create indexes for audit_logs
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_user" ON "audit_logs"("userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs"("action")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_created" ON "audit_logs"("createdAt" DESC)`);

    // Create updated_at trigger function
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."updatedAt" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Add triggers for updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON "users"
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_companies_updated_at
        BEFORE UPDATE ON "companies"
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_people_updated_at
        BEFORE UPDATE ON "people"
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_user_sessions_updated_at
        BEFORE UPDATE ON "user_sessions"
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_user_sessions_updated_at ON "user_sessions"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_people_updated_at ON "people"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_companies_updated_at ON "companies"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_users_updated_at ON "users"`);
    
    // Drop trigger function
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column()`);
    
    // Drop tables (in reverse order to handle foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file_uploads"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scraping_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "people"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "companies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}

