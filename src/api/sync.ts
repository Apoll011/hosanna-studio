import { SyncStatusResponse } from "../types";
import { getApiClient } from "./http";

/**
 * `/sync/status` is not in the OpenAPI document (replication uses
 * `/replication/*`). Kept as a raw request for exported API compatibility.
 */
export const syncApi = {
  getStatus: async (): Promise<SyncStatusResponse> => {
    return getApiClient().request<SyncStatusResponse>("/sync/status");
  },
};
