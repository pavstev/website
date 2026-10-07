"use client";

import { type ReactElement, useEffect } from "react";

import { initCursorEffects } from "@/lib/cursor";

export const CursorGlow = (): ReactElement => {
  useEffect(() => initCursorEffects(), []);
  return <div aria-hidden="true" className="cursor-glow" data-cursor-glow="" />;
};
