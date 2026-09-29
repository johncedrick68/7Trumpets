"use client";

import * as React from "react";
import { Activity, Clock, Eye, FileText, RotateCcw, Search } from "lucide-react";
import { AdminToolbar } from "@/components/admin/admin-toolbar";
import {
  AdminTableContainer,
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminEmptyState,
} from "@/components/admin/admin-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditWorkspaceProps {
  logs: AuditLogEntry[];
}

// Sensitive keys that must NEVER be rendered in UI
const SENSITIVE_KEY_PATTERN = /(password|secret|totp|token|key|cookie|auth|credential)/i;

function sanitizeObject(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      clean[k] = "[REDACTED_SECRET]";
    } else if (typeof v === "object" && v !== null) {
      clean[k] = sanitizeObject(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export function AuditWorkspace({ logs }: AuditWorkspaceProps) {
  const [search, setSearch] = React.useState("");
  const [entityFilter, setEntityFilter] = React.useState("all");
  const [activeLog, setActiveLog] = React.useState<AuditLogEntry | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  // Extract unique entities for filter
  const uniqueEntities = React.useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) {
      if (log.entity) set.add(log.entity);
    }
    return Array.from(set).sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      // 1. Entity filter
      if (entityFilter !== "all" && log.entity !== entityFilter) {
        return false;
      }

      // 2. Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesAction = log.action.toLowerCase().includes(q);
        const matchesEntity = log.entity.toLowerCase().includes(q);
        const matchesEntityId = log.entity_id ? log.entity_id.toLowerCase().includes(q) : false;
        const matchesActorId = log.actor_id ? log.actor_id.toLowerCase().includes(q) : false;
        const matchesActorRole = log.actor_role ? log.actor_role.toLowerCase().includes(q) : false;
        if (!matchesAction && !matchesEntity && !matchesEntityId && !matchesActorId && !matchesActorRole) {
          return false;
        }
      }

      return true;
    });
  }, [logs, search, entityFilter]);

  const hasActiveFilters = search.trim() !== "" || entityFilter !== "all";

  const handleResetFilters = () => {
    setSearch("");
    setEntityFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* Investigation Toolbar */}
      <AdminToolbar>
        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search action, entity, actor ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-xs"
              aria-label="Search audit entries by action, entity, or actor"
            />
          </div>

          {/* Entity Filter */}
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger aria-label="Filter audit logs by entity type" className="h-9 w-full sm:w-[200px] text-xs">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {uniqueEntities.map((ent) => (
                <SelectItem key={ent} value={ent}>
                  {ent.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Reset</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Showing</span>
          <strong className="font-mono font-semibold text-foreground">
            {filteredLogs.length}
          </strong>
          <span>of {logs.length} entries</span>
        </div>
      </AdminToolbar>

      {/* Main Audit Log Table */}
      <AdminTableContainer>
        <AdminTable>
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHead className="w-[190px]">Timestamp</AdminTableHead>
              <AdminTableHead className="w-[200px]">Action</AdminTableHead>
              <AdminTableHead className="w-[220px]">Target Entity</AdminTableHead>
              <AdminTableHead className="w-[180px]">Actor</AdminTableHead>
              <AdminTableHead className="text-right">Payload Detail</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>
          <AdminTableBody>
            {filteredLogs.length === 0 ? (
              <AdminTableRow>
                <AdminTableCell colSpan={5} className="p-0">
                  <AdminEmptyState
                    icon={Activity}
                    title="No audit entries match criteria"
                    description={
                      hasActiveFilters
                        ? "Try clearing the search query or changing the entity filter."
                        : "There are no administrative audit logs recorded in the system."
                    }
                    action={
                      hasActiveFilters ? (
                        <Button variant="outline" size="sm" onClick={handleResetFilters}>
                          Reset Filters
                        </Button>
                      ) : undefined
                    }
                  />
                </AdminTableCell>
              </AdminTableRow>
            ) : (
              filteredLogs.map((log) => (
                <AdminTableRow key={log.id}>
                  {/* Timestamp */}
                  <AdminTableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </AdminTableCell>

                  {/* Action */}
                  <AdminTableCell>
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-mono text-[11px] font-semibold text-foreground uppercase tracking-wide">
                      {log.action}
                    </span>
                  </AdminTableCell>

                  {/* Target Entity */}
                  <AdminTableCell>
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground capitalize">
                        {log.entity.replace(/_/g, " ")}
                      </p>
                      {log.entity_id && (
                        <p className="font-mono text-[10px] text-muted-foreground truncate">
                          {log.entity_id}
                        </p>
                      )}
                    </div>
                  </AdminTableCell>

                  {/* Actor */}
                  <AdminTableCell>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground capitalize">
                        {log.actor_role || "System"}
                      </p>
                      {log.actor_id && (
                        <p className="font-mono text-[10px] text-muted-foreground truncate">
                          {log.actor_id}
                        </p>
                      )}
                    </div>
                  </AdminTableCell>

                  {/* Payload Inspection Trigger */}
                  <AdminTableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        triggerRef.current = e.currentTarget;
                        setActiveLog(log);
                      }}
                      className="h-8 gap-1.5 text-xs font-medium"
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                      <span>Inspect</span>
                    </Button>
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
      </AdminTableContainer>

      {/* ── Detail Inspection Dialog ─────────────────────────────── */}
      {activeLog && (
        <Dialog open={Boolean(activeLog)} onOpenChange={(open) => !open && setActiveLog(null)}>
          <DialogContent
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              triggerRef.current?.focus();
            }}
            className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden"
          >
            <DialogHeader className="p-6 pb-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Clock className="size-3.5" />
                <span>{new Date(activeLog.created_at).toLocaleString()}</span>
              </div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2 mt-1">
                <span className="font-mono uppercase text-sm">{activeLog.action}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Audit Record <span className="font-mono text-[10px]">{activeLog.id}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Context Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Target Entity
                  </span>
                  <p className="font-semibold text-foreground capitalize">
                    {activeLog.entity.replace(/_/g, " ")}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground break-all">
                    {activeLog.entity_id || "N/A"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Origin Actor
                  </span>
                  <p className="font-semibold text-foreground capitalize">
                    {activeLog.actor_role || "System"}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground break-all">
                    {activeLog.actor_id || "System Trigger"}
                  </p>
                </div>
              </div>

              {/* Metadata Payload */}
              {activeLog.metadata && Object.keys(activeLog.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <FileText className="size-3.5 text-muted-foreground" />
                    Operational Metadata
                  </h4>
                  <pre className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-foreground overflow-x-auto">
                    {JSON.stringify(sanitizeObject(activeLog.metadata), null, 2)}
                  </pre>
                </div>
              )}

              {/* Old vs New Values (State Changes) */}
              {(activeLog.old_values || activeLog.new_values) && (
                <div className="space-y-3 pt-1">
                  {activeLog.old_values && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Previous State (Old Values)
                      </span>
                      <pre className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-[11px] text-muted-foreground overflow-x-auto">
                        {JSON.stringify(sanitizeObject(activeLog.old_values), null, 2)}
                      </pre>
                    </div>
                  )}

                  {activeLog.new_values && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-foreground">
                        Mutated State (New Values)
                      </span>
                      <pre className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20 p-3 font-mono text-[11px] text-emerald-900 dark:text-emerald-300 overflow-x-auto">
                        {JSON.stringify(sanitizeObject(activeLog.new_values), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Request Technical Details */}
              {(activeLog.request_id || activeLog.ip_address || activeLog.user_agent) && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1 text-[11px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Technical Tracing
                  </span>
                  {activeLog.request_id && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">Request ID:</span>
                      <span className="font-mono text-foreground">{activeLog.request_id}</span>
                    </div>
                  )}
                  {activeLog.ip_address && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">IP Address:</span>
                      <span className="font-mono text-foreground">{activeLog.ip_address}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
