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
import {
  closePullRequest as closePrAction,
  createBranch as createBranchAction,
  linkRepository,
  mergePullRequest as mergePrAction,
  openPullRequest as openPrAction,
  pullRepository,
  pushRepository,
  setAutoCommit as setAutoCommitAction,
  simulateTeammatePush,
  switchBranch as switchBranchAction,
  unlinkRepository,
} from "@/lib/actions/github";
import { repoStatus, type ProjectRepo } from "@/lib/sim/github";
import type { Mode, ProjectSettings, ProjectStage, ProjectStatus } from "@/db/schema";
import type { EditTarget, VisualChange } from "@/lib/sim/visual";
import type { ConnectionView } from "@/lib/integrations";
import type { AgentTest, BuildScript, BuildStepId, Plan, PlanAgent, ProposalData } from "@/lib/sim/types";

export type TabId = "preview" | "review" | "plan" | "agents" | "data" | "code" | "versions" | "settings";

export type LogLevel = "info" | "warn" | "error";
export type LogLine = { id: number; at: number; level: LogLevel; source: "app" | "agent" | "build"; message: string };

const MAX_LOGS = 400;
let logSeq = 0;

/** Result of any server action that lands a new version. `repo` is the linked repo after it. */
type Landed = { version: ClientVersion; message: ClientMessage; plan: Plan; focusPage?: string; repo?: ProjectRepo | null };

export type LinkInput = { mode: "create"; name: string; private: boolean; description?: string } | { mode: "existing"; name: string };

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
    /** The linked (simulated) GitHub repo, and the workspace's GitHub login when connected. */
    repo: ProjectRepo | null;
    githubLogin: string | null;
    /** Decided on the server: whether the teammate's change had already landed when the page loaded. */
    teammateArrived: boolean;
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
  const [repo, setRepo] = useState<ProjectRepo | null>(init.repo);
  const [githubLogin, setGithubLogin] = useState(init.githubLogin);
  const [pushing, setPushing] = useState(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [arrivedAt, setArrivedAt] = useState<string | null>(init.teammateArrived ? init.repo?.teammate?.at ?? null : null);

  const currentVersion = useMemo(() => versions.find((v) => v.id === currentVersionId) ?? null, [versions, currentVersionId]);

  // The teammate's change lands on the remote at a set time (about two minutes after linking).
  const teammateAt = repo?.teammate && !repo.teammate.pulled ? repo.teammate.at : null;
  const teammateArrived = !!teammateAt && arrivedAt === teammateAt;
  useEffect(() => {
    if (!teammateAt || arrivedAt === teammateAt) return;
    const t = setTimeout(() => setArrivedAt(teammateAt), Math.max(0, Date.parse(teammateAt) - Date.now()));
    return () => clearTimeout(t);
  }, [teammateAt, arrivedAt]);
  const git = useMemo(() => (repo ? repoStatus(repo, teammateArrived ? Number.MAX_SAFE_INTEGER : 0) : null), [repo, teammateArrived]);

  /** Shows "Pushing…" on the chip for a moment, the way an auto-commit push would. */
  const flashPushing = useCallback((ms = 1000) => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    setPushing(true);
    pushTimer.current = setTimeout(() => setPushing(false), ms);
  }, []);
  useEffect(() => () => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
  }, []);

  /** The repo after a new version: with auto-commit the version was pushed, so the chip flickers. */
  const landRepo = useCallback(
    (next: ProjectRepo | null | undefined) => {
      if (next === undefined) return;
      setRepo(next);
      const b = next?.branches[next.branch];
      if (next?.autoCommit && b && b.commits.length > 0 && b.pushed === b.commits.length) flashPushing();
    },
    [flashPushing],
  );

  /** Every new version goes through here: it becomes current and, when linked, a commit. */
  const addVersion = useCallback(
    (version: ClientVersion, nextRepo?: ProjectRepo | null) => {
      setVersions((v) => [...v, version]);
      setCurrentVersionId(version.id);
      landRepo(nextRepo);
    },
    [landRepo],
  );

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
            addVersion(res.version, res.repo);
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
    [addVersion, project.id],
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
      addVersion(res.version, res.repo);
      setMessages((m) => [...m, res.message]);
      setPlanDirty(false);
      setTabState("preview");
    } catch {
      toast.error("Couldn't apply the plan");
    } finally {
      setThinking(null);
    }
  }, [addVersion, plan, project.id]);

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
  const land = useCallback(
    (res: Landed) => {
      addVersion(res.version, res.repo);
      setMessages((m) => [...m, res.message]);
      setPlan(res.plan);
      setPlanDirty(false);
      setPreviewVersionId(null);
      setPreviewPage(res.focusPage ?? null);
    },
    [addVersion],
  );

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
          addVersion(res.version, res.repo);
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
    [addVersion, project.id, project.stage, pageCount, reviewing, testAfterChanges, think, uiMode],
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
        addVersion(res.version, res.repo);
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
    [addVersion, project.id, versions],
  );

  /** The versions on the current branch, oldest first (all of them when no repo is linked). */
  const branchVersions = useMemo(() => {
    const ids = repo?.branches[repo.branch]?.commits;
    if (!ids) return [...versions].sort((a, b) => a.number - b.number);
    const byId = new Map(versions.map((v) => [v.id, v]));
    return ids.map((id) => byId.get(id)).filter((v): v is ClientVersion => !!v);
  }, [repo, versions]);

  /** The version just before the current one on this branch, which Undo brings back. */
  const previousVersion = useMemo(() => {
    if (!currentVersion) return null;
    const i = branchVersions.findIndex((v) => v.id === currentVersion.id);
    if (i > 0) return branchVersions[i - 1];
    return i === 0 ? null : [...versions].filter((v) => v.number < currentVersion.number).sort((a, b) => b.number - a.number)[0] ?? null;
  }, [branchVersions, versions, currentVersion]);

  /** Commit subjects: the conventional-commit line an edit carried, or the version's summary. */
  const commitSubjects = useMemo(() => {
    const byNumber = new Map<number, string>();
    for (const m of messages) {
      const d = m.data as { version?: number; commit?: string } | null;
      if (m.kind === "edit" && d?.version && d.commit) byNumber.set(d.version, d.commit);
    }
    return Object.fromEntries(versions.map((v) => [v.id, byNumber.get(v.number) ?? v.summary])) as Record<string, string>;
  }, [messages, versions]);

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

  const addConnection = useCallback((c: ConnectionView) => {
    setConnections((list) => [c, ...list.filter((x) => x.id !== c.id)]);
    // Connecting GitHub anywhere in the Workspace (the agent editor, too) is connecting it for the chip.
    if (c.integrationId === "github") setGithubLogin(c.account.replace(/^@/, ""));
  }, []);

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
          land({ version: res.version, message: res.message, plan: res.plan, repo: res.repo });
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

  // ---------------------------------------------------------------------------------------------
  // GitHub (simulated): link, push, pull, branches, pull requests

  const addMessage = useCallback((m: ClientMessage | null | undefined) => {
    if (m) setMessages((list) => [...list, m]);
  }, []);

  /**
   * Links a new or existing repo. The sheet plays its progress first, then calls `adopt()` to show
   * the linked repo, so "Pushing 23 files" isn't skipped.
   */
  const linkRepo = useCallback(
    async (input: LinkInput) => {
      const res = await linkRepository(project.id, { ...input, uiMode });
      if (!res.ok) return res;
      return {
        ...res,
        adopt: () => {
          setRepo(res.repo);
          addMessage(res.message);
        },
      };
    },
    [addMessage, project.id, uiMode],
  );

  const unlinkRepo = useCallback(async () => {
    try {
      const res = await unlinkRepository(project.id);
      setRepo(null);
      addMessage(res.message);
    } catch {
      toast.error("Couldn't unlink the repository");
    }
  }, [addMessage, project.id]);

  const pushRepo = useCallback(async () => {
    if (!repo) return false;
    setPushing(true);
    const started = Date.now();
    try {
      const res = await pushRepository(project.id);
      await wait(Math.max(0, 900 - (Date.now() - started)));
      if (!res.ok) {
        toast.error("Push rejected", { description: res.error });
        return false;
      }
      setRepo(res.repo);
      toast.success(
        res.count === 0
          ? `Published ${res.repo.branch}`
          : `Pushed ${res.count} ${res.count === 1 ? "commit" : "commits"} to origin/${res.repo.branch}`,
      );
      return true;
    } catch {
      toast.error("Couldn't push", { description: "Please try again." });
      return false;
    } finally {
      setPushing(false);
    }
  }, [project.id, repo]);

  const pullRepo = useCallback(async () => {
    if (!repo || thinking) return false;
    try {
      const res = await think([`Fetching origin/${repo.branch}`, "Merging 1 commit"], 1400, () => pullRepository(project.id));
      if (!res.ok) {
        toast(res.error);
        return false;
      }
      land(res);
      toast.success("Pulled 1 commit", { description: `Saved as v${res.version.number}.` });
      return true;
    } catch {
      toast.error("Couldn't pull", { description: "Please try again." });
      return false;
    }
  }, [land, project.id, repo, think, thinking]);

  const setAutoCommit = useCallback(
    async (on: boolean) => {
      if (!repo) return;
      const before = repo;
      setRepo({ ...repo, autoCommit: on });
      try {
        const res = await setAutoCommitAction(project.id, on);
        if (!res.ok) throw new Error(res.error);
        setRepo(res.repo);
        if (res.pushed > 0) {
          flashPushing();
          toast.success(`Pushed ${res.pushed} waiting ${res.pushed === 1 ? "commit" : "commits"}`);
        }
      } catch {
        setRepo(before);
        toast.error("Couldn't change auto-commit");
      }
    },
    [flashPushing, project.id, repo],
  );

  const simulateTeammate = useCallback(async () => {
    try {
      const res = await simulateTeammatePush(project.id);
      if (!res.ok) throw new Error(res.error);
      setRepo(res.repo);
      toast(`${res.repo.defaultBranch} has a new commit on GitHub`, { description: "Maya Chen pushed a README change. Pull to get it." });
    } catch {
      toast.error("Couldn't simulate the push");
    }
  }, [project.id]);

  /** After a switch or a merge the app shows that branch's latest version. */
  const moveTo = useCallback((versionId: string, nextPlan: Plan | null) => {
    setCurrentVersionId(versionId);
    if (nextPlan) setPlan(nextPlan);
    setPlanDirty(false);
    setPreviewVersionId(null);
    setPreviewPage(null);
    setProject((p) => ({ ...p, stage: "ready" }));
  }, []);

  const newBranch = useCallback(
    async (name: string) => {
      const res = await createBranchAction(project.id, name);
      if (res.ok) {
        setRepo(res.repo);
        addMessage(res.message);
      }
      return res;
    },
    [addMessage, project.id],
  );

  const switchBranch = useCallback(
    async (name: string) => {
      try {
        const res = await switchBranchAction(project.id, name);
        if (!res.ok) {
          toast(res.error);
          return false;
        }
        setRepo(res.repo);
        moveTo(res.currentVersionId, res.plan);
        addMessage(res.message);
        return true;
      } catch {
        toast.error("Couldn't switch branches");
        return false;
      }
    },
    [addMessage, moveTo, project.id],
  );

  const openPr = useCallback(
    async (input: { title: string; body: string }) => {
      const res = await openPrAction(project.id, input);
      if (res.ok) {
        setRepo(res.repo);
        addMessage(res.message);
      }
      return res;
    },
    [addMessage, project.id],
  );

  const mergePr = useCallback(
    async (number: number) => {
      try {
        const res = await mergePrAction(project.id, number);
        if (!res.ok) {
          toast(res.error);
          return false;
        }
        if (res.version) addVersion(res.version, res.repo);
        else setRepo(res.repo);
        moveTo(res.currentVersionId, res.plan);
        addMessage(res.message);
        toast.success(`Merged #${number}`, { description: `You're on ${res.repo.branch} now.` });
        return true;
      } catch {
        toast.error("Couldn't merge the pull request");
        return false;
      }
    },
    [addMessage, addVersion, moveTo, project.id],
  );

  const closePr = useCallback(
    async (number: number) => {
      try {
        const res = await closePrAction(project.id, number);
        if (!res.ok) throw new Error(res.error);
        setRepo(res.repo);
      } catch {
        toast.error("Couldn't close the pull request");
      }
    },
    [project.id],
  );

  const saveCode = useCallback(
    async (path: string, content: string) => {
      const res = await saveFile(project.id, path, content);
      addVersion(res.version, res.repo);
      setMessages((m) => [...m, res.message]);
      setPlan(res.plan);
      toast.success(`Saved ${path.split("/").pop()} as v${res.version.number}`);
    },
    [addVersion, project.id],
  );

  return {
    project,
    setProject,
    repo,
    git,
    githubLogin,
    setGithubLogin,
    pushing,
    teammateArrived,
    branchVersions,
    commitSubjects,
    linkRepo,
    unlinkRepo,
    pushRepo,
    pullRepo,
    setAutoCommit,
    simulateTeammate,
    newBranch,
    switchBranch,
    openPr,
    mergePr,
    closePr,
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
