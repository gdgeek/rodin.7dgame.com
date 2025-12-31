import { z } from "zod";

export const IdSchema = z.object({
  query: z.object({
    id: z.string().min(1, "id is required"),
  }),
});

export const RodinSchema = z.object({
  query: z
    .object({
      id: z.string().optional(),
      prompt: z.string().optional(),
      resource_id: z.union([z.string(), z.array(z.string())]).optional(),
      quality: z.string().optional(),
    })
    .refine((data) => data.id || data.prompt || data.resource_id, {
      message: "Either id OR (prompt/resource_id) is required",
      path: ["prompt"],
    }),
});

export type IdRequest = z.infer<typeof IdSchema>;
export type RodinRequest = z.infer<typeof RodinSchema>;
