import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(1).max(500),
  domain: z.string().url().optional().or(z.literal("")),
  industry: z.string().max(255).optional(),
  companySize: z.string().max(50).optional(),
  location: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  state: z.string().max(255).optional(),
  country: z.string().max(255).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  description: z.string().optional(),
  foundedYear: z.number().int().min(1800).max(2100).optional(),
  fundingStage: z.string().max(100).optional(),
  dataSource: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

export const companyFilterSchema = z.object({
  name: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  companySize: z.string().optional(),
  fundingStage: z.string().optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["ASC", "DESC"]).optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CompanyFilterInput = z.infer<typeof companyFilterSchema>;
