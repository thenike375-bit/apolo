import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { createThread, threadsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function ThreadList({ activeId, className }: { activeId?: string; className?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: threads } = useQuery(threadsQuery());

  async function add() {
    const id = await createThread(t.newChatTitle);
    await qc.invalidateQueries({ queryKey: ["threads"] });
    navigate({ to: "/chat/$threadId", params: { threadId: id } });
  }
  async function remove(id: string) {
    await supabase.from("threads").delete().eq("id", id);
    await qc.invalidateQueries({ queryKey: ["threads"] });
    if (id === activeId) navigate({ to: "/chat" });
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between px-3 py-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t.chats}</h2>
        <Button size="sm" variant="secondary" className="rounded-full" onClick={add}>
          <Plus className="size-4" /> {t.newChat}
        </Button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {(threads ?? []).map((th) => (
          <div
            key={th.id}
            className={cn(
              "group flex items-center rounded-xl text-sm hover:bg-muted",
              th.id === activeId && "bg-muted font-medium",
            )}
          >
            <Link to="/chat/$threadId" params={{ threadId: th.id }} className="min-w-0 flex-1 truncate px-3 py-2.5">
              {th.title}
            </Link>
            <button
              aria-label="Delete"
              onClick={() => remove(th.id)}
              className="mr-1 rounded-lg p-1.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
