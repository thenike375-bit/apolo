import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { TeacherAvatar } from "@/components/brand";
import { PreferencesForm } from "@/components/preferences-form";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/onboarding")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Set up your teacher — PostFactum" },
      { name: "description", content: "Tell your AI teacher how you learn best." },
      { property: "og:title", content: "Set up your teacher — PostFactum" },
      { property: "og:description", content: "Tell your AI teacher how you learn best." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-4">
        <TeacherAvatar size={64} className="animate-float" />
        <div>
          <h1 className="text-2xl font-semibold">{t.onboardTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.onboardBody}</p>
        </div>
      </div>
      <div className="card-surface p-6">
        <PreferencesForm
          onboarding
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ["profile"] });
            navigate({ to: "/home" });
          }}
        />
      </div>
    </div>
  );
}
