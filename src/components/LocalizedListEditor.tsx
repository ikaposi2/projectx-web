export type LocalizedItem = { en: string; nl: string };

type Locale = "en" | "nl";

type Props = {
  title: string;
  items: LocalizedItem[];
  locale: Locale;
  onChange: (items: LocalizedItem[]) => void;
  addLabel: string;
  removeLabel: string;
  itemPlaceholder: string;
};

export function LocalizedListEditor({
  title,
  items,
  locale,
  onChange,
  addLabel,
  removeLabel,
  itemPlaceholder,
}: Props) {
  function updateAt(index: number, text: string) {
    onChange(
      items.map((item, i) => (i === index ? { ...item, [locale]: text } : item)),
    );
  }

  function removeAt(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, { en: "", nl: "" }]);
  }

  return (
    <fieldset className="localized-list">
      <legend>{title}</legend>
      <ul className="localized-list-items">
        {items.map((item, index) => (
          <li key={index}>
            <input
              type="text"
              value={item[locale]}
              placeholder={itemPlaceholder}
              onChange={(e) => updateAt(index, e.target.value)}
              aria-label={`${title} ${index + 1}`}
            />
            <button type="button" onClick={() => removeAt(index)} aria-label={removeLabel}>
              {removeLabel}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={addItem}>
        {addLabel}
      </button>
    </fieldset>
  );
}
