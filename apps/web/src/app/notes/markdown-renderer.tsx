"use client";

import { Check, Copy } from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type MarkdownRendererProps = {
  content: string;
  className?: string;
  onToggleTask?: (lineIndex: number, checked: boolean) => void;
  fontClass?: string;
  dir?: "auto" | "rtl" | "ltr";
  placeholder?: string;
};

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ol"; items: string[]; isPersian?: boolean }
  | { type: "ul"; items: string[] }
  | { type: "checklist"; items: { text: string; checked: boolean; lineIndex: number }[] }
  | { type: "quote"; text: string }
  | { type: "codeblock"; lang?: string; code: string }
  | { type: "hr" };

type CopyState = "idle" | "copied" | "error";

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const previousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) throw new Error("Copy command was rejected");
  } finally {
    textarea.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageLabel = lang?.trim() || "Code";
  const buttonLabel =
    copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy";

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  const stopCardKeyboardAction = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    try {
      await copyText(code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => setCopyState("idle"), 2000);
  };

  return (
    <div className="note-code-block" dir="ltr" onClick={(event) => event.stopPropagation()}>
      <div className="note-code-toolbar">
        <span className="note-code-language">{languageLabel}</span>
        <button
          type="button"
          className={`note-code-copy ${copyState === "copied" ? "note-code-copy--copied" : ""}`}
          onClick={(event) => void handleCopy(event)}
          onKeyDown={stopCardKeyboardAction}
          aria-label={`${buttonLabel}: ${languageLabel} code`}
          title={`${buttonLabel} code`}
        >
          {copyState === "copied" ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
          <span aria-live="polite">{buttonLabel}</span>
        </button>
      </div>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function formatInline(text: string): ReactNode[] {
  // Replace bold **text** or __text__
  // Replace italic *text* or _text_
  // Replace strikethrough ~~text~~
  // Replace inline code `code`
  const tokens: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch && codeMatch[1]) {
      tokens.push(<code key={key++}>{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
    if (boldMatch && boldMatch[2]) {
      tokens.push(<strong key={key++}>{boldMatch[2]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Strikethrough
    const strikeMatch = remaining.match(/^~~(.*?)~~/);
    if (strikeMatch && strikeMatch[1]) {
      tokens.push(<s key={key++}>{strikeMatch[1]}</s>);
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^(\*|_)(.*?)\1/);
    if (italicMatch && italicMatch[2]) {
      tokens.push(<em key={key++}>{italicMatch[2]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Markdown Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+|[^\s)]+)\)/);
    if (linkMatch && linkMatch[1] && linkMatch[2]) {
      const href =
        linkMatch[2].startsWith("http://") || linkMatch[2].startsWith("https://")
          ? linkMatch[2]
          : `https://${linkMatch[2]}`;
      tokens.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="note-inline-link"
          onClick={(e) => e.stopPropagation()}
        >
          {linkMatch[1]}
        </a>,
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Regular character/word
    const nextSpecial = remaining.search(/[`*_~[]/);
    if (nextSpecial === -1) {
      tokens.push(remaining);
      break;
    } else if (nextSpecial > 0) {
      tokens.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    } else {
      tokens.push(remaining[0]!);
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

export function MarkdownRenderer({
  content,
  className = "",
  onToggleTask,
  fontClass = "",
  dir = "auto",
  placeholder,
}: MarkdownRendererProps) {
  const blocks = useMemo(() => {
    const rawLines = content.split(/\r?\n/);
    const result: Block[] = [];

    let inCodeBlock = false;
    let codeLang = "";
    let codeLines: string[] = [];

    let currentList: { type: "ol" | "ul"; items: string[]; isPersian?: boolean } | null = null;
    let currentChecklist: { text: string; checked: boolean; lineIndex: number }[] | null = null;

    const flushList = () => {
      if (currentList) {
        result.push(currentList);
        currentList = null;
      }
      if (currentChecklist) {
        result.push({ type: "checklist", items: currentChecklist });
        currentChecklist = null;
      }
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i]!;
      const trimmed = line.trim();

      // Code block toggle
      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          result.push({ type: "codeblock", lang: codeLang, code: codeLines.join("\n") });
          inCodeBlock = false;
          codeLang = "";
          codeLines = [];
        } else {
          flushList();
          inCodeBlock = true;
          codeLang = trimmed.slice(3).trim();
          codeLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      if (!trimmed) {
        flushList();
        continue;
      }

      // Horizontal rule
      if (/^([-*_]){3,}$/.test(trimmed)) {
        flushList();
        result.push({ type: "hr" });
        continue;
      }

      // Headings
      if (trimmed.startsWith("### ")) {
        flushList();
        result.push({ type: "h3", text: trimmed.slice(4).trim() });
        continue;
      }
      if (trimmed.startsWith("## ")) {
        flushList();
        result.push({ type: "h2", text: trimmed.slice(3).trim() });
        continue;
      }
      if (trimmed.startsWith("# ")) {
        flushList();
        result.push({ type: "h1", text: trimmed.slice(2).trim() });
        continue;
      }

      // Blockquote
      if (trimmed.startsWith("> ")) {
        flushList();
        result.push({ type: "quote", text: trimmed.slice(2).trim() });
        continue;
      }

      // Checklist: - [ ] or - [x] or * [ ]
      const checkMatch = line.match(/^\s*[-*]\s*\[([ xX])\]\s*(.*)$/);
      if (checkMatch && checkMatch[2] !== undefined) {
        if (currentList) flushList();
        if (!currentChecklist) currentChecklist = [];
        currentChecklist.push({
          checked: checkMatch[1]?.toLowerCase() === "x",
          text: checkMatch[2],
          lineIndex: i,
        });
        continue;
      }

      // Numbered list: 1. or ۱. (supports Persian & English numbers)
      const numMatch = line.match(/^\s*([0-9]+|[۰-۹]+)\.\s+(.*)$/);
      if (numMatch && numMatch[2]) {
        const isPersian = /[۰-۹]/.test(numMatch[1] ?? "");
        if (currentChecklist) flushList();
        if (currentList && (currentList.type !== "ol" || currentList.isPersian !== isPersian)) {
          flushList();
        }
        if (!currentList) currentList = { type: "ol", items: [], isPersian };
        currentList.items.push(numMatch[2]);
        continue;
      }

      // Bullet list: - or *
      const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
      if (bulletMatch && bulletMatch[1]) {
        if (currentChecklist) flushList();
        if (currentList && currentList.type !== "ul") flushList();
        if (!currentList) currentList = { type: "ul", items: [] };
        currentList.items.push(bulletMatch[1]);
        continue;
      }

      // Paragraph
      flushList();
      result.push({ type: "p", text: line });
    }

    if (inCodeBlock) {
      result.push({ type: "codeblock", lang: codeLang, code: codeLines.join("\n") });
    }
    flushList();

    return result;
  }, [content]);

  if (!content.trim()) {
    return <em className="text-muted">{placeholder || "Empty note"}</em>;
  }

  return (
    <div className={`note-markdown ${fontClass} ${className}`} dir={dir}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "h1":
            return (
              <h1 key={idx} dir={dir}>
                {formatInline(block.text)}
              </h1>
            );
          case "h2":
            return (
              <h2 key={idx} dir={dir}>
                {formatInline(block.text)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={idx} dir={dir}>
                {formatInline(block.text)}
              </h3>
            );
          case "ol":
            return (
              <ol
                key={idx}
                dir={block.isPersian ? "rtl" : dir}
                className={block.isPersian ? "ol-persian-digits font-shabnam" : "ol-english-digits"}
                style={{
                  listStyleType: block.isPersian ? "persian" : "decimal",
                }}
              >
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{formatInline(item)}</li>
                ))}
              </ol>
            );
          case "ul":
            return (
              <ul key={idx} dir={dir}>
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{formatInline(item)}</li>
                ))}
              </ul>
            );
          case "checklist":
            return (
              <div key={idx} className="checklist-group" dir={dir}>
                {block.items.map((item, itemIdx) => (
                  <label
                    key={itemIdx}
                    className={`checklist-item ${item.checked ? "checklist-item--checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => onToggleTask?.(item.lineIndex, e.target.checked)}
                      disabled={!onToggleTask}
                    />
                    <span>{formatInline(item.text)}</span>
                  </label>
                ))}
              </div>
            );
          case "quote":
            return (
              <blockquote key={idx} dir={dir}>
                {formatInline(block.text)}
              </blockquote>
            );
          case "codeblock":
            return <CodeBlock key={idx} code={block.code} lang={block.lang} />;
          case "hr":
            return <hr key={idx} />;
          case "p":
          default:
            return (
              <p key={idx} dir={dir}>
                {formatInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
