import { en } from "./i18n.ts";
import { productPalette } from "./theme.ts";

export interface Product {
  applicationCategory: string;
  key: ProductKey;
  line: string;
  name: string;
  operatingSystem: string;
  palette: (typeof productPalette)[ProductKey];
  period: string;
  platform: string;
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
  operatingSystem: "Web",
  palette: productPalette[key],
  schemaType,
  url,
  ...en.products.items[key],
});

export const products: readonly Product[] = [
  entry(
    "safety-real-time",
    "Safety Real Time",
    "WebApplication",
    "https://safetyrealtime.com"
  ),
];

export const productMetaParts = (
  product: Product
): readonly [string, string] => [`${product.role} ·`, product.period];

export const productMeta = (product: Product): string =>
  productMetaParts(product).join(" ");

export const productLlmsLines = (items: readonly Product[]): string[] =>
  items.map(
    (item) =>
      `- [${item.name}](${item.url}): ${productMeta(item)}. ${item.line}`
  );

const bareHost = (url: string): string | undefined =>
  URL.parse(url)?.hostname.replace(/^www\./, "");

export const productHost = (product: Product): string =>
  bareHost(product.url) ?? product.url;

export const isProductUrl = (url: string): boolean => {
  const host = bareHost(url);
  return (
    host !== undefined &&
    products.some((product) => bareHost(product.url) === host)
  );
};
