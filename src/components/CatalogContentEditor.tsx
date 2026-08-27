import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LocalizedListEditor, type LocalizedItem } from "./LocalizedListEditor";
import { MarkdownField } from "./MarkdownField";

export type CatalogContentState = {
  name_en: string;
  name_nl: string;
  description_en: string;
  description_nl: string;
  prerequisites: LocalizedItem[];
  deliverables: LocalizedItem[];
};

type Locale = "en" | "nl";

type Props = {
  value: CatalogContentState;
  onChange: (next: CatalogContentState) => void;
  token: string;
  catalogApi: string;
  onStatus?: (message: string | null) => void;
  onError?: (message: string | null) => void;
  showName?: boolean;
};

export function CatalogContentEditor({
  value,
  onChange,
  token,
  catalogApi,
  onStatus,
  onError,
  showName = true,
}: Props) {
  const { t } = useTranslation();
  const [locale, setLocale] = useState<Locale>("en");
  const [translating, setTranslating] = useState(false);

  const nameKey = locale === "en" ? "name_en" : "name_nl";
  const descKey = locale === "en" ? "description_en" : "description_nl";
  const other: Locale = locale === "en" ? "nl" : "en";

  async function translateToOther() {
    onError?.(null);
    onStatus?.(null);
    setTranslating(true);
    try {
      const res = await fetch(`${catalogApi}/services/translate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_locale: locale,
          target_locale: other,
          fields: {
            name: value[nameKey],
            description: value[descKey],
            prerequisites: value.prerequisites.map((p) => p[locale]),
            deliverables: value.deliverables.map((d) => d[locale]),
          },
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const code = typeof detail.detail === "string" ? detail.detail : res.statusText;
        if (code === "translation_unavailable") {
          throw new Error(t("catalog.translateUnavailable"));
        }
        throw new Error(code || t("catalog.translateFailed"));
      }
      const data = (await res.json()) as {
        fields: {
          name?: string;
          description?: string;
          prerequisites?: string[];
          deliverables?: string[];
        };
      };
      const fields = data.fields || {};
      const nextPrereq = value.prerequisites.map((item, i) => ({
        ...item,
        [other]: fields.prerequisites?.[i] ?? item[other],
      }));
      const nextDel = value.deliverables.map((item, i) => ({
        ...item,
        [other]: fields.deliverables?.[i] ?? item[other],
      }));
      onChange({
        ...value,
        [other === "en" ? "name_en" : "name_nl"]: fields.name ?? value[other === "en" ? "name_en" : "name_nl"],
        [other === "en" ? "description_en" : "description_nl"]:
          fields.description ?? value[other === "en" ? "description_en" : "description_nl"],
        prerequisites: nextPrereq,
        deliverables: nextDel,
      });
      setLocale(other);
      onStatus?.(t("catalog.translated"));
    } catch (err) {
      onError?.(err instanceof Error ? err.message : t("catalog.translateFailed"));
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className="catalog-content-block">
      <div className="locale-tabs" role="tablist" aria-label={t("catalog.locale")}>
        <button
          type="button"
          role="tab"
          className={locale === "en" ? "active" : undefined}
          aria-selected={locale === "en"}
          onClick={() => setLocale("en")}
        >
          EN
        </button>
        <button
          type="button"
          role="tab"
          className={locale === "nl" ? "active" : undefined}
          aria-selected={locale === "nl"}
          onClick={() => setLocale("nl")}
        >
          NL
        </button>
        <button type="button" disabled={translating} onClick={() => void translateToOther()}>
          {translating
            ? t("catalog.translating")
            : t("catalog.translateTo", { lang: other.toUpperCase() })}
        </button>
      </div>

      {showName ? (
        <>
          <label htmlFor={`cat-name-${locale}`}>{t("catalog.name")}</label>
          <input
            id={`cat-name-${locale}`}
            value={value[nameKey]}
            onChange={(e) => onChange({ ...value, [nameKey]: e.target.value })}
          />
        </>
      ) : null}

      <MarkdownField
        id={`cat-desc-${locale}`}
        label={t("catalog.description")}
        value={value[descKey]}
        onChange={(text) => onChange({ ...value, [descKey]: text })}
        writeLabel={t("catalog.mdWrite")}
        previewLabel={t("catalog.mdPreview")}
        splitLabel={t("catalog.mdSplit")}
        placeholder={t("catalog.descriptionHint")}
      />

      <LocalizedListEditor
        title={t("catalog.prerequisites")}
        items={value.prerequisites}
        locale={locale}
        onChange={(prerequisites) => onChange({ ...value, prerequisites })}
        addLabel={t("catalog.addItem")}
        removeLabel={t("catalog.removeItem")}
        itemPlaceholder={t("catalog.itemPlaceholder")}
      />

      <LocalizedListEditor
        title={t("catalog.deliverables")}
        items={value.deliverables}
        locale={locale}
        onChange={(deliverables) => onChange({ ...value, deliverables })}
        addLabel={t("catalog.addItem")}
        removeLabel={t("catalog.removeItem")}
        itemPlaceholder={t("catalog.itemPlaceholder")}
      />
    </div>
  );
}

export function emptyCatalogContent(): CatalogContentState {
  return {
    name_en: "",
    name_nl: "",
    description_en: "",
    description_nl: "",
    prerequisites: [],
    deliverables: [],
  };
}

export function contentFromDefinition(definition: Record<string, unknown> | undefined): CatalogContentState {
  const name = (definition?.name as Record<string, string> | undefined) || {};
  const description = (definition?.description as Record<string, string> | undefined) || {};
  const constraints = (definition?.constraints as { prerequisites?: LocalizedItem[] } | undefined) || {};
  const deliverables = (definition?.deliverables as LocalizedItem[] | undefined) || [];
  const prereqs = constraints.prerequisites || [];
  return {
    name_en: name.en || "",
    name_nl: name.nl || "",
    description_en: description.en || "",
    description_nl: description.nl || "",
    prerequisites: prereqs.map((p) => ({ en: p.en || "", nl: p.nl || "" })),
    deliverables: deliverables.map((d) => ({ en: d.en || "", nl: d.nl || "" })),
  };
}
