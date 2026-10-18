import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sign in — PostFactum" },
      { name: "description", content: "Sign in or create your PostFactum account to meet your personal AI teacher." },
      { property: "og:title", content: "Sign in — PostFactum" },
      { property: "og:description", content: "Meet your personal AI teacher." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/home" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/home", data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) toast.success(t.checkEmail);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  }

  return (
    <div className="grid min-h-screen bg-soft md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-hero p-12 text-foreground md:flex md:flex-col md:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-glow" />
        <Logo className="relative" />
        <h2 className="relative max-w-md text-4xl font-semibold leading-tight">{t.tagline}</h2>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between md:hidden">
            <Logo />
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{mode === "in" ? t.signIn : t.signUp}</h1>
          </div>
          <Button variant="outline" className="mt-6 w-full rounded-xl" onClick={google}>
            {t.continueGoogle}
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> {t.or} <div className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "up" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">{t.name}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t.email}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t.password}</Label>
              <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full rounded-xl" disabled={busy}>
              {mode === "in" ? t.signIn : t.signUp}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "in" ? t.noAccount : t.haveAccount}{" "}
            <button className="font-medium text-secondary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? t.signUp : t.signIn}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
