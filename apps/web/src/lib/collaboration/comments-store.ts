export type CommentRecord = {
  id: string;
  threadId: string;
  runId?: string;
  controlId?: string;
  author: string;
  bodyMarkdown: string;
  createdAt: string;
  resolved?: boolean;
  mentions: string[];
};

const g = globalThis as unknown as { __scComments?: CommentRecord[] };

function list(): CommentRecord[] {
  if (!g.__scComments) {
    g.__scComments = [
      {
        id: "seed-1",
        threadId: "thread-1",
        controlId: "pg.rls.tables_without_rls",
        author: "Sam Okonkwo",
        bodyMarkdown:
          "Confirmed missing RLS on `public.documents`. Tracking as finding.",
        createdAt: new Date().toISOString(),
        mentions: ["@jordan"],
      },
    ];
  }
  return g.__scComments;
}

export function listComments(filter?: {
  controlId?: string;
  runId?: string;
}): CommentRecord[] {
  return list().filter((c) => {
    if (filter?.controlId && c.controlId !== filter.controlId) return false;
    if (filter?.runId && c.runId !== filter.runId) return false;
    return true;
  });
}

export function addComment(input: {
  author: string;
  bodyMarkdown: string;
  controlId?: string;
  runId?: string;
  threadId?: string;
}): CommentRecord {
  const mentions = [...input.bodyMarkdown.matchAll(/@([a-zA-Z0-9_-]+)/g)].map(
    (m) => `@${m[1]}`,
  );
  const rec: CommentRecord = {
    id: `c-${Date.now()}`,
    threadId: input.threadId ?? `thread-${Date.now()}`,
    runId: input.runId,
    controlId: input.controlId,
    author: input.author,
    bodyMarkdown: sanitiseMarkdown(input.bodyMarkdown),
    createdAt: new Date().toISOString(),
    mentions,
  };
  list().push(rec);
  return rec;
}

/** Strip raw HTML tags — comments never alter technical results. */
export function sanitiseMarkdown(input: string): string {
  return input.replace(/<[^>]*>/g, "").slice(0, 10_000);
}
