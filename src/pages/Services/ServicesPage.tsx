import {
  Badge,
  ConfirmDialog,
  EmptyState,
  Modal,
  Spinner,
} from "@/src/components/common";
import { useAppNavigate } from "@/src/hooks/useAppNavigate";
import { useI18n } from "@/src/lib/i18n";
import { usePermissionValue } from "@/src/lib/permissions/client";
import { Service } from "@/src/types";
import {
  Archive,
  ArchiveRestore,
  Calendar,
  Copy,
  Edit2,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useOutletContext } from "react-router-dom";
import {
  BatchActionFloatingBar,
  MarqueeSelectionBox,
  ServiceGridCard,
  ServiceTableRow,
} from "../../components/explorer";
import { ServiceForm } from "../../components/forms/ServiceForm";
import { useAuth } from "../../contexts/AuthContext";
import { usePrint } from "../../contexts/PrintContext";
import { useMarqueeSelection } from "../../hooks/useMarqueeSelection";
import { useServices } from "../../hooks/useServices";
import { posthog } from "../../lib/posthog";

interface ServicesPageProps {
  searchQuery?: string;
}

type ServiceSortBy = "date" | "name";
type SortOrder = "asc" | "desc";

export const ServicesPage: React.FC<ServicesPageProps> = ({
  searchQuery: externalSearchQuery,
}) => {
  const { navigate } = useAppNavigate();
  const { t } = useI18n();
  const { organization } = useAuth();
  const slugPrefix = organization?.slug ? `/${organization.slug}` : "";
  const context = (useOutletContext<Record<string, unknown>>() || {}) as Record<
    string,
    unknown
  >;
  const viewMode = context.viewMode ?? "grid";
  const density =
    (context.density as "comfortable" | "compact") ?? "comfortable";
  const contextSortBy = context.sortBy;
  const contextSortOrder = context.sortOrder;
  const actualSearchQuery =
    externalSearchQuery !== undefined
      ? externalSearchQuery
      : (context.searchQuery as string) || "";

  const { servicesQuery, createService, updateService, deleteService } =
    useServices();
  const { printService, printServices } = usePrint();

  // Effective sort (from MainLayout context)
  const effectiveSortBy: ServiceSortBy =
    contextSortBy === "title" ? "name" : "date";
  const effectiveSortOrder: SortOrder =
    (contextSortOrder as SortOrder) ?? "desc";

  // ─── Archive toggle (from MainLayout context or local fallback) ──────────
  const showArchived = (context.showArchived as boolean) ?? false;

  // Fetch archived services (fallback if context doesn't provide)
  const { servicesQuery: localArchivedServicesQuery } = useServices(true);

  const archivedServicesQuery =
    (context.archivedServicesQuery as typeof localArchivedServicesQuery) ??
    localArchivedServicesQuery;

  const { value: emptyStateAction } = usePermissionValue(
    "service.create",
    t("servicesPage.createFirstService"),
    undefined,
  );

  // ─── Modal / dialog state ─────────────────────────────────────────────────
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Service | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    service: Service | null;
    isMulti?: boolean;
  } | null>(null);

  // ─── Multi-select state ───────────────────
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(
    new Set(),
  );
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isBatchArchiveOpen, setIsBatchArchiveOpen] = useState(false);

  // ─── Data ─────────────────────────────────────────────────────────────────
  const allServices: Service[] = useMemo(
    () =>
      (servicesQuery.data || []).map((s: Service) => ({
        ...s,
        archived: s.archived ?? false,
      })),
    [servicesQuery.data],
  );

  // Active (non-archived) services
  const activeServices = useMemo(
    () => allServices.filter((s) => !s.archived),
    [allServices],
  );

  const archivedServices = useMemo(
    () =>
      showArchived
        ? (
            (context.archivedServices as Service[] | null) ??
            archivedServicesQuery.data ??
            []
          ).filter((s) => s.archived)
        : [],
    [showArchived, context.archivedServices, archivedServicesQuery.data],
  );

  // ─── Filter + sort ────────────────────────────────────────────────────────
  const sortServices = useCallback(
    (list: Service[]): Service[] => {
      return [...list].sort((a, b) => {
        let valA: string;
        let valB: string;
        if (effectiveSortBy === "name") {
          valA = (a.name || "").toLowerCase();
          valB = (b.name || "").toLowerCase();
        } else {
          valA = a.date || a.updatedAt || "";
          valB = b.date || b.updatedAt || "";
        }
        if (valA < valB) return effectiveSortOrder === "asc" ? -1 : 1;
        if (valA > valB) return effectiveSortOrder === "asc" ? 1 : -1;
        return 0;
      });
    },
    [effectiveSortBy, effectiveSortOrder],
  );

  const filteredServices = useMemo(() => {
    let list = activeServices;
    if (actualSearchQuery.trim()) {
      const lq = actualSearchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(lq) ||
          (s.notes && s.notes.toLowerCase().includes(lq)),
      );
    }
    return sortServices(list);
  }, [activeServices, actualSearchQuery, sortServices]);

  const filteredArchivedServices = useMemo(() => {
    let list = archivedServices;
    if (actualSearchQuery.trim()) {
      const lq = actualSearchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(lq) ||
          (s.notes && s.notes.toLowerCase().includes(lq)),
      );
    }
    return sortServices(list);
  }, [archivedServices, actualSearchQuery, sortServices]);

  // Combined visible list for keyboard selection and operations
  const allVisibleServices = useMemo(
    () =>
      showArchived
        ? [...filteredServices, ...filteredArchivedServices]
        : filteredServices,
    [showArchived, filteredServices, filteredArchivedServices],
  );

  // ─── Context menu auto-close listeners ────────────────────────────────────
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, []);

  // ─── Keyboard shortcuts (selection mode) ──────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isTyping) return;

      if (e.key === "Escape") {
        setContextMenu(null);
        setSelectedServiceIds(new Set());
        setLastClickedId(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedServiceIds(new Set(allVisibleServices.map((s) => s.id)));
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedServiceIds.size === 0) return;
        e.preventDefault();
        if (selectedServiceIds.size === 1) {
          const service = allVisibleServices.find((s) =>
            selectedServiceIds.has(s.id),
          );
          if (service) setDeleteTarget(service);
        } else {
          setIsBatchDeleteOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allVisibleServices, selectedServiceIds]);

  // ─── Marquee selection hook ──────────────────────────────────────────────
  const { selectionBox, handleMouseDown: handleWorkspaceMouseDown } =
    useMarqueeSelection({
      containerRef,
      enabled: true,
      selectedIds: selectedServiceIds,
      onSelectionChange: setSelectedServiceIds,
      onClearSelection: () => {
        setSelectedServiceIds(new Set());
        setLastClickedId(null);
      },
    });

  // ─── Item click handler (Ctrl/Shift/normal) ───────────────────────────────
  const handleServiceClick = useCallback(
    (e: React.MouseEvent, service: Service, allDisplayed: Service[]) => {
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        setSelectedServiceIds((prev) => {
          const next = new Set(prev);
          if (next.has(service.id)) next.delete(service.id);
          else next.add(service.id);
          return next;
        });
        setLastClickedId(service.id);
      } else if (e.shiftKey && lastClickedId) {
        const allIds = allDisplayed.map((s) => s.id);
        const idx1 = allIds.indexOf(lastClickedId);
        const idx2 = allIds.indexOf(service.id);
        if (idx1 !== -1 && idx2 !== -1) {
          const start = Math.min(idx1, idx2);
          const end = Math.max(idx1, idx2);
          const rangeIds = allIds.slice(start, end + 1);
          setSelectedServiceIds(new Set(rangeIds));
        } else {
          setSelectedServiceIds(new Set([service.id]));
        }
        setLastClickedId(service.id);
      } else {
        if (
          selectedServiceIds.size === 1 &&
          selectedServiceIds.has(service.id)
        ) {
          navigate(`${slugPrefix}/services/${service.id}`);
          return;
        }
        setSelectedServiceIds(new Set([service.id]));
        setLastClickedId(service.id);
      }
    },
    [navigate, slugPrefix, lastClickedId, selectedServiceIds],
  );

  // ─── Context menu opener ──────────────────────────────────────────────────
  const openContextMenu = useCallback(
    (e: React.MouseEvent, service: Service) => {
      e.preventDefault();
      e.stopPropagation();

      if (!selectedServiceIds.has(service.id)) {
        setSelectedServiceIds(new Set([service.id]));
        setLastClickedId(service.id);
      }

      const x = Math.max(12, Math.min(e.clientX, window.innerWidth - 240));
      const y = Math.max(12, Math.min(e.clientY, window.innerHeight - 320));
      const isMulti =
        selectedServiceIds.size > 1 && selectedServiceIds.has(service.id);

      setContextMenu({ x, y, service, isMulti });
    },
    [selectedServiceIds],
  );

  // ─── Service actions ──────────────────────────────────────────────────────
  const handleCreateServiceSubmit = async (data: {
    name: string;
    date: string;
    notes: string;
  }) => {
    try {
      const newService = await createService({
        name: data.name,
        date: data.date,
        notes: data.notes,
        elements: [],
      });
      posthog.capture("service_created", { has_notes: !!data.notes });
      setIsCreateModalOpen(false);
      navigate(`${slugPrefix}/services/${newService.id}`);
    } catch {
      // Toast notification is already handled by useServices
    }
  };

  const handleEditServiceSubmit = async (data: {
    name: string;
    date: string;
    notes: string;
  }) => {
    if (!editTarget) return;
    try {
      await updateService({
        id: editTarget.id,
        data: {
          name: data.name,
          date: data.date,
          notes: data.notes,
          updatedAt: editTarget.updatedAt,
        },
      });
      setEditTarget(null);
    } catch {
      // Toast notification is already handled by useServices
    }
  };

  const handleDuplicateService = async (service: Service) => {
    try {
      let fullElements = service.elements;
      if (!fullElements) {
        const fullService = (servicesQuery.data || []).find(
          (s: Service) => s.id === service.id,
        );
        fullElements = fullService?.elements || [];
      }
      await createService({
        name: `${service.name}${t("common.copySuffix")}`,
        date: service.date,
        notes: service.notes || "",
        elements: fullElements || [],
      });
    } catch {
      await createService({
        name: `${service.name}${t("common.copySuffix")}`,
        date: service.date,
        notes: service.notes || "",
        elements: [],
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteService(deleteTarget.id);
    posthog.capture("service_deleted", { count: 1 });
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteTarget.id);
      return next;
    });
    setDeleteTarget(null);
  };

  const handleArchiveToggle = async (service: Service) => {
    const nextArchived = !service.archived;
    try {
      await updateService({
        id: service.id,
        data: {
          archived: nextArchived,
          updatedAt: service.updatedAt,
        },
      });
      posthog.capture("service_archived", { archived: nextArchived });
    } catch {
      // Toast notification is already handled by useServices
    }
    setArchiveTarget(null);
    setContextMenu(null);
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedServiceIds);
    await Promise.allSettled(ids.map((id) => deleteService(id)));
    posthog.capture("service_deleted", { count: ids.length });
    setSelectedServiceIds(new Set());
    setIsBatchDeleteOpen(false);
  };

  const handleBatchArchive = async () => {
    const ids = Array.from(selectedServiceIds);
    const updates = ids.map((id) => {
      const service = allVisibleServices.find((s) => s.id === id);
      if (service) {
        return updateService({
          id,
          data: {
            archived: !service.archived,
            updatedAt: service.updatedAt,
          },
        });
      }
      return Promise.resolve();
    });
    await Promise.allSettled(updates);
    setSelectedServiceIds(new Set());
    setIsBatchArchiveOpen(false);
  };

  // ─── Loading State ────────────────────────────────────────────────────────
  if (servicesQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Spinner label={t("servicesPage.loading")} />
      </div>
    );
  }

  // ─── Truly Empty State (Only when no active services AND archive view is off/empty) ───
  const hasNoItemsToShow =
    activeServices.length === 0 &&
    (!showArchived ||
      (archivedServices.length === 0 && !archivedServicesQuery.isLoading));

  if (hasNoItemsToShow && !actualSearchQuery) {
    return (
      <div
        className="flex-1 flex flex-col w-full mx-auto animate-in fade-in duration-500 overflow-y-auto h-full p-4 sm:p-8 max-w-7xl"
        onContextMenu={(e) => e.preventDefault()}
      >
        <EmptyState
          icon={<Calendar className="w-12 h-12 text-m3-primary opacity-40" />}
          title={t("servicesPage.noServicesTitle")}
          description={t("servicesPage.noServicesDesc")}
          actionLabel={emptyStateAction}
          onAction={() => setIsCreateModalOpen(true)}
        />
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title={t("servicesPage.createServiceTitle")}
        >
          <ServiceForm
            onSubmit={handleCreateServiceSubmit}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        </Modal>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────
  return (
    <div
      className="flex-1 flex flex-col w-full mx-auto space-y-6 animate-in fade-in duration-300 overflow-y-auto h-full relative select-none p-4 sm:p-8 max-w-7xl"
      onMouseDown={handleWorkspaceMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      ref={containerRef}
    >
      {/* ── Services Content (Grid / List Views) ── */}
      {viewMode === "grid" ? (
        <div
          className={
            density === "compact"
              ? "grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3.5"
              : "grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
          }
        >
          {filteredServices.length === 0 && !showArchived ? (
            <div className="col-span-full text-center py-20 text-m3-secondary font-black uppercase tracking-widest opacity-60">
              {t("servicesPage.noMatch")}
            </div>
          ) : (
            filteredServices.map((service) => (
              <ServiceGridCard
                key={service.id}
                service={service}
                isSelected={selectedServiceIds.has(service.id)}
                density={density}
                onClick={(e) =>
                  handleServiceClick(e, service, filteredServices)
                }
                onDoubleClick={() =>
                  navigate(`${slugPrefix}/services/${service.id}`)
                }
                onContextMenu={(e) => openContextMenu(e, service)}
              />
            ))
          )}

          {/* Archived section */}
          {showArchived && (
            <>
              <div className="col-span-full flex items-center gap-3 mt-4 mb-2">
                <div className="h-px flex-1 bg-amber-500/20" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <Archive className="w-3.5 h-3.5" />
                  {t("servicesPage.archivedTitle", {
                    count: filteredArchivedServices.length,
                  })}
                  {archivedServicesQuery.isLoading && <Spinner size="sm" />}
                </span>
                <div className="h-px flex-1 bg-amber-500/20" />
              </div>
              {filteredArchivedServices.length === 0 &&
              !archivedServicesQuery.isLoading ? (
                <div className="col-span-full text-center py-8 text-m3-secondary text-xs opacity-60">
                  {t("servicesPage.noArchived")}
                </div>
              ) : (
                filteredArchivedServices.map((service) => (
                  <ServiceGridCard
                    key={service.id}
                    service={service}
                    isSelected={selectedServiceIds.has(service.id)}
                    isArchived
                    density={density}
                    onClick={(e) =>
                      handleServiceClick(e, service, filteredArchivedServices)
                    }
                    onDoubleClick={() =>
                      navigate(`${slugPrefix}/services/${service.id}`)
                    }
                    onContextMenu={(e) => openContextMenu(e, service)}
                  />
                ))
              )}
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border border-m3-border/40 rounded-3xl bg-m3-card shadow-sm">
          <table className="w-full text-left border-collapse select-none">
            <thead>
              <tr className="bg-m3-sidebar/40 border-b border-m3-border text-[10px] font-black text-m3-secondary uppercase tracking-[0.2em]">
                <th
                  className={
                    density === "compact" ? "py-2.5 px-4" : "py-4 px-6"
                  }
                >
                  {t("servicesPage.serviceName")}
                </th>
                <th
                  className={
                    density === "compact" ? "py-2.5 px-4" : "py-4 px-6"
                  }
                >
                  {t("common.type")}
                </th>
                <th
                  className={
                    density === "compact" ? "py-2.5 px-4" : "py-4 px-6"
                  }
                >
                  {t("servicesPage.scheduledDate")}
                </th>
                <th
                  className={`${density === "compact" ? "py-2.5 px-4" : "py-4 px-6"} text-right`}
                >
                  {t("servicesPage.actions")}
                </th>
              </tr>
            </thead>
            <tbody
              className={`divide-y divide-m3-border/30 ${density === "compact" ? "text-xs" : "text-[13px]"} font-bold`}
            >
              {filteredServices.length === 0 && !showArchived ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-12 text-m3-secondary opacity-60"
                  >
                    {t("servicesPage.noMatch")}
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => (
                  <ServiceTableRow
                    key={service.id}
                    service={service}
                    isSelected={selectedServiceIds.has(service.id)}
                    density={density}
                    onClick={(e) =>
                      handleServiceClick(e, service, filteredServices)
                    }
                    onDoubleClick={() =>
                      navigate(`${slugPrefix}/services/${service.id}`)
                    }
                    onContextMenu={(e) => openContextMenu(e, service)}
                  />
                ))
              )}

              {/* Archived rows */}
              {showArchived && (
                <>
                  <tr>
                    <td
                      colSpan={4}
                      className="py-3 px-6 bg-amber-50/50 dark:bg-amber-950/20"
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <Archive className="w-3.5 h-3.5" />
                        {t("servicesPage.archivedTitle", {
                          count: filteredArchivedServices.length,
                        })}
                        {archivedServicesQuery.isLoading && (
                          <Spinner size="sm" />
                        )}
                      </span>
                    </td>
                  </tr>
                  {filteredArchivedServices.length === 0 &&
                  !archivedServicesQuery.isLoading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-6 text-m3-secondary text-xs opacity-60"
                      >
                        {t("servicesPage.noArchived")}
                      </td>
                    </tr>
                  ) : (
                    filteredArchivedServices.map((service) => (
                      <ServiceTableRow
                        key={service.id}
                        service={service}
                        isSelected={selectedServiceIds.has(service.id)}
                        isArchived
                        density={density}
                        onClick={(e) =>
                          handleServiceClick(
                            e,
                            service,
                            filteredArchivedServices,
                          )
                        }
                        onDoubleClick={() =>
                          navigate(`${slugPrefix}/services/${service.id}`)
                        }
                        onContextMenu={(e) => openContextMenu(e, service)}
                      />
                    ))
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Multi-select action bar ── */}
      <BatchActionFloatingBar
        selectedCount={selectedServiceIds.size}
        itemLabel={t("common.services")}
        onPrint={() => {
          const selected = allServices.filter((s) =>
            selectedServiceIds.has(s.id),
          );
          if (selected.length > 0) {
            printServices(selected.map((s) => ({ service: s })));
          }
        }}
        onArchive={() => setIsBatchArchiveOpen(true)}
        onDelete={() => setIsBatchDeleteOpen(true)}
        onCancel={() => {
          setSelectedServiceIds(new Set());
          setLastClickedId(null);
        }}
      />

      {/* ── FLOATING CONTEXT MENU ── */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 flex flex-col gap-0.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.isMulti ? (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-500 border-b border-slate-100 dark:border-slate-800/80 mb-0.5 flex items-center justify-between">
                <span>{t("servicesPage.multiSelect")}</span>
                <Badge variant="sky">{selectedServiceIds.size}</Badge>
              </div>
              <button
                onClick={() => {
                  const selected = allServices.filter((s) =>
                    selectedServiceIds.has(s.id),
                  );
                  if (selected.length > 0) {
                    printServices(selected.map((s) => ({ service: s })));
                  }
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
              >
                <Printer className="w-4 h-4 text-sky-500" />
                <span>
                  {t("print.buttons.printCount", {
                    count: selectedServiceIds.size,
                  })}
                </span>
              </button>
              <button
                onClick={() => {
                  setIsBatchArchiveOpen(true);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
              >
                <Archive className="w-4 h-4 text-amber-500" />
                <span>
                  {t("servicesPage.archiveCount", {
                    count: selectedServiceIds.size,
                  })}
                </span>
              </button>
              <button
                onClick={() => {
                  setIsBatchDeleteOpen(true);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition-colors text-left cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>
                  {t("servicesPage.deleteCount", {
                    count: selectedServiceIds.size,
                  })}
                </span>
              </button>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />
              <button
                onClick={() => {
                  setSelectedServiceIds(new Set());
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-400" />
                <span>{t("servicesPage.deselect")}</span>
              </button>
            </>
          ) : contextMenu.service ? (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/80 mb-0.5 truncate">
                {contextMenu.service.name}
              </div>

              <button
                onClick={() => {
                  navigate(`${slugPrefix}/services/${contextMenu.service!.id}`);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-sky-500" />
                <span>{t("servicesPage.openService")}</span>
              </button>

              <button
                onClick={() => {
                  setEditTarget(contextMenu.service);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
              >
                <Edit2 className="w-4 h-4 text-blue-500" />
                <span>{t("servicesPage.editNameDate")}</span>
              </button>

              <button
                onClick={() => {
                  handleDuplicateService(contextMenu.service!);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
              >
                <Copy className="w-4 h-4 text-emerald-500" />
                <span>{t("servicesPage.duplicate")}</span>
              </button>

              <button
                onClick={() => {
                  if (contextMenu.service) {
                    printService(contextMenu.service);
                  }
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
              >
                <Printer className="w-4 h-4 text-sky-500" />
                <span>{t("print.buttons.printServiceShort")}</span>
              </button>

              <button
                onClick={() => {
                  handleArchiveToggle(contextMenu.service!);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors text-left cursor-pointer"
              >
                {contextMenu.service.archived ? (
                  <ArchiveRestore className="w-4 h-4 text-orange-500" />
                ) : (
                  <Archive className="w-4 h-4 text-orange-500" />
                )}
                <span>
                  {contextMenu.service.archived
                    ? t("servicesPage.activateService")
                    : t("servicesPage.archiveService")}
                </span>
              </button>

              <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

              <button
                onClick={() => {
                  setDeleteTarget(contextMenu.service);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition-colors text-left cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>{t("servicesPage.deleteService")}</span>
              </button>
            </>
          ) : null}
        </div>
      )}

      {/* ── CREATE SERVICE MODAL ── */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t("servicesPage.createServiceTitle")}
      >
        <ServiceForm
          onSubmit={handleCreateServiceSubmit}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* ── EDIT SERVICE MODAL ── */}
      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={t("servicesPage.editServiceTitle")}
      >
        {editTarget && (
          <ServiceForm
            initialValues={{
              name: editTarget.name,
              date: editTarget.date,
              notes: editTarget.notes || "",
            }}
            onSubmit={handleEditServiceSubmit}
            onCancel={() => setEditTarget(null)}
          />
        )}
      </Modal>

      {/* ── DELETE SERVICE DIALOG ── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("servicesPage.deleteService")}
        message={t("servicesPage.deleteServiceMessage", {
          name: deleteTarget?.name || "",
        })}
        confirmText={t("servicesPage.deleteService")}
      />

      {/* ── ARCHIVE SERVICE DIALOG ── */}
      <ConfirmDialog
        variant="primary"
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && handleArchiveToggle(archiveTarget)}
        title={
          archiveTarget?.archived
            ? t("servicesPage.activateService")
            : t("servicesPage.archiveService")
        }
        message={t("servicesPage.archiveServiceMessage", {
          action: archiveTarget?.archived
            ? t("servicesPage.activate")
            : t("servicesPage.archive"),
          name: archiveTarget?.name || "",
        })}
        confirmText={
          archiveTarget?.archived
            ? t("servicesPage.activateService")
            : t("servicesPage.archiveService")
        }
      />

      {/* ── BATCH DELETE DIALOG ── */}
      <ConfirmDialog
        isOpen={isBatchDeleteOpen}
        onClose={() => setIsBatchDeleteOpen(false)}
        onConfirm={handleBatchDelete}
        title={t("servicesPage.deleteAllTitle", {
          count: selectedServiceIds.size,
        })}
        message={t("servicesPage.deleteAllMessage", {
          count: selectedServiceIds.size,
        })}
        confirmText={t("servicesPage.deleteAll")}
      />

      {/* ── BATCH ARCHIVE DIALOG ── */}
      <ConfirmDialog
        variant="primary"
        isOpen={isBatchArchiveOpen}
        onClose={() => setIsBatchArchiveOpen(false)}
        onConfirm={handleBatchArchive}
        title={t("servicesPage.archiveAllTitle", {
          count: selectedServiceIds.size,
        })}
        message={t("servicesPage.archiveAllMessage", {
          count: selectedServiceIds.size,
        })}
        confirmText={t("servicesPage.archiveAll")}
      />

      {/* ── Marquee rubberband selection box ── */}
      <MarqueeSelectionBox box={selectionBox} />
    </div>
  );
};
