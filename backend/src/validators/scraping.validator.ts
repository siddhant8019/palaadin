import { z } from "zod";

/**
 * Scraping request validation schema
 */
export const scrapingRequestSchema = z.object({
  url: z.string().url("Must be a valid URL").min(1, "URL is required"),
  strategy: z
    .enum(["css-selector", "har-processing", "ocr-ml", "api-direct", "auto"])
    .optional()
    .default("auto"),
  options: z
    .object({
      selectors: z.array(z.string()).optional(),
      waitForSelector: z.string().optional(),
      timeout: z.number().int().min(1000).max(60000).optional().default(30000),
      userAgent: z.string().optional(),
      headers: z.record(z.string()).optional(),
      requiresAuth: z.boolean().optional().default(false),
      credentials: z
        .object({
          username: z.string().optional(),
          password: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * Scraping integration schema
 */
export const scrapingIntegrationSchema = z.object({
  url: z.string().url("Must be a valid URL").min(1, "URL is required"),
  autoSave: z.boolean().optional().default(true),
  deduplicate: z.boolean().optional().default(true),
  dataType: z.enum(["companies", "people", "both"]).optional().default("companies"),
});

/**
 * Job ID parameter validation
 */
export const jobIdSchema = z.object({
  jobId: z.string().uuid("Must be a valid UUID"),
});

/**
 * Scraping job filter schema
 */
export const scrapingJobFilterSchema = z.object({
  status: z
    .enum(["pending", "analyzing", "scraping", "validating", "completed", "failed"])
    .optional(),
  url: z.string().optional(),
  userId: z.string().uuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("10"),
});

export type ScrapingRequest = z.infer<typeof scrapingRequestSchema>;
export type ScrapingIntegrationRequest = z.infer<typeof scrapingIntegrationSchema>;
export type JobIdParams = z.infer<typeof jobIdSchema>;
export type ScrapingJobFilter = z.infer<typeof scrapingJobFilterSchema>;

