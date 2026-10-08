import { en } from "./i18n.ts";
import { productPalette } from "./theme.ts";

export interface Product {
  applicationCategory: string;
  key: ProductKey;
  line: string;
  name: string;
  palette: (typeof productPalette)[ProductKey];
  period: string;
  role: string;
  schemaType: "SoftwareApplication" | "WebApplication";
  url: string;
}

export type ProductKey = keyof typeof productPalette;

const entry = (
  key: ProductKey,
  name: string,
  schemaType: Product["schemaType"],
  url: string
): Product => ({
  applicationCategory: "BusinessApplication",
  key,
  name,
  palette: productPalette[key],
  schemaType,
  url,
  ...en.products.items[key],
});

export const products: readonly Product[] = [
  entry("hirista", "hirista", "WebApplication", "https://hirista.app"),
  entry(
    "safety-real-time",
    "Safety Real Time",
    "SoftwareApplication",
    "https://safetyrealtime.com"
  ),
];

export const productMeta = (product: Product): string =>
  `${product.role} · ${product.period}`;

export const productLlmsLines = (items: readonly Product[]): string[] =>
  items.map(
    (item) =>
      `- [${item.name}](${item.url}): ${productMeta(item)}. ${item.line}`
  );

const bareHost = (url: string): string | undefined =>
  URL.parse(url)?.hostname.replace(/^www\./, "");

export const isProductUrl = (url: string): boolean => {
  const host = bareHost(url);
  return (
    host !== undefined &&
    products.some((product) => bareHost(product.url) === host)
  );
};
