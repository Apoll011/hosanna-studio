import { Service, ServiceElement } from "../types";
import { unwrapApiResult } from "./client";
import { getApiClient } from "./http";

export const servicesApi = {
  getServices: async (archived = false): Promise<Service[]> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.GET("/services", {
        params: { query: { archived } },
      }),
    );
    return (data ?? []) as unknown as Service[];
  },

  getServiceById: async (id: string): Promise<Service> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.GET("/services/{id}", {
        params: { path: { id } },
      }),
    );
    return data as unknown as Service;
  },

  createService: async (data: Partial<Service>): Promise<Service> => {
    const created = await unwrapApiResult(
      await getApiClient().openapi.POST("/services", {
        body: data as unknown as {
          name: string;
          date: string;
          notes?: string | null;
          elements?: { [key: string]: unknown }[];
        },
      }),
    );
    return created as unknown as Service;
  },

  updateService: async (
    id: string,
    data: Partial<Service>,
  ): Promise<Service> => {
    const updated = await unwrapApiResult(
      await getApiClient().openapi.PUT("/services/{id}", {
        params: { path: { id } },
        body: data as unknown as {
          updatedAt: string;
          name?: string;
          date?: string;
          archived?: boolean;
          notes?: string | null;
        },
      }),
    );
    return updated as unknown as Service;
  },

  deleteService: async (id: string): Promise<void> => {
    await unwrapApiResult(
      await getApiClient().openapi.DELETE("/services/{id}", {
        params: { path: { id } },
      }),
    );
  },

  updateServiceElements: async (
    serviceId: string,
    data: { elements: ServiceElement[]; updatedAt: string },
  ): Promise<Service> => {
    const updated = await unwrapApiResult(
      await getApiClient().openapi.PUT("/services/{id}/elements", {
        params: { path: { id: serviceId } },
        body: {
          updatedAt: data.updatedAt,
          elements: data.elements as unknown as { [key: string]: unknown }[],
        },
      }),
    );
    return updated as unknown as Service;
  },
};
