import { Check, Loader2, Search, SlidersHorizontal, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

export interface StatusData {
  phase: "retrieving" | "reranking" | "generating" | "done"
  label?: string
}

const PHASE_ORDER: StatusData["phase"][] = [
  "retrieving",
  "reranking",
  "generating",
]

const PHASE_ICONS: Record<StatusData["phase"], typeof Search> = {
  retrieving: Search,
  reranking: SlidersHorizontal,
  generating: Sparkles,
  done: Check,
}

const PHASE_LABELS: Record<StatusData["phase"], string> = {
  retrieving: "Retrieving",
  reranking: "Reranking",
  generating: "Generating",
  done: "Done",
}

interface StatusStepperProps {
  data: StatusData
}

/** Horizontal pill stepper showing the multi-stage RAG pipeline as it runs.
 * Active phase pulses with a primary background; completed phases show a
 * filled checkmark; pending phases are muted. Collapses entirely once
 * phase === "done" so the finished message isn't visually noisy. */
export function StatusStepper({ data }: StatusStepperProps) {
  if (data.phase === "done") return null

  const currentIdx = PHASE_ORDER.indexOf(data.phase)

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {PHASE_ORDER.map((phase, i) => {
        const isActive = i === currentIdx
        const isComplete = i < currentIdx
        const isPending = i > currentIdx
        const Icon = PHASE_ICONS[phase]
        return (
          <div
            key={phase}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              isActive &&
                "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30",
              isComplete && "bg-muted text-muted-foreground",
              isPending && "bg-transparent text-muted-foreground/60",
            )}
          >
            {isActive ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isComplete ? (
              <Check className="h-3 w-3" />
            ) : (
              <Icon className="h-3 w-3" />
            )}
            <span>
              {isActive && data.label ? data.label : PHASE_LABELS[phase]}
            </span>
          </div>
        )
      })}
    </div>
  )
}
