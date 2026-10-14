import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Drawer } from "@/components/ui/drawer";
import { ChevronDown, ChevronRight, CornerDownRight, Home as HomeIcon, MessageSquare, Pencil, Plus, Search, Send, X } from "lucide-react";
import { allLessons, type Lesson } from "./catalog";
import { getRoadmap, topicThreadId, type ChatMessage, type ChatThread, type State } from "./state";

type Row = { id: string; title: string; workspaceId: string; messages: ChatMessage[]; topic?: Lesson; thread?: ChatThread; parentThreadId?: string };
export function ChatsView({ state, onCreate, onOpen, onRename, onDraft, onSend, onStop, onRetry, onBranch, onContinueTopic, onHome, busyId, small }: {
  state: State; onCreate: () => void; onOpen: (id: string) => void; onRename: (id: string, title: string) => void;
  onDraft: (id: string, value: string) => void; onSend: (id: string) => void; onStop: (id: string) => void;
  onBranch: (parentId: string, message: ChatMessage, quote: string) => void; onContinueTopic: (id: string) => void; onHome: () => void; onRetry: (id: string) => void; busyId?: string; small: boolean;
}) {
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<string>();
  const [renameValue, setRenameValue] = useState("");
  const [peekOpen, setPeekOpen] = useState(false);
  const [chatListOpen, setChatListOpen] = useState(false);
  const [openedBranch, setOpenedBranch] = useState<string>();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedOrigin, setSelectedOrigin] = useState<{ threadId: string; messageId: string; quote: string }>();
  const rows = useMemo<Row[]>(() => {
    const topics: Row[] = Object.entries(state.conversations).map(([key, history]) => {
      const [enrollmentId, topicId] = [key.slice(0, key.indexOf("::")), key.slice(key.indexOf("::") + 2)];
      const enrollment = state.enrollments.find((item) => item.id === enrollmentId);
      const roadmap = enrollment && getRoadmap(enrollment.templateId);
      const topic = roadmap && allLessons(roadmap).find((item) => item.id === topicId);
      return { id: topicThreadId(key), title: history.find((message) => message.role === "learner")?.text.slice(0, 48) || topic?.title || "Lesson conversation", workspaceId: enrollmentId, messages: history.map((message) => ({ id: String(message.id), role: message.role, text: message.text, ...(message.status ? { status: message.status } : {}) })), topic };
    }).filter((row) => Boolean(row.topic));
    const threads: Row[] = state.chats.map((thread) => ({ id: thread.id, title: thread.title, workspaceId: thread.workspaceId, messages: thread.messages, thread, parentThreadId: thread.parentThreadId }));
    return [...threads, ...topics].sort((a, b) => (b.thread?.updatedAt ?? Math.max(0, ...b.messages.map((message) => Number(message.id) || 0))) - (a.thread?.updatedAt ?? Math.max(0, ...a.messages.map((message) => Number(message.id) || 0))));
  }, [state.chats, state.conversations, state.enrollments]);
  const matching = rows.filter((row) => `${row.title} ${row.topic?.title ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const visibleIds = new Set(matching.map((row) => row.id));
  const byId = new Map(rows.map((row) => [row.id, row]));
  matching.forEach((row) => { let parentId = row.parentThreadId; while (parentId && byId.has(parentId)) { visibleIds.add(parentId); parentId = byId.get(parentId)?.parentThreadId; } });
  const visible = rows.filter((row) => visibleIds.has(row.id));
  const activeId = state.activeChatId;
  const active = rows.find((row) => row.id === activeId);
  const parent = active?.parentThreadId ? rows.find((row) => row.id === active.parentThreadId) : undefined;
  const newestChild = active && childrenForAll(active.id).sort((a, b) => (b.thread?.updatedAt ?? 0) - (a.thread?.updatedAt ?? 0))[0];
  const peekRow = rows.find((row) => row.id === openedBranch) ?? parent ?? newestChild;
  const closePeek = () => { if (peekRow && busyId === peekRow.id) onStop(peekRow.id); setPeekOpen(false); };
  const children = (id: string) => visible.filter((row) => row.parentThreadId === id);
  function childrenForAll(id: string) { return rows.filter((row) => row.parentThreadId === id); }
  const previousActiveId = useRef(activeId);
  const previousNewestChildId = useRef(newestChild?.id);
  useEffect(() => {
    if (previousActiveId.current !== activeId) {
      setOpenedBranch(undefined);
      setPeekOpen(false);
    } else if (newestChild && previousNewestChildId.current !== newestChild.id) {
      setOpenedBranch(newestChild.id);
      setPeekOpen(true);
    }
    previousActiveId.current = activeId;
    previousNewestChildId.current = newestChild?.id;
  }, [activeId, newestChild?.id]);
  useEffect(() => {
    if (!activeId) return;
    const ancestors: Record<string, boolean> = {};
    if (childrenForAll(activeId).length) ancestors[activeId] = true;
    let parentId = byId.get(activeId)?.parentThreadId;
    while (parentId && byId.has(parentId)) { ancestors[parentId] = true; parentId = byId.get(parentId)?.parentThreadId; }
    if (Object.keys(ancestors).length) setExpanded((value) => ({ ...value, ...ancestors }));
  }, [activeId]);
  const ancestry = (row: Row) => {
    const chain: Row[] = []; let id = row.parentThreadId;
    while (id && byId.has(id)) { const item = byId.get(id)!; chain.unshift(item); id = item.parentThreadId; }
    return chain;
  };
  const setBranch = (id: string, message: ChatMessage) => {
    const selected = selectedOrigin?.threadId === id && selectedOrigin.messageId === message.id ? selectedOrigin.quote : "";
    onBranch(id, message, selected && message.text.includes(selected) ? selected.slice(0, 1000) : message.text.slice(0, 500));
  };
  const threadPane = (row: Row, isPeek = false) => <section key={row.id} className="flex min-h-0 min-w-0 flex-1 flex-col">
    <header className="shrink-0 border-b border-border-subtle px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-foreground-muted">{row.topic ? `Lesson · ${row.topic.title}` : row.thread?.kind === "branch" ? "Branch conversation" : row.workspaceId === "personal-workspace" ? "Personal workspace" : state.enrollments.find((item) => item.id === row.workspaceId)?.title ?? "Roadmap workspace"}</div>
          <h1 className="mt-1 truncate text-lg font-semibold">{row.title}</h1>
          {row.thread?.quote && <blockquote className="mt-2 border-l-2 border-border-strong pl-3 text-xs leading-5 text-foreground-muted">{row.thread.quote}</blockquote>}
        </div>
        <div className="flex max-w-full shrink-0 flex-wrap justify-end gap-1">{isPeek && <><Button size="sm" variant="outline" onClick={() => { onOpen(row.id); closePeek(); setChatListOpen(false); }}>Open full thread</Button><Button size="iconSm" variant="ghost" aria-label="Close side peek" onClick={closePeek}><X className="size-4"/></Button></>}{small && !isPeek && <Button size="sm" variant="outline" onClick={() => setChatListOpen(true)}>All chats</Button>}{row.topic && !isPeek && <Button size="sm" variant="outline" onClick={() => onContinueTopic(row.id)}>Continue in lesson</Button>}{parent && !isPeek && <Button size="sm" variant="outline" onClick={() => { setOpenedBranch(undefined); setPeekOpen(true); }}><CornerDownRight className="size-3.5"/> Parent</Button>}{newestChild && !isPeek && <Button size="sm" variant="outline" onClick={() => { setOpenedBranch(newestChild.id); setPeekOpen(true); }}><CornerDownRight className="size-3.5"/> Open branch</Button>}</div>
      </div>
      {!isPeek && row.thread?.kind === "branch" && <nav aria-label="Conversation ancestry" className="mt-3 flex flex-wrap items-center gap-1 text-xs text-foreground-muted">{ancestry(row).map((ancestor) => <span key={ancestor.id} className="inline-flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => { onOpen(ancestor.id); setPeekOpen(false); }}>{ancestor.title}</Button><ChevronRight className="size-3"/></span>)}<span className="truncate text-foreground">{row.title}</span></nav>}
      <div className="mt-1 text-xs text-foreground-muted">Sample replies · local preview</div>
    </header>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
      {row.messages.length ? row.messages.map((message) => <article key={message.id} className={`max-w-[94%] rounded-xl p-3 text-sm leading-6 ${message.role === "learner" ? "ml-auto bg-primary text-primary-foreground" : "border border-border-subtle bg-background-secondary"}`}>
        <div className="mb-1 text-xs font-medium">{message.role === "learner" ? "You" : "Sample tutor reply"}</div>
        <p className="whitespace-pre-wrap" onMouseUp={(event) => { const selection = window.getSelection(); const text = selection?.toString().trim(); if (selection?.anchorNode && selection.focusNode && event.currentTarget.contains(selection.anchorNode) && event.currentTarget.contains(selection.focusNode) && text && message.text.includes(text)) setSelectedOrigin({ threadId: row.id, messageId: message.id, quote: text.slice(0, 1000) }); }}>{message.text || (message.status === "streaming" ? "Thinking…" : "")}</p>
        {message.role === "tutor" && message.status !== "streaming" && <Button className="mt-2" size="sm" variant="ghost" onClick={() => setBranch(row.id, message)}><CornerDownRight className="size-3.5"/> {selectedOrigin?.threadId === row.id && selectedOrigin.messageId === message.id ? "Branch from selection" : "Branch from reply"}</Button>}
      </article>) : <div className="mx-auto max-w-md py-14 text-center"><div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-background-secondary"><MessageSquare className="size-5 text-foreground-muted"/></div><h2 className="mt-3 text-base font-medium">Start with a question</h2><p className="mt-1 text-sm text-foreground-muted">Explore an idea here. Select part of a reply to branch into a focused conversation.</p></div>}
    </div>
    {row.thread && state.chatErrors[row.id] && <div role="alert" className="mx-4 mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-background-secondary px-3 py-2 text-sm"><span>{state.chatErrors[row.id]}</span><Button size="sm" variant="outline" onClick={() => onRetry(row.id)}>Retry response</Button></div>}
    {row.thread ? <form className="shrink-0 border-t border-border-subtle bg-background px-4 py-3" onSubmit={(event) => { event.preventDefault(); if (busyId === row.id) onStop(row.id); else onSend(row.id); }}>
      <Textarea aria-label={`Write a message in ${row.title}`} className="min-h-20" placeholder="Ask a question or explore an idea…" value={row.thread.draft} onChange={(event) => onDraft(row.id, event.target.value)}/>
      <div className="mt-2 flex items-center justify-between"><span className="text-xs text-foreground-muted">Saved in this browser</span><Button type="submit" size="sm" disabled={(busyId !== undefined && busyId !== row.id) || (busyId !== row.id && !row.thread.draft.trim())}>{busyId === row.id ? <><X className="size-3.5"/> Stop</> : <><Send className="size-3.5"/> Send</>}</Button></div>
    </form> : <div className="shrink-0 border-t border-border-subtle bg-background px-4 py-3"><p className="text-xs text-foreground-muted">Lesson conversation history</p><Button className="mt-2" size="sm" variant="outline" onClick={() => onContinueTopic(row.id)}>Continue in lesson</Button></div>}
  </section>;
  const renderTree = (row: Row, depth = 0): ReactNode => <div key={row.id} className="mb-1" style={{ marginLeft: Math.min(depth, 4) * 10 }}>
    <div className={`group flex min-w-0 items-center rounded-lg ${activeId === row.id ? "bg-surface" : "hover:bg-surface-hover"}`}>
      <Button variant="ghost" className="min-w-0 flex-1 justify-start truncate text-left" onClick={() => { onOpen(row.id); setChatListOpen(false); }}><MessageSquare className="size-3.5 shrink-0 text-foreground-muted"/><span className="truncate">{row.title}</span></Button>
      {row.thread && <Button size="iconSm" variant="ghost" aria-label={`Rename ${row.title}`} onClick={() => { setRenaming(row.id); setRenameValue(row.title); }}><Pencil className="size-3.5"/></Button>}
      {children(row.id).length > 0 && !query && <Button size="iconSm" variant="ghost" aria-label={`${expanded[row.id] ? "Collapse" : "Expand"} branches for ${row.title}`} onClick={() => setExpanded((value) => ({ ...value, [row.id]: !value[row.id] }))}>{expanded[row.id] ? <ChevronDown className="size-3.5"/> : <ChevronRight className="size-3.5"/>}</Button>}
    </div>
    {renaming === row.id && <form className="flex gap-1 px-2 py-1" onSubmit={(event) => { event.preventDefault(); onRename(row.id, renameValue); setRenaming(undefined); }}><Input aria-label="Chat title" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus/><Button size="iconSm" type="submit" aria-label="Save chat title">✓</Button><Button size="iconSm" variant="ghost" type="button" aria-label="Cancel rename" onClick={() => setRenaming(undefined)}><X className="size-3.5"/></Button></form>}
    {(expanded[row.id] || query) && children(row.id).map((child) => renderTree(child, depth + 1))}
  </div>;
  const threadList = <aside className={`flex ${small ? "w-full" : "w-64"} shrink-0 flex-col border-r border-border-subtle bg-background-secondary/40`}>
    <div className="space-y-2 border-b border-border-subtle p-3"><Button variant="ghost" className="w-full justify-start" onClick={onHome}><HomeIcon className="size-4"/> Learning studio</Button><Button className="w-full justify-start" onClick={() => { onCreate(); setChatListOpen(false); }}><Plus className="size-4"/> New chat</Button><div className="flex gap-2"><Input startIcon={<Search className="size-4"/>} aria-label="Search chats" placeholder="Search chats" value={query} onChange={(event) => setQuery(event.target.value)}/>{query && <Button size="iconSm" variant="ghost" aria-label="Clear chat search" onClick={() => setQuery("")}><X className="size-4"/></Button>}</div></div>
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"><div className="px-2 py-2 text-2xs font-medium uppercase tracking-wider text-foreground-subtle">Recent</div>{visible.filter((row) => !row.parentThreadId).map((row) => renderTree(row))}{matching.length === 0 && <div className="px-3 py-6 text-sm text-foreground-muted">{query ? "No matching chats." : "Your chats will appear here."}</div>}</div>
  </aside>;
  const peek = active && (parent || newestChild);
  const peekTitle = parent && peekRow?.id === parent.id ? "Parent conversation" : "Child branch";
  return <div className="flex h-full min-h-0 min-w-0">
    {!small && threadList}
    {small && !active && threadList}
    {active ? threadPane(active) : small ? null : <div className="flex min-w-0 flex-1 flex-col items-center justify-center p-6 text-center"><div className="text-base font-semibold">Your conversations, connected</div><p className="mt-2 max-w-sm text-sm text-foreground-muted">Open a lesson conversation or start a general chat in this workspace.</p><Button className="mt-4" onClick={onCreate}><Plus className="size-4"/> New chat</Button></div>}
    {peek && peekRow && !small && peekOpen && <div className="flex min-h-0 w-[min(38%,420px)] shrink-0 border-l border-border-subtle">{threadPane(peekRow, true)}</div>}
    {peek && peekRow && small && <Drawer isOpen={peekOpen} onClose={closePeek} title={peekTitle} description={peekRow.title} widthClassName="h-full w-full"><div className="flex h-full min-h-0">{threadPane(peekRow, true)}</div></Drawer>}
    {small && active && <Drawer isOpen={chatListOpen} onClose={() => setChatListOpen(false)} title="Chats" description="Your conversations" widthClassName="h-full w-full sm:w-[320px]">{threadList}</Drawer>}
  </div>;
}
