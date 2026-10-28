import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { listingsApi } from "@/features/seller/listings/api/listingsApi";
import { addListingSchema } from "@/features/seller/listings/schemas/listingSchemas";
import { useCommodities } from "@/features/seller/listings/hooks/useCommodities";
import { useCommodityCategories } from "@/features/seller/listings/hooks/useCommodityCategories";
import { useCallback, useMemo, useState } from "react";

export type AddListingField =
  | "categoryId"
  | "commodityId"
  | "quality"
  | "quantity"
  | "weightKg"
  | "price"
  | "moisture"
  | "color"
  | "size"
  | "overridePayment"
  | "paymentTerms"
  | "notes"
  | "photoUrls"
  | "videoUrls";

export interface AddListingValues {
  categoryId: string;
  commodityId: string;
  quality: string;
  quantity: string;
  weightKg: string;
  price: string;
  moisture: string;
  color: string;
  size: string;
  overridePayment: boolean;
  paymentTerms: string;
  notes: string;
  photoUrls: string[];
  videoUrls: string[];
}

export type AddListingFieldErrors = Partial<Record<AddListingField, string>>;

const INITIAL_VALUES: AddListingValues = {
  categoryId: "",
  commodityId: "",
  quality: "",
  quantity: "",
  weightKg: "30",
  price: "",
  moisture: "",
  color: "",
  size: "",
  overridePayment: false,
  paymentTerms: "",
  notes: "",
  photoUrls: [],
  videoUrls: [],
};

/**
 * Seller add-listing form: category → commodity (live UUIDs), quality grade,
 * quantity (required), weight/price (optional), then POSTs `side: "SELL"`.
 * `itemName` is never a client input — the backend derives it from the commodity.
 */
export function useAddListing() {
  const { runWithAuth, session } = useAuth();
  const defaultPaymentTerms = session?.user.defaultPaymentTerms ?? null;
  const [values, setValues] = useState<AddListingValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = useState<AddListingFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { categories, isLoading: categoriesLoading } = useCommodityCategories();
  const { commodities, isLoading: commoditiesLoading } = useCommodities(
    values.categoryId || null,
  );

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name] as const)),
    [categories],
  );
  const commodityNameById = useMemo(
    () => new Map(commodities.map((c) => [c.id, c.name] as const)),
    [commodities],
  );

  const setField = useCallback(
    (field: AddListingField, value: string | boolean) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value } as AddListingValues;
        // Changing category invalidates the selected commodity.
        if (field === "categoryId" && value !== prev.categoryId) {
          next.commodityId = "";
        }
        return next;
      });
      setFieldErrors((prev) => {
        if (!prev[field] && !(field === "categoryId" && prev["commodityId"])) return prev;
        const next = { ...prev };
        delete next[field];
        if (field === "categoryId") delete next["commodityId"];
        return next;
      });
    },
    [],
  );

  const setMediaField = useCallback(
    (
      field: "photoUrls" | "videoUrls",
      update: string[] | ((current: string[]) => string[]),
    ) => {
      setValues((prev) => ({
        ...prev,
        [field]: typeof update === "function" ? update(prev[field]) : update,
      }));
    },
    [],
  );

  const reset = useCallback(() => {
    setValues(INITIAL_VALUES);
    setFieldErrors({});
    setError(null);
    setSuccess(null);
  }, []);

  /** Validates, then POSTs to the real backend. Returns true on publish. */
  async function submit(): Promise<boolean> {
    setError(null);
    setSuccess(null);
    const parsed = addListingSchema.safeParse({
      categoryId: values.categoryId,
      commodityId: values.commodityId,
      quality: values.quality,
      quantity: values.quantity,
      weightKg: values.weightKg,
      price: values.price,
      moisture: values.moisture,
      color: values.color,
      size: values.size,
      paymentTerms: values.paymentTerms,
      notes: values.notes,
      photoUrls: values.photoUrls,
      videoUrls: values.videoUrls,
    });
    const nextErrors: AddListingFieldErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as AddListingField | undefined;
        if (key && !nextErrors[key]) nextErrors[key] = issue.message;
      }
    }
    const needsListingPaymentTerms =
      values.overridePayment || defaultPaymentTerms === null;
    if (needsListingPaymentTerms && !values.paymentTerms.trim()) {
      nextErrors.paymentTerms =
        "Enter payment terms in days, or set a default in your profile";
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return false;
    }
    setIsLoading(true);
    try {
      const created = await runWithAuth((token) =>
        listingsApi.create(
          {
            categoryId: values.categoryId.trim(),
            commodityId: values.commodityId.trim(),
            quality: values.quality.trim() || null,
            quantityBags: Number(values.quantity.trim()),
            weightKg: values.weightKg.trim()
              ? Number(values.weightKg.trim())
              : null,
            price: values.price.trim() ? Number(values.price.trim()) : null,
            moisture: values.moisture.trim() || null,
            color: values.color.trim() || null,
            size: values.size.trim() || null,
            // Backend `optionalPositiveInt`: days as a number, never free text.
            paymentTerms: needsListingPaymentTerms
              ? Number(values.paymentTerms.trim())
              : null,
            notes: values.notes.trim() || null,
            photoUrls: values.photoUrls,
            videoUrls: values.videoUrls,
          },
          token,
        ),
      );
      setFieldErrors({});
      setValues(INITIAL_VALUES);
      setSuccess(
        created.price != null
          ? `Listing published: ${created.item} at Rs.${created.price.toLocaleString("en-IN")} per bag.`
          : `Listing published: ${created.item} (open to offers).`,
      );
      return true;
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not publish the listing"));
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  return {
    values,
    setField,
    setMediaField,
    fieldErrors,
    error,
    success,
    isLoading,
    submit,
    reset,
    categories,
    categoriesLoading,
    commodities,
    commoditiesLoading,
    defaultPaymentTerms,
    categoryNameById,
    commodityNameById,
  };
}
