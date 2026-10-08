"use client";

import {
  type KeyboardEvent,
  type ReactElement,
  type SubmitEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Icon } from "@/components/icon";
import {
  askBlock,
  askEndpoint,
  type AskErrorKey,
  askErrorKey,
  askMaxChars,
  askPanelId,
  askSiteKey,
  readAnswerStream,
  readErrorCode,
  turnstileScript,
} from "@/lib/ask";
import { en } from "@/lib/i18n";

interface TurnstileApi {
  remove: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: TurnstileOptions
  ) => string | undefined;
  reset: (widgetId: string) => void;
}

interface TurnstileOptions {
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  sitekey: string;
  size: "compact" | "flexible";
  theme: "dark";
}

declare global {
  var turnstile: TurnstileApi | undefined;
}

const narrowQuery = "(max-width: 22rem)";

let turnstileLoad: Promise<TurnstileApi> | undefined;

const injectTurnstile = (): Promise<TurnstileApi> =>
  new Promise<TurnstileApi>((resolve, reject) => {
    const ready = globalThis.turnstile;
    if (ready) {
      resolve(ready);
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.src = `${turnstileScript}?render=explicit`;
    script.addEventListener(
      "load",
      () => {
        const api = globalThis.turnstile;
        if (api) resolve(api);
        else reject(new Error("Turnstile did not start"));
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => {
        script.remove();
        reject(new Error("Turnstile did not load"));
      },
      { once: true }
    );
    document.head.append(script);
  });

const loadTurnstile = async (): Promise<TurnstileApi> => {
  turnstileLoad ??= injectTurnstile();
  try {
    return await turnstileLoad;
  } catch (error) {
    turnstileLoad = undefined;
    throw error;
  }
};

export const AskPanel = (): ReactElement => {
  const titleId = useId();
  const inputId = useId();
  const blockId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const requested = useRef(false);
  const request = useRef<AbortController | null>(null);
  const [question, setQuestion] = useState("");
  const [token, setToken] = useState<null | string>(null);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<AskErrorKey | null>(null);
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    let disposed = false;
    const mountWidget = async (): Promise<void> => {
      try {
        const api = await loadTurnstile();
        const target = mount.current;
        if (disposed || !target) return;
        widget.current = api.render(target, {
          callback: (value) => {
            setToken(value);
          },
          "error-callback": () => {
            setToken(null);
            setError("bot");
          },
          "expired-callback": () => {
            setToken(null);
          },
          sitekey: askSiteKey,
          size: globalThis.matchMedia(narrowQuery).matches
            ? "compact"
            : "flexible",
          theme: "dark",
        });
      } catch {
        requested.current = false;
        if (!disposed) setError("bot");
      }
    };
    const onToggle = (event: Event): void => {
      if ((event as ToggleEvent).newState !== "open") return;
      input.current?.focus({ preventScroll: true });
      if (requested.current) return;
      requested.current = true;
      void mountWidget();
    };
    element.addEventListener("toggle", onToggle);
    return () => {
      disposed = true;
      element.removeEventListener("toggle", onToggle);
      request.current?.abort();
      if (widget.current !== undefined) {
        globalThis.turnstile?.remove(widget.current);
        widget.current = undefined;
      }
      requested.current = false;
    };
  }, []);

  const block = askBlock({ busy, hasToken: token !== null, question });
  const hint = refused && block !== null ? en.ask[block] : null;

  const ask = async (): Promise<void> => {
    if (busy) return;
    if (block !== null) {
      setRefused(true);
      return;
    }
    const text = question.trim();
    request.current?.abort();
    const current = new AbortController();
    request.current = current;
    setBusy(true);
    setRefused(false);
    setError(null);
    setAnswer("");
    let received = false;
    try {
      const response = await fetch(askEndpoint, {
        body: JSON.stringify({ question: text, turnstileToken: token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: current.signal,
      });
      if (!response.ok || !response.body) {
        setError(askErrorKey(response.status, await readErrorCode(response)));
        return;
      }
      await readAnswerStream(response.body, (chunk) => {
        received = true;
        setAnswer((previous) => previous + chunk);
      });
      if (!received) setError("failed");
    } catch {
      if (!current.signal.aborted) setError("failed");
    } finally {
      if (request.current === current) {
        setBusy(false);
        setToken(null);
        if (widget.current !== undefined) {
          globalThis.turnstile?.reset(widget.current);
        }
      }
    }
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void ask();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <div
      aria-labelledby={titleId}
      className="topic-panel ask-panel"
      data-anchored=""
      id={askPanelId}
      popover="auto"
      ref={panel}
      role="dialog"
    >
      <header className="topic-head">
        <h2 className="topic-title" id={titleId}>
          {en.ask.title}
        </h2>
        <button
          aria-label={en.ask.close}
          className="topic-close focus-ring"
          popoverTarget={askPanelId}
          popoverTargetAction="hide"
          type="button"
        >
          <Icon aria-hidden name="lucide:x" size="0.875rem" />
        </button>
      </header>
      <form className="ask-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor={inputId}>
          {en.ask.label}
        </label>
        <textarea
          className="ask-input focus-ring"
          enterKeyHint="send"
          id={inputId}
          maxLength={askMaxChars}
          name="question"
          onChange={(event) => {
            setQuestion(event.target.value);
            setError(null);
            setRefused(false);
          }}
          onKeyDown={onKeyDown}
          placeholder={en.ask.placeholder}
          ref={input}
          rows={3}
          value={question}
        />
        <div className="ask-check" ref={mount} />
        <button
          aria-describedby={block === null ? undefined : blockId}
          aria-disabled={busy || block !== null}
          className="ask-send focus-ring"
          type="submit"
        >
          {en.ask.send}
        </button>
        {block === null ? null : (
          <span className="sr-only" id={blockId}>
            {en.ask[block]}
          </span>
        )}
      </form>
      <div aria-busy={busy} aria-live="polite" className="ask-answer">
        {error ? <p className="ask-error">{en.ask.errors[error]}</p> : null}
        {!error && busy && answer === "" ? (
          <p className="ask-status">{en.ask.thinking}</p>
        ) : null}
        {hint === null ? null : <p className="ask-status">{hint}</p>}
        {answer === "" ? null : <p className="topic-text ask-text">{answer}</p>}
      </div>
      <p className="ask-note">{en.ask.note}</p>
    </div>
  );
};
