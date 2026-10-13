import type { ReactElement } from "react";

import { DiagramBox } from "@/components/blog/diagrams/diagram-box";
import { skillMap } from "@/lib/blog/diagrams";

export const SkillMap = (): ReactElement => {
  const flow = skillMap.length - 1;
  return (
    <DiagramBox name="skill-map">
      <ul className="text-sm">
        {skillMap.map((group, index) => {
          const alone = index >= flow;
          return (
            <li
              className={`relative flex flex-wrap items-start gap-x-3 gap-y-1 pb-3 ${alone ? "mt-3" : ""}`}
              key={group.phase}
            >
              {index < flow - 1 ? (
                <span
                  className="absolute top-4 -bottom-4 left-1.5 w-px -translate-x-1/2 bg-(--muted-foreground)"
                  data-fc="spine"
                />
              ) : undefined}
              <span
                className={`relative mt-2.5 size-3 shrink-0 rounded-full border-[1.5px] ${alone ? "border-dashed border-(--muted-foreground) bg-(--background)" : "border-(--primary) bg-(--primary)"}`}
                data-fc={alone ? "ring" : "node"}
              />
              <span className="flex min-w-[min(4rem,100%)] flex-1 flex-wrap gap-x-3 gap-y-1">
                <span
                  className="max-w-full min-w-[min(6rem,100%)] shrink-0 pt-1 font-semibold wrap-anywhere text-(--foreground)"
                  data-fc="text"
                >
                  {group.phase}
                </span>
                <span className="flex min-w-[min(8rem,100%)] flex-1 flex-wrap gap-2">
                  {group.skills.map((skill) => (
                    <span
                      className="max-w-full rounded-full border border-(--muted-foreground) px-2.5 py-0.5 font-mono text-xs/5 wrap-anywhere text-(--foreground-soft)"
                      data-fc="pill"
                      key={skill}
                    >
                      {skill}
                    </span>
                  ))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </DiagramBox>
  );
};
