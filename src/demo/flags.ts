/**
 * Demo-mode session flags — kept free of DB imports so storage naming helpers
 * can depend on this without circular modules.
 */

export const DEMO_SESSION_KEY = "isDemo";
export const DEMO_SEEDED_KEY = "demo_seeded";
/**
 * Reserved org slug for the isolated demo workspace.
 * Must not collide with a real Better Auth organization slug — see server
 * reserved-slug check. The public entry URL remains `/demo`.
 */
export const DEMO_ORG_SLUG = "hosanna-demo";

/** Returns true when the current tab is running in demo mode. */
export function isDemoMode(): boolean {
  try {
    return sessionStorage.getItem(DEMO_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

/** Activates demo mode for the current tab session. */
export function enableDemoMode(): void {
  try {
    sessionStorage.setItem(DEMO_SESSION_KEY, "true");
  } catch {
    // sessionStorage unavailable (e.g. private-mode iOS Safari) — ignore
  }
}

/** Deactivates demo mode and clears all demo session flags. */
export function disableDemoMode(): void {
  try {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    sessionStorage.removeItem(DEMO_SEEDED_KEY);
  } catch {
    // ignore
  }
}

/** Returns true if the demo DB has already been seeded in this session. */
export function isDemoSeeded(): boolean {
  try {
    return sessionStorage.getItem(DEMO_SEEDED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Marks the demo DB as seeded for the current session. */
export function markDemoSeeded(): void {
  try {
    sessionStorage.setItem(DEMO_SEEDED_KEY, "true");
  } catch {
    // ignore
  }
}
