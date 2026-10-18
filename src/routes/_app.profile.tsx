import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Trash2 } from "lucide-react";
import { PreferencesForm } from "@/components/preferences-form";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { memoriesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Profile — PostFactum" },
      { name: "description", content: "Your learning preferences and what your AI teacher remembers." },
      { property: "og:title", content: "Profile — PostFactum" },
      { property: "og:description", content: "Your learning preferences and teacher memory." },
    ],
  }),
  component: ProfilePage,
});

const kindStyle: Record<string, string> = {
  gap: "bg-destructive/10 text-destructive",
  strength: "bg-success/15 text-success",
  preference: "bg-secondary/10 text-secondary",
  goal: "bg-warning/20 text-foreground",
  fact: "bg-muted text-muted-foreground",
};

function ProfilePage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: memories } = useQuery(memoriesQuery());

  async function remove(id: string) {
    await supabase.from("memories").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["memories"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">{t.settings}</h1>
        <div className="card-surface p-6">
          <PreferencesForm />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold">{t.memory}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t.memoryHelp}</p>
        <div className="card-surface divide-y divide-border">
          {(memories ?? []).map((m) => (
            <div key={m.id} className="flex items-start gap-3 p-4">
              <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${kindStyle[m.kind] ?? kindStyle["fact"]}`}>{m.kind}</span>
              <p className="flex-1 text-sm">{m.content}</p>
              <button aria-label="Delete" onClick={() => remove(m.id)} className="rounded-lg p-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {memories?.length === 0 && <p className="p-5 text-sm text-muted-foreground">{t.memoryEmpty}</p>}
        </div>
      </section>
      <Button
        variant="outline"
        className="rounded-full"
        onClick={async () => {
          await supabase.auth.signOut();
          qc.clear();
          navigate({ to: "/" });
        }}
      >
        <LogOut className="size-4" /> {t.signOut}
      </Button>
    </div>
  );
}
