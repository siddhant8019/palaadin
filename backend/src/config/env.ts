import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform(Number).default("4000"),
  
  // Database
  DATABASE_URL: z.string().url(),
  DB_HOST: z.string(),
  DB_PORT: z.string().transform(Number),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  
  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  
  // Gemini API
  GEMINI_API_KEY: z.string().min(20),
  
  // Web Search (optional - at least one required)
  TAVILY_API_KEY: z.string().optional(),
  SERPAPI_KEY: z.string().optional(),
  
  // CORS
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  
  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).default("10485760"),
  UPLOAD_DIR: z.string().default("./uploads"),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default("900000"),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default("100"),
  
  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";

