import type { ReactElement, ReactNode } from "react";

import type { ContactTone } from "@/lib/contact-links";
import type { Blocker } from "@/lib/tip-place";

import { Icon } from "@/components/icon";
import { TipLabel } from "@/components/tip-label";
import { Tooltip } from "@/components/ui/tooltip";

interface ContactKeyProps {
  avoid?: () => Blocker[];
  children?: ReactNode;
  describedBy?: string | undefined;
  detail?: string;
  external: boolean;
  href: string;
  icon: string;
  label: string;
  linkClassName: string;
  reload?: boolean;
  tip?: ReactNode;
  tone: ContactTone;
  type?: string;
}

export const ContactKey = ({
  avoid,
  children,
  describedBy,
  detail,
  external,
  href,
  icon,
  label,
  linkClassName,
  reload = false,
  tip,
  tone,
  type,
}: ContactKeyProps): ReactElement => (
  <li className="contact-item" data-tone={tone}>
    <Tooltip
      {...(avoid ? { avoid } : {})}
      label={tip ?? <TipLabel detail={detail} name={label} />}
    >
      <a
        aria-describedby={describedBy}
        aria-label={label}
        className={`contact-link keycap-host focus-ring ${linkClassName}`}
        data-astro-reload={reload ? "" : undefined}
        href={href}
        rel={external ? "me noopener noreferrer" : undefined}
        target={external ? "_blank" : undefined}
        type={type}
      >
        <span className="keycap">
          <span aria-hidden="true" className="contact-icon">
            <Icon name={icon} size="0.9375rem" />
          </span>
        </span>
        {children}
      </a>
    </Tooltip>
  </li>
);
