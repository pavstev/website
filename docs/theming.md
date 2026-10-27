# How theming works

- Every CSS color lives in `src/styles/tokens.css`. `globals.css` imports it first, and `card.css` and `blog.css` get it through `globals.css`. The page sheets (`post.css`, `prose.css`, `work.css`, `sky-panel.css`) only read tokens.
- The file has three kinds of tokens. Primitives hold the raw values (`--night-950`, `--cool-400`, `--day-950`). Semantic tokens name a job (`--background`, `--primary`, `--focus`). UI tokens style the controls (`--ui-*`, `--glass-*`, `--bar-*`).
- Other style sheets read tokens only. They never write a hex, `rgb()`, `oklch()`, `white` or `black`.
- There is one focus color, `--focus`: white at night and `--day-950` by day, on every page.
- Night lift: on every control a few `--ui-*` tokens are a little lighter.
- Day mode: when the home sky ink is dark (`:root:has([data-card] .bio[data-ink="dark"])`), one block on `:root` and one on the controls set the day values.
- Bright sky mode: at dawn and dusk the ink can stay light on a bright sky. The sky sets `data-lit` on the bio when its ink is light and its `--lift` is at least `litLift` (0.15, `sky-ink.ts`). Then the control fill turns 66% `--glass-solid`. A pill inside dark-ink text keeps the day fill.
- The night lift and the day mode use one control list (`:is(...)`). Add a new control to both lists or to none.
- A `var()` token resolves where it is declared. So when a mode changes a primitive, it also sets each token that reads it.
- The fallbacks (no backdrop filter, reduced transparency) and the print colors are also in `tokens.css`.
- JS colors live in `src/lib/theme.ts` (ink, dither, product and PDF colors). The painted sky palettes live in `src/lib/sky-palette.ts`.
- Some `theme.ts` values copy a CSS token, because the sky ink math and the dither need them in JS. `theme.test.ts` checks that each copy equals its token.
- `theme.test.ts` also checks that both control lists are equal. It fails on a color literal in any other style sheet or source file (`icon-data.ts` excepted).
- To change a color, change the primitive in `tokens.css`. Then change its copy in `theme.ts` if it has one.
