import { DataSource } from "typeorm";
import { config } from "dotenv";

config();

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "sales_intelligence",
  
  // CRITICAL: NEVER use synchronize in production - it will drop tables
  synchronize: false,
  
  // Run migrations automatically on startup
  migrationsRun: true,
  
  // Enable logging only in development
  logging: isDevelopment && process.env.LOG_LEVEL === "debug",
  
  // Use compiled JS files in production, TS files in development
  entities: isProduction 
    ? ["dist/database/models/**/*.js"]
    : ["src/database/models/**/*.ts"],
  
  migrations: isProduction
    ? ["dist/database/migrations/**/*.js"]
    : ["src/database/migrations/**/*.ts"],
  
  subscribers: [],
  
  // Connection pool configuration
  extra: {
    max: 20, // Maximum connections
    min: 5,  // Minimum connections
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 2000, // Fail after 2s if can't connect
  },
  
  // Connection retry configuration
  maxQueryExecutionTime: 5000, // Log slow queries (>5s)
});

