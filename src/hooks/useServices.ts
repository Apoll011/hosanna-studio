/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useI18n } from "@/src/lib/i18n";
import { Service, ServiceElement } from "@/src/types";
import { useCallback, useEffect, useState } from "react";
import { useSync } from "../contexts/SyncContext";
import { getDatabase, getPurgeAt, validateServiceRules } from "../db";

let cachedServicesMap: Map<string, Service[]> = new Map();
let cachedSingleServices: Map<string, Service> = new Map();

export function useServices(includeArchived: boolean = false) {
  const { showToast } = useSync();
  const { t } = useI18n();
  const cacheKey = includeArchived ? "archived_included" : "active_only";
  const [services, setServices] = useState<Service[]>(
    () => cachedServicesMap.get(cacheKey) ?? [],
  );
  const [isLoading, setIsLoading] = useState(
    () => !cachedServicesMap.has(cacheKey),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    let rxSub: { unsubscribe: () => void } | null = null;

    async function subscribeServices() {
      try {
        const db = await getDatabase();
        if (!isSubscribed) return;

        const selector: Record<string, object> = {
          isDeleted: { $ne: true },
        };

        if (!includeArchived) {
          selector.archived = { $ne: true };
        }

        rxSub = db.services
          .find({
            selector,
          })
          .$.subscribe((docs) => {
            if (!isSubscribed) return;
            const data = docs.map((d) => d.toJSON() as Service);
            cachedServicesMap.set(cacheKey, data);
            for (const s of data) {
              cachedSingleServices.set(s.id, s);
            }
            setServices(data);
            setIsLoading(false);
          });
      } catch (err) {
        console.error("Failed to query services from RxDB", err);
        setIsLoading(false);
      }
    }

    void subscribeServices();

    return () => {
      isSubscribed = false;
      if (rxSub) rxSub.unsubscribe();
    };
  }, [includeArchived, cacheKey]);

  const createService = useCallback(
    async (data: Partial<Service>) => {
      setIsCreating(true);
      try {
        validateServiceRules(data);
        const db = await getDatabase();
        const now = new Date().toISOString();
        const newService = {
          id: data.id || crypto.randomUUID(),
          name: data.name!.trim(),
          date: data.date || now,
          notes: data.notes ?? null,
          elements: data.elements || [],
          archived: !!data.archived,
          createdAt: data.createdAt || now,
          updatedAt: now,
          _deleted: false,
        };

        const doc = await db.services.insert(newService);
        const result = doc.toJSON() as Service;
        showToast(t("hooks.services.created"), "success");
        return result;
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            (err as Error).message ||
              t("hooks.services.saveError", {
                error: "",
              }),
            "error",
          );
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [showToast, t],
  );

  const updateService = useCallback(
    async ({ id, data }: { id: string; data: Partial<Service> }) => {
      setIsUpdating(true);
      try {
        validateServiceRules(data, { partial: true });
        const db = await getDatabase();
        const doc = await db.services.findOne(id).exec();
        const now = new Date().toISOString();

        if (doc) {
          await doc.patch({
            ...data,
            name: data.name !== undefined ? data.name.trim() : doc.name,
            updatedAt: now,
            _deleted: false,
          });
          const updated = doc.toJSON() as Service;
          showToast(t("hooks.services.updated"), "success");
          return updated;
        } else {
          const newDoc = await db.services.upsert({
            id,
            name: (data.name || t("forms.untitled")).trim(),
            date: data.date || now,
            notes: data.notes ?? null,
            elements: data.elements || [],
            archived: !!data.archived,
            createdAt: data.createdAt || now,
            updatedAt: now,
            _deleted: false,
            ...data,
          });
          const result = newDoc.toJSON() as Service;
          showToast(t("hooks.services.updated"), "success");
          return result;
        }
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            (err as Error).message ||
              t("hooks.services.saveError", {
                error: "",
              }),
            "error",
          );
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [showToast, t],
  );

  const deleteService = useCallback(
    async (id: string) => {
      setIsDeleting(true);
      try {
        const db = await getDatabase();
        const doc = await db.services.findOne(id).exec();
        if (doc) {
          await doc.patch({
            isDeleted: true,
            purgeAt: getPurgeAt(),
            updatedAt: new Date().toISOString(),
          });
        }
        showToast(t("hooks.services.deleted"), "info");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            t("hooks.services.deleteError", {
              error: (err as Error).message || "",
            }),
            "error",
          );
        throw err;
      } finally {
        setIsDeleting(false);
      }
    },
    [showToast, t],
  );

  const restoreService = useCallback(
    async (id: string) => {
      setIsRestoring(true);
      try {
        const db = await getDatabase();
        const doc = await db.services.findOne(id).exec();
        if (doc) {
          await doc.patch({
            isDeleted: false,
            purgeAt: null,
            updatedAt: new Date().toISOString(),
          });
        }
        showToast(t("hooks.services.activated"), "success");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            t("hooks.services.saveError", {
              error: (err as Error).message || "",
            }),
            "error",
          );
        throw err;
      } finally {
        setIsRestoring(false);
      }
    },
    [showToast, t],
  );

  const updateElements = useCallback(
    async ({
      serviceId,
      data,
    }: {
      serviceId: string;
      data: { elements: ServiceElement[]; updatedAt?: string };
    }) => {
      setIsUpdating(true);
      try {
        const db = await getDatabase();
        const doc = await db.services.findOne(serviceId).exec();
        const now = new Date().toISOString();
        if (doc) {
          await doc.patch({
            elements: data.elements,
            updatedAt: now,
          });
        }
      } catch (err: unknown) {
        if (err && typeof err === "object" && "message" in err)
          showToast(
            t("hooks.services.saveError", {
              error: (err as Error).message || "",
            }),
            "error",
          );
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [showToast, t],
  );

  return {
    servicesQuery: {
      data: services,
      isLoading,
      isPending: isLoading,
      isError: false,
      error: null,
      refetch: async () => {},
    },
    createService,
    updateService,
    deleteService,
    restoreService,
    updateElements,
    isCreating,
    isUpdating,
    isDeleting,
    isRestoring,
  };
}

export function useService(id: string | null) {
  const [service, setService] = useState<Service | null>(() =>
    id ? (cachedSingleServices.get(id) ?? null) : null,
  );
  const [isLoading, setIsLoading] = useState(() =>
    id ? !cachedSingleServices.has(id) : false,
  );

  useEffect(() => {
    if (!id) {
      setService(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    let isSubscribed = true;
    let rxSub: { unsubscribe: () => void } | null = null;

    async function subscribeService() {
      try {
        const db = await getDatabase();
        if (!isSubscribed) return;

        rxSub = db.services.findOne(id as string).$.subscribe((doc) => {
          if (!isSubscribed) return;
          if (doc && !doc.isDeleted) {
            const data = doc.toJSON() as Service;
            cachedSingleServices.set(id as string, data);
            setService(data);
          } else {
            cachedSingleServices.delete(id as string);
            setService(null);
          }
          setIsLoading(false);
        });
      } catch (err) {
        console.error("Failed to query service by id from RxDB", err);
        setIsLoading(false);
      }
    }

    void subscribeService();

    return () => {
      isSubscribed = false;
      if (rxSub) rxSub.unsubscribe();
    };
  }, [id]);

  return {
    data: service,
    isLoading,
    isPending: isLoading,
    isError: false,
    error: null,
    refetch: async () => {},
  };
}
