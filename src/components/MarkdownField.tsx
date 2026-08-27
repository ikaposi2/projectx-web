import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Mode = "write" | "preview" | "split";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  writeLabel: string;
  previewLabel: string;
  splitLabel: string;
  placeholder?: string;
  rows?: number;
};

export function MarkdownField({
  id,
  label,
  value,
  onChange,
  writeLabel,
  previewLabel,
  splitLabel,
  placeholder,
  rows = 10,
}: Props) {
  const [mode, setMode] = useState<Mode>("split");

  return (
    <div className="md-field">
      <div className="md-field-header">
        <label htmlFor={id}>{label}</label>
        <div className="md-mode-tabs" role="tablist" aria-label={label}>
          {(
            [
              ["write", writeLabel],
              ["preview", previewLabel],
              ["split", splitLabel],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={mode === key ? "active" : undefined}
              onClick={() => setMode(key)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      <div className={`md-field-body md-mode-${mode}`}>
        {mode !== "preview" ? (
          <textarea
            id={id}
            className="md-editor"
            value={value}
            rows={rows}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            spellCheck
          />
        ) : null}
        {mode !== "write" ? (
          <div className="md-preview" aria-live="polite">
            {value.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <p className="muted">—</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
