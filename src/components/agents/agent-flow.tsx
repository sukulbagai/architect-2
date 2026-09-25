"use client";

import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { Controls, Handle, MarkerType, Panel, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { AlertTriangle, BookOpen, Database, Globe, Server, SquareTerminal, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";
import { isHttpTool, isMcpTool, toolIntegration, toolLabel } from "@/lib/sim/agents";
import { frameworkLabel } from "@/lib/sim/frameworks";
import { MODELS } from "@/lib/constants";
import type { ConnectionView, Integration } from "@/lib/integrations";
import type { Plan, PlanAgent } from "@/lib/sim/types";
import { PageIcon } from "@/components/preview/bits";
import { AgentAvatar } from "./agent-bits";
import { toolConnected } from "./tools-section";

type PageData = { name: string; icon: string };
type AgentData = { agent: PlanAgent; selected: boolean; warn: boolean };
type ToolData = { tool: string };
type OutputData = { label: string; integration?: Pick<Integration, "mono" | "tint"> };

// "result", not "output": xyflow ships default styles for a built-in "output" node type.
type FlowNode = Node<PageData, "page"> | Node<AgentData, "agent"> | Node<ToolData, "tool"> | Node<OutputData, "result">;

/** Pages sit close to the first agents; agents get more room so handoff lines read clearly. */
const PAGE_GAP = 236;
const AGENT_COL = 292;
const AGENT_H = 76;
const TOOL_H = 30;
const PAGE_H = 52;
const OUT_H = 52;
const GAP = 30;

const handle = "!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-border-strong";

function PageNodeView({ data }: NodeProps<Node<PageData, "page">>) {
  return (
    <div className="flex w-[176px] items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 shadow-card">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <PageIcon name={data.icon} className="size-3" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{data.name}</span>
        <span className="annotation block !text-[9px]">Page</span>
      </span>
      <Handle type="source" position={Position.Right} className={handle} isConnectable={false} />
    </div>
  );
}

const MODEL_SHORT: Record<string, string> = Object.fromEntries(MODELS.map((m) => [m.id, m.label.replace("Claude ", "")]));

function AgentNodeView({ data }: NodeProps<Node<AgentData, "agent">>) {
  const a = data.agent;
  return (
    <div
      className={cn(
        "w-[212px] cursor-pointer rounded-xl border bg-card px-3 py-2.5 shadow-card transition-[border-color,box-shadow]",
        data.selected ? "border-brand ring-3 ring-brand/15" : "border-border-strong hover:border-foreground/30",
      )}
    >
      <Handle type="target" position={Position.Left} className={handle} isConnectable={false} />
      <div className="flex items-center gap-2">
        <AgentAvatar id={a.id} name={a.name} className="size-7 rounded-md text-[10px]" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.name}</span>
        {data.warn && <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-label="A tool isn't connected" />}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="rounded-md border border-border bg-background px-1.5 py-px font-mono text-[10px] text-muted-foreground">{frameworkLabel(a.framework)}</span>
        <span className="truncate font-mono text-[10px] text-subtle-foreground">{MODEL_SHORT[a.model] ?? a.model}</span>
      </div>
      <Handle type="source" position={Position.Right} className={handle} isConnectable={false} />
      <Handle id="tools" type="source" position={Position.Bottom} className={cn(handle, "!left-5")} isConnectable={false} />
    </div>
  );
}

function ToolNodeView({ data }: NodeProps<Node<ToolData, "tool">>) {
  const t = data.tool;
  const Icon = isMcpTool(t) ? Server : isHttpTool(t) ? Webhook : t === "Web search" ? Globe : t === "Knowledge base" ? BookOpen : SquareTerminal;
  return (
    <div className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 text-[11px] whitespace-nowrap text-muted-foreground">
      <Handle type="target" position={Position.Left} className={handle} isConnectable={false} />
      <Icon className="size-3" />
      {toolLabel(t)}
      {isMcpTool(t) && <span className="font-mono text-[9px] text-subtle-foreground">MCP</span>}
    </div>
  );
}

function OutputNodeView({ data }: NodeProps<Node<OutputData, "result">>) {
  return (
    <div className="flex w-[176px] items-center gap-2 rounded-lg border border-dashed border-border-strong bg-background px-2.5 py-2">
      <Handle type="target" position={Position.Left} className={handle} isConnectable={false} />
      {data.integration ? (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-[9px] font-semibold text-white" style={{ background: data.integration.tint }} aria-hidden="true">
          {data.integration.mono}
        </span>
      ) : (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Database className="size-3" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{data.label}</span>
        <span className="annotation block !text-[9px]">Output</span>
      </span>
    </div>
  );
}

const nodeTypes = { page: PageNodeView, agent: AgentNodeView, tool: ToolNodeView, result: OutputNodeView };

/** Columns: pages that use agents, then agents ordered by handoffs, then where results go. */
function layout(plan: Pick<Plan, "pages" | "agents" | "data">, selectedId: string | null, connections: ConnectionView[] | null) {
  const agents = plan.agents;
  const ids = new Set(agents.map((a) => a.id));
  const depth: Record<string, number> = Object.fromEntries(agents.map((a) => [a.id, 0]));
  for (let pass = 0; pass < agents.length; pass++) {
    for (const a of agents) {
      for (const h of a.handoffs ?? []) {
        if (ids.has(h) && h !== a.id && depth[a.id] + 1 > depth[h] && depth[a.id] + 1 < agents.length) depth[h] = depth[a.id] + 1;
      }
    }
  }
  const maxDepth = Math.max(0, ...Object.values(depth));
  const triggers = plan.pages.filter((p) => p.agent && ids.has(p.agent));

  type Out = { id: string; data: OutputData; from: Set<string> };
  const outputs = new Map<string, Out>();
  const toolsOf = (a: PlanAgent) => a.tools.filter((t) => !toolIntegration(t));
  for (const a of agents) {
    for (const t of a.tools) {
      const i = toolIntegration(t);
      if (!i) continue;
      const id = `out-int-${i.id}`;
      if (!outputs.has(id)) outputs.set(id, { id, data: { label: i.name, integration: i }, from: new Set() });
      outputs.get(id)!.from.add(a.id);
    }
    for (const p of plan.pages.filter((p) => p.agent === a.id && p.collection)) {
      const c = plan.data.find((d) => d.id === p.collection);
      if (!c) continue;
      const id = `out-col-${c.id}`;
      if (!outputs.has(id)) outputs.set(id, { id, data: { label: `Saved to ${c.name}` }, from: new Set() });
      outputs.get(id)!.from.add(a.id);
    }
  }

  const columns: { h: number; place: (top: number) => FlowNode[] }[] = [];
  // Pages
  columns.push({
    h: triggers.length * (PAGE_H + GAP) - GAP,
    place: (top) => triggers.map((p, i) => ({ id: `page-${p.id}`, type: "page", position: { x: 0, y: top + i * (PAGE_H + GAP) }, data: { name: p.name, icon: p.icon } })),
  });
  // Agents, one column per handoff depth
  for (let d = 0; d <= maxDepth; d++) {
    const col = agents.filter((a) => depth[a.id] === d);
    const blockH = (a: PlanAgent) => AGENT_H + (toolsOf(a).length ? 10 + toolsOf(a).length * TOOL_H : 0);
    columns.push({
      h: col.reduce((s, a) => s + blockH(a) + GAP, 0) - GAP,
      place: (top) => {
        const out: FlowNode[] = [];
        let y = top;
        const x = PAGE_GAP + d * AGENT_COL;
        for (const a of col) {
          const warn = connections ? a.tools.some((t) => !toolConnected(t, connections)) : false;
          out.push({ id: `agent-${a.id}`, type: "agent", position: { x, y }, data: { agent: a, selected: a.id === selectedId, warn } });
          toolsOf(a).forEach((t, i) => out.push({ id: `tool-${a.id}-${i}`, type: "tool", position: { x: x + 36, y: y + AGENT_H + 10 + i * TOOL_H }, data: { tool: t } }));
          y += blockH(a) + GAP;
        }
        return out;
      },
    });
  }
  // Outputs
  const outs = [...outputs.values()];
  columns.push({
    h: outs.length * (OUT_H + GAP) - GAP,
    place: (top) => outs.map((o, i) => ({ id: o.id, type: "result", position: { x: PAGE_GAP + (maxDepth + 1) * AGENT_COL, y: top + i * (OUT_H + GAP) }, data: o.data })),
  });

  const tallest = Math.max(...columns.map((c) => c.h));
  const nodes = columns.flatMap((c) => c.place((tallest - c.h) / 2));

  const edges: Edge[] = [];
  const arrow = (color: string) => ({ type: MarkerType.ArrowClosed, width: 14, height: 14, color });
  for (const p of triggers) {
    edges.push({ id: `e-page-${p.id}`, source: `page-${p.id}`, target: `agent-${p.agent}`, type: "smoothstep", style: { stroke: "var(--border-strong)", strokeWidth: 1.25 }, markerEnd: arrow("var(--border-strong)") });
  }
  for (const a of agents) {
    for (const h of a.handoffs ?? []) {
      if (!ids.has(h) || h === a.id) continue;
      edges.push({
        id: `e-handoff-${a.id}-${h}`,
        source: `agent-${a.id}`,
        target: `agent-${h}`,
        type: "smoothstep",
        animated: true,
        style: { stroke: "var(--brand)", strokeWidth: 1.5, strokeDasharray: "5 4" },
        markerEnd: arrow("var(--brand)"),
      });
    }
    toolsOf(a).forEach((_, i) =>
      edges.push({ id: `e-tool-${a.id}-${i}`, source: `agent-${a.id}`, sourceHandle: "tools", target: `tool-${a.id}-${i}`, type: "smoothstep", style: { stroke: "var(--border-strong)", strokeWidth: 1 } }),
    );
  }
  for (const o of outs) {
    for (const from of o.from) {
      edges.push({ id: `e-out-${from}-${o.id}`, source: `agent-${from}`, target: o.id, type: "smoothstep", style: { stroke: "var(--border-strong)", strokeWidth: 1.25 }, markerEnd: arrow("var(--border-strong)") });
    }
  }
  return { nodes, edges };
}

/**
 * The agents as a read-only graph: page → agent → handoff → tool → output. Clicking an agent
 * selects it. `compact` is the smaller version in the Plan tab, which lets the page scroll.
 */
export function AgentFlow({
  plan,
  selectedId = null,
  onSelect,
  connections = null,
  compact = false,
  className,
}: {
  plan: Pick<Plan, "pages" | "agents" | "data">;
  selectedId?: string | null;
  onSelect?: (agentId: string) => void;
  connections?: ConnectionView[] | null;
  compact?: boolean;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const { nodes, edges } = layout(plan, selectedId, connections);
  return (
    <div className={cn("architect-flow h-full w-full", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        fitView
        // On a phone the whole graph can't fit legibly: stay readable and let people pan.
        fitViewOptions={{ padding: compact ? 0.08 : 0.1, maxZoom: 1.05, minZoom: 0.6 }}
        minZoom={0.3}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        zoomOnScroll={!compact}
        panOnScroll={false}
        preventScrolling={!compact}
        zoomOnDoubleClick={false}
        onNodeClick={(_, node) => {
          if (node.type === "agent") onSelect?.((node.data as AgentData).agent.id);
        }}
        proOptions={{ hideAttribution: false }}
      >
        <Controls showInteractive={false} position="bottom-left" />
        {!compact && (
          <Panel position="top-right" className="!m-3 hidden items-center gap-3 sm:flex rounded-md bg-background/85 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-card ring-1 ring-border backdrop-blur-sm">
            <span className="flex items-center gap-1.5">
              <svg width="22" height="6" aria-hidden="true">
                <path d="M0 3h22" stroke="var(--border-strong)" strokeWidth="1.5" />
              </svg>
              Uses
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="22" height="6" aria-hidden="true">
                <path d="M0 3h22" stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="5 4" />
              </svg>
              Hands off to
            </span>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
