import { getFriendlyApiError } from "@/core/api/client";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  freightApi,
  type FreightRoute,
} from "@/features/shared/freight/api/freightApi";
import { useCallback, useEffect, useRef, useState } from "react";

interface PageCursor {
  page: number;
  totalPages: number;
}

interface SearchCursor {
  all?: PageCursor;
  origin?: PageCursor;
  destination?: PageCursor;
}

function mergeRoutes(...groups: FreightRoute[][]): FreightRoute[] {
  const seen = new Set<string>();
  return groups.flat().filter((route) => {
    if (seen.has(route.id)) return false;
    seen.add(route.id);
    return true;
  });
}

function hasMore(cursor: SearchCursor): boolean {
  return Object.values(cursor).some(
    (page) => page !== undefined && page.page < page.totalPages,
  );
}

export function useFreightRoutes() {
  const { runWithAuth } = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [routes, setRoutes] = useState<FreightRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const cursor = useRef<SearchCursor>({});
  const requestId = useRef(0);
  const loadMoreInFlight = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadFirstPage = useCallback(async () => {
    const currentRequest = ++requestId.current;
    cursor.current = {};
    loadMoreInFlight.current = false;
    setRoutes([]);
    setIsLoading(true);
    setIsLoadingMore(false);
    setCanLoadMore(false);
    setError(null);

    try {
      const loaded = await runWithAuth(async (token) => {
        if (!query) {
          const page = await freightApi.list(token, { page: 1 });
          return {
            routes: page.data,
            next: { all: { page: 1, totalPages: page.meta.totalPages } },
          };
        }
        const [origin, destination] = await Promise.all([
          freightApi.list(token, { page: 1, origin: query }),
          freightApi.list(token, { page: 1, destination: query }),
        ]);
        return {
          routes: mergeRoutes(origin.data, destination.data),
          next: {
            origin: { page: 1, totalPages: origin.meta.totalPages },
            destination: {
              page: 1,
              totalPages: destination.meta.totalPages,
            },
          },
        };
      });

      if (currentRequest !== requestId.current) return;
      cursor.current = loaded.next;
      setRoutes(loaded.routes);
      setCanLoadMore(hasMore(loaded.next));
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setError(getFriendlyApiError(cause, "Could not load freight rates."));
      }
    } finally {
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, [query, runWithAuth]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadFirstPage();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (
      isLoading ||
      isLoadingMore ||
      loadMoreInFlight.current ||
      !canLoadMore
    ) {
      return;
    }
    const currentRequest = requestId.current;
    const previous = cursor.current;
    loadMoreInFlight.current = true;
    setIsLoadingMore(true);
    setError(null);

    try {
      const loaded = await runWithAuth(async (token) => {
        if (!query) {
          const nextPage = previous.all;
          if (!nextPage || nextPage.page >= nextPage.totalPages) {
            return { routes: [], next: previous };
          }
          const page = await freightApi.list(token, {
            page: nextPage.page + 1,
          });
          return {
            routes: page.data,
            next: {
              all: { page: page.meta.page, totalPages: page.meta.totalPages },
            },
          };
        }

        const originPage =
          previous.origin &&
          previous.origin.page < previous.origin.totalPages
            ? previous.origin.page + 1
            : null;
        const destinationPage =
          previous.destination &&
          previous.destination.page < previous.destination.totalPages
            ? previous.destination.page + 1
            : null;
        const [origin, destination] = await Promise.all([
          originPage
            ? freightApi.list(token, { page: originPage, origin: query })
            : null,
          destinationPage
            ? freightApi.list(token, {
                page: destinationPage,
                destination: query,
              })
            : null,
        ]);
        return {
          routes: mergeRoutes(origin?.data ?? [], destination?.data ?? []),
          next: {
            origin: origin
              ? {
                  page: origin.meta.page,
                  totalPages: origin.meta.totalPages,
                }
              : previous.origin,
            destination: destination
              ? {
                  page: destination.meta.page,
                  totalPages: destination.meta.totalPages,
                }
              : previous.destination,
          },
        };
      });

      if (currentRequest !== requestId.current) return;
      cursor.current = loaded.next;
      setRoutes((current) => mergeRoutes(current, loaded.routes));
      setCanLoadMore(hasMore(loaded.next));
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setError(getFriendlyApiError(cause, "Could not load more freight rates."));
      }
    } finally {
      if (currentRequest === requestId.current) {
        loadMoreInFlight.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [canLoadMore, isLoading, isLoadingMore, query, runWithAuth]);

  return {
    search,
    setSearch,
    routes,
    isLoading,
    isLoadingMore,
    error,
    canLoadMore,
    retry: loadFirstPage,
    loadMore,
  };
}
