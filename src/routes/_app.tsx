import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { BookOpen, Home, MessageCircle, Trophy, User, Video } from "lucide-react";
import { Logo } from "@/components/brand";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { profileQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const profile = useQuery({ ...profileQuery(user?.id ?? ""), enabled: !!user });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    if (!p.onboarded && location.pathname !== "/onboarding") navigate({ to: "/onboarding" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.data]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">…</div>;
  }

  const nav = [
    { to: "/home", label: t.home, icon: Home },
    { to: "/examples", label: "Examples for Judges", icon: Trophy },
    { to: "/chat", label: t.teacher, icon: MessageCircle },
    { to: "/lessons", label: t.lessons, icon: BookOpen },
    { to: "/lessons/live", label: t.liveLesson, icon: Video },
    { to: "/profile", label: t.profile, icon: User },
  ] as const;
  const isActive = (to: string) => location.pathname === to || (to !== "/lessons" || location.pathname !== "/lessons/live") && location.pathname.startsWith(to + "/");
  const isChat = location.pathname.startsWith("/chat/");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  isActive(n.to) && "bg-muted text-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className={cn("mx-auto max-w-6xl", isChat ? "" : "px-4 pb-28 pt-6 md:pb-12")}>
        <Outlet />
      </main>
      {!isChat && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="grid grid-cols-6">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground",
                  isActive(n.to) && "text-secondary",
                )}
              >
                <n.icon className="size-5" />
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
