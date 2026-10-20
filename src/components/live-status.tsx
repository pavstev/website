import { type ReactElement, useEffect, useState } from "react";

interface LiveStatusProps {
  text: string;
}

const announceDelayMs = 300;

export const LiveStatus = ({ text }: LiveStatusProps): ReactElement => {
  const [said, setSaid] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSaid(text);
    }, announceDelayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [text]);

  return (
    <p className="sr-only" role="status">
      {said}
    </p>
  );
};
