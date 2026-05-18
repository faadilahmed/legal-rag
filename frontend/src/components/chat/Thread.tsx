import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react"
import type {
  DataMessagePartComponent,
  DataMessagePartProps,
} from "@assistant-ui/react"

import { Button } from "@/components/ui/button"
import { SourcesPanel } from "@/components/chat/SourcesPanel"
import type { SourcesData } from "@/lib/types"
import { cn } from "@/lib/utils"

export function Thread() {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col bg-background">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4">
        <ThreadPrimitive.Empty>
          <div className="flex h-full items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">
              Ask anything about the SEC 10-K corpus to start.
            </p>
          </div>
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.Messages
          components={{ UserMessage, AssistantMessage }}
        />
      </ThreadPrimitive.Viewport>
      <Composer />
    </ThreadPrimitive.Root>
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="my-4 ml-auto max-w-2xl rounded-lg bg-primary px-4 py-2 text-primary-foreground">
      <MessagePrimitive.Content />
    </MessagePrimitive.Root>
  )
}

const SourcesDataPart: DataMessagePartComponent<SourcesData> = ({
  data,
}: DataMessagePartProps<SourcesData>) => {
  if (!data?.chunks?.length) return null
  return <SourcesPanel chunks={data.chunks} />
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="my-4 max-w-3xl rounded-lg bg-card px-4 py-2 text-card-foreground">
      <MessagePrimitive.Content
        components={{
          data: {
            by_name: {
              sources: SourcesDataPart as DataMessagePartComponent,
            },
          },
        }}
      />
    </MessagePrimitive.Root>
  )
}

function Composer() {
  return (
    <ComposerPrimitive.Root
      className={cn(
        "m-4 flex items-end gap-2 rounded-lg border border-border bg-card p-2"
      )}
    >
      <ComposerPrimitive.Input
        className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder="Ask about SEC 10-K filings…"
        rows={1}
      />
      <ComposerPrimitive.Send asChild>
        <Button size="sm">Send</Button>
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  )
}
