import { z } from "zod";
import { COUNTRIES } from "@/lib/countries";

const NAME = /^[\p{L}\p{N}][\p{L}\p{N} .'()\-/&]*$/u;

const optionalName = (label: string) =>
  z
    .string()
    .trim()
    .max(80, `${label} must be under 80 characters`)
    .refine((v) => v === "" || NAME.test(v), `${label} contains invalid characters`)
    .optional()
    .nullable();

const requiredName = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(80, `${label} must be under 80 characters`)
    .regex(NAME, `${label} contains invalid characters`);

export const regionSchema = z
  .object({
    country: requiredName("Country").refine(
      (v) => COUNTRIES.some((c) => c.toLowerCase() === v.toLowerCase()),
      "Select a country from the list",
    ),
    state: requiredName("State"),
    district: requiredName("District"),
    mandal: optionalName("Mandal / Block"),
    village: optionalName("Village"),
  })
  .superRefine((v, ctx) => {
    if (v.village && !v.mandal && !v.district) {
      ctx.addIssue({ code: "custom", path: ["mandal"], message: "Select a mandal/block first" });
    }
  });

export type RegionFields = "country" | "state" | "district" | "mandal" | "village";
export type RegionErrors = Partial<Record<RegionFields, string>>;

/** Validates a region selection and returns per-field error messages. */
export function validateRegion(value: {
  country?: string | null;
  state?: string | null;
  district?: string | null;
  mandal?: string | null;
  village?: string | null;
}): { ok: boolean; errors: RegionErrors } {
  const parsed = regionSchema.safeParse({
    country: value.country ?? "",
    state: value.state ?? "",
    district: value.district ?? "",
    mandal: value.mandal ?? "",
    village: value.village ?? "",
  });
  if (parsed.success) return { ok: true, errors: {} };

  const errors: RegionErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as RegionFields | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
