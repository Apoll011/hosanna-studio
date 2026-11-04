import { Folder, FoldersResponse } from "../types";
import { unwrapApiResult } from "./client";
import { getApiClient } from "./http";

function asFoldersResponse(data: unknown): FoldersResponse {
  if (Array.isArray(data)) {
    return { folders: data as Folder[], rootSongsCount: 0 };
  }
  const shaped = data as FoldersResponse | null;
  return {
    folders: shaped?.folders ?? [],
    rootSongsCount: shaped?.rootSongsCount ?? 0,
  };
}

export const foldersApi = {
  getFolders: async (): Promise<FoldersResponse> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.GET("/folders"),
    );
    return asFoldersResponse(data);
  },

  getFlatFolders: async (): Promise<Folder[]> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.GET("/folders/flat"),
    );
    return (data ?? []) as unknown as Folder[];
  },

  createFolder: async (
    name: string,
    parentId?: string | null,
  ): Promise<Folder> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.POST("/folders", {
        body: { name, parentId },
      }),
    );
    return data as unknown as Folder;
  },

  updateFolder: async (
    id: string,
    data: { name?: string; parentId?: string | null; updatedAt: string },
  ): Promise<Folder> => {
    const updated = await unwrapApiResult(
      await getApiClient().openapi.PUT("/folders/{id}", {
        params: { path: { id } },
        body: data,
      }),
    );
    return updated as unknown as Folder;
  },

  renameFolder: async (
    id: string,
    name: string,
    updatedAt: string,
  ): Promise<Folder> => {
    const updated = await unwrapApiResult(
      await getApiClient().openapi.PUT("/folders/{id}", {
        params: { path: { id } },
        body: { name, updatedAt },
      }),
    );
    return updated as unknown as Folder;
  },

  moveFolder: async (
    id: string,
    parentId: string | null,
    updatedAt: string,
  ): Promise<Folder> => {
    const updated = await unwrapApiResult(
      await getApiClient().openapi.PUT("/folders/{id}", {
        params: { path: { id } },
        body: { parentId, updatedAt },
      }),
    );
    return updated as unknown as Folder;
  },

  deleteFolder: async (
    id: string,
    action: "delete_songs" | "move_to_root",
  ): Promise<void> => {
    await unwrapApiResult(
      await getApiClient().openapi.DELETE("/folders/{id}", {
        params: { path: { id }, query: { action } },
      }),
    );
  },

  deleteFolderAndSongs: async (
    id: string,
  ): Promise<{ deletedSongs: number }> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.DELETE("/folders/{id}/with-content", {
        params: { path: { id } },
      }),
    );
    const shaped = (data ?? {}) as { deletedSongs?: number };
    return { deletedSongs: shaped.deletedSongs ?? 0 };
  },

  deleteFolderAndMoveSongsToRoot: async (
    id: string,
  ): Promise<{ movedSongs: number }> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.DELETE(
        "/folders/{id}/move-content-to-root",
        {
          params: { path: { id } },
        },
      ),
    );
    return { movedSongs: data?.movedSongs ?? 0 };
  },
};
