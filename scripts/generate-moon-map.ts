import { writeFileSync } from "node:fs";
import sharp from "sharp";

import { moonMap, moonMapPath, stackMap } from "./moon-map.ts";

const quality = Number(process.argv[2] ?? 85);

const bytes = await sharp(stackMap(moonMap()), {
  raw: { channels: 1, height: 512, width: 512 },
})
  .webp({ effort: 6, quality })
  .toBuffer();

writeFileSync(moonMapPath, bytes);
console.warn(
  `${moonMapPath}: ${String(bytes.length)} bytes at quality ${String(quality)}`
);
