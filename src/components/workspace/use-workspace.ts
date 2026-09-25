"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  acceptProposal as acceptProposalAction,
  answerQuestions,
  applyPlan,
  applyVisualEdit,
  completeBuild,
  discardProposal as discardProposalAction,
  fixIssue as fixIssueAction,
  restoreVersion,
  runTests as runTestsAction,
  saveAgent as saveAgentAction,
  saveAgentTests as saveAgentTestsAction,
  saveFile,
  savePlan,
  sendMessage,
  setProjectSettings,
  startBuild,
  stopBuild,
  type ClientMessage,
  type ClientVersion,
} from "@/lib/actions/build";
import type { Mode, ProjectSettings, ProjectStage, ProjectStatus } from "@/db/schema";
import type { EditTarget, VisualChange } from "@/lib/sim/visual";
import type { ConnectionView } from "@/lib/integrations";
import type { AgentTest, BuildScript, BuildStepId, Plan, PlanAgent, ProposalData } from "@/lib/sim/types";

export type TabId = "preview" | "review" | "plan" | "agents" | "data" | "code" | "versions" | "settings";

export type LogLevel = "info" | "warn" | "error";
export type LogLine = { id: number; at: number; level: LogLevel; source: "app" | "agent" | "build"; message: string };

const MAX_LOGS = 400;
let logSeq = 0;

/** Result of any server action that lands a new version. */
type Landed = { version: ClientVersion; message: ClientMessage; plan: Plan; focusPage?: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type WorkspaceProject = {
  id: string;
  name: string;
  slug: string;
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



export function useWorkspace(
  init: {
    project: WorkspaceProject;
    plan: Plan | null;
    messages: ClientMessage[];
    versions: ClientVersion[];
    currentVersionId: string | null;
    freshMessageId: string | null;
    autoBuild: boolean;
    /** From the URL: /p/<id>?tab=agents&agent=<agentId> opens straight onto an agent. */
    initialTab?: TabId | null;
    initialAgentId?: string | null;
    connections: ConnectionView[];
  },
  uiMode: Mode,
  /** Called when someone asks to see a stage tab, so the phone layout can switch to the App view. */
  onShowStage?: () => void,
) {
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
  const [tab, setTabState] = useState<TabId>(init.initialTab ?? (init.currentVersionId ? "preview" : init.plan ? "plan" : "preview"));
  const [agentId, setAgentId] = useState<string | null>(init.initialAgentId ?? null);
  /** Unsaved edits per agent, kept here so they survive switching tabs. */
  const [agentDrafts, setAgentDrafts] = useState<Record<string, PlanAgent>>({});
  const [connections, setConnections] = useState<ConnectionView[]>(init.connections);
  const [previewPage, setPreviewPage] = useState<string | null>(null);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Record<string, unknown>>({});
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [codeFile, setCodeFile] = useState<string | null>(null);
  const [codeLine, setCodeLine] = useState<{ line: number; n: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const planSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentVersion = useMemo(() => versions.find((v) => v.id === currentVersionId) ?? null, [versions, currentVersionId]);

  // Tabs opened from the UI (a card's "Review", a file link) also bring the stage into view on phones.
  const showStage = useRef(onShowStage);
  useEffect(() => {
    showStage.current = onShowStage;
  });
  const setTab = useCallback((t: TabId) => {
    setTabState(t);
    showStage.current?.();
  }, []);
  const settings = project.settings;
  const testAfterChanges = settings.testAfterChanges ?? uiMode === "simple";
  const pageCount = plan?.pages.length ?? 4;
  const reviewing = uiMode === "pro" && !!settings.reviewChanges;
  const issues = useMemo(() => (project.stage === "ready" ? plan?.issues ?? [] : []), [plan, project.stage]);
  const pendingProposal = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind === "proposal" && (m.data as ProposalData | null)?.status === "pending") return m as ClientMessage & { data: ProposalData };
    }
    return null;
  }, [messages]);

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
      setTabState((t) => (t === "plan" ? "preview" : t));

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
        setTabState("plan");
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
      setTabState("preview");
    } catch {
      toast.error("Couldn't apply the plan");
    } finally {
      setThinking(null);
    }
  }, [plan, project.id]);

  // ---------------------------------------------------------------------------------------------
  // Chat

  /** Plays a sequence of "thinking" labels while a server action runs, for at least `min` ms. */
  const think = useCallback(async <T,>(labels: string[], min: number, work: () => Promise<T>): Promise<T> => {
    let i = 0;
    setThinking(labels[0]);
    const step = Math.max(700, Math.round(min / labels.length));
    const rotate = setInterval(() => {
      i = Math.min(labels.length - 1, i + 1);
      setThinking(labels[i]);
    }, step);
    const started = Date.now();
    try {
      const out = await work();
      await wait(Math.max(0, min - (Date.now() - started)));
      return out;
    } finally {
      clearInterval(rotate);
      setThinking(null);
    }
  }, []);

  /** A new version arrived from the server: make it current and show it. */
  const land = useCallback((res: Landed) => {
    setVersions((v) => [...v, res.version]);
    setCurrentVersionId(res.version.id);
    setMessages((m) => [...m, res.message]);
    setPlan(res.plan);
    setPlanDirty(false);
    setPreviewVersionId(null);
    setPreviewPage(res.focusPage ?? null);
  }, []);

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
      const editing = mode === "build" && project.stage === "ready";
      const labels =
        project.stage === "plan"
          ? ["Updating the plan"]
          : !editing
            ? ["Thinking it through"]
            : reviewing
              ? ["Reading the plan", "Editing files", "Preparing the diff"]
              : testAfterChanges
                ? ["Reading the plan", "Editing files", "Opening the app in a browser", `Clicking through ${pageCount} pages`]
                : ["Reading the plan", "Editing files", "Checking the preview"];
      try {
        const res = await think(labels, editing ? (testAfterChanges && !reviewing ? 3800 : 2600) : 1100, () => sendMessage(project.id, text, mode, { uiMode }));
        const replaced = "replaced" in res && res.replaced ? res.replaced : [];
        setMessages((m) => [...m.filter((x) => x.id !== optimistic.id).map((x) => replaced.find((r) => r.id === x.id) ?? x), ...res.messages]);
        if ("plan" in res && res.plan) setPlan(res.plan);
        if ("version" in res && res.version) {
          setVersions((v) => [...v, res.version!]);
          setCurrentVersionId(res.version.id);
          setPreviewVersionId(null);
          const edit = res.messages.find((m) => m.kind === "edit")?.data as { focusPage?: string } | undefined;
          setPreviewPage(edit?.focusPage ?? null);
        }
        if (res.messages.some((m) => m.kind === "proposal")) setTabState("review");
      } catch {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        toast.error("That message didn't go through", { description: "Please try again." });
      }
    },
    [project.id, project.stage, pageCount, reviewing, testAfterChanges, think, uiMode],
  );

  // ---------------------------------------------------------------------------------------------
  // Iterate: review, Fix it, visual edits, tests, settings

  const acceptProposal = useCallback(
    async (messageId: string, paths: string[], commit: string) => {
      try {
        const res = await think(["Applying the change"], 900, () => acceptProposalAction(project.id, messageId, paths, commit));
        if (!res.ok) {
          if (res.reason !== "closed") toast.error(res.reason === "stale" ? "This change is out of date" : "Nothing to accept", { description: res.error });
          return false;
        }
        setMessages((m) => m.map((x) => (x.id === res.proposal.id ? res.proposal : x)));
        land({ ...res, focusPage: (res.proposal.data as ProposalData).focusPage });
        setTabState("preview");
        return true;
      } catch {
        toast.error("Couldn't apply the change", { description: "Please try again." });
        return false;
      }
    },
    [land, project.id, think],
  );

  const discardProposal = useCallback(
    async (messageId: string) => {
      try {
        const res = await discardProposalAction(project.id, messageId);
        setMessages((m) => [...m.map((x) => (x.id === res.proposal.id ? res.proposal : x)), ...(res.message ? [res.message] : [])]);
        setTabState((t) => (t === "review" ? "preview" : t));
      } catch {
        toast.error("Couldn't discard the change");
      }
    },
    [project.id],
  );

  const fixIssue = useCallback(
    async (issueId: string) => {
      const issue = plan?.issues?.find((i) => i.id === issueId);
      if (!issue || thinking) return;
      try {
        const res = await think(["Reading the error", `Fixing ${issue.file}`, "Checking the preview"], 2600, () => fixIssueAction(project.id, issueId));
        if (!res.ok) {
          toast(res.error);
          return;
        }
        land(res);
        setTabState((t) => (t === "code" || t === "review" ? t : "preview"));
      } catch {
        toast.error("Couldn't fix that", { description: "Please try again." });
      }
    },
    [land, plan?.issues, project.id, think, thinking],
  );

  const visualEdit = useCallback(
    async (target: EditTarget, change: VisualChange) => {
      try {
        const res = await think(["Editing the element", "Checking the preview"], 1400, () => applyVisualEdit(project.id, target, change));
        if (!res.ok) {
          toast(res.error);
          return false;
        }
        land(res);
        return true;
      } catch {
        toast.error("Couldn't apply that edit", { description: "Please try again." });
        return false;
      }
    },
    [land, project.id, think],
  );

  const runTests = useCallback(async () => {
    if (project.stage !== "ready" || thinking) return;
    try {
      const res = await think(["Opening the app in a browser", `Clicking through ${pageCount} pages`, "Checking every agent"], 3200, () => runTestsAction(project.id));
      if (!res.ok) {
        toast(res.error);
        return;
      }
      if ("version" in res && res.version) land(res);
      else setMessages((m) => [...m, res.message]);
    } catch {
      toast.error("The testing agent couldn't run", { description: "Please try again." });
    }
  }, [land, pageCount, project.id, project.stage, think, thinking]);

  const updateSettings = useCallback(
    async (patch: Partial<ProjectSettings>) => {
      const before = project.settings;
      setProject((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
      try {
        const res = await setProjectSettings(project.id, patch);
        setProject((p) => ({ ...p, settings: res.settings }));
        if (res.plan && patch.model) setPlan(res.plan);
      } catch {
        setProject((p) => ({ ...p, settings: before }));
        toast.error("Couldn't save that setting");
      }
    },
    [project.id, project.settings],
  );

  /** Messages that live only in this browser tab, like the /help card. */
  const addLocalMessage = useCallback((m: Omit<ClientMessage, "id" | "createdAt">) => {
    setMessages((list) => [...list, { ...m, id: `local-${Date.now()}`, createdAt: new Date() }]);
  }, []);

  const addLog = useCallback((level: LogLevel, message: string, source: LogLine["source"] = "app") => {
    setLogs((l) => [...l.slice(-(MAX_LOGS - 1)), { id: ++logSeq, at: Date.now(), level, source, message }]);
  }, []);
  const clearLogs = useCallback(() => setLogs([]), []);

  /** Opens a file in the Code tab, optionally scrolled to a line. */
  const openCode = useCallback((path: string, line?: number) => {
    setCodeFile(path);
    setCodeLine(line ? { line, n: Date.now() } : null);
    setTab("code");
  }, [setTab]);

  const restore = useCallback(
    async (versionId: string) => {
      try {
        const res = await restoreVersion(project.id, versionId);
        setVersions((v) => [...v, res.version]);
        setCurrentVersionId(res.version.id);
        setMessages((m) => [...m, res.message]);
        if (res.plan) setPlan(res.plan);
        setPreviewVersionId(null);
        setPreviewPage(null);
        setPlanDirty(false);
        setProject((p) => ({ ...p, stage: "ready" }));
        toast.success(`Restored v${versions.find((v) => v.id === versionId)?.number}`);
      } catch {
        toast.error("Couldn't restore that version");
      }
    },
    [project.id, versions],
  );

  /** The version just before the current one, which Undo brings back. */
  const previousVersion = useMemo(() => {
    if (!currentVersion) return null;
    return [...versions].filter((v) => v.number < currentVersion.number).sort((a, b) => b.number - a.number)[0] ?? null;
  }, [versions, currentVersion]);

  const undo = useCallback(async () => {
    if (!previousVersion) {
      toast("There's nothing to undo yet");
      return;
    }
    await restore(previousVersion.id);
  }, [previousVersion, restore]);

  // ---------------------------------------------------------------------------------------------
  // Agents

  const openAgent = useCallback(
    (id: string) => {
      setAgentId(id);
      setTab("agents");
    },
    [setTab],
  );

  const setAgentDraft = useCallback((id: string, draft: PlanAgent | null) => {
    setAgentDrafts((d) => {
      const next = { ...d };
      if (draft) next[id] = draft;
      else delete next[id];
      return next;
    });
  }, []);

  const addConnection = useCallback((c: ConnectionView) => setConnections((list) => [c, ...list.filter((x) => x.id !== c.id)]), []);

  /** Saves one agent. After the first build that's a new version; before it, just the plan. */
  const saveAgent = useCallback(
    async (agent: PlanAgent) => {
      try {
        const res = await saveAgentAction(project.id, agent);
        if (!res.ok) {
          toast(res.error);
          return false;
        }
        if (res.version && res.message) {
          land({ version: res.version, message: res.message, plan: res.plan });
          toast.success(`Saved ${agent.name} as v${res.version.number}`, { description: res.changes.length === 1 ? res.changes[0] : `${res.changes.length} changes` });
        } else {
          setPlan(res.plan);
          toast.success(`Saved ${agent.name} to the plan`, { description: "It's built into the app when you click Build this." });
        }
        setAgentDraft(agent.id, null);
        return true;
      } catch {
        toast.error("Couldn't save the agent", { description: "Please try again." });
        return false;
      }
    },
    [land, project.id, setAgentDraft],
  );

  /** Test cases save straight away (no version); a failure throws so the console can say so. */
  const saveAgentTests = useCallback(
    async (id: string, tests: AgentTest[]) => {
      const res = await saveAgentTestsAction(project.id, id, tests);
      if (!res.ok) throw new Error("Agent not found");
      setPlan((p) => (p ? { ...p, agents: p.agents.map((a) => (a.id === id ? { ...a, tests } : a)) } : p));
      setAgentDrafts((d) => (d[id] ? { ...d, [id]: { ...d[id], tests } } : d));
    },
    [project.id],
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
    agentId,
    setAgentId,
    openAgent,
    agentDrafts,
    setAgentDraft,
    saveAgent,
    saveAgentTests,
    connections,
    addConnection,
    settings,
    testAfterChanges,
    reviewing,
    issues,
    pendingProposal,
    previousVersion,
    logs,
    addLog,
    clearLogs,
    codeFile,
    setCodeFile,
    codeLine,
    openCode,
    acceptProposal,
    discardProposal,
    fixIssue,
    visualEdit,
    runTests,
    updateSettings,
    addLocalMessage,
    undo,
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
