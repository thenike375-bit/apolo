import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const threadsQuery = () =>
  queryOptions({
    queryKey: ["threads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("threads").select("*").order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

export const lessonsQuery = () =>
  queryOptions({
    queryKey: ["lessons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id, title, subject, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

export const quizzesQuery = () =>
  queryOptions({
    queryKey: ["quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, topic, score, total, completed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

export const memoriesQuery = () =>
  queryOptions({
    queryKey: ["memories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("memories").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export async function createThread(title: string, lessonId?: string | null) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("threads")
    .insert({ title, lesson_id: lessonId ?? null, user_id: u.user!.id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
