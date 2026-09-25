"use client";

import { runWidget } from "@/lib/actions/embed";
import { WidgetChat } from "./widget-chat";

/** The widget on a host page: the same chat as the preview, with replies from the public runner. */
export function EmbedChat({ id, name, greeting, color }: { id: string; name: string; greeting: string; color: string }) {
  return <WidgetChat name={name} greeting={greeting} color={color} send={(text, turn) => runWidget(id, text, turn)} className="h-dvh" />;
}
