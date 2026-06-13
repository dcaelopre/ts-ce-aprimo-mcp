import { z } from "zod";

const configSchema = z.object({
  environment: z.string().min(1, "APRIMO_ENVIRONMENT is required"),
  clientId: z.string().min(1, "APRIMO_CLIENT_ID is required"),
  clientSecret: z.string().min(1, "APRIMO_CLIENT_SECRET is required"),
  searchFields: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "Keywords,LatestVersionOfMasterfile.FileName")
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean),
    ),
});

export type AprimoConfig = z.infer<typeof configSchema>;

export function loadConfig(): AprimoConfig {
  const result = configSchema.safeParse({
    environment: process.env.APRIMO_ENVIRONMENT,
    clientId: process.env.APRIMO_CLIENT_ID,
    clientSecret: process.env.APRIMO_CLIENT_SECRET,
    searchFields: process.env.APRIMO_SEARCH_FIELDS,
  });

  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message).join("; ");
    console.error(`Configuration error: ${messages}`);
    process.exit(1);
  }

  return result.data as AprimoConfig;
}
