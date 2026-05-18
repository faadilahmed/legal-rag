import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { EvalTab } from "./tabs/EvalTab"
import { OverviewTab } from "./tabs/OverviewTab"
import { PipelineTab } from "./tabs/PipelineTab"
import { StackTab } from "./tabs/StackTab"

interface InfoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InfoDialog({ open, onOpenChange }: InfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-4xl">
        <div className="flex h-[85vh] flex-col">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>About this system</DialogTitle>
            <DialogDescription>
              SEC 10-K Q&amp;A — hybrid-retrieval RAG over 387 filings from 76
              companies. Architecture, models, stack, and eval — all in one place.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="mx-6 mt-3 grid w-fit grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="stack">Stack</TabsTrigger>
              <TabsTrigger value="eval">Eval</TabsTrigger>
            </TabsList>
            <TabsContent
              value="overview"
              className="mt-0 flex-1 min-h-0 min-w-0 overflow-y-auto px-6 pb-6 pt-4"
            >
              <OverviewTab />
            </TabsContent>
            <TabsContent
              value="pipeline"
              className="mt-0 flex-1 min-h-0 min-w-0 overflow-y-auto px-6 pb-6 pt-4"
            >
              <PipelineTab />
            </TabsContent>
            <TabsContent
              value="stack"
              className="mt-0 flex-1 min-h-0 min-w-0 overflow-y-auto px-6 pb-6 pt-4"
            >
              <StackTab />
            </TabsContent>
            <TabsContent
              value="eval"
              className="mt-0 flex-1 min-h-0 min-w-0 overflow-y-auto px-6 pb-6 pt-4"
            >
              <EvalTab />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
