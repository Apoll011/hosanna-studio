import { unwrapApiResult } from "./client";
import { getApiClient } from "./http";

export type YouTubeDurationResponse = {
  videoId: string;
  url: string;
  durationSeconds: number;
  /** ChordPro-friendly `M:SS` / `H:MM:SS` */
  duration: string;
  directive: string;
  provider: "youtube_api" | "watch_page";
};

export const youtubeApi = {
  getDuration: async (urlOrId: string): Promise<YouTubeDurationResponse> => {
    const data = await unwrapApiResult(
      await getApiClient().openapi.GET("/youtube/duration", {
        params: { query: { url: urlOrId } },
      }),
    );
    return data as unknown as YouTubeDurationResponse;
  },
};
