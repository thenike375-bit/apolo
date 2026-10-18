import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { TeacherAvatar } from "@/components/brand";
import { TEACHER_NAME } from "@/lib/avatars";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { profileQuery } from "@/lib/queries";



export function PreferencesForm({
  onboarding,
  onSaved,
}: {
  onboarding?: boolean;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: p, refetch } = useQuery({ ...profileQuery(user?.id ?? ""), enabled: !!user });
  const [form, setForm] = useState({
    display_name: "",
    education_level: "high_school",
    learning_style: "step_by_step",
    language: "en",
    teacher_name: "Apollo",
    teacher_voice: "Aoede",
    avatar_id: "apollo",
    avatar_url: null as string | null,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (p)
      setForm({
        display_name: p.display_name ?? "",
        education_level: p.education_level ?? "high_school",
        learning_style: p.learning_style ?? "step_by_step",
        language: p.language,
        teacher_name: p.teacher_name,
        teacher_voice: "Aoede",
        avatar_id: p.avatar_id ?? "apollo",
        avatar_url: p.avatar_url,
      });
  }, [p]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: form.display_name.trim() || null,
      education_level: form.education_level,
      learning_style: form.learning_style,
      language: form.language,
      teacher_name: TEACHER_NAME,
      teacher_voice: "Aoede",
      avatar_id: "apollo",
      avatar_url: null,
      subjects: [],
      onboarded: true,
      updated_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refetch();
    if (!onboarding) toast.success(t.saved);
    onSaved?.();
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <div className="flex items-center gap-3 sm:col-span-2">
        <TeacherAvatar size={56} />
        <p className="font-display font-semibold">{TEACHER_NAME}</p>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>{t.name}</Label>
        <Input value={form.display_name} onChange={(e) => set("display_name")(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>{t.level}</Label>
        <Select value={form.education_level} onValueChange={set("education_level")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(t.levels).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>{t.style}</Label>
        <Select value={form.learning_style} onValueChange={set("learning_style")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(t.styles).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={busy || uploading} className="rounded-xl sm:col-span-2">
        {onboarding ? t.letsGo : t.save}
      </Button>
    </form>
  );
}
