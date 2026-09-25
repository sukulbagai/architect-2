"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  answerQuestions,
  applyPlan,
  completeBuild,
  restoreVersion,
  saveFile,
  savePlan,
  sendMessage,
  startBuild,
  stopBuild,
  type ClientMessage,
  type ClientVersion,
} from "@/lib/actions/build";
import type { ProjectSettings, ProjectStage, ProjectStatus } from "@/db/schema";
import type { BuildScript, BuildStepId, Plan } from "@/lib/sim/types";

export type TabId = "preview" | "plan" | "agents" | "data" | "code" | "versions" | "settings";

export type WorkspaceProject = {
  id: string;
  name: string;
  status: ProjectStatus;
  stage: ProjectStage;
  stack: string;
  settings: ProjectSettings;
  updatedAt: Date;
};

export type StepState = { status: "todo" | "active" | "done"; detail?: string; subs: string[] };

export type LiveBuild = {
  startedAt: number;
  elapsed: number;
  steps: Record<BuildStepId, StepState>;
  order: string[];
  streamed: Record<string, number>;
  writing: string | null;
  previewReady: boolean;
  files: Record<string, string>;
};

export const STEP_ORDER: BuildStepId[] = ["plan", "agents", "data", "ui", "test", "ready"];
export const STEP_LABEL: Record<BuildStepId, string> = {
  plan: "Plan locked",
  agents: "Agents",
  data: "Data",
  ui: "UI",
  test: "Test",
  ready: "Ready",
};

function emptySteps(): Record<BuildStepId, StepState> {
  return Object.fromEntries(STEP_ORDER.map((s) => [s, { status: "todo", subs: [] }])) as unknown as Record<BuildStepId, StepState>;
}

const PLAN_SECTIONS = 7;



export function useWorkspace(init: {
  project: WorkspaceProject;
  plan: Plan | null;
  messages: ClientMessage[];
  versions: ClientVersion[];
  currentVersionId: string | null;
  freshMessageId: string | null;
  autoBuild: boolean;
}) {
  const [project, setProject] = useState(init.project);
  const [plan, setPlan] = useState<Plan | null>(init.plan);
  const [messages, setMessages] = useState<ClientMessage[]>(init.messages);
  const [versions, setVersions] = useState<ClientVersion[]>(init.versions);
  const [currentVersionId, setCurrentVersionId] = useState(init.currentVersionId);
  const [build, setBuild] = useState<LiveBuild | null>(null);
  // The opening questions, created moments ago, get a short "thinking" beat before they appear.
  // The server decides what counts as fresh so the first render matches on both sides.
  const fresh = init.freshMessageId;
  const [thinking, setThinking] = useState<string | null>(fresh ? "Reading your idea" : null);
  const [hiddenId, setHiddenId] = useState<string | null>(fresh ?? null);
  const [planReveal, setPlanReveal] = useState(PLAN_SECTIONS);
  const [planDirty, setPlanDirty] = useState(false);
  const [tab, setTab] = useState<TabId>(init.currentVersionId ? "preview" : init.plan ? "plan" : "preview");
  const [previewPage, setPreviewPage] = useState<string | null>(null);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const planSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentVersion = useMemo(() => versions.find((v) => v.id === currentVersionId) ?? null, [versions, currentVersionId]);

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => {
      setHiddenId(null);
      setThinking(null);
    }, 1400);
    return () => clearTimeout(t);
  }, [fresh]);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stopTimer, []);

  // ---------------------------------------------------------------------------------------------
  // Build playback

  const play = useCallback(
    (script: BuildScript) => {
      stopTimer();
      const startedAt = Date.now();
      let cursor = 0;
      const state: LiveBuild = {
        startedAt,
        elapsed: 0,
        steps: emptySteps(),
        order: [],
        streamed: {},
        writing: null,
        previewReady: false,
        files: script.files,
      };
      const active: { path: string; at: number; duration: number }[] = [];
      setBuild({ ...state });
      setTab((t) => (t === "plan" ? "preview" : t));

      timer.current = setInterval(async () => {
        const t = Date.now() - startedAt;
        let finished = false;
        while (cursor < script.events.length && script.events[cursor].at <= t) {
          const ev = script.events[cursor++];
          if (ev.type === "step") {
            state.steps = { ...state.steps, [ev.step]: { ...state.steps[ev.step], status: ev.status, detail: ev.detail ?? state.steps[ev.step].detail } };
          } else if (ev.type === "sub") {
            state.steps = { ...state.steps, [ev.step]: { ...state.steps[ev.step], subs: [...state.steps[ev.step].subs, ev.text] } };
          } else if (ev.type === "file") {
            state.order = [...state.order, ev.path];
            active.push({ path: ev.path, at: ev.at, duration: ev.duration });
          } else if (ev.type === "preview") {
            state.previewReady = true;
          } else if (ev.type === "done") {
            finished = true;
          }
        }
        const streamed = { ...state.streamed };
        for (let i = active.length - 1; i >= 0; i--) {
          const a = active[i];
          const p = Math.min(1, (t - a.at) / a.duration);
          streamed[a.path] = p;
          if (p >= 1) active.splice(i, 1);
        }
        state.streamed = streamed;
        state.writing = active[0]?.path ?? null;
        state.elapsed = t;
        setBuild({ ...state });

        if (finished) {
          stopTimer();
          try {
            const res = await completeBuild(project.id, t / 1000);
            setVersions((v) => [...v, res.version]);
            setCurrentVersionId(res.version.id);
            setMessages((m) => [...m, res.message]);
            setProject((p) => ({ ...p, stage: "ready", status: "draft" }));
            setPreviewVersionId(null);
          } catch {
            toast.error("The build couldn't be saved", { description: "Try building again." });
          } finally {
            setBuild(null);
          }
        }
      }, 50);
    },
    [project.id],
  );

  const runBuild = useCallback(async () => {
    if (build) return;
    setThinking("Locking the plan");
    try {
      const res = await startBuild(project.id);
      setPlan(res.plan);
      setProject((p) => ({ ...p, stage: "build", status: "building" }));
      setThinking(null);
      play(res.script);
    } catch {
      setThinking(null);
      toast.error("Couldn't start the build");
    }
  }, [build, play, project.id]);

  const stop = useCallback(async () => {
    stopTimer();
    setBuild(null);
    try {
      const res = await stopBuild(project.id);
      setMessages((m) => [...m, res.message]);
      setProject((p) => ({ ...p, stage: res.stage, status: "draft" }));
    } catch {
      toast.error("Couldn't stop the build cleanly");
    }
  }, [project.id]);

  // Projects created with "Plan first" off start building as soon as they open.
  useEffect(() => {
    if (init.autoBuild) {
      const t = setTimeout(() => void runBuild(), 600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first mount
  }, []);

  // ---------------------------------------------------------------------------------------------
  // Planning

  const revealPlan = useCallback(() => {
    setPlanReveal(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setPlanReveal(n);
      if (n >= PLAN_SECTIONS) clearInterval(id);
    }, 320);
  }, []);

  const answer = useCallback(
    async (answers: Record<string, string[]> | null) => {
      setThinking("Drafting the plan");
      const started = Date.now();
      try {
        const res = await answerQuestions(project.id, answers);
        await new Promise((r) => setTimeout(r, Math.max(0, 1200 - (Date.now() - started))));
        if (res.questionsId) setAnswered((a) => ({ ...a, [res.questionsId!]: res.answered }));
        setMessages((m) => [...m, ...res.messages]);
        setPlan(res.plan);
        setTab("plan");
        revealPlan();
      } catch {
        toast.error("Couldn't draft the plan");
      } finally {
        setThinking(null);
      }
    },
    [project.id, revealPlan],
  );

  const updatePlan = useCallback(
    (next: Plan) => {
      setPlan(next);
      if (project.stage === "plan") {
        if (planSaveTimer.current) clearTimeout(planSaveTimer.current);
        planSaveTimer.current = setTimeout(() => void savePlan(project.id, next).catch(() => toast.error("Couldn't save the plan")), 600);
      } else {
        setPlanDirty(true);
      }
    },
    [project.id, project.stage],
  );

  const applyPlanChanges = useCallback(async () => {
    if (!plan) return;
    setThinking("Applying the plan");
    try {
      const res = await applyPlan(project.id, plan);
      setVersions((v) => [...v, res.version]);
      setCurrentVersionId(res.version.id);
      setMessages((m) => [...m, res.message]);
      setPlanDirty(false);
      setTab("preview");
    } catch {
      toast.error("Couldn't apply the plan");
    } finally {
      setThinking(null);
    }
  }, [plan, project.id]);

  // ---------------------------------------------------------------------------------------------
  // Chat

  const send = useCallback(
    async (text: string, mode: "plan" | "build") => {
      const optimistic: ClientMessage = {
        id: `tmp-${Date.now()}`,
        role: "user",
        kind: "chat",
        content: text,
        data: { mode, stage: project.stage },
        createdAt: new Date(),
      };
      setMessages((m) => [...m, optimistic]);
      const labels =
        project.stage === "plan"
          ? ["Updating the plan"]
          : mode === "plan"
            ? ["Thinking it through"]
            : ["Reading the plan", "Editing files", "Checking the preview"];
      let i = 0;
      setThinking(labels[0]);
      const rotate = setInterval(() => {
        i = Math.min(labels.length - 1, i + 1);
        setThinking(labels[i]);
      }, 900);
      const started = Date.now();
      try {
        const res = await sendMessage(project.id, text, mode);
        await new Promise((r) => setTimeout(r, Math.max(0, (mode === "build" && project.stage === "ready" ? 2600 : 1100) - (Date.now() - started))));
        setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), ...res.messages]);
        if (res.plan) setPlan(res.plan);
        if (res.version) {
          setVersions((v) => [...v, res.version!]);
          setCurrentVersionId(res.version.id);
          setPreviewVersionId(null);
          const edit = res.messages.find((m) => m.kind === "edit")?.data as { focusPage?: string } | undefined;
          if (edit?.focusPage) setPreviewPage(edit.focusPage);
        }
      } catch {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        toast.error("That message didn't go through", { description: "Please try again." });
      } finally {
        clearInterval(rotate);
        setThinking(null);
      }
    },
    [project.id, project.stage],
  );

  const restore = useCallback(
    async (versionId: string) => {
      try {
        const res = await restoreVersion(project.id, versionId);
        setVersions((v) => [...v, res.version]);
        setCurrentVersionId(res.version.id);
        setMessages((m) => [...m, res.message]);
        if (res.plan) setPlan(res.plan);
        setPreviewVersionId(null);
        setPlanDirty(false);
        setProject((p) => ({ ...p, stage: "ready" }));
        toast.success(`Restored v${versions.find((v) => v.id === versionId)?.number}`);
      } catch {
        toast.error("Couldn't restore that version");
      }
    },
    [project.id, versions],
  );

  const saveCode = useCallback(
    async (path: string, content: string) => {
      const res = await saveFile(project.id, path, content);
      setVersions((v) => [...v, res.version]);
      setCurrentVersionId(res.version.id);
      setMessages((m) => [...m, res.message]);
      setPlan(res.plan);
      toast.success(`Saved ${path.split("/").pop()} as v${res.version.number}`);
    },
    [project.id],
  );

  return {
    project,
    setProject,
    plan,
    messages,
    versions,
    currentVersion,
    currentVersionId,
    build,
    thinking,
    hiddenId,
    planReveal,
    planDirty,
    tab,
    setTab,
    previewPage,
    setPreviewPage,
    previewVersionId,
    setPreviewVersionId,
    answered,
    runBuild,
    stop,
    answer,
    updatePlan,
    applyPlanChanges,
    send,
    restore,
    saveCode,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
