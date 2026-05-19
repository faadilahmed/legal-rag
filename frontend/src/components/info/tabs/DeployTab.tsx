import {
  Cloud,
  Container,
  Database,
  Globe,
  KeyRound,
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
    │  https (custom domain via Cloudflare DNS)
    ▼
Static Web Apps          ─── free tier · CDN · auto-SSL
    │  fetch /api/* (cross-origin CORS)
    ▼
Container Apps           ─── consumption · 2 vCPU / 4 GiB
    ├─ managed identity ────▶ Key Vault (ANTHROPIC_API_KEY)
    └─ cold start: download ─▶ Blob Storage (1.1 GB index)
                                  └─ faiss.index · bm25.pkl ·
                                     chunks.pkl · embeddings.npy`}
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
              triggers two GitHub Actions workflows in parallel.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[9px] text-foreground">
              2
            </span>
            <span>
              <strong className="text-foreground">build-backend.yml</strong> uses
              Docker buildx (native <code className="text-foreground">linux/amd64</code>),
              authenticates to ACR via the <code className="text-foreground">AZURE_CREDENTIALS</code>{" "}
              service-principal secret, builds the image with registry layer cache, pushes{" "}
              <code className="text-foreground">:latest</code> + <code className="text-foreground">:&lt;sha&gt;</code>.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[9px] text-foreground">
              3
            </span>
            <span>
              <strong className="text-foreground">azure-static-web-apps-*.yml</strong>{" "}
              (auto-generated by SWA) builds the React bundle with{" "}
              <code className="text-foreground">npm run build</code> and uploads{" "}
              <code className="text-foreground">frontend/dist</code> to the SWA CDN.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[9px] text-foreground">
              4
            </span>
            <span>
              <code className="text-foreground">az containerapp update --image ...</code>{" "}
              creates a new Container App revision pointing at the new tag. Old revision
              keeps serving until the new one passes its startup probe (zero downtime).
            </span>
          </li>
        </ol>
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
      </section>
    </div>
  )
}
