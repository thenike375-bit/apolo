import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import type { UIMessage } from "ai";
import { ChatWindow } from "@/components/chat-window";
import { ThreadList } from "@/components/thread-list";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/chat/$threadId")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Chat with your teacher — PostFactum" },
      { name: "description", content: "Learn anything step by step with your AI teacher." },
      { property: "og:title", content: "Chat with your teacher — PostFactum" },
      { property: "og:description", content: "Learn anything step by step with your AI teacher." },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { t } = useI18n();
  const { threadId } = Route.useParams();
  const { q } = Route.useSearch();
  const thread = useQuery({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      const [{ data: th, error }, { data: rows, error: e2 }] = await Promise.all([
        supabase.from("threads").select("*").eq("id", threadId).maybeSingle(),
        supabase.from("messages").select("*").eq("thread_id", threadId).order("created_at"),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      const messages: UIMessage[] = (rows ?? []).map((r) => ({
        id: r.ui_id ?? r.id,
        role: r.role as UIMessage["role"],
        parts: r.parts as unknown as UIMessage["parts"],
      }));
      return { thread: th, messages };
    },
    staleTime: Infinity,
    gcTime: 0,
  });

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      <aside className="hidden w-72 shrink-0 border-r border-border md:block">
        <ThreadList activeId={threadId} className="h-full" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
          <Link to="/chat" className="rounded-lg p-1.5 hover:bg-muted" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
          <span className="truncate text-sm font-medium">{thread.data?.thread?.title}</span>
        </div>
        {thread.isPending ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">…</div>
        ) : thread.data?.thread ? (
          <ChatWindow key={threadId} threadId={threadId} initialMessages={thread.data.messages} initialPrompt={q} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <p role="alert">{thread.isError ? t.pageLoadError : "Conversation not found."}</p>
            {thread.isError && <Button variant="outline" onClick={() => void thread.refetch()}>{t.retry}</Button>}
          </div>
        )}
      </div>
    </div>
  );
}
