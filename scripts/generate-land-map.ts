import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

import {
  landMap,
  landMapHeight,
  landMapPath,
  landMapWidth,
} from "./land-map.ts";

const source =
  process.argv[2] ??
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson";
const quality = Number(process.argv[3] ?? 80);

const text = /^https?:\/\//.test(source)
  ? await (async () => {
      const response = await fetch(source);
      if (!response.ok)
        throw new Error(`${source}: ${String(response.status)}`);
      return response.text();
    })()
  : readFileSync(source, "utf8");

const bytes = await sharp(landMap(JSON.parse(text)), {
  raw: { channels: 1, height: landMapHeight, width: landMapWidth },
})
  .webp({ effort: 6, quality })
  .toBuffer();

writeFileSync(landMapPath, bytes);
console.warn(
  `${landMapPath}: ${String(bytes.length)} bytes at quality ${String(quality)}`
);
