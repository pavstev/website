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

type CodeBlockProps = ComponentPropsWithoutRef<"pre"> & {
  tabindex?: number | string;
};

export const CodeBlock = ({
  children,
  tabindex,
  ...props
}: CodeBlockProps): ReactElement => (
  <div className="code-block mat-panel">
    <div className="code-head">
      <span className="code-lang">{languageOf(children)}</span>
      <span data-code-copy="" />
    </div>
    <div className="code-surface mat-well">
      <pre
        {...props}
        tabIndex={tabindex === undefined ? undefined : Number(tabindex)}
      >
        {children}
      </pre>
    </div>
  </div>
);
