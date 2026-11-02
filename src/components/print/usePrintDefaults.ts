/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAuth } from "@/src/contexts/AuthContext";
import { authClient } from "@/src/lib/authClient";
import { useCan } from "@/src/lib/permissions/client";
import { useCallback, useMemo } from "react";
import { resolveOrgPrintSettings, toOrgPrintSettings } from "./options";
import { OrgPrintSettings, PrintOptions } from "./types";

type OrgMetadata = {
  settings?: { print?: unknown; [key: string]: unknown };
  [key: string]: unknown;
};

/** The organisation's saved print defaults, and a way to overwrite them. */
export function usePrintDefaults(): {
  defaults: OrgPrintSettings;
  canSave: boolean;
  save: (options: PrintOptions) => Promise<void>;
} {
  const { organization, refetch } = useAuth();
  const { granted: canSave } = useCan("organization.update");

  const defaults = useMemo(() => {
    const meta = (organization?.metadata as OrgMetadata) || {};
    return resolveOrgPrintSettings(meta.settings?.print);
  }, [organization?.metadata]);

  const save = useCallback(
    async (options: PrintOptions) => {
      if (!organization) return;
      const meta = (organization.metadata as OrgMetadata) || {};
      await authClient.organization.update({
        data: {
          metadata: {
            ...meta,
            settings: {
              ...meta.settings,
              print: toOrgPrintSettings(options),
            },
          },
        },
      });
      await refetch();
    },
    [organization, refetch],
  );

  return { defaults, canSave, save };
}
