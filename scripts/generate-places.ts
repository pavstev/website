import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

import { encodePlaces, parseGeoNames, placesPath } from "./places-data.ts";

const source = "https://download.geonames.org/export/dump/cities15000.zip";

const textFromZip = (zip: Buffer): string => {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const directory = zip.readUInt32LE(end + 16);
  const method = zip.readUInt16LE(directory + 10);
  const packed = zip.readUInt32LE(directory + 20);
  const header = zip.readUInt32LE(directory + 42);
  const start =
    header + 30 + zip.readUInt16LE(header + 26) + zip.readUInt16LE(header + 28);
  const body = zip.subarray(start, start + packed);
  return (method === 0 ? body : inflateRawSync(body)).toString("utf8");
};

const download = async (): Promise<string> => {
  const response = await fetch(source);
  if (!response.ok) throw new Error(String(response.status));
  return textFromZip(Buffer.from(await response.arrayBuffer()));
};

const input = process.argv[2];
const text = input ? readFileSync(input, "utf8") : await download();

const cities = parseGeoNames(text);
const encoded = encodePlaces(cities);
writeFileSync(placesPath, encoded);
console.warn(
  `${placesPath}: ${String(cities.length)} places read, ${String(encoded.length)} bytes`
);
