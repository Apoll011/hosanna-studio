/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The single source of truth for "where am I?" in the app.
 *
 * Instead of scattering `isSongsView`, `isServicesView`, `isExplorerView`, ...
 * booleans across the layout and its children, every consumer derives what it
 * needs from one discriminant: `ViewName`.
 */
export type ViewName =
  | "explorer"
  | "songs"
  | "song-editor"
  | "services"
  | "service-editor"
  | "collections"
  | "collection-detail"
  | "teams"
  | "settings"
  | "agenda"
  | "trash";

/**
 * Derive the current view from a `location.pathname` and the organisation slug
 * prefix. Slug-stripping keeps the matching logic identical for both
 * `/org/songs` and `/songs`.
 */
export function deriveView(pathname: string, slugPrefix: string): ViewName {
  const path =
    slugPrefix && pathname.startsWith(slugPrefix)
      ? pathname.slice(slugPrefix.length) || "/"
      : pathname;

  if (path === "/songs") return "songs";
  if (path.startsWith("/songs/")) return "song-editor";
  if (path === "/services") return "services";
  if (path.startsWith("/services/")) return "service-editor";
  if (path === "/collections") return "collections";
  if (path.startsWith("/collections/")) return "collection-detail";
  if (path.includes("/teams")) return "teams";
  if (path.includes("/agenda")) return "agenda";
  if (path.includes("/settings")) return "settings";
  if (path.includes("/trash")) return "trash";

  // `/folders` and every unmatched route fall back to the explorer view.
  return "explorer";
}
