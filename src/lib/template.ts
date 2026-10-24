export const fillCount = (template: string, count: number): string =>
  template.replace("{count}", () => String(count));

export const fillText = (
  template: string,
  values: Readonly<Record<string, string>>
): string =>
  template.replaceAll(
    /\{(\w+)\}/g,
    (match, name: string) => values[name] ?? match
  );

const plural = new Intl.PluralRules("en");

export const pluralForm = <T>(count: number, one: T, other: T): T =>
  plural.select(count) === "one" ? one : other;

export const countHeading = (
  count: number,
  forms: { headingOne: string; headingOther: string }
): string =>
  fillCount(pluralForm(count, forms.headingOne, forms.headingOther), count);
