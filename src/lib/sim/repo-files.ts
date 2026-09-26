import type { ResolvedImport } from "./github";

/**
 * A handful of real-looking files from each simulated repository. They're kept on import (as file
 * overrides, so they survive regeneration) next to the files Architect generates. Server-only in
 * practice: the import page never needs them.
 */

const pkg = (v: object) => JSON.stringify(v, null, 2) + "\n";

const env = (keys: string[], comment: string) => `# ${comment}\n${keys.map((k) => `${k}=`).join("\n")}\n`;

function supportBot(): Record<string, string> {
  return {
    "package.json": pkg({
      name: "support-bot",
      private: true,
      version: "0.4.2",
      scripts: { dev: "next dev", build: "prisma generate && next build", start: "next start", "db:migrate": "prisma migrate deploy" },
      dependencies: { "@prisma/client": "^5.22.0", langchain: "^0.3.5", "@langchain/openai": "^0.3.11", next: "14.2.15", "next-auth": "^4.24.10", react: "^18.3.1", "react-dom": "^18.3.1", zod: "^3.23.8" },
      devDependencies: { prisma: "^5.22.0", typescript: "^5.6.3", "@types/react": "^18.3.11" },
    }),
    "README.md": `# support-bot

A support inbox for our customers. New tickets land in the inbox, and an AI agent drafts a reply from our help docs for a person to approve.

## Setup

\`\`\`bash
pnpm install
cp .env.example .env   # fill in the three keys
pnpm db:migrate
pnpm dev
\`\`\`

## How it works

- \`app/inbox\` lists open tickets; \`app/tickets/[id]\` shows one ticket with the agent's draft.
- \`lib/agent.ts\` is the LangChain agent. It retrieves help articles and drafts a reply.
- \`prisma/schema.prisma\` holds tickets, customers and messages.
`,
    ".env.example": env(["DATABASE_URL", "OPENAI_API_KEY", "NEXTAUTH_SECRET"], "Copy to .env and fill in"),
    "prisma/schema.prisma": `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Customer {
  id        String    @id @default(cuid())
  name      String
  email     String    @unique
  plan      String    @default("Starter")
  tickets   Ticket[]
  createdAt DateTime  @default(now())
}

model Ticket {
  id         String    @id @default(cuid())
  subject    String
  status     String    @default("Open")
  priority   String    @default("Normal")
  customer   Customer  @relation(fields: [customerId], references: [id])
  customerId String
  messages   Message[]
  createdAt  DateTime  @default(now())
}

model Message {
  id        String   @id @default(cuid())
  body      String
  author    String
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  ticketId  String
  createdAt DateTime @default(now())
}
`,
    "lib/db.ts": `import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
`,
    "lib/agent.ts": `import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { db } from "./db";

const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.2 });

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a friendly support agent. Draft a reply using only the help articles provided. If you're unsure, say a person will follow up."],
  ["human", "Ticket: {subject}\\n\\nThread:\\n{thread}\\n\\nHelp articles:\\n{articles}"],
]);

export async function draftReply(ticketId: string, articles: string[]) {
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { messages: true } });
  const thread = ticket.messages.map((m) => \`\${m.author}: \${m.body}\`).join("\\n");
  const chain = prompt.pipe(model);
  const res = await chain.invoke({ subject: ticket.subject, thread, articles: articles.join("\\n---\\n") });
  return String(res.content);
}
`,
    "app/api/chat/route.ts": `import { NextResponse } from "next/server";
import { draftReply } from "@/lib/agent";

export async function POST(request: Request) {
  const { ticketId, articles } = await request.json();
  const reply = await draftReply(ticketId, articles ?? []);
  return NextResponse.json({ reply });
}
`,
    "app/tickets/[id]/page.tsx": `import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export default async function TicketPage({ params }: { params: { id: string } }) {
  const ticket = await db.ticket.findUnique({ where: { id: params.id }, include: { customer: true, messages: true } });
  if (!ticket) notFound();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">{ticket.subject}</h1>
      <p className="text-sm text-gray-500">{ticket.customer.name} · {ticket.status}</p>
      <ol className="mt-6 space-y-4">
        {ticket.messages.map((m) => (
          <li key={m.id} className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{m.author}</p>
            <p>{m.body}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
`,
    "middleware.ts": `export { default } from "next-auth/middleware";

export const config = { matcher: ["/inbox/:path*", "/tickets/:path*", "/customers/:path*", "/settings/:path*"] };
`,
  };
}

function marketingSite(): Record<string, string> {
  return {
    "package.json": pkg({
      name: "marketing-site",
      private: true,
      version: "2.3.0",
      scripts: { dev: "next dev --turbo", build: "next build", start: "next start", lint: "next lint" },
      dependencies: { "@next/mdx": "^15.0.3", next: "15.0.3", "posthog-js": "^1.180.0", react: "19.0.0-rc", "react-dom": "19.0.0-rc" },
      devDependencies: { tailwindcss: "^3.4.14", typescript: "^5.6.3", postcss: "^8.4.47" },
    }),
    "README.md": `# marketing-site

Our public website: the landing page, pricing, the blog and customer stories.

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

Blog posts live in \`content/blog\` as MDX. Analytics go to PostHog; set \`NEXT_PUBLIC_POSTHOG_KEY\` to turn them on.
`,
    ".env.example": env(["NEXT_PUBLIC_POSTHOG_KEY"], "Analytics. Leave empty to turn tracking off."),
    "next.config.ts": `import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const withMDX = createMDX({});

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  images: { remotePatterns: [{ hostname: "images.example.com" }] },
};

export default withMDX(nextConfig);
`,
    "tailwind.config.ts": `import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx,mdx}", "./components/**/*.{ts,tsx}", "./content/**/*.mdx"],
  theme: { extend: { colors: { brand: { DEFAULT: "#2563eb", dark: "#1e40af" } } } },
} satisfies Config;
`,
    "lib/posthog.ts": `"use client";

import posthog from "posthog-js";

export function initAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === "undefined") return;
  posthog.init(key, { api_host: "https://eu.i.posthog.com", capture_pageview: true });
}
`,
    "content/blog/pricing-that-grows.mdx": `---
title: Pricing that grows with you
author: Omar Haddad
date: 2026-09-12
---

We've simplified our plans to three: Starter, Team and Business. Everyone on an old plan moves to the closest new one automatically, and nobody pays more.
`,
    "app/blog/[slug]/page.tsx": `import { notFound } from "next/navigation";

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { default: Content } = await import(\`@/content/blog/\${slug}.mdx\`);
    return (
      <article className="prose mx-auto max-w-2xl py-16">
        <Content />
      </article>
    );
  } catch {
    notFound();
  }
}
`,
  };
}

function crmExport(): Record<string, string> {
  return {
    "package.json": pkg({
      name: "vite_react_shadcn_ts",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
      dependencies: { "@supabase/supabase-js": "^2.45.4", "@tanstack/react-query": "^5.56.2", "lucide-react": "^0.451.0", react: "^18.3.1", "react-dom": "^18.3.1", "react-router-dom": "^6.26.2" },
      devDependencies: { "@vitejs/plugin-react-swc": "^3.5.0", tailwindcss: "^3.4.11", typescript: "^5.5.3", vite: "^5.4.1" },
    }),
    "README.md": `# CRM

Exported from Lovable.

## Run it

\`\`\`sh
npm i
npm run dev
\`\`\`

Data and sign-in come from Supabase. Set \`VITE_SUPABASE_URL\` and \`VITE_SUPABASE_ANON_KEY\` in \`.env\`.
`,
    ".env.example": env(["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"], "From your Supabase project's API settings"),
    "src/integrations/supabase/client.ts": `import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
`,
    "src/hooks/use-contacts.ts": `import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*, companies(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
`,
    "supabase/migrations/20260801120000_init.sql": `create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  industry text,
  created_at timestamptz default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  company_id uuid references companies(id),
  stage text default 'Lead',
  created_at timestamptz default now()
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company_id uuid references companies(id),
  amount numeric(12, 2),
  stage text default 'Discovery',
  close_date date
);
`,
    "components.json": pkg({ $schema: "https://ui.shadcn.com/schema.json", style: "default", tsx: true, tailwind: { config: "tailwind.config.ts", css: "src/index.css", baseColor: "slate" }, aliases: { components: "@/components", utils: "@/lib/utils" } }),
  };
}

function invoiceApi(): Record<string, string> {
  return {
    "backend/requirements.txt": "fastapi==0.115.4\nuvicorn[standard]==0.32.0\nsqlalchemy==2.0.36\nalembic==1.14.0\npsycopg[binary]==3.2.3\nstripe==11.2.0\npydantic-settings==2.6.1\n",
    "README.md": `# invoice-api

Invoices, clients and payments over a small REST API. Payments go through Stripe.

\`\`\`bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
\`\`\`

Open http://localhost:8000/docs for the interactive API docs.
`,
    ".env.example": env(["DATABASE_URL", "STRIPE_SECRET_KEY"], "Copy to backend/.env"),
    "backend/app/main.py": `from fastapi import FastAPI

from .routers import clients, invoices, payments

app = FastAPI(title="Invoice API", version="1.3.0")
app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
app.include_router(clients.router, prefix="/clients", tags=["clients"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])


@app.get("/health")
def health():
    return {"ok": True}
`,
    "backend/app/models.py": `from datetime import date
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Client(Base):
    __tablename__ = "clients"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="client")


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(20), unique=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(20), default="Draft")
    due: Mapped[date]
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    client: Mapped[Client] = relationship(back_populates="invoices")


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(64))
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(20))
`,
    "backend/app/routers/invoices.py": `from fastapi import APIRouter, HTTPException

from ..db import session
from ..models import Invoice

router = APIRouter()


@router.get("")
def list_invoices(status: str | None = None):
    with session() as s:
        q = s.query(Invoice)
        if status:
            q = q.filter(Invoice.status == status)
        return q.order_by(Invoice.due).all()


@router.get("/{invoice_id}")
def get_invoice(invoice_id: int):
    with session() as s:
        invoice = s.get(Invoice, invoice_id)
        if invoice is None:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return invoice
`,
    "alembic/versions/0001_init.py": `"""Create clients, invoices and payments."""

revision = "0001"
down_revision = None


def upgrade() -> None:
    from alembic import op
    import sqlalchemy as sa

    op.create_table("clients", sa.Column("id", sa.Integer, primary_key=True), sa.Column("name", sa.String(120)), sa.Column("email", sa.String(200), unique=True))
    op.create_table("invoices", sa.Column("id", sa.Integer, primary_key=True), sa.Column("number", sa.String(20), unique=True), sa.Column("amount", sa.Numeric(12, 2)), sa.Column("status", sa.String(20)), sa.Column("due", sa.Date), sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id")))
`,
  };
}

function agentPlayground(): Record<string, string> {
  return {
    "package.json": pkg({
      name: "agent-playground",
      private: true,
      version: "0.2.0",
      type: "module",
      scripts: { dev: "mastra dev", build: "mastra build", start: "node .mastra/output/index.mjs" },
      dependencies: { "@ai-sdk/anthropic": "^1.0.2", "@mastra/core": "^0.17.0", "@mastra/memory": "^0.15.0", hono: "^4.6.10", zod: "^3.23.8" },
      devDependencies: { mastra: "^0.17.0", typescript: "^5.6.3" },
    }),
    "README.md": `# agent-playground

Two Mastra agents that work together: a **Researcher** that searches the web and a **Writer** that turns its notes into a draft.

\`\`\`bash
pnpm install
pnpm dev   # opens the Mastra playground on http://localhost:4111
\`\`\`
`,
    ".env.example": env(["ANTHROPIC_API_KEY"], "Model provider key"),
    "src/mastra/index.ts": `import { Mastra } from "@mastra/core";
import { researcher } from "./agents/researcher";
import { writer } from "./agents/writer";

export const mastra = new Mastra({
  agents: { researcher, writer },
});
`,
    "src/mastra/tools/web-search.ts": `import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const webSearch = createTool({
  id: "web-search",
  description: "Search the web and return the top results with their URLs.",
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ results: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })) }),
  execute: async ({ context }) => {
    const res = await fetch(\`https://search.example.com/api?q=\${encodeURIComponent(context.query)}\`);
    return res.json();
  },
});
`,
    "src/server.ts": `import { Hono } from "hono";
import { mastra } from "./mastra";

const app = new Hono();

app.post("/api/runs", async (c) => {
  const { input } = await c.req.json();
  const notes = await mastra.getAgent("researcher").generate(input);
  const draft = await mastra.getAgent("writer").generate(notes.text);
  return c.json({ notes: notes.text, draft: draft.text });
});

export default app;
`,
  };
}

function docsSite(): Record<string, string> {
  return {
    "package.json": pkg({
      name: "docs-site",
      type: "module",
      version: "1.8.0",
      scripts: { dev: "astro dev", build: "astro build", preview: "astro preview" },
      dependencies: { "@astrojs/mdx": "^4.0.1", "@astrojs/starlight": "^0.29.2", astro: "^5.0.2" },
    }),
    "README.md": `# docs-site

Product documentation and the changelog, built with Astro and Starlight.

\`\`\`bash
npm install
npm run dev
\`\`\`

Docs live in \`src/content/docs\`, releases in \`src/content/changelog\`.
`,
    "astro.config.mjs": `import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [starlight({ title: "Docs", sidebar: [{ label: "Guides", autogenerate: { directory: "guides" } }] }), mdx()],
});
`,
    "src/content/config.ts": `import { defineCollection, z } from "astro:content";
import { docsSchema } from "@astrojs/starlight/schema";

export const collections = {
  docs: defineCollection({ schema: docsSchema() }),
  changelog: defineCollection({ schema: z.object({ version: z.string(), date: z.date(), highlights: z.string() }) }),
};
`,
    "src/content/docs/getting-started.mdx": `---
title: Getting started
---

Create an account, add your first project and invite your team. It takes about five minutes.
`,
    "src/content/changelog/v2-6-0.md": `---
version: v2.6.0
date: 2026-09-18
highlights: Agent handoffs
---

Agents can now hand a conversation to another agent, with the full history.
`,
  };
}

function mobileApp(): Record<string, string> {
  return {
    "package.json": pkg({
      name: "mobile-app",
      main: "expo-router/entry",
      version: "1.2.0",
      scripts: { start: "expo start", ios: "expo run:ios", android: "expo run:android" },
      dependencies: { expo: "~53.0.0", "expo-router": "~5.0.0", react: "19.0.0", "react-native": "0.79.2", "react-native-safe-area-context": "5.4.0" },
      devDependencies: { typescript: "~5.8.3", "@types/react": "~19.0.10" },
    }),
    "README.md": `# mobile-app

A habit tracker for iOS and Android, built with Expo.

\`\`\`bash
npm install
npx expo start
\`\`\`

Scan the QR code with Expo Go, or press \`i\` for the iOS simulator.
`,
    ".env.example": env(["EXPO_PUBLIC_API_URL"], "Where the app's API lives"),
    "app.json": pkg({ expo: { name: "Habits", slug: "habits", scheme: "habits", version: "1.2.0", orientation: "portrait", ios: { bundleIdentifier: "com.example.habits" }, android: { package: "com.example.habits" }, plugins: ["expo-router"] } }),
    "app/(tabs)/_layout.tsx": `import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="habits" options={{ title: "Habits" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
`,
    "app/(tabs)/habits.tsx": `import { FlatList, Text, View } from "react-native";
import { useHabits } from "@/lib/api";

export default function Habits() {
  const { data } = useHabits();
  return (
    <FlatList
      data={data}
      keyExtractor={(h) => h.id}
      renderItem={({ item }) => (
        <View style={{ padding: 16, borderBottomWidth: 1, borderColor: "#eee" }}>
          <Text style={{ fontWeight: "600" }}>{item.name}</Text>
          <Text>{item.streak} day streak</Text>
        </View>
      )}
    />
  );
}
`,
    "lib/api.ts": `import { useEffect, useState } from "react";

const API = process.env.EXPO_PUBLIC_API_URL;

export type Habit = { id: string; name: string; streak: number };

export function useHabits() {
  const [data, setData] = useState<Habit[]>([]);
  useEffect(() => {
    fetch(\`\${API}/habits\`).then((r) => r.json()).then(setData);
  }, []);
  return { data };
}
`,
  };
}

function generic(r: ResolvedImport): Record<string, string> {
  const name = r.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return {
    "package.json": pkg({
      name,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: { dev: "vite", build: "vite build" },
      dependencies: { react: "^18.3.1", "react-dom": "^18.3.1", "react-router-dom": "^6.26.2" },
      devDependencies: { "@vitejs/plugin-react": "^4.3.1", typescript: "^5.5.3", vite: "^5.4.1" },
    }),
    "README.md": `# ${r.name}\n\nImported from ${r.fullName}.\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
  };
}

export function repoFiles(r: ResolvedImport): Record<string, string> {
  if (!r.repo) return generic(r);
  switch (r.repo.name) {
    case "support-bot":
      return supportBot();
    case "marketing-site":
      return marketingSite();
    case "crm-lovable-export":
      return crmExport();
    case "invoice-api":
      return invoiceApi();
    case "agent-playground":
      return agentPlayground();
    case "docs-site":
      return docsSite();
    case "mobile-app":
      return mobileApp();
    default:
      return generic(r);
  }
}
