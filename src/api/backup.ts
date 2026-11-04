import type { components } from "./generated/schema";
import { unwrapApiResult } from "./client";
import { getApiClient } from "./http";

type BackupDocument = components["schemas"]["BackupDocument"];

export const backupApi = {
  downloadBackup: async (): Promise<void> => {
    const backup = await unwrapApiResult(
      await getApiClient().openapi.GET("/backup"),
    );

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `hosanna_backup_${new Date().toISOString().split("T")[0]}.hosanna`;

    a.click();
    URL.revokeObjectURL(url);
  },

  restoreBackup: async (
    backupData: unknown,
  ): Promise<{ message: string; counts: Record<string, number> }> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.POST("/backup/restore", {
        body: backupData as BackupDocument,
      }),
    );

    return {
      message: data?.message ?? "",
      counts: (data?.counts ?? {}) as Record<string, number>,
    };
  },
};
