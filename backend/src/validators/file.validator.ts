import { z } from "zod";

/**
 * File upload validation schema
 */
export const fileUploadSchema = z.object({
  file: z.object({
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z.enum([
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/json",
      "application/har+json",
    ], {
      errorMap: () => ({ message: "Invalid file type. Allowed: Excel, CSV, JSON, HAR" }),
    }),
    size: z.number().max(10 * 1024 * 1024, "File size must not exceed 10MB"),
    destination: z.string(),
    filename: z.string(),
    path: z.string(),
  }),
});

/**
 * Multiple files upload validation
 */
export const multipleFilesUploadSchema = z.object({
  files: z
    .array(
      z.object({
        fieldname: z.string(),
        originalname: z.string(),
        encoding: z.string(),
        mimetype: z.string(),
        size: z.number().max(10 * 1024 * 1024),
        destination: z.string(),
        filename: z.string(),
        path: z.string(),
      })
    )
    .min(1, "At least one file is required")
    .max(5, "Maximum 5 files allowed"),
});

/**
 * Excel processing options
 */
export const excelProcessingSchema = z.object({
  sheetName: z.string().optional(),
  headerRow: z.number().int().min(0).optional().default(0),
  mapping: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      title: z.string().optional(),
      location: z.string().optional(),
    })
    .optional(),
  skipRows: z.number().int().min(0).optional().default(0),
  maxRows: z.number().int().min(1).optional(),
  autoDetectColumns: z.boolean().optional().default(true),
  deduplicate: z.boolean().optional().default(true),
});

/**
 * HAR processing options
 */
export const harProcessingSchema = z.object({
  targetDomain: z.string().optional(),
  extractType: z.enum(["companies", "people", "both"]).optional().default("both"),
  filterRequests: z.boolean().optional().default(true),
  includeImages: z.boolean().optional().default(false),
});

/**
 * File filter schema
 */
export const fileFilterSchema = z.object({
  fileType: z.enum(["excel", "csv", "json", "har"]).optional(),
  processingStatus: z.enum(["pending", "processing", "completed", "failed"]).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("10"),
});

export type FileUpload = z.infer<typeof fileUploadSchema>;
export type MultipleFilesUpload = z.infer<typeof multipleFilesUploadSchema>;
export type ExcelProcessingOptions = z.infer<typeof excelProcessingSchema>;
export type HARProcessingOptions = z.infer<typeof harProcessingSchema>;
export type FileFilter = z.infer<typeof fileFilterSchema>;

