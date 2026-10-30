/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Markdown, type MarkdownComponents } from "@tanstack/markdown/react";
import React, { memo } from "react";
import { CopyButton } from "./CopyButton";

/** Plain text of a rendered subtree (for the code-block copy button). */
function nodeText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  const props = (node as { props?: { children?: unknown } }).props;
  return props ? nodeText(props.children) : "";
}

const components = {
  a(props) {
    const href = props.href ?? "";
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        {...props}
        className="text-m3-primary underline underline-offset-2 decoration-m3-primary/40 hover:decoration-m3-primary break-words"
        rel={external ? "nofollow noopener noreferrer" : props.rel}
        target={external ? "_blank" : props.target}
      />
    );
  },
  p(props) {
    return <p {...props} className="my-1.5 leading-relaxed text-[13px]" />;
  },
  h1(props) {
    return (
      <h1
        {...props}
        className="mt-2 mb-1 text-[15px] font-semibold leading-snug text-m3-text"
      />
    );
  },
  h2(props) {
    return (
      <h2
        {...props}
        className="mt-2 mb-1 text-[14px] font-semibold leading-snug text-m3-text"
      />
    );
  },
  h3(props) {
    return (
      <h3
        {...props}
        className="mt-1.5 mb-0.5 text-[13px] font-semibold text-m3-text"
      />
    );
  },
  ul(props) {
    return (
      <ul
        {...props}
        className="my-1.5 list-disc pl-4 space-y-0.5 text-[13px]"
      />
    );
  },
  ol(props) {
    return (
      <ol
        {...props}
        className="my-1.5 list-decimal pl-4 space-y-0.5 text-[13px]"
      />
    );
  },
  li(props) {
    return <li {...props} className="leading-relaxed" />;
  },
  blockquote(props) {
    return (
      <blockquote
        {...props}
        className="my-2 border-l-2 border-m3-primary/40 pl-2.5 text-m3-secondary italic"
      />
    );
  },
  hr() {
    return <hr className="my-2.5 border-0 border-t border-m3-border" />;
  },
  strong(props) {
    return <strong {...props} className="font-semibold text-m3-text" />;
  },
  em(props) {
    return <em {...props} className="italic" />;
  },
  code(props) {
    const { className, children, ...rest } = props;
    const isBlock =
      typeof className === "string" && /language-/.test(className);
    if (isBlock) {
      return (
        <code
          {...rest}
          className={`${className ?? ""} block text-[11px] font-mono leading-snug`}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        {...rest}
        className="rounded px-1 py-0.5 text-[11px] font-mono bg-m3-card text-m3-text border border-m3-border/70"
      >
        {children}
      </code>
    );
  },
  pre(props) {
    const { children, ...rest } = props;
    return (
      <div className="group/code relative my-2">
        <pre
          {...rest}
          className="max-h-60 overflow-auto rounded-[var(--radius-md)] border border-m3-border bg-m3-card px-2.5 py-2 pr-9 text-[11px] font-mono leading-snug"
        >
          {children}
        </pre>
        <CopyButton
          text={() => nodeText(children).replace(/\n$/, "")}
          className="absolute top-1.5 right-1.5 p-1 bg-m3-card/90 border border-m3-border/70 opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100 transition-opacity"
        />
      </div>
    );
  },
  table(props) {
    return (
      <div className="my-2 w-full overflow-x-auto rounded-[var(--radius-md)] border border-m3-border">
        <table
          {...props}
          className="w-full border-collapse text-left text-[12px]"
        />
      </div>
    );
  },
  thead(props) {
    return <thead {...props} className="bg-m3-card/80" />;
  },
  tbody(props) {
    return <tbody {...props} className="divide-y divide-m3-border/70" />;
  },
  tr(props) {
    return (
      <tr {...props} className="border-b border-m3-border/70 last:border-0" />
    );
  },
  th(props) {
    return (
      <th
        {...props}
        className="px-2.5 py-1.5 font-semibold text-m3-text whitespace-nowrap border-b border-m3-border bg-m3-card/90"
      />
    );
  },
  td(props) {
    return (
      <td
        {...props}
        className="px-2.5 py-1.5 align-top text-m3-text/95 whitespace-nowrap"
      />
    );
  },
} satisfies MarkdownComponents;

/** Studio chat markdown with explicit table/list/code styles (no typography plugin). */
export const AiChatMarkdown = memo(function AiChatMarkdown({
  children,
}: {
  children: string;
}) {
  return <Markdown components={components}>{children}</Markdown>;
});
