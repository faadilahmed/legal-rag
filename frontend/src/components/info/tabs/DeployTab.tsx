import {
  AlertTriangle,
  Cloud,
  Container,
  Database,
  GitBranch,
  Globe,
  KeyRound,
  Layers,
  ScrollText,
  Workflow,
} from "lucide-react"

interface Resource {
  name: string
  type: string
  tier: string
  role: string
  icon: typeof Cloud
}

const RESOURCES: Resource[] = [
  {
    name: "legal-rag-web",
    type: "Static Web Apps",
    tier: "Free",
    role: "CDN-fronted React/Vite bundle. GitHub-integrated auto-deploy. Custom domain + auto-SSL.",
    icon: Globe,
  },
  {
    name: "legal-rag-api",
    type: "Container Apps",
    tier: "Consumption · 2 vCPU / 4 GiB",
    role: "FastAPI backend. Min 1 / max 2 replicas. System-assigned managed identity.",
    icon: Container,
  },
  {
    name: "legalragstg45789",
    type: "Storage (Blob)",
    tier: "Standard_LRS",
    role: "Hosts the 1.1 GB FAISS + BM25 index. Backend streams it down on cold start.",
    icon: Database,
  },
  {
    name: "legalragkv45789",
    type: "Key Vault",
    tier: "Standard",
    role: "Stores ANTHROPIC_API_KEY. Container App reads via managed identity — never an env var literal.",
    icon: KeyRound,
  },
  {
    name: "legalragacr45789",
    type: "Container Registry",
    tier: "Basic",
    role: "Holds the backend Docker image. Pushed by GitHub Actions on every commit to main.",
    icon: Container,
  },
  {
    name: "legal-rag-gh-actions",
    type: "Service Principal (Entra ID)",
    tier: "RBAC: AcrPush",
    role: "Scoped credentials so the GitHub workflow can push to ACR without user accounts.",
    icon: Cloud,
  },
  {
    name: "legal-rag-env",
    type: "Container Apps Environment",
    tier: "Consumption",
    role: "Parent resource for the Container App — defines the networking boundary and binds it to the Log Analytics workspace.",
    icon: Layers,
  },
  {
    name: "workspace-legalragrg6ADK",
    type: "Log Analytics Workspace",
    tier: "PerGB2018 (default)",
    role: "Auto-created with the Container Apps Environment. Holds backend console + system logs, queryable via Kusto (KQL).",
    icon: ScrollText,
  },
]

export function DeployTab() {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs text-muted-foreground">
          The full deployment is provisioned via the <code className="text-foreground">az</code> CLI
          in a single reproducible shell script (<code className="text-foreground">infra/deploy.sh</code> +
          <code className="text-foreground">infra/deploy-app.sh</code>) and torn down with one
          <code className="text-foreground"> az group delete</code> when the demo is done.
        </p>
      </section>

      {/* Topology diagram */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Topology</h3>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-4 font-mono text-[10px] leading-snug text-foreground">
{`User's browser
    │  legal-rag-imanage-demo.faadil-ahmed-dev.com
    ▼
Cloudflare DNS  ───── CNAME (DNS-only) ─────┐
                                            ▼
                                  Static Web Apps     ── free · CDN · auto-SSL
                                            │  fetch /api/* (CORS, cross-origin)
                                            ▼
                                  Container Apps      ── consumption · 2 vCPU / 4 GiB
                                            ├─ managed identity ─▶ Key Vault
                                            │                       (ANTHROPIC_API_KEY)
                                            └─ cold start ───────▶ Blob Storage
                                                                    (1.1 GB index: faiss
                                                                     + bm25 + chunks
                                                                     + embeddings)

──── build path (on every push to main) ────
GitHub Actions ─▶ Container Registry ─▶ Container Apps (new revision)`}
        </pre>
      </section>

      {/* Resource inventory */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Azure resources
        </h3>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-foreground">Name</th>
                <th className="px-3 py-2 font-medium text-foreground">Service · tier</th>
                <th className="px-3 py-2 font-medium text-foreground">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {RESOURCES.map((r) => {
                const Icon = r.icon
                return (
                  <tr key={r.name} className="text-muted-foreground">
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-start gap-1.5">
                        <Icon className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/70" />
                        <code className="font-mono text-foreground">{r.name}</code>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-foreground">{r.type}</div>
                      <div className="text-[10px]">{r.tier}</div>
                    </td>
                    <td className="px-3 py-2 align-top">{r.role}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Build & deploy pipeline */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Workflow className="h-3.5 w-3.5" />
            Build &amp; deploy pipeline
          </span>
        </h3>
        <ol className="space-y-2 text-xs text-muted-foreground">
          <li className="flex gap-2">
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[9px] text-foreground">
              1
            </span>
            <span>
              <code className="text-foreground">git push origin main</code>{" "}
              triggers two GitHub Actions workflows in parallel — one for the
              backend image, one for the frontend bundle. Path filters in each
              workflow file skip the run when the touched files don&apos;t matter
              (e.g. README-only commits don&apos;t rebuild anything).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[9px] text-foreground">
              2
            </span>
            <span>
              <strong className="text-foreground">build-backend.yml</strong> uses
              Docker buildx with <code className="text-foreground">--platform linux/amd64</code>{" "}
              (required because Container Apps runs amd64 — Apple Silicon dev
              machines default to arm64), authenticates to ACR via the{" "}
              <code className="text-foreground">AZURE_CREDENTIALS</code>{" "}
              service-principal secret, builds the image with{" "}
              <code className="text-foreground">cache-from</code>/<code className="text-foreground">cache-to</code>{" "}
              pointing at a registry layer cache (subsequent builds reuse apt +
              pip + the HuggingFace model-warmup layers, ~2 min instead of ~8),
              then pushes both <code className="text-foreground">:latest</code> and{" "}
              <code className="text-foreground">:&lt;sha&gt;</code> tags.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[9px] text-foreground">
              3
            </span>
            <span>
              <strong className="text-foreground">azure-static-web-apps-*.yml</strong>{" "}
              (auto-generated by SWA when the resource was created) runs{" "}
              <code className="text-foreground">npm run build</code> on Vite,
              reads <code className="text-foreground">VITE_API_BASE</code> from{" "}
              <code className="text-foreground">.env.production</code> so the
              bundled fetch calls hit the Container App URL directly, and
              uploads <code className="text-foreground">frontend/dist</code> to
              the SWA's CDN.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[9px] text-foreground">
              4
            </span>
            <span>
              <code className="text-foreground">az containerapp update --image ...</code>{" "}
              creates a new <strong className="text-foreground">revision</strong>{" "}
              pointing at the new tag. The old revision keeps taking 100% of
              traffic until the new one passes its startup probe (HTTP{" "}
              <code className="text-foreground">/api/health</code> 200); only
              then does traffic atomically shift. If the new revision fails the
              probe, traffic stays on the old one — no user-visible outage.
            </span>
          </li>
        </ol>
      </section>

      {/* Revisions / zero-downtime */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            Revisions &amp; zero-downtime deploys
          </span>
        </h3>
        <p className="text-xs text-muted-foreground">
          Every config change (new image, new env var, new probe definition)
          produces a numbered revision: <code className="text-foreground">legal-rag-api--0000007</code>,
          {" "}<code className="text-foreground">--0000008</code>, and so on.
          Both revisions exist side-by-side in the cluster while the new one
          is starting up. Container Apps treats the startup probe as the
          health gate — once it passes, the new revision takes 100% of
          traffic and the old one drains. If the new revision crash-loops
          (image pull failure, env mis-config, OOM during pipeline load), the
          old one keeps serving and you never see the outage end-user-side.
          Bad deploys roll back simply by pointing traffic back at the
          previous revision.
        </p>
      </section>

      {/* Free-trial limitations */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Free-trial limitations encountered
          </span>
        </h3>
        <p className="text-xs text-muted-foreground">
          Three things Azure's free trial blocks that you don&apos;t find out
          about until you hit them:
        </p>
        <ul className="space-y-1.5 pl-5 text-xs text-muted-foreground">
          <li>
            <strong className="text-foreground">ACR Tasks</strong>{" "}
            (<code className="text-foreground">az acr build</code>) returns{" "}
            <code className="text-foreground">TasksOperationsNotAllowed</code> →
            switched to GitHub Actions runners (free, native amd64).
          </li>
          <li>
            <strong className="text-foreground">App Service Domains</strong>{" "}
            shows a red &ldquo;subscription doesn&apos;t have billing
            support&rdquo; error; upgrading to Pay-As-You-Go didn&apos;t
            propagate immediately → bought the domain at Cloudflare Registrar
            (~$9/yr <code className="text-foreground">.com</code>) and pointed
            a CNAME at the SWA.
          </li>
          <li>
            <strong className="text-foreground">SWA Linked Backends</strong>{" "}
            (the native <code className="text-foreground">/api/*</code> →
            backend proxy) requires Standard tier ($9/mo) → wired up the
            cross-origin pattern instead: frontend fetches the Container App
            URL absolutely, backend whitelists the SWA + custom-domain origins
            in CORS.
          </li>
        </ul>
      </section>

      {/* Auth flow */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          <span className="inline-flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            Secrets &amp; auth (Key Vault → Container App)
          </span>
        </h3>
        <p className="text-xs text-muted-foreground">
          The Anthropic API key never appears in env vars, code, CI logs, or
          <code className="text-foreground"> az containerapp show</code> output. Flow:
        </p>
        <ol className="space-y-1.5 pl-5 text-xs text-muted-foreground">
          <li>
            Container App is assigned a <strong className="text-foreground">system-assigned
            managed identity</strong> — Azure rotates the credential automatically.
          </li>
          <li>
            Key Vault access policy grants that identity{" "}
            <code className="text-foreground">get</code>/<code className="text-foreground">list</code>{" "}
            on secrets.
          </li>
          <li>
            Container App secret is declared as
            {" "}<code className="text-foreground">keyvaultref:&lt;vault-uri&gt;/secrets/anthropic-api-key,identityref:system</code>.
          </li>
          <li>
            At runtime, Azure fetches the secret via the identity and injects it as
            the <code className="text-foreground">ANTHROPIC_API_KEY</code> env var.
          </li>
          <li>
            The Python code reads <code className="text-foreground">os.environ[...]</code>{" "}
            — never sees the vault. Rotating the key = one CLI command, no code changes.
          </li>
        </ol>
      </section>

      {/* Cost note */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Cost shape</h3>
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Idle</strong> (Container Apps scaled to 0):
          ~$5/month after the free trial — driven by Container Registry Basic. Everything
          else is in a free tier or charges sub-dollar amounts.
          <strong className="text-foreground"> Warm</strong> (<code className="text-foreground">min_replicas=1</code>{" "}
          to eliminate cold start during a live demo): ~$20/month prorated. The 30-day
          free $200 Azure trial covers everything during initial demos. Anthropic API
          spend (~$0.08 per chat turn) bills separately on the user's Anthropic key.
        </p>
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Tear-down</strong>: one command nukes
          every resource in the group (registry, app, storage, vault, log workspace,
          DNS zone) — keeps the bill at zero after the demo:
        </p>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px] text-foreground">
{`az group delete --name legal-rag-rg --yes --no-wait`}
        </pre>
      </section>
    </div>
  )
}
