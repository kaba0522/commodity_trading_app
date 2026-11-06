import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { listingsApi } from "@/features/seller/listings/api/listingsApi";
import {
  addListingSchema,
  editListingSchema,
} from "@/features/seller/listings/schemas/listingSchemas";
import { useCommodities } from "@/features/seller/listings/hooks/useCommodities";
import { useCommodityCategories } from "@/features/seller/listings/hooks/useCommodityCategories";
import { useListingDetail } from "@/features/seller/listings/hooks/useListingDetail";
import type { CreateListingInput } from "@/features/seller/listings/api/listingsApi";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AddListingField =
  | "categoryId"
  | "commodityId"
  | "qualityId"
  | "quantity"
  | "weightKg"
  | "price"
  | "moisture"
  | "color"
  | "size"
  | "paymentTerms"
  | "notes"
  | "photoUrls"
  | "videoUrls";

export interface AddListingValues {
  categoryId: string;
  commodityId: string;
  qualityId: string;
  quantity: string;
  weightKg: string;
  price: string;
  moisture: string;
  color: string;
  size: string;
  paymentTerms: string;
  notes: string;
  photoUrls: string[];
  videoUrls: string[];
}

export type AddListingFieldErrors = Partial<Record<AddListingField, string>>;

const INITIAL_VALUES: AddListingValues = {
  categoryId: "",
  commodityId: "",
  qualityId: "",
  quantity: "",
  weightKg: "30",
  price: "",
  moisture: "",
  color: "",
  size: "",
  paymentTerms: "",
  notes: "",
  photoUrls: [],
  videoUrls: [],
};

/**
 * Seller listing form: category → commodity (live UUIDs), quality grade,
 * quantity (required), weight/price (optional), then creates or updates the
 * listing. `itemName` is derived by the backend from the selected commodity.
 */
export function useAddListing(
  editListingId?: string,
  relistListingId?: string,
) {
  const { runWithAuth, session } = useAuth();
  const defaultPaymentTerms = session?.user.defaultPaymentTerms ?? null;
  const [values, setValues] = useState<AddListingValues>(() => ({
    ...INITIAL_VALUES,
    paymentTerms:
      defaultPaymentTerms !== null ? String(defaultPaymentTerms) : "",
  }));
  const [fieldErrors, setFieldErrors] = useState<AddListingFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const initializedListingId = useRef<string | null>(null);
  const {
    listing: sourceListing,
    isLoading: editListingLoading,
    error: editListingError,
    retry: retryEditListing,
  } = useListingDetail(editListingId ?? relistListingId);
  const listingQualityLabel = sourceListing?.quality ?? "";

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

  useEffect(() => {
    if (
      (!editListingId && !relistListingId) ||
      !sourceListing ||
      initializedListingId.current === (editListingId ?? relistListingId)
    ) {
      return;
    }
    initializedListingId.current = editListingId ?? relistListingId ?? null;
    setValues({
      categoryId: sourceListing.categoryId ?? "",
      commodityId: sourceListing.commodityId ?? "",
      qualityId: sourceListing.qualityId ?? "",
      quantity: sourceListing.bags != null ? String(sourceListing.bags) : "",
      weightKg:
        sourceListing.weightKg != null ? String(sourceListing.weightKg) : "",
      price: sourceListing.price > 0 ? String(sourceListing.price) : "",
      moisture: sourceListing.moisture ?? "",
      color: sourceListing.color ?? "",
      size: sourceListing.size ?? "",
      paymentTerms:
        sourceListing.paymentTerms != null
          ? String(sourceListing.paymentTerms)
          : defaultPaymentTerms !== null
            ? String(defaultPaymentTerms)
            : "",
      notes: sourceListing.notes ?? "",
      photoUrls: sourceListing.photoUrls ?? [],
      videoUrls: sourceListing.videoUrls ?? [],
    });
  }, [defaultPaymentTerms, editListingId, relistListingId, sourceListing]);

  const setField = useCallback(
    (field: AddListingField, value: string | boolean) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value } as AddListingValues;
        // Changing category invalidates its commodity and quality selections.
        if (field === "categoryId" && value !== prev.categoryId) {
          next.commodityId = "";
          next.qualityId = "";
        }
        return next;
      });
      setFieldErrors((prev) => {
        if (
          !prev[field] &&
          !(field === "categoryId" && prev["commodityId"]) &&
          !(field === "categoryId" && prev["qualityId"])
        ) return prev;
        const next = { ...prev };
        delete next[field];
        if (field === "categoryId") {
          delete next["commodityId"];
          delete next["qualityId"];
        }
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
    setValues({
      ...INITIAL_VALUES,
      paymentTerms:
        defaultPaymentTerms !== null ? String(defaultPaymentTerms) : "",
    });
    setFieldErrors({});
    setError(null);
    setSuccess(null);
  }, [defaultPaymentTerms]);

  /** Validates, then creates or updates the seller listing. */
  async function submit(): Promise<boolean> {
    setError(null);
    setSuccess(null);
    const parsed = editListingId
      ? editListingSchema.safeParse({
          quantity: values.quantity,
          price: values.price,
          notes: values.notes,
        })
      : addListingSchema.safeParse({
          categoryId: values.categoryId,
          commodityId: values.commodityId,
          qualityId: values.qualityId,
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
    if (!editListingId && !values.paymentTerms.trim()) {
      nextErrors.paymentTerms = "Enter payment terms in days";
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return false;
    }
    setIsLoading(true);
    try {
      const input: CreateListingInput = {
        categoryId: values.categoryId.trim(),
        commodityId: values.commodityId.trim(),
        qualityId: values.qualityId.trim(),
        quantityBags: Number(values.quantity.trim()),
        weightKg: values.weightKg.trim()
          ? Number(values.weightKg.trim())
          : null,
        price: values.price.trim() ? Number(values.price.trim()) : null,
        moisture: values.moisture.trim() || null,
        color: values.color.trim() || null,
        size: values.size.trim() || null,
        paymentTerms: !editListingId
          ? Number(values.paymentTerms.trim())
          : null,
        notes: values.notes.trim() || null,
        photoUrls: values.photoUrls,
        videoUrls: values.videoUrls,
      };
      setFieldErrors({});
      if (editListingId) {
        if (!sourceListing) {
          setError("Could not load the listing to compare changes.");
          return false;
        }
        const patch: Partial<CreateListingInput> = {};
        if (input.quantityBags !== sourceListing.bags) {
          patch.quantityBags = input.quantityBags;
        }
        if (
          input.price !== (sourceListing.price > 0 ? sourceListing.price : null)
        ) {
          patch.price = input.price;
        }
        if (input.notes !== (sourceListing.notes || null)) {
          patch.notes = input.notes;
        }
        if (Object.keys(patch).length > 0) {
          await runWithAuth((token) =>
            listingsApi.update(editListingId, patch, token),
          );
          setSuccess("Listing details updated.");
        } else {
          setSuccess("No changes to save.");
        }
      } else {
        const created = await runWithAuth((token) =>
          listingsApi.create(input, token),
        );
        setValues({
          ...INITIAL_VALUES,
          paymentTerms:
            defaultPaymentTerms !== null ? String(defaultPaymentTerms) : "",
        });
        setSuccess(
          created.price != null
            ? `Listing published: ${created.item} at Rs.${created.price.toLocaleString("en-IN")} per bag.`
            : `Listing published: ${created.item} (open to offers).`,
        );
      }
      return true;
    } catch (e) {
      setError(
        getFriendlyApiError(
          e,
          editListingId ? "Could not update the listing" : "Could not publish the listing",
        ),
      );
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
    editListingLoading,
    editListingError,
    retryEditListing,
    submit,
    reset,
    categories,
    categoriesLoading,
    commodities,
    commoditiesLoading,
    defaultPaymentTerms,
    categoryNameById,
    commodityNameById,
    listingQualityLabel,
  };
}
