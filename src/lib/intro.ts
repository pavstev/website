import { stillQuery } from "@/lib/motion-pause";

const blurMs = 800;
const blurEasing = "cubic-bezier(0.16, 1, 0.3, 1)";
const lateStartMs = 1000;

export const initIntro = (card: HTMLElement): (() => void) => {
  if (stillQuery().matches) {
    return () => undefined;
  }

  const blurTargets =
    performance.now() > lateStartMs
      ? []
      : card.querySelectorAll<HTMLElement>("[data-blur-in]");

  const animations = [...blurTargets].map((element) => {
    const animation = element.animate(
      [
        { filter: "blur(8px)", opacity: 0 },
        { filter: "blur(0px)", opacity: 1 },
      ],
      { duration: blurMs, easing: blurEasing, fill: "both" }
    );
    animation.onfinish = () => animation.cancel();
    return animation;
  });

  return () => {
    for (const animation of animations) animation.cancel();
  };
};
