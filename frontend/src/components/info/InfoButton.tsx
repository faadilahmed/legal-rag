import { useState } from "react"
import { Info } from "lucide-react"

import { Button } from "@/components/ui/button"

import { InfoDialog } from "./InfoDialog"

/** Floating bottom-left button that opens the About dialog.
 * Rendered as a sibling of the chat layout so it stays above any panels. */
export function InfoButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 h-9 gap-1.5 rounded-full pl-3 pr-4 shadow-md hover:shadow-lg"
        title="About this system — architecture, models, stack, eval"
      >
        <Info className="h-4 w-4" />
        <span className="hidden text-xs font-medium sm:inline">About</span>
      </Button>
      <InfoDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
