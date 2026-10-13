"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { backLink } from "@/lib/blog/back-link";
import { en } from "@/lib/i18n";

interface BackButtonProps {
  children: ReactNode;
}

export const BackButton = ({ children }: BackButtonProps): ReactElement => {
  const { href, label, prefetch } = backLink(usePathname());
  const [dismissed, setDismissed] = useState(false);
  const itemRef = useRef<HTMLElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      if (
        itemRef.current?.matches(":hover") ||
        linkRef.current?.matches(":focus-visible")
      ) {
        setDismissed(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <nav
      aria-label={en.blog.backNav}
      className="back-item"
      data-dismissed={dismissed ? "" : undefined}
      onPointerLeave={() => {
        setDismissed(false);
      }}
      ref={itemRef}
    >
      <Link
        aria-labelledby="back-tip"
        className="back-button"
        href={href}
        onBlur={() => {
          setDismissed(false);
        }}
        prefetch={prefetch}
        ref={linkRef}
      >
        <span aria-hidden="true" className="back-ring fade-up delay-4">
          {children}
        </span>
      </Link>
      <span className="contact-tip back-tip" id="back-tip" role="tooltip">
        {label}
      </span>
    </nav>
  );
};
