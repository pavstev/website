import type { ReactElement, ReactNode } from "react";

import { Icon } from "@/components/icon";

export interface SelectMenuItem {
  label: string;
  value: string;
}

interface SelectMenuProps {
  className?: string;
  icon: ReactNode;
  id: string;
  items: readonly SelectMenuItem[];
  label: string;
  value: string;
}

export const SelectMenu = ({
  className = "",
  icon,
  id,
  items,
  label,
  value,
}: SelectMenuProps): ReactElement => {
  const current = items.find((item) => item.value === value) ?? items[0];
  return (
    <div
      className={`select-menu ${className}`}
      data-default={items[0]?.value}
      data-select-menu=""
      data-value={current?.value}
    >
      <button
        aria-controls={`${id}-panel`}
        aria-expanded="false"
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label ${id}-value`}
        className="select-menu-trigger focus-ring"
        id={id}
        popoverTarget={`${id}-panel`}
        type="button"
      >
        <span className="sr-only" id={`${id}-label`}>
          {label}
        </span>
        <span aria-hidden className="select-menu-icon">
          {icon}
        </span>
        <span className="select-menu-value" id={`${id}-value`}>
          {current?.label}
        </span>
        <Icon
          aria-hidden
          className="select-menu-chevron"
          name="lucide:chevron-down"
          size="0.875rem"
        />
        <span aria-hidden className="select-menu-dot" />
      </button>
      <div
        className="select-menu-panel mat-pop"
        data-anchored="always"
        data-placement="bottom-end"
        id={`${id}-panel`}
        popover="auto"
      >
        <span aria-hidden className="select-menu-glow" />
        <ul
          aria-label={label}
          className="select-menu-list"
          data-initial-focus=""
          role="listbox"
          tabIndex={-1}
        >
          {items.map((item) => (
            <li
              aria-selected={item.value === current?.value}
              className="select-menu-option"
              data-value={item.value}
              id={`${id}-option-${item.value}`}
              key={item.value}
              role="option"
            >
              <span className="select-menu-option-label">{item.label}</span>
              <Icon
                aria-hidden
                className="select-menu-check"
                name="lucide:check"
                size="0.875rem"
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
