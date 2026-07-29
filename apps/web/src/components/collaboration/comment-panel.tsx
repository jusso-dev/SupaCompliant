"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Comment = {
  id: string;
  author: string;
  bodyMarkdown: string;
  createdAt: string;
  mentions: string[];
  controlId?: string;
};

export function CommentPanel({ controlId }: { controlId?: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("Alex Chen");
  const [busy, setBusy] = useState(false);

  async function load() {
    const q = controlId ? `?controlId=${encodeURIComponent(controlId)}` : "";
    const res = await fetch(`/api/comments${q}`);
    const data = await res.json();
    setComments(data.comments ?? []);
  }

  useEffect(() => {
    void load();
  }, [controlId]);

  async function submit() {
    setBusy(true);
    try {
      await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, bodyMarkdown: body, controlId }),
      });
      setBody("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="rounded-md border border-border p-3 text-sm">
            <p className="font-medium">
              {c.author}{" "}
              <span className="font-normal text-muted-foreground">
                · {new Date(c.createdAt).toLocaleString()}
              </span>
            </p>
            <p className="mt-1 whitespace-pre-wrap">{c.bodyMarkdown}</p>
            {c.mentions.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Mentions: {c.mentions.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <input
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          aria-label="Author"
        />
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Discuss this control… use @mentions"
          aria-label="Comment body"
        />
        <Button type="button" onClick={submit} disabled={busy || !body.trim()}>
          {busy ? "Posting…" : "Post comment"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Comments never alter immutable technical results.
        </p>
      </div>
    </div>
  );
}
