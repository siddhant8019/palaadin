import { z } from "zod";

export const querySchema = z.object({
  query: z.string().min(1).max(1000),
  sessionId: z.string().uuid().optional(),
  files: z
    .array(
      z.object({
        filename: z.string(),
        mimetype: z.string(),
        size: z.number().max(10 * 1024 * 1024),
      })
    )
    .optional(),
});

export type QueryInput = z.infer<typeof querySchema>;

