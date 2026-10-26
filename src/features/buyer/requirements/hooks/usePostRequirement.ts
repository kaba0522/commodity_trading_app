import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { requirementsApi } from "@/features/buyer/requirements/api/requirementsApi";
import { postRequirementSchema } from "@/features/seller/listings/schemas/listingSchemas";
import { catalogApi, type CatalogCategory, type CatalogCommodity } from "@/features/shared/catalog/api/catalogApi";
import { useCallback, useEffect, useMemo, useState } from "react";

export type PostRequirementField = "categoryId" | "commodityId" | "quantity";

export interface PostRequirementValues {
  categoryId: string;
  commodityId: string;
  quantity: string;
}

export type PostRequirementFieldErrors = Partial<Record<PostRequirementField, string>>;

const INITIAL_VALUES: PostRequirementValues = {
  categoryId: "",
  commodityId: "",
  quantity: "",
};

/**
 * Buyer post-requirement form: category → commodity (live UUIDs), quantity
 * (required), then POSTs `side: "BUY"`. The backend does not allow a price
 * on BUY requirements; pricing is agreed during negotiation.
 */
export function usePostRequirement() {
  const { runWithAuth } = useAuth();
  const [values, setValues] = useState<PostRequirementValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = useState<PostRequirementFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [commodities, setCommodities] = useState<CatalogCommodity[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [commoditiesLoading, setCommoditiesLoading] = useState(false);
  const [commoditiesError, setCommoditiesError] = useState<string | null>(null);
  const [commoditiesNonce, setCommoditiesNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await runWithAuth((token) =>
          catalogApi.getCommodityCategories(token),
        );
        if (!cancelled) setCategories(list);
      } catch {
        // Screen renders the empty state.
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runWithAuth]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const categoryId = values.categoryId;
      if (!categoryId) {
        if (!cancelled) {
          setCommodities([]);
          setCommoditiesError(null);
          setCommoditiesLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setCommoditiesLoading(true);
        setCommoditiesError(null);
      }
      try {
        let list = await runWithAuth((token) =>
          catalogApi.getCommodities(token, categoryId),
        );
        if (list.length === 0) {
          // Some backends ignore (or gate for buyers) the `?categoryId=`
          // filter and return nothing — fall back to the full catalog
          // filtered client-side by id, then by category name.
          const all = await runWithAuth((token) =>
            catalogApi.getCommodities(token),
          );
          const wanted = categories
            .find((c) => c.id === categoryId)
            ?.name.trim()
            .toLowerCase();
          const filtered = all.filter((c) =>
            c.categoryId
              ? c.categoryId === categoryId
              : wanted
                ? c.categoryName.trim().toLowerCase() === wanted
                : false,
          );
          if (filtered.length > 0) list = filtered;
        }
        if (!cancelled) setCommodities(list);
      } catch (e) {
        if (!cancelled) {
          setCommodities([]);
          setCommoditiesError(
            getFriendlyApiError(e, "Could not load commodities"),
          );
        }
      } finally {
        if (!cancelled) setCommoditiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runWithAuth, values.categoryId, categories, commoditiesNonce]);

  const retryCommodities = useCallback(() => {
    setCommoditiesNonce((n) => n + 1);
  }, []);

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name] as const)),
    [categories],
  );
  const commodityNameById = useMemo(
    () => new Map(commodities.map((c) => [c.id, c.name] as const)),
    [commodities],
  );

  const setField = useCallback((field: PostRequirementField, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
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
  }, []);

  async function submit(): Promise<boolean> {
    setError(null);
    setSuccess(null);
    const parsed = postRequirementSchema.safeParse({
      categoryId: values.categoryId,
      commodityId: values.commodityId,
      quantity: values.quantity,
    });
    if (!parsed.success) {
      const nextErrors: PostRequirementFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as PostRequirementField | undefined;
        if (key && !nextErrors[key]) nextErrors[key] = issue.message;
      }
      setFieldErrors(nextErrors);
      return false;
    }
    setIsLoading(true);
    try {
      const created = await runWithAuth((token) =>
        requirementsApi.create(
          {
            categoryId: values.categoryId.trim(),
            commodityId: values.commodityId.trim(),
            quantityBags: Number(values.quantity.trim()),
          },
          token,
        ),
      );
      setFieldErrors({});
      setValues(INITIAL_VALUES);
      setSuccess(
        created.targetPrice > 0
          ? `Requirement posted: ${created.item} — ${created.bags} bags at Rs.${created.targetPrice.toLocaleString("en-IN")}.`
          : `Requirement posted: ${created.item} — ${created.bags} bags (open to offers).`,
      );
      return true;
    } catch (e) {
      setError(getFriendlyApiError(e, "Could not post the requirement"));
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  return {
    values,
    setField,
    fieldErrors,
    error,
    success,
    isLoading,
    submit,
    categories,
    commodities,
    catalogLoading,
    commoditiesLoading,
    commoditiesError,
    retryCommodities,
    categoryNameById,
    commodityNameById,
  };
}
