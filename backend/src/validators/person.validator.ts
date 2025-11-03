import { z } from "zod";

export const createPersonSchema = z.object({
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  fullName: z.string().min(1).max(500).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/)
    .optional()
    .or(z.literal("")),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  title: z.string().max(255).optional(),
  companyId: z.string().uuid().optional(),
  location: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  state: z.string().max(255).optional(),
  country: z.string().max(255).optional(),
  bio: z.string().optional(),
  dataSource: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const updatePersonSchema = createPersonSchema.partial();

export const personFilterSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  email: z.string().optional(),
  title: z.string().optional(),
  companyId: z.string().uuid().optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["ASC", "DESC"]).optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type PersonFilterInput = z.infer<typeof personFilterSchema>;

