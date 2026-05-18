import React, { useEffect, useMemo, useState } from "react"
import { Bot, Loader2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react"
import type {
  DataMessagePartComponent,
  DataMessagePartProps,
  EmptyMessagePartComponent,
  TextMessagePartComponent,
  TextMessagePartProps,
} from "@assistant-ui/react"

import { Button } from "@/components/ui/button"
import {
  CitationProvider,
  useCitationOptional,
} from "@/components/chat/CitationContext"
import { SourcesPanel } from "@/components/chat/SourcesPanel"
import { StatusStepper, type StatusData } from "@/components/chat/StatusStepper"
import { TraceButton } from "@/components/chat/TraceButton"
import type { SourcesData } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ErrorData {
  message: string
}

// Inline [CHUNK_ID] citation pattern as it appears in the model's text.
const CITATION_RE = /\[([A-Za-z0-9_]+)\]/g

/** Visual chip for an inline [CHUNK_ID] reference.
 *
 * When inside a CitationProvider (i.e., in an AssistantMessage), hover and
 * click are interactive: hover highlights + scrolls to the matching source
 * card; click opens the ChunkSheet directly. Outside a provider, it's just a
 * decorative pill. */
function CitationPill({ chunkId }: { chunkId: string }) {
  const cite = useCitationOptional()

  const interactive = cite !== null
  const isHovered = cite?.hoveredChunkId === chunkId

  return (
    <button
      type="button"
      title={chunkId}
      disabled={!interactive}
      onMouseEnter={() => {
        if (!cite) return
        cite.setHoveredChunkId(chunkId)
        cite.scrollToCard(chunkId)
      }}
      onMouseLeave={() => cite?.setHoveredChunkId(null)}
      onClick={() => cite?.setOpenChunkId(chunkId)}
      className={cn(
        "mx-0.5 inline-flex items-baseline rounded-md px-1.5 py-px font-mono text-[10px] font-medium align-baseline transition-colors",
        "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20",
        interactive && "cursor-pointer hover:bg-primary/20 hover:ring-primary/40",
        isHovered && "bg-primary/25 ring-primary/50",
      )}
    >
      {chunkId}
    </button>
  )
}

/** Walk a string and substitute `[CHUNK_ID]` matches with CitationPill nodes. */
function renderWithCitations(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  let m: RegExpExecArray | null
  CITATION_RE.lastIndex = 0
  while ((m = CITATION_RE.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index))
    parts.push(
      <CitationPill key={`${m.index}-${m[1]}`} chunkId={m[1]} />,
    )
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts
}

/** Recursively transform string children inside ReactMarkdown elements. */
function transformChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") return renderWithCitations(child)
    return child
  })
}

/** Custom text renderer for assistant messages — renders markdown + citation pills. */
const MarkdownText: TextMessagePartComponent = ({
  text,
}: TextMessagePartProps) => {
  return (
    <div className="prose prose-sm prose-invert max-w-none break-words prose-p:my-2 prose-li:my-0.5 prose-pre:my-2 prose-headings:my-3 prose-headings:font-semibold prose-strong:text-foreground prose-code:text-foreground prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-px prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{transformChildren(children)}</p>,
          li: ({ children }) => <li>{transformChildren(children)}</li>,
          strong: ({ children }) => (
            <strong>{transformChildren(children)}</strong>
          ),
          em: ({ children }) => <em>{transformChildren(children)}</em>,
          h1: ({ children }) => <h1>{transformChildren(children)}</h1>,
          h2: ({ children }) => <h2>{transformChildren(children)}</h2>,
          h3: ({ children }) => <h3>{transformChildren(children)}</h3>,
          td: ({ children }) => <td>{transformChildren(children)}</td>,
          th: ({ children }) => <th>{transformChildren(children)}</th>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

/** Shown when the assistant message has no parts yet but is running. */
const ThinkingIndicator: EmptyMessagePartComponent = ({ status }) => {
  if (status?.type !== "running") return null
  return (
    <div className="flex items-center gap-2 py-1 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Thinking…</span>
    </div>
  )
}

const SourcesDataPart: DataMessagePartComponent<SourcesData> = ({
  data,
}: DataMessagePartProps<SourcesData>) => {
  if (!data?.chunks?.length) return null
  return <SourcesPanel chunks={data.chunks} />
}

const StatusDataPart: DataMessagePartComponent<StatusData> = ({
  data,
}: DataMessagePartProps<StatusData>) => {
  if (!data?.phase) return null
  return <StatusStepper data={data} />
}

interface FollowupsData {
  questions: string[]
}

const FollowupsDataPart: DataMessagePartComponent<FollowupsData> = ({
  data,
}: DataMessagePartProps<FollowupsData>) => {
  if (!data?.questions?.length) return null
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {data.questions.map((q: string) => (
        <ThreadPrimitive.Suggestion key={q} prompt={q} send asChild>
          <button
            className={cn(
              "group inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs",
              "text-muted-foreground transition-colors",
              "hover:border-primary/40 hover:bg-accent hover:text-foreground",
            )}
          >
            <span>{q}</span>
          </button>
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  )
}

const ErrorDataPart: DataMessagePartComponent<ErrorData> = ({
  data,
}: DataMessagePartProps<ErrorData>) => {
  if (!data?.message) return null
  return (
    <p className="mt-2 text-xs text-destructive">⚠ {data.message}</p>
  )
}

// ---------------------------------------------------------------------------
// Per-message context: carry the DB message id from the metadata data part
// up to TraceButton without prop-drilling through MessagePrimitive.
// ---------------------------------------------------------------------------

const AssistantMessageContext = React.createContext<{
  messageId: string | null
  setMessageId: (id: string) => void
} | null>(null)

interface MetadataData {
  db_message_id?: string
}

const MetadataDataPart: DataMessagePartComponent<MetadataData> = ({
  data,
}: DataMessagePartProps<MetadataData>) => {
  const ctx = React.useContext(AssistantMessageContext)
  useEffect(() => {
    if (data?.db_message_id && ctx) {
      ctx.setMessageId(data.db_message_id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.db_message_id])
  return null
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="my-4 flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  const [messageId, setMessageId] = useState<string | null>(null)
  const ctx = useMemo(() => ({ messageId, setMessageId }), [messageId])
  return (
    <AssistantMessageContext.Provider value={ctx}>
      <CitationProvider>
        <MessagePrimitive.Root className="my-6 flex gap-3">
          <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-inset ring-primary/20">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1 text-sm text-foreground">
            <div className="flex items-center justify-end gap-1 -mt-1">
              <TraceButton messageId={messageId} />
            </div>
            <MessagePrimitive.Content
              components={{
                Text: MarkdownText,
                Empty: ThinkingIndicator,
                data: {
                  by_name: {
                    status: StatusDataPart as DataMessagePartComponent,
                    sources: SourcesDataPart as DataMessagePartComponent,
                    followups: FollowupsDataPart as DataMessagePartComponent,
                    error: ErrorDataPart as DataMessagePartComponent,
                    metadata: MetadataDataPart as DataMessagePartComponent,
                  },
                },
              }}
            />
          </div>
        </MessagePrimitive.Root>
      </CitationProvider>
    </AssistantMessageContext.Provider>
  )
}

const EXAMPLE_PROMPTS: { tag: string; prompt: string }[] = [
  {
    tag: "Factual",
    prompt: "What are Apple's main supply chain risks?",
  },
  {
    tag: "Comparative",
    prompt:
      "How do JPMorgan and Goldman Sachs describe trading and market-making risks?",
  },
  {
    tag: "Multi-company",
    prompt:
      "How do Microsoft, Google, and Meta describe AI-related risk factors?",
  },
  {
    tag: "Evolution",
    prompt:
      "How has Apple's discussion of China-related risks changed since 2022?",
  },
]

function EmptyState() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-1 ring-inset ring-primary/20">
        <Bot className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">SEC 10-K Q&amp;A</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Hybrid retrieval over 387 filings (76 companies × 5 years) with
        citation-grounded answers from Claude.
      </p>
      <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {EXAMPLE_PROMPTS.map(({ tag, prompt }) => (
          <ThreadPrimitive.Suggestion
            key={prompt}
            prompt={prompt}
            send
            asChild
          >
            <button
              className={cn(
                "group flex flex-col items-start gap-1 rounded-lg border border-border bg-card p-3 text-left",
                "transition-colors hover:bg-accent hover:border-primary/30",
              )}
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary/80 group-hover:text-primary">
                {tag}
              </span>
              <span className="text-sm text-foreground">{prompt}</span>
            </button>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  )
}

export function Thread() {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col bg-background">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6">
          <ThreadPrimitive.Empty>
            <EmptyState />
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{ UserMessage, AssistantMessage }}
          />
        </div>
      </ThreadPrimitive.Viewport>
      <Composer />
    </ThreadPrimitive.Root>
  )
}

function Composer() {
  return (
    <div className="border-t border-border bg-background px-6 py-4">
      <ComposerPrimitive.Root
        className={cn(
          "mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 focus-within:ring-1 focus-within:ring-ring",
        )}
      >
        <ComposerPrimitive.Input
          className="flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Ask about SEC 10-K filings…"
          rows={1}
        />
        <ThreadPrimitive.If running={false}>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">Send</Button>
          </ComposerPrimitive.Send>
        </ThreadPrimitive.If>
        <ThreadPrimitive.If running>
          <ComposerPrimitive.Cancel asChild>
            <Button size="sm" variant="destructive">
              Stop
            </Button>
          </ComposerPrimitive.Cancel>
        </ThreadPrimitive.If>
      </ComposerPrimitive.Root>
    </div>
  )
}
