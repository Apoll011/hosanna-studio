import { parseChordPro } from "@hosanna/chordpro";
import {
  Folder,
  GetSongsParams,
  ParsedSong,
  Song,
  SongsResponse,
} from "../types";
import { unwrapApiResult } from "./client";
import { getApiClient } from "./http";

export function parseSong(apiSong: Song, folders: Folder[] = []): ParsedSong {
  const parsed = parseChordPro(apiSong.content || "");
  const songPath = apiSong.path || "";
  const parts = songPath.split("/").filter(Boolean);
  const fileName =
    parts.length > 0
      ? parts[parts.length - 1]
      : apiSong.title
        ? `${apiSong.title.replace(/[\/\\]/g, "_")}.chopro`
        : "song.chopro";
  const folder = apiSong.folderId
    ? folders.find((f) => f.id === apiSong.folderId)?.name || ""
    : parts.length > 1
      ? parts.slice(0, -1).join("/")
      : "";

  return {
    ...apiSong,
    title: apiSong.title || parsed.metadata.title || "Sem Título",
    artist: apiSong.artist || parsed.metadata.artist || "",
    folder,
    fileName,
    metadata: parsed.metadata,
  };
}

export const songsApi = {
  getSongs: async (params: GetSongsParams = {}): Promise<SongsResponse> => {
    const client = getApiClient();
    // key / searchFields are accepted by the Studio UI but not yet in OpenAPI.
    const query = {
      search: params.search,
      folder: params.folder,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      page: params.page,
      limit: params.limit,
      tag: params.tag,
      ...(params.key ? { key: params.key } : {}),
      ...(params.searchFields
        ? { searchFields: JSON.stringify(params.searchFields) }
        : {}),
    };

    const data = await unwrapApiResult(
      await client.openapi.GET("/songs", {
        params: {
          query: query as {
            page?: number;
            limit?: number;
            search?: string;
            folder?: string;
            tag?: string;
            sortBy?: "title" | "artist" | "createdAt" | "updatedAt";
            sortOrder?: "asc" | "desc";
          },
        },
      }),
    );

    return {
      songs: (data?.songs ?? []) as Song[],
      total: data?.total ?? 0,
      page: data?.page ?? 1,
      totalPages: data?.totalPages ?? 0,
    };
  },

  getParsedSongs: async (
    params: GetSongsParams = {},
    folders: Folder[] = [],
  ): Promise<{
    songs: ParsedSong[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const res = await songsApi.getSongs(params);
    return {
      ...res,
      songs: res.songs.map((song) => parseSong(song, folders)),
    };
  },

  getSongById: async (id: string): Promise<Song> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.GET("/songs/{id}", {
        params: { path: { id } },
      }),
    );
    return data as unknown as Song;
  },

  getParsedSongById: async (
    id: string,
    folders: Folder[] = [],
  ): Promise<ParsedSong> => {
    const song = await songsApi.getSongById(id);
    return parseSong(song, folders);
  },

  createSong: async (data: Partial<Song>): Promise<Song> => {
    const created = await unwrapApiResult(
      await getApiClient().openapi.POST("/songs", {
        body: data as unknown as {
          title: string;
          artist?: string;
          content?: string;
          folderId?: string | null;
          song_number?: number | null;
          path?: string;
          tags?: string[];
        },
      }),
    );
    return created as unknown as Song;
  },

  createSongsBatch: async (
    songsList: Array<Partial<Song>>,
  ): Promise<{ created: Song[]; count: number }> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.POST("/songs/batch", {
        body: { songs: songsList as unknown as { [key: string]: unknown }[] },
      }),
    );

    // Spec documents Song[]; server historically returned { created, count }.
    if (Array.isArray(data)) {
      return { created: data as unknown as Song[], count: data.length };
    }
    const shaped = data as unknown as { created?: Song[]; count?: number };
    return {
      created: (shaped.created ?? []) as Song[],
      count: shaped.count ?? shaped.created?.length ?? 0,
    };
  },

  updateSong: async (id: string, data: Partial<Song>): Promise<Song> => {
    const updated = await unwrapApiResult(
      await getApiClient().openapi.PUT("/songs/{id}", {
        params: { path: { id } },
        body: data as unknown as {
          updatedAt: string;
          title?: string;
          artist?: string;
          content?: string;
          folderId?: string | null;
          song_number?: number | null;
          path?: string;
          tags?: string[];
        },
      }),
    );
    return updated as unknown as Song;
  },

  deleteSong: async (id: string): Promise<void> => {
    await unwrapApiResult(
      await getApiClient().openapi.DELETE("/songs/{id}", {
        params: { path: { id } },
      }),
    );
  },

  moveSong: async (
    id: string,
    folderId: string | null,
    updatedAt: string,
    newPath?: string,
  ): Promise<Song> => {
    const moved = await unwrapApiResult(
      await getApiClient().openapi.PUT("/songs/{id}/move", {
        params: { path: { id } },
        body: { folderId, newPath, updatedAt },
      }),
    );
    return moved as unknown as Song;
  },

  downloadSong: async (id: string, filename: string): Promise<void> => {
    const { data, error, response } = await getApiClient().openapi.GET(
      "/songs/{id}/download",
      {
        params: { path: { id } },
        parseAs: "blob",
      },
    );
    if (!response.ok) {
      await unwrapApiResult({ data, error, response });
    }
    const blob = (data ?? (await response.blob())) as Blob;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".pro") ? filename : `${filename}.pro`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  updateBatchTags: async (params: {
    songIds: string[];
    tags: string[];
    mode?: "append" | "replace" | "remove";
  }): Promise<{ success: boolean; count: number }> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.PUT("/songs/batch-tags", {
        body: params,
      }),
    );
    return {
      success: data?.success ?? true,
      count: data?.count ?? 0,
    };
  },
};
