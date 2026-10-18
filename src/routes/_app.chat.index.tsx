import { createFileRoute } from "@tanstack/react-router";
import { ThreadList } from "@/components/thread-list";
import { TeacherAvatar } from "@/components/brand";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/chat/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Your teacher — PostFactum" },
      { name: "description", content: "Your conversations with your personal AI teacher." },
      { property: "og:title", content: "Your teacher — PostFactum" },
      { property: "og:description", content: "Your conversations with your personal AI teacher." },
    ],
  }),
  component: ChatIndex,
});

function ChatIndex() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <TeacherAvatar size={48} />
        <p className="text-sm text-muted-foreground">{t.emptyChat}</p>
      </div>
      <ThreadList className="card-surface" />
    </div>
  );
}
