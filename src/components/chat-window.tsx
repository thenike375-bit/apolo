import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ScanFace } from "lucide-react";
import { SessionCamera } from "@/components/session-camera";
import type { FaceCue } from "@/lib/face-cues";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BookmarkCheck, Loader2, Mic, Square, Volume2, VolumeX } from "lucide-react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageAction, MessageActions, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputButton, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { TeacherAvatar } from "@/components/brand";
import { Switch } from "@/components/ui/switch";
import { authHeader, useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { profileQuery } from "@/lib/queries";
import { Recorder, speak, stopSpeaking, transcribeBlob } from "@/lib/voice-client";

function textOf(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n").trim();
}

export function ChatWindow({
  threadId,
  initialMessages,
  initialPrompt,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  initialPrompt?: string | undefined;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useQuery({ ...profileQuery(user?.id ?? ""), enabled: !!user });
  const voice = "Aoede";
  const [text, setText] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [mic, setMic] = useState<"idle" | "recording" | "transcribing">("idle");
  const recorder = useRef<Recorder | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sentInitial = useRef(false);
  const [camOpen, setCamOpen] = useState(false);
  const cueRef = useRef<FaceCue | null>(null);
  const voiceModeRef = useRef(voiceMode);
  voiceModeRef.current = voiceMode;

  useEffect(() => () => {
    recorder.current?.abort();
    recorder.current = null;
  }, []);

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ threadId, cue: cueRef.current }),
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        const auth = await authHeader();
        if (auth["Authorization"]) headers.set("Authorization", auth["Authorization"]);
        return fetch(input, { ...init, headers });
      },
    }),
    onError: (e) => toast.error(e.message || "Error"),
    onFinish: ({ message }) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: ["memories"] });
      if (voiceModeRef.current && message.role === "assistant") playMessage(message);
      textareaRef.current?.focus();
    },
  });

  useEffect(() => {
    if (initialPrompt && !sentInitial.current && initialMessages.length === 0) {
      sentInitial.current = true;
      sendMessage({ text: initialPrompt });
      navigate({ to: "/chat/$threadId", params: { threadId }, search: {}, replace: true });
    }
    textareaRef.current?.focus();
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function playMessage(m: UIMessage) {
    if (speakingId === m.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setLoadingVoiceId(m.id);
    try {
      await speak(textOf(m), voice, () => setSpeakingId((s) => (s === m.id ? null : s)));
      setSpeakingId(m.id);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message);
    } finally {
      setLoadingVoiceId(null);
    }
  }

  async function toggleMic() {
    if (mic === "idle") {
      try {
        stopSpeaking();
        recorder.current = new Recorder();
        await recorder.current.start();
        setMic("recording");
      } catch {
        toast.error(t.micDenied);
      }
    } else if (mic === "recording") {
      setMic("transcribing");
      try {
        const activeRecorder = recorder.current;
        if (!activeRecorder) return;
        recorder.current = null;
        const blob = await activeRecorder.stop();
        const said = await transcribeBlob(blob, lang);
        if (said) {
          setVoiceMode(true);
          sendMessage({ text: said });
        }
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setMic("idle");
      }
    }
  }

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<TeacherAvatar size={88} className="animate-float" />}
              title={"Apollo"}
              description={t.emptyChat}
            />
          ) : (
            messages.map((m) => (
              <Message from={m.role} key={m.id}>
                <MessageContent>
                  {m.parts.map((p, i) => {
                    if (p.type === "text") return <MessageResponse key={i}>{p.text}</MessageResponse>;
                    if (p.type === "tool-remember") {
                      const out = p.state === "output-available" ? (p.output as { content?: string } | undefined) : undefined;
                      return (
                        <Tool key={i} defaultOpen={false} className="border-accent/30 bg-accent/5">
                          <ToolHeader type={p.type} state={p.state} title={t.savedMemory} />
                          <ToolContent>
                            <ToolInput input={p.input} />
                            {out && <ToolOutput output={out.content} errorText={undefined} />}
                            {p.state === "output-error" && <ToolOutput output={undefined} errorText={p.errorText} />}
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
                {m.role === "assistant" && textOf(m) && !(busy && m.id === messages[messages.length - 1]?.id) && (
                  <MessageActions>
                    <MessageAction tooltip={t.listen} label={t.listen} onClick={() => playMessage(m)}>
                      {loadingVoiceId === m.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : speakingId === m.id ? (
                        <VolumeX className="size-4" />
                      ) : (
                        <Volume2 className="size-4" />
                      )}
                    </MessageAction>
                  </MessageActions>
                )}
              </Message>
            ))
          )}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm">
              <TeacherAvatar size={24} />
              <Shimmer>{t.thinking}</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
        {camOpen && (
          <div className="mb-2 ml-auto w-56">
            <SessionCamera ended={!camOpen} autoStart compact onCue={(c) => (cueRef.current = c)} />
          </div>
        )}
        <PromptInput
          onSubmit={(msg) => {
            const v = msg.text.trim();
            if (!v || busy) return;
            stopSpeaking();
            sendMessage({ text: v });
            setText("");
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mic === "recording" ? t.recording : mic === "transcribing" ? t.transcribing : t.placeholder}
          />
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputButton
                onClick={() => {
                  setCamOpen(!camOpen);
                  cueRef.current = null;
                }}
                variant={camOpen ? "default" : "ghost"}
                className="rounded-full"
                aria-label={t.chatCamera}
                title={t.chatCamera}
              >
                <ScanFace className="size-4" />
              </PromptInputButton>
              <PromptInputButton
                onClick={toggleMic}
                disabled={mic === "transcribing" || busy}
                variant={mic === "recording" ? "default" : "ghost"}
                className={mic === "recording" ? "animate-speaking rounded-full" : "rounded-full"}
                aria-label="Voice"
              >
                {mic === "transcribing" ? <Loader2 className="size-4 animate-spin" /> : mic === "recording" ? <Square className="size-4" /> : <Mic className="size-4" />}
              </PromptInputButton>
              <label className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                <Switch checked={voiceMode} onCheckedChange={setVoiceMode} />
                {t.voiceMode}
              </label>
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[11px] text-muted-foreground">
          <BookmarkCheck className="size-3" /> {t.aiNotice}
        </p>
      </div>
    </div>
  );
}
