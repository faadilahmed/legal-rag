import { useState, type FormEvent, type ReactNode } from "react"

// Hardcoded gate password. This is a portfolio demo; the password
// living in the bundle is acceptable — the gate exists to keep casual
// visitors from racking up Anthropic API costs, not to protect anything
// sensitive. Share the URL + this password with interviewers.
const EXPECTED_PASSWORD = "$ROvF;;d+5yhh^n0m)0W_imanage"
const STORAGE_KEY = "legal-rag.gate"

function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "unlocked"
  } catch {
    // sessionStorage can throw in sandboxed iframes — treat as locked
    return false
  }
}

interface PasswordGateProps {
  children: ReactNode
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [unlocked, setUnlocked] = useState<boolean>(isUnlocked)
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  if (unlocked) return <>{children}</>

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (value === EXPECTED_PASSWORD) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "unlocked")
      } catch {
        /* ignore — still unlock in-memory for the current session */
      }
      setUnlocked(true)
    } else {
      setError("Incorrect passcode")
    }
  }

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg"
      >
        <h1 className="text-center text-xl font-semibold text-foreground">
          SEC 10-K <span className="text-primary">Q&amp;A</span>
        </h1>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          This site is in development. Enter the passcode to continue.
        </p>

        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError(null)
          }}
          placeholder="Passcode"
          className="mt-5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />

        {error && (
          <p className="mt-2 text-center text-xs text-destructive">{error}</p>
        )}

        <button
          type="submit"
          className="mt-4 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Enter
        </button>
      </form>
    </div>
  )
}
