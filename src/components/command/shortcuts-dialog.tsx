"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

const GROUPS: { title: string; items: [string[], string, string?][] }[] = [
  {
    title: "Everywhere",
    items: [
      [["⌘", "K"], "Open the command palette"],
      [["?"], "Show these shortcuts"],
    ],
  },
  {
    title: "Workspace",
    items: [
      [["⌘", "\\"], "Show or hide the chat"],
      [["⌘", "J"], "Show or hide Terminal, Logs and Problems", "Pro"],
      [["V"], "Select an element in the preview to edit it"],
      [["Esc"], "Leave select mode"],
      [["⌘", "S"], "Save the open file as a new version", "Pro"],
    ],
  },
  {
    title: "Chat",
    items: [
      [["↵"], "Send"],
      [["⇧", "↵"], "New line"],
      [["/"], "Commands: /theme, /page, /undo, /fix, /test…"],
      [["@"], "Mention a file to point a change at it", "Pro"],
    ],
  },
  {
    title: "Reviewing a change",
    items: [
      [["J"], "Next file"],
      [["K"], "Previous file"],
      [["X"], "Include or leave out the file"],
      [["⌘", "↵"], "Accept the selected files"],
    ],
  },
  {
    title: "Terminal",
    items: [
      [["↑", "↓"], "Go through history"],
      [["Tab"], "Complete a command or path"],
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto scrollbar-thin sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>On Windows and Linux, use Ctrl where you see ⌘.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="annotation mb-2">{g.title}</h3>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {g.items.map(([keys, label, badge]) => (
                  <li key={label} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{label}</span>
                      {badge && <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">{badge}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {keys.map((k) => (
                        <Kbd key={k} className="font-mono">
                          {k}
                        </Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
