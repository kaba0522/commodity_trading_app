import { z } from "zod";

/** Offline fallback options (live list comes from GET `/commodity-categories`). */
export const LISTING_CATEGORIES = ["Besan", "Dal", "Matar", "Chana", "Rajma", "Rice"] as const;

/**
 * Backend-exact `QUALITY_GRADES` (`D:\Tradding_backend\services\listing.validation.js`
 * — mirrors the Prisma `QualityGrade` enum; `optionalEnum` rejects anything else).
 */
export const QUALITY_GRADES = [
  "barik",
  "chota",
  "mota",
  "dardra",
  "small",
  "bold",
  "normal",
  "dry",
  "full_green",
  "medium",
  "standard",
  "madras",
  "imported",
  "stream",
  "sella",
  "parmal",
] as const;

const uuid = z
  .string()
  .trim()
  .min(1, "Select an option")
  .uuid("Invalid selection — refresh and try again");

const positiveIntString = (field: string) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: `${field} must be a positive whole number`,
    });

const optionalPositiveIntString = (field: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) > 0), {
      message: `${field} must be a positive whole number`,
    });

const optionalPositiveDecimalString = (field: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (Number(v) > 0 && Number.isFinite(Number(v))), {
      message: `${field} must be a number greater than 0`,
    });

const optionalNonNegativeIntString = (field: string) =>
  z
    .string()
    .trim()
    .refine(
      (v) =>
        v === "" ||
        (/^\d+$/.test(v) &&
          Number.isSafeInteger(Number(v)) &&
          Number(v) <= 2_147_483_647),
      {
        message: `${field} must be a non-negative whole number`,
      },
    );

/**
 * Seller Add-listing validation — mirrors backend `validateSellListingInput`:
 * categoryId + commodityId UUIDs, quantityBags required, price and weightKg
 * optional, quality one of the backend grades, payment terms as a
 * non-negative integer when supplied, and media URL counts within backend limits.
 * Scalar fields stay strings here; the hook converts numbers at the boundary.
 * Media fields are arrays of uploaded Cloudinary URLs.
 */
export const addListingSchema = z.object({
  categoryId: uuid,
  commodityId: uuid,
  quality: z
    .string()
    .trim()
    .min(1, "Quality is required")
    .refine((v) => v === "" || (QUALITY_GRADES as readonly string[]).includes(v), {
      message: `Quality must be one of: ${QUALITY_GRADES.join(", ")}`,
    }),
  quantity: positiveIntString("Quantity"),
  weightKg: optionalPositiveIntString("Weight"),
  price: optionalPositiveDecimalString("Price"),
  moisture: z.string().max(40, "Keep moisture under 40 characters"),
  color: z.string().max(40, "Keep color under 40 characters"),
  size: z.string().max(40, "Keep size under 40 characters"),
  paymentTerms: optionalNonNegativeIntString("Payment terms (days)"),
  notes: z.string().max(500, "Keep notes under 500 characters"),
  photoUrls: z.array(z.string().url()).max(5, "A listing can have at most 5 photos"),
  videoUrls: z.array(z.string().url()).max(1, "A listing can have at most 1 video"),
});

export type AddListingSchema = z.infer<typeof addListingSchema>;

/** Fields a seller can change from the listing detail edit action. */
export const editListingSchema = z.object({
  quantity: positiveIntString("Quantity"),
  price: optionalPositiveDecimalString("Price"),
  notes: z.string().max(500, "Keep notes under 500 characters"),
});

export type EditListingSchema = z.infer<typeof editListingSchema>;

/**
 * Buyer post-requirement client validation: categoryId, commodityId, and
 * quality and quantity are required; optional listing details can also be supplied.
 * BUY requirements do not accept a price; sellers and buyers negotiate later.
 */
export const postRequirementSchema = z.object({
  categoryId: uuid,
  commodityId: uuid,
  quality: z
    .string()
    .trim()
    .min(1, "Quality is required")
    .refine((v) => v === "" || (QUALITY_GRADES as readonly string[]).includes(v), {
      message: `Quality must be one of: ${QUALITY_GRADES.join(", ")}`,
    }),
  quantity: positiveIntString("Quantity"),
  weightKg: optionalPositiveIntString("Weight"),
  paymentTerms: optionalNonNegativeIntString("Payment terms (days)"),
  location: z.string().trim().max(120, "Keep delivery location under 120 characters"),
  notes: z.string().max(500, "Keep notes under 500 characters"),
});

export type PostRequirementSchema = z.infer<typeof postRequirementSchema>;
