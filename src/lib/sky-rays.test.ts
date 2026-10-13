import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cornerCorona, longRaysShader, patchShader } from "./sky-rays.ts";
import { skyFragmentShader } from "./sky-shader.ts";

describe("longRaysShader", () => {
  it("swaps in the LinkedIn cover rays", () => {
    assert.match(longRaysShader, /const float coronaSize = 1\.60;/);
    assert.match(longRaysShader, /const float coronaBright = 1\.30;/);
    assert.doesNotMatch(longRaysShader, /coronaSize = 0\.48;/);
  });

  it("leaves the home sky shader as tuned", () => {
    assert.match(skyFragmentShader, /const float coronaSize = 0\.48;/);
    assert.match(skyFragmentShader, /const float coronaBright = 1\.06;/);
  });

  it("changes nothing but the two ray lines", () => {
    const back = longRaysShader
      .replace("coronaSize = 1.60;", "coronaSize = 0.48;")
      .replace("coronaBright = 1.30;", "coronaBright = 1.06;");
    assert.equal(back, skyFragmentShader);
  });
});

describe("patchShader", () => {
  it("fails when a line is gone", () => {
    assert.throws(
      () => patchShader("void main() {}", [["const float x = 1.0;", "y"]]),
      /no longer holds: const float x = 1\.0;/
    );
  });

  it("inserts the replacement as plain text", () => {
    assert.equal(patchShader("a b", [["b", "$&$&"]]), "a $&$&");
  });
});

describe("cornerCorona", () => {
  it("centers the source off canvas at the top-left corner", () => {
    assert.deepEqual(cornerCorona(396), { radius: 170, x: -170, y: -170 });
  });

  it("scales with the header height", () => {
    assert.deepEqual(cornerCorona(486), { radius: 209, x: -209, y: -209 });
  });
});
