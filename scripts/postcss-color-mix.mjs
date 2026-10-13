const guard = /^\(color:\s*color-mix\(in lab,\s*red,\s*red\)\)$/;

const declared = (rule) =>
  new Set(rule.nodes.filter((n) => n.type === "decl").map((n) => n.prop));

const dropFallback = (supports, target) => {
  const previous = supports.prev();
  if (previous?.type !== "rule" || previous.selector !== target.selector) {
    return;
  }
  const props = declared(target);
  previous.each((node) => {
    if (node.type === "decl" && props.has(node.prop)) {
      node.remove();
    }
  });
  if (previous.nodes.length === 0) {
    previous.remove();
  }
};

const plugin = () => ({
  OnceExit(root) {
    const found = [];
    root.walkAtRules("supports", (atRule) => {
      if (guard.test(atRule.params.trim())) {
        found.push(atRule);
      }
    });
    for (const atRule of found) {
      const [first] = atRule.nodes;
      if (atRule.nodes.length === 1 && first?.type === "rule") {
        dropFallback(atRule, first);
      }
      atRule.replaceWith(atRule.nodes);
    }
  },
  postcssPlugin: "modern-color-mix",
});

plugin.postcss = true;

export default plugin;
