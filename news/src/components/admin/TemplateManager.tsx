"use client";

import { Fragment, useState, useTransition } from "react";
import {
  previewLetterTemplate,
  saveLetterTemplate,
  sendTestLetter,
  setLetterTemplateActive,
} from "@/app/actions";
import { EMAIL_FORMATS } from "@/lib/newsletters";
import { MAX_ARTICLE_COUNT, MIN_STORIES } from "@/lib/newsletterFormats";
import type { LetterTemplate, TemplateContent } from "@/lib/letterTemplates";
import type { SelectionConfig } from "@/lib/articleSelection";
import { SCHEDULE_KINDS } from "@/lib/scheduler";

const KIND_LABELS: Record<string, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  trading: "Trading days",
  event: "Event based",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Editor for one template — same card grammar as the category manager.
function TemplateEditor({
  template,
  onClose,
}: {
  template: LetterTemplate;
  onClose: () => void;
}) {
  const [form, setForm] = useState<LetterTemplate>(structuredClone(template));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewFormat, setPreviewFormat] = useState(template.defaultFormat ?? "daily_digest");
  const [mobile, setMobile] = useState(false);
  const [pending, startTransition] = useTransition();

  const patch = (fields: Partial<LetterTemplate>) => setForm((f) => ({ ...f, ...fields }));
  const patchSchedule = (fields: Partial<LetterTemplate["schedule"]>) =>
    setForm((f) => ({ ...f, schedule: { ...f.schedule, ...fields } }));
  const patchSelection = (fields: Partial<SelectionConfig>) =>
    setForm((f) => ({ ...f, selection: { ...(f.selection ?? {}), ...fields } }));
  const patchContent = (fields: Partial<TemplateContent>) =>
    setForm((f) => ({ ...f, content: { ...(f.content ?? {}), ...fields } }));

  const save = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await saveLetterTemplate(form);
      if ("error" in result) setError(result.error);
      else setMessage("Saved.");
    });

  const testSend = () => {
    const email = window.prompt("Send a test edition to:");
    if (!email) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await sendTestLetter({ id: form.id, email, format: previewFormat });
      if ("error" in result) setError(result.error);
      else setMessage(result.message);
    });
  };

  const previewNow = (format: string) =>
    startTransition(async () => {
      setError(null);
      setPreviewFormat(format as LetterTemplate["defaultFormat"]);
      const result = await previewLetterTemplate({ id: form.id, format });
      if ("error" in result) setError(result.error);
      else setPreview({ subject: result.subject, html: result.html });
    });

  return (
    <div className="cat-form">
      <div className="cat-form-flags">
        <label className="cms-field small">
          <span>Name</span>
          <input value={form.name} maxLength={80} onChange={(e) => patch({ name: e.target.value })} />
        </label>
        <label className="cms-field small">
          <span>Schedule</span>
          <select
            value={form.schedule.kind}
            onChange={(e) => patchSchedule({ kind: e.target.value as LetterTemplate["schedule"]["kind"] })}
          >
            {SCHEDULE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind] ?? kind}
              </option>
            ))}
          </select>
        </label>
        {form.schedule.kind === "weekly" && (
          <label className="cms-field small">
            <span>Send day</span>
            <select
              value={form.schedule.dayOfWeek ?? 0}
              onChange={(e) => patchSchedule({ dayOfWeek: Number(e.target.value) })}
            >
              {DAY_NAMES.map((day, i) => (
                <option key={day} value={i}>
                  {day}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="cms-field small">
          <span>Default time</span>
          <input
            type="time"
            value={form.schedule.time}
            onChange={(e) => patchSchedule({ time: e.target.value })}
          />
        </label>
        <label className="cms-field small">
          <span>Timezone</span>
          <input
            value={form.schedule.timeZone}
            placeholder="Asia/Kolkata"
            onChange={(e) => patchSchedule({ timeZone: e.target.value })}
          />
        </label>
        <label className="cms-field small">
          <span>Articles per issue ({MIN_STORIES}–{MAX_ARTICLE_COUNT})</span>
          <input
            type="number"
            min={MIN_STORIES}
            max={MAX_ARTICLE_COUNT}
            value={form.articleCount}
            onChange={(e) => patch({ articleCount: Number(e.target.value) })}
          />
        </label>
        <label className="cms-field small">
          <span>Min stories before flagging</span>
          <input
            type="number"
            min={MIN_STORIES}
            max={MAX_ARTICLE_COUNT}
            value={form.minArticles}
            onChange={(e) => patch({ minArticles: Number(e.target.value) })}
          />
        </label>
        <label className="cms-field small">
          <span>Selection window (hours)</span>
          <input
            type="number"
            min={1}
            max={24 * 90}
            value={form.selection?.windowHours ?? ""}
            placeholder="24 daily / 168 weekly"
            onChange={(e) =>
              patchSelection({ windowHours: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </label>
        <label className="cms-field small">
          <span>Fallback windows (hours, comma)</span>
          <input
            value={(form.selection?.fallbackWindowsHours ?? []).join(", ")}
            placeholder="48, 168"
            onChange={(e) =>
              patchSelection({
                fallbackWindowsHours: e.target.value
                  .split(",")
                  .map((v) => Number(v.trim()))
                  .filter((v) => Number.isFinite(v) && v > 0),
              })
            }
          />
        </label>
        <label className="cms-field small">
          <span>Re-use articles after (days)</span>
          <input
            type="number"
            min={1}
            max={365}
            value={form.selection?.excludeSentDays ?? ""}
            placeholder="7"
            onChange={(e) =>
              patchSelection({ excludeSentDays: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </label>
        <label className="cms-field small">
          <span>When short of stories</span>
          <select value={form.onEmpty} onChange={(e) => patch({ onEmpty: e.target.value as LetterTemplate["onEmpty"] })}>
            <option value="send-with-fallback">Send with the letter&apos;s standing content</option>
            <option value="skip">Skip the edition</option>
            <option value="hold">Hold for review</option>
          </select>
        </label>
        <label className="cms-field small">
          <span>Cadence label</span>
          <input value={form.cadence} maxLength={80} onChange={(e) => patch({ cadence: e.target.value })} />
        </label>
      </div>
      <label className="cms-field">
        <span>Description</span>
        <textarea rows={2} maxLength={300} value={form.description} onChange={(e) => patch({ description: e.target.value })} />
      </label>
      <label className="cms-field">
        <span>Desks / topics (comma-separated)</span>
        <input
          value={form.topics.join(", ")}
          onChange={(e) => patch({ topics: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
        />
      </label>
      <fieldset className="cms-field">
        <span>Supported formats</span>
        <div className="nc-format-picks">
          {EMAIL_FORMATS.map((fmt) => (
            <label key={fmt.id} className={`cat-flag${form.formats.includes(fmt.id) ? " on" : ""}`}>
              <input
                type="checkbox"
                hidden
                checked={form.formats.includes(fmt.id)}
                onChange={(e) =>
                  patch({
                    formats: e.target.checked
                      ? [...form.formats, fmt.id]
                      : form.formats.filter((f) => f !== fmt.id),
                  })
                }
              />
              {fmt.name}
            </label>
          ))}
        </div>
        <div className="cat-form-flags" style={{ marginTop: 10 }}>
          <label className="cms-field small">
            <span>Default format</span>
            <select
              value={form.defaultFormat}
              onChange={(e) => patch({ defaultFormat: e.target.value as LetterTemplate["defaultFormat"] })}
            >
              {EMAIL_FORMATS.filter((fmt) => form.formats.includes(fmt.id)).map((fmt) => (
                <option key={fmt.id} value={fmt.id}>
                  {fmt.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      <div className="cat-form-flags">
        <label className="cms-switch">
          <input
            type="checkbox"
            checked={form.selection?.crossDeskFallback === true}
            onChange={(e) => patchSelection({ crossDeskFallback: e.target.checked })}
          />
          <span className="switch" aria-hidden="true" />
          <span>Allow cross-desk fallback</span>
        </label>
        <label className="cms-switch">
          <input
            type="checkbox"
            checked={form.selection?.allowPremium === true}
            onChange={(e) => patchSelection({ allowPremium: e.target.checked })}
          />
          <span className="switch" aria-hidden="true" />
          <span>Include premium stories</span>
        </label>
      </div>
      <fieldset className="cms-field">
        <span>Optional content blocks (never counted as stories)</span>
        <div className="cat-form-flags">
          <label className="cms-switch">
            <input
              type="checkbox"
              checked={form.content?.marketSnapshot === true}
              onChange={(e) => patchContent({ marketSnapshot: e.target.checked })}
            />
            <span className="switch" aria-hidden="true" />
            <span>Market snapshot</span>
          </label>
        </div>
        <div className="cat-form-flags">
          <label className="cms-field small">
            <span>Interesting fact</span>
            <input
              value={form.content?.interestingFact ?? ""}
              placeholder="Shown in the digest when set"
              onChange={(e) => patchContent({ interestingFact: e.target.value })}
            />
          </label>
          <label className="cms-field small">
            <span>Editor&apos;s note</span>
            <input
              value={form.content?.editorsNote ?? ""}
              onChange={(e) => patchContent({ editorsNote: e.target.value })}
            />
          </label>
        </div>
        <div className="cat-form-flags">
          <label className="cms-field small">
            <span>Poll question</span>
            <input
              value={form.content?.poll?.question ?? ""}
              onChange={(e) =>
                patchContent({
                  poll: {
                    question: e.target.value,
                    options: form.content?.poll?.options ?? ["Yes", "No"],
                  },
                })
              }
            />
          </label>
          <label className="cms-field small">
            <span>Poll options (comma)</span>
            <input
              value={(form.content?.poll?.options ?? []).join(", ")}
              onChange={(e) =>
                patchContent({
                  poll: {
                    question: form.content?.poll?.question ?? "",
                    options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                  },
                })
              }
            />
          </label>
          <label className="cms-field small">
            <span>Quiz question</span>
            <input
              value={form.content?.quiz?.question ?? ""}
              onChange={(e) =>
                patchContent({
                  quiz: {
                    question: e.target.value,
                    options: form.content?.quiz?.options ?? ["A", "B"],
                    answer: form.content?.quiz?.answer,
                  },
                })
              }
            />
          </label>
          <label className="cms-field small">
            <span>Quiz options (comma)</span>
            <input
              value={(form.content?.quiz?.options ?? []).join(", ")}
              onChange={(e) =>
                patchContent({
                  quiz: {
                    question: form.content?.quiz?.question ?? "",
                    options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                    answer: form.content?.quiz?.answer,
                  },
                })
              }
            />
          </label>
        </div>
      </fieldset>
      <div className="cat-form-flags">
        <label className="cms-switch">
          <input type="checkbox" checked={form.premium} onChange={(e) => patch({ premium: e.target.checked })} />
          <span className="switch" aria-hidden="true" />
          <span>Premium edition</span>
        </label>
        <label className="cms-switch">
          <input type="checkbox" checked={form.active} onChange={(e) => patch({ active: e.target.checked })} />
          <span className="switch" aria-hidden="true" />
          <span>Active</span>
        </label>
      </div>
      <div className="cat-actions">
        <button type="button" className="button" onClick={save} disabled={pending}>
          Save newsletter
        </button>
        <button type="button" className="button outline" onClick={() => previewNow(previewFormat)} disabled={pending}>
          Preview edition
        </button>
        <button type="button" className="button outline" onClick={testSend} disabled={pending}>
          Send test email
        </button>
        <button type="button" className="cat-delete" onClick={onClose}>
          Close
        </button>
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
      {preview && (
        <div className="nc-preview">
          <div className="nc-preview-head">
            <strong>{preview.subject}</strong>
            <div className="nc-format-picks">
              {EMAIL_FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  className={`cat-flag${previewFormat === fmt.id ? " on" : ""}`}
                  onClick={() => previewNow(fmt.id)}
                  disabled={pending}
                >
                  {fmt.name}
                </button>
              ))}
            </div>
            <div className="nc-format-picks">
              <button
                type="button"
                className={`cat-flag${!mobile ? " on" : ""}`}
                onClick={() => setMobile(false)}
              >
                Desktop
              </button>
              <button
                type="button"
                className={`cat-flag${mobile ? " on" : ""}`}
                onClick={() => setMobile(true)}
              >
                Mobile
              </button>
            </div>
            <button type="button" className="cat-delete" onClick={() => setPreview(null)}>
              Close preview
            </button>
          </div>
          <iframe
            title="Newsletter preview"
            className="nc-preview-frame"
            style={mobile ? { maxWidth: 400 } : undefined}
            srcDoc={preview.html}
          />
        </div>
      )}
    </div>
  );
}

export default function TemplateManager({
  templates,
  counts,
}: {
  templates: LetterTemplate[];
  counts: Record<string, number>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<LetterTemplate | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string, active: boolean) =>
    startTransition(async () => {
      setError(null);
      const result = await setLetterTemplateActive({ id, active });
      if ("error" in result) setError(result.error);
    });

  // The id is minted on click, not during render.
  const makeNewTemplate = (): LetterTemplate => ({
    id: `nl-${Date.now().toString(36)}`,
    name: "New newsletter",
    description: "",
    cadence: "Weekly",
    schedule: { kind: "weekly", dayOfWeek: 1, time: "08:00", timeZone: "Asia/Kolkata" },
    topics: [],
    articleCount: 7,
    formats: ["daily_digest"],
    defaultFormat: "daily_digest",
    premium: false,
    active: false,
    onEmpty: "send-with-fallback",
    minArticles: MIN_STORIES,
  });

  return (
    <div className="cat-manager">
      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}
      <table className="subs-table">
        <thead>
          <tr>
            <th>Newsletter</th>
            <th>Schedule</th>
            <th>Tier</th>
            <th>Subscribers</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <Fragment key={t.id}>
              <tr>
                <td>
                  <span className="subs-name">{t.name}</span>
                  <br />
                  <small className="nc-reason">{t.description}</small>
                </td>
                <td>
                  {KIND_LABELS[t.schedule.kind] ?? t.schedule.kind}
                  {t.schedule.kind === "weekly" ? ` · ${DAY_NAMES[t.schedule.dayOfWeek ?? 0]}` : ""}
                  {" · "}
                  {t.schedule.time} {t.schedule.timeZone}
                </td>
                <td>{t.premium ? "Premium" : "Free"}</td>
                <td>{counts[t.id] ?? 0}</td>
                <td>
                  <label className="cms-switch">
                    <input
                      type="checkbox"
                      checked={t.active}
                      disabled={pending}
                      onChange={(e) => toggle(t.id, e.target.checked)}
                    />
                    <span className="switch" aria-hidden="true" />
                    <span>{t.active ? "Active" : "Inactive"}</span>
                  </label>
                </td>
                <td>
                  <button type="button" className="cat-edit" onClick={() => setEditing(editing === t.id ? null : t.id)}>
                    {editing === t.id ? "Close" : "Edit"}
                  </button>
                </td>
              </tr>
              {editing === t.id && (
                <tr key={`${t.id}-edit`}>
                  <td colSpan={6}>
                    <TemplateEditor template={t} onClose={() => setEditing(null)} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {draft ? (
        <div className="cat-group">
          <TemplateEditor template={draft} onClose={() => setDraft(null)} />
        </div>
      ) : (
        <button type="button" className="button outline cat-add" onClick={() => setDraft(makeNewTemplate())}>
          + New newsletter
        </button>
      )}
    </div>
  );
}
