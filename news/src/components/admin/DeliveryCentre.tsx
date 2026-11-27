"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { retryDeliveriesBulk, retryDelivery } from "@/app/actions";
import type { DeliveryListRow } from "@/lib/newsletterAdmin";

const RETRYABLE = new Set(["FAILED", "MISSED", "SKIPPED", "UNKNOWN", "DELAYED", "QUEUED"]);

function fmt(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function StatusChip({ status }: { status: string }) {
  return <span className={`nc-status nc-${status.toLowerCase()}`}>{status}</span>;
}

// The delivery-centre table: server-rendered rows + client-side selection
// and actions. Filters submit GET so every view is a shareable URL.
export default function DeliveryCentre({
  rows,
  total,
  page,
  pages,
  templates,
  params,
  statuses,
}: {
  rows: DeliveryListRow[];
  total: number;
  page: number;
  pages: number;
  templates: { id: string; name: string }[];
  params: Record<string, string | undefined>;
  statuses: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const eligibleRows = rows.filter((row) => RETRYABLE.has(row.status));
  const allChecked = eligibleRows.length > 0 && eligibleRows.every((row) => selected.has(row.id));

  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(eligibleRows.map((row) => row.id)));
  const toggleOne = (id: string) =>
    setSelected((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const retryOne = (row: DeliveryListRow) =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await retryDelivery({ deliveryId: row.id });
      if ("error" in result) setError(result.error);
      else setMessage(`Queued a retry for ${row.email}.`);
    });

  const retrySelection = (ids: string[], label: string) => {
    if (
      !window.confirm(
        `Queue retries for ${ids.length} eligible deliver${ids.length === 1 ? "y" : "ies"} — ${label}?`,
      )
    )
      return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      // Selected ids share the current filter view — retry by status across
      // the filter, capped to the selection client-side via individual calls.
      for (const id of ids) {
        await retryDelivery({ deliveryId: id });
      }
      setMessage(`Queued ${ids.length} retries.`);
      setSelected(new Set());
    });
  };

  const retryFiltered = () => {
    if (
      !window.confirm(
        `Retry every eligible delivery matching the current filters? (${total} matching rows total — only eligible ones are queued.)`,
      )
    )
      return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await retryDeliveriesBulk({
        editionId: params.editionId,
        templateId: params.templateId,
        status: params.status,
        date: params.date,
        email: params.q,
      });
      if ("error" in result) setError(result.error);
      else setMessage(`Queued ${result.queued} eligible deliveries.`);
    });
  };

  const qs = (extra: Record<string, string | undefined>) => {
    const merged = { ...params, ...extra };
    const query = Object.entries(merged)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${encodeURIComponent(value!)}`)
      .join("&");
    return `?${query}`;
  };

  const csvParams = Object.entries({ ...params, tab: undefined, page: undefined, delivery: undefined })
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value!)}`)
    .join("&");
  const csvHref = `/api/admin/deliveries.csv${csvParams ? `?${csvParams}` : ""}`;

  return (
    <div>
      <form method="get" className="nc-filters">
        <input type="hidden" name="tab" value="deliveries" />
        <label className="cms-field small">
          <span>From</span>
          <input type="date" name="from" defaultValue={params.from} />
        </label>
        <label className="cms-field small">
          <span>To</span>
          <input type="date" name="to" defaultValue={params.to} />
        </label>
        <label className="cms-field small">
          <span>Newsletter</span>
          <select name="templateId" defaultValue={params.templateId ?? ""}>
            <option value="">All newsletters</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cms-field small">
          <span>Status</span>
          <select name="status" defaultValue={params.status ?? ""}>
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="cms-field small">
          <span>Source</span>
          <select name="source" defaultValue={params.source ?? ""}>
            <option value="">Automatic + manual</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <label className="cms-field small">
          <span>Recipient</span>
          <input name="q" placeholder="name or email" defaultValue={params.q} />
        </label>
        <label className="cms-field small">
          <span>Sort</span>
          <select name="sort" defaultValue={params.sort ?? "scheduled_desc"}>
            <option value="scheduled_desc">Newest scheduled</option>
            <option value="scheduled_asc">Oldest scheduled</option>
            <option value="email_asc">Recipient A–Z</option>
            <option value="attempts_desc">Most attempts</option>
          </select>
        </label>
        <button type="submit" className="button outline">
          Filter
        </button>
      </form>

      <div className="nc-bulkbar">
        <p className="side-note">
          {total} deliver{total === 1 ? "y" : "ies"}
          {selected.size ? ` · ${selected.size} selected` : ""}
        </p>
        <div className="cat-actions">
          <button
            type="button"
            className="button outline"
            disabled={!selected.size || pending}
            onClick={() => retrySelection([...selected], "your selection")}
          >
            Retry selected
          </button>
          <button type="button" className="button outline" disabled={pending} onClick={retryFiltered}>
            Retry all eligible in filter
          </button>
          <a className="button outline" href={csvHref}>
            Export CSV
          </a>
        </div>
      </div>
      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-note ok" role="status">
          {message}
        </p>
      )}

      <div className="subs-table-wrap">
        <table className="subs-table nc-deliveries">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="Select all eligible deliveries"
                  checked={allChecked}
                  onChange={toggleAll}
                />
              </th>
              <th>Recipient</th>
              <th>Newsletter</th>
              <th>Edition</th>
              <th>Scheduled</th>
              <th>Sent</th>
              <th>Delivered</th>
              <th>Status</th>
              <th>Tries</th>
              <th>Reason</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const eligible = RETRYABLE.has(row.status);
              return (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.email}`}
                      disabled={!eligible}
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                    />
                  </td>
                  <td className="subs-mail">
                    <span className="subs-name">{row.name || row.email}</span>
                    {row.name ? <span className="subs-mail-addr">{row.email}</span> : null}
                  </td>
                  <td>{row.letterName}</td>
                  <td>{row.editionDate || row.editionId.slice(0, 8)}</td>
                  <td>{fmt(row.scheduledAt)}</td>
                  <td>{fmt(row.sentAt)}</td>
                  <td>{fmt(row.deliveredAt)}</td>
                  <td>
                    <StatusChip status={row.status} />
                    {row.source === "manual" ? <small className="nc-reason">manual</small> : null}
                  </td>
                  <td>{row.attempts}</td>
                  <td className="nc-reason">{row.failReason ?? row.skipReason ?? "—"}</td>
                  <td className="nc-row-actions">
                    <Link href={qs({ delivery: row.id })} className="cat-edit">
                      View
                    </Link>
                    {eligible && (
                      <button type="button" className="cat-edit" disabled={pending} onClick={() => retryOne(row)}>
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={11}>No deliveries match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="pager" aria-label="Pagination">
          {page > 1 ? (
            <Link href={qs({ page: String(page - 1) })} className="button outline">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="pager-info">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={qs({ page: String(page + 1) })} className="button outline">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
