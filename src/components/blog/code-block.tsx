import {
  Children,
  type ComponentPropsWithoutRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

const languagePrefix = "language-";

const languageOf = (children: ReactNode): string => {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ className?: string }>(child)) continue;
    const name = child.props.className
      ?.split(/\s+/u)
      .find((item) => item.startsWith(languagePrefix));
    if (name !== undefined) return name.slice(languagePrefix.length);
  }
  return "text";
};

export const CodeBlock = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"pre">): ReactElement => (
  <div className="code-block mat-panel">
    <div className="code-head">
      <span className="code-lang">{languageOf(children)}</span>
      <span data-code-copy="" />
    </div>
    <div className="code-surface mat-well">
      <pre {...props}>{children}</pre>
    </div>
  </div>
);
