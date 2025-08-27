/**
 * Paste the full IncidentRescueRunbook component from ChatGPT here.
 * After pasting, save the file and run: npm run dev
 */
import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Search, RefreshCw, AlertTriangle, ShieldCheck, ListChecks, Clipboard, ClipboardCheck, Info, Lock, Shield, Server, Network, FileText, Activity, Hammer, BookOpen } from "lucide-react";

// Minimal shadcn/ui wrappers (they're available in the canvas runtime)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

/**
 * Incident Rescue Runbook — Interactive Checklist/Wizard
 * - Single-file React app with Tailwind + shadcn/ui components
 * - Persists progress to localStorage
 * - Shows one step at a time; checking "Done" advances automatically
 * - Includes search, progress, export of audit trail, and reset
 * - Designed for AWS terminology but written to be cloud-agnostic where possible
 */

// ---- Types ----
interface CommandBlock {
  label?: string;
  cmd: string;
}

interface StepItem {
  id: string;
  title: string;
  category: "Preparation" | "Triage" | "Containment" | "Forensics" | "Eradication" | "Recovery" | "Hardening" | "Post-Incident";
  critical?: boolean;
  details: string;
  commands?: CommandBlock[];
  links?: { label: string; href: string }[];
}

interface StepState {
  id: string;
  status: "todo" | "done" | "skipped";
  doneAt?: string; // ISO timestamp
}

interface IncidentMeta {
  name: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4" | "TBD";
  accountId: string;
  region: string;
  commander: string;
  scribe: string;
}

// ---- Seed Steps ----
const STEPS: StepItem[] = [
  // Preparation
  {
    id: "declare-incident",
    title: "Declare Incident, Assign Roles, Open War Room",
    category: "Preparation",
    critical: true,
    details:
      "Confirm incident scope and declare severity. Assign Incident Commander (IC), Scribe, Communications Lead. Open a dedicated chat/video bridge. Start timeline." ,
    commands: [
      { label: "Create Slack channel (example)", cmd: "# incident-sev1-<short-id>" },
    ],
  },
  {
    id: "preserve-logs",
    title: "Preserve Logs & Evidence Bucket (WORM/Lock)",
    category: "Preparation",
    critical: true,
    details:
      "Ensure log sources are immutable. Enable/verify org CloudTrail and S3 Object Lock (governance/legal hold). Mirror logs to a dedicated evidence bucket with restricted access.",
    commands: [
      { label: "S3 Object Lock (example)", cmd: "aws s3api put-object-lock-configuration --bucket <EVIDENCE_BUCKET> --object-lock-configuration 'ObjectLockEnabled=Enabled,Rule={DefaultRetention={Mode=GOVERNANCE,Days=90}}'" },
    ],
    links: [
      { label: "AWS CloudTrail", href: "https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html" },
      { label: "S3 Object Lock", href: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html" },
    ],
  },
  {
    id: "change-freeze",
    title: "Change Freeze & Stakeholder Notifications",
    category: "Preparation",
    details:
      "Announce temporary change freeze for impacted accounts/regions except emergency containment. Notify legal, security, exec sponsors as required by policy.",
  },

  // Triage
  {
    id: "scope-triage",
    title: "Scope/Triage: Identify Impacted Accounts, Regions, Assets",
    category: "Triage",
    critical: true,
    details:
      "Gather indicators of compromise (IoCs). Identify impacted accounts, regions, users, roles, instances, containers, data stores. Start asset list.",
  },
  {
    id: "review-guardduty",
    title: "Review GuardDuty / Security Hub / Detective",
    category: "Triage",
    details:
      "Pull recent findings, pivot to related resources, and tag affected assets.",
    commands: [
      { cmd: "aws guardduty list-findings --detector-id <ID> --finding-criteria '{...}'" },
      { cmd: "aws securityhub get-findings --filters '{...}'" },
    ],
    links: [
      { label: "AWS GuardDuty", href: "https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html" },
      { label: "AWS Detective", href: "https://docs.aws.amazon.com/detective/latest/adminguide/what-is.html" },
    ],
  },
  {
    id: "review-cloudtrail",
    title: "Review CloudTrail & CloudTrail Lake Queries",
    category: "Triage",
    details:
      "Hunt for anomalous API calls, new IAM users/keys, policy changes, AssumeRole spikes, unusual regions.",
    commands: [
      { cmd: "SELECT eventTime, eventName, userIdentity.sessionContext.sessionIssuer.userName, sourceIPAddress FROM cloudtrail WHERE eventTime > timestamp '2025-08-19' AND eventName IN ('CreateUser','CreateAccessKey','PutUserPolicy');" },
    ],
  },
  {
    id: "review-vpc-flows",
    title: "Review VPC Flow Logs & WAF/ALB Logs",
    category: "Triage",
    details:
      "Identify C2 beacons, data exfil patterns, unusual egress, and blocked/allowed WAF requests.",
  },

  // Containment
  {
    id: "rotate-keys",
    title: "Rotate/Disable IAM Access Keys & Suspicious Credentials",
    category: "Containment",
    critical: true,
    details:
      "Immediately deactivate/rotate compromised keys and credentials for users, roles, workload identities, CI/CD, and third-party integrators.",
    commands: [
      { cmd: "aws iam update-access-key --user-name <USER> --access-key-id <KEYID> --status Inactive" },
      { cmd: "aws iam create-access-key --user-name <USER>" },
    ],
  },
  {
    id: "force-password-reset",
    title: "Force Password Resets & Require MFA",
    category: "Containment",
    details:
      "Enforce password reset for console users. Enable/require MFA on root and all human users. For Identity Center (SSO), terminate sessions where supported.",
  },
  {
    id: "invalidate-sessions",
    title: "Invalidate/Terminate Active Sessions (where possible)",
    category: "Containment",
    details:
      "Terminate federated/SSO sessions (if supported) and rotate underlying IdP secrets. Temporary STS creds cannot be revoked; block via policy/SCP.",
    commands: [
      { cmd: "aws iam set-default-policy-version --policy-arn <POLICY> --version-id vN (use explicit deny to block)" },
    ],
  },
  {
    id: "isolate-assets",
    title: "Quarantine/Isolate Compromised Assets",
    category: "Containment",
    details:
      "Move instances/containers to quarantine security groups or isolated subnets (deny egress). For S3, enable Block Public Access; for RDS, restrict SGs; for EKS, cordon/drain nodes; for ECS, stop tasks." ,
  },

  // Forensics
  {
    id: "snapshot-evidence",
    title: "Snapshot Evidence (Disks/AMIs/Logs)",
    category: "Forensics",
    critical: true,
    details:
      "Create EBS snapshots/AMIs, export logs, and store hashes in evidence bucket. Maintain chain of custody. Avoid stopping instances unless required.",
    commands: [
      { cmd: "aws ec2 create-snapshot --volume-id <VOL> --description 'IR evidence <case>'" },
      { cmd: "aws ec2 create-image --instance-id <i-...> --name 'ir-ami-<case>' --no-reboot" },
    ],
  },
  {
    id: "collect-iocs",
    title: "Collect IoCs & Timeline",
    category: "Forensics",
    details:
      "Document file hashes, IPs, domains, user agents, API patterns. Build minute-by-minute timeline in the incident log.",
  },

  // Eradication
  {
    id: "remove-backdoors-iam",
    title: "Remove Backdoors: Rogue IAM Users/Keys/Roles/Policies/Trusts",
    category: "Eradication",
    details:
      "Search for unauthorized principals, inline policies, access key proliferation, modified trust relationships, overly-broad permissions. Remove/disable and document.",
  },
  {
    id: "remove-backdoors-lambda",
    title: "Remove Backdoors: Lambda Triggers / EventBridge / SSM",
    category: "Eradication",
    details:
      "Find suspicious Lambda triggers (S3, CloudWatch, EventBridge), automation scripts, SSM documents/run commands, CodeBuild webhooks, and disable/remove.",
  },
  {
    id: "remove-backdoors-infra",
    title: "Remove Backdoors: Launch Templates/AMIs/UserData/Containers",
    category: "Eradication",
    details:
      "Audit Launch Templates, AMIs, EC2 User Data, EKS DaemonSets, ECS Task Definitions for persistence. Replace with clean, signed artifacts.",
  },

  // Recovery
  {
    id: "rebuild-patch",
    title: "Rebuild/Patch from Known-Good Artifacts",
    category: "Recovery",
    details:
      "Rebuild workloads from golden AMIs/containers, apply patches, rotate app/database credentials (Secrets Manager/Parameter Store), and validate integrity." ,
  },
  {
    id: "monitor-heightened",
    title: "Heightened Monitoring & Gradual Re-Enablement",
    category: "Recovery",
    details:
      "Keep quarantine until metrics/logs remain clean over a defined window. Add detections for observed IoCs. Slowly re-open egress if needed.",
  },

  // Hardening (Apply Missing Controls)
  {
    id: "controls-root-mfa",
    title: "Apply Controls: Root Account MFA & Break-Glass",
    category: "Hardening",
    details:
      "Ensure root MFA enforced, store break-glass creds offline with strict procedure and alerts on use.",
  },
  {
    id: "controls-least-privilege",
    title: "Apply Controls: Least Privilege, Access Analyzer, SCP Guardrails",
    category: "Hardening",
    details:
      "Use IAM Access Analyzer, reduce wildcards, enforce deny guardrails with SCPs across org, restrict regions, and disable unused services.",
  },
  {
    id: "controls-network",
    title: "Apply Controls: Network Egress, WAF, Private Endpoints",
    category: "Hardening",
    details:
      "Egress allow-listing via NAT/Proxy, WAF managed rules + custom rules, VPC endpoints for control-plane APIs, Inspector/patch baselines.",
  },
  {
    id: "controls-logging",
    title: "Apply Controls: Central Logging, Retention, Detective Controls",
    category: "Hardening",
    details:
      "Org CloudTrail (multi-region), Config, CloudWatch log aggregation, GuardDuty/Detective/Security Hub enabled org-wide with minimum retention.",
  },
  {
    id: "controls-secrets",
    title: "Apply Controls: Secrets Rotation & CI/CD Hygiene",
    category: "Hardening",
    details:
      "Rotate all secrets via Secrets Manager; enforce OIDC for CI, scoped short-lived tokens, and artifact signing (SLSA attestations).",
  },

  // Post-Incident
  {
    id: "reporting",
    title: "Post-Incident Report, Lessons Learned, Playbook Updates",
    category: "Post-Incident",
    details:
      "Within agreed SLA, publish a blameless PIR: root cause (if known), impact, timeline, controls added, detection gaps, and action items with owners/dates.",
  },
  {
    id: "notify-compliance",
    title: "Regulatory/Customer Notifications (if applicable)",
    category: "Post-Incident",
    details:
      "Coordinate with legal/privacy for required notifications (e.g., data breach). Track deadlines and evidence of compliance.",
  },
];

// ---- Utilities ----
const STORAGE_KEY = "incident-rescue-progress-v1";

function loadState(stepIds: string[]): StepState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return stepIds.map((id) => ({ id, status: "todo" }));
    const parsed: StepState[] = JSON.parse(raw);
    // ensure we have all current steps (in case of updates)
    const mapped = new Map(parsed.map((s) => [s.id, s] as const));
    return stepIds.map((id) => mapped.get(id) ?? { id, status: "todo" });
  } catch {
    return stepIds.map((id) => ({ id, status: "todo" }));
  }
}

function saveState(state: StepState[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function nowIso() {
  return new Date().toISOString();
}

// ---- Component ----
export default function IncidentRescueRunbook() {
  const [search, setSearch] = useState("");
  const [meta, setMeta] = useState<IncidentMeta>({
    name: "Untitled Incident",
    severity: "TBD",
    accountId: "",
    region: "",
    commander: "",
    scribe: "",
  });

  const [states, setStates] = useState<StepState[]>(() => loadState(STEPS.map((s) => s.id)));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    saveState(states);
  }, [states]);

  const progress = useMemo(() => {
    const done = states.filter((s) => s.status === "done").length;
    return Math.round((done / states.length) * 100);
  }, [states]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return STEPS.map((s, i) => ({ ...s, idx: i }));
    return STEPS.map((s, i) => ({ ...s, idx: i })).filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.details.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [search]);

  // ensure currentIndex always points to filtered list where possible
  useEffect(() => {
    const currentId = STEPS[currentIndex]?.id;
    const newIndex = filtered.findIndex((s) => s.id === currentId);
    if (newIndex >= 0) return; // current still visible
    if (filtered.length > 0) setCurrentIndex(filtered[0].idx);
  }, [filtered, currentIndex]);

  const current = STEPS[currentIndex];
  const currentState = states.find((s) => s.id === current.id)!;

  function setStatus(id: string, status: StepState["status"]) {
    setStates((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, doneAt: status === "done" ? nowIso() : undefined } : s))
    );
  }

  function onMarkDone(checked: boolean | string) {
    const isChecked = Boolean(checked);
    setStatus(current.id, isChecked ? "done" : "todo");
    if (isChecked) {
      // auto-advance to next not-done step
      const nextIdx = STEPS.findIndex((_, i) => i > currentIndex && states[i]?.status !== "done");
      if (nextIdx > -1) setCurrentIndex(nextIdx);
    }
  }

  function onSkip() {
    setStatus(current.id, "skipped");
    const nextIdx = Math.min(STEPS.length - 1, currentIndex + 1);
    setCurrentIndex(nextIdx);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCmd(text);
      setTimeout(() => setCopiedCmd(null), 1500);
    });
  }

  function resetAll() {
    setStates(STEPS.map((s) => ({ id: s.id, status: "todo" })));
    setCurrentIndex(0);
  }

  function exportAudit() {
    const audit = {
      meta,
      generatedAt: nowIso(),
      steps: STEPS.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        status: states.find((st) => st.id === s.id)?.status ?? "todo",
        doneAt: states.find((st) => st.id === s.id)?.doneAt ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident-audit-${meta.name.replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white text-slate-900">
        {/* Header */}
        <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6" />
            <h1 className="text-xl font-bold">Incident Rescue Runbook</h1>
            <Badge variant="secondary" className="ml-2">AWS-focused</Badge>
            <div className="ml-auto flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={resetAll}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Reset
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear all statuses</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" onClick={exportAudit}>
                    <Download className="w-4 h-4 mr-2" /> Export Audit
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download JSON report</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar: Steps list */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5"/>Runbook Steps</CardTitle>
                <CardDescription>Search or jump to a step</CardDescription>
                <div className="relative mt-3">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400"/>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search steps, categories, text..." className="pl-8"/>
                </div>
                <div className="mt-4">
                  <Progress value={progress} />
                  <div className="text-xs text-slate-500 mt-1">{progress}% complete</div>
                </div>
              </CardHeader>
              <CardContent className="max-h-[60vh] overflow-auto pr-2">
                <div className="space-y-2">
                  {STEPS.map((s, i) => {
                    const st = states.find((x) => x.id === s.id)!;
                    const active = i === currentIndex;
                    const visible = filtered.some((f) => f.id === s.id);
                    if (!visible) return null;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setCurrentIndex(i)}
                        className={`w-full text-left rounded-xl p-3 border transition hover:bg-slate-50 ${active ? "border-slate-900" : "border-slate-200"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {st.status === "done" ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600"><Check className="w-3 h-3 text-white"/></span>
                            ) : st.status === "skipped" ? (
                              <Badge variant="destructive">Skipped</Badge>
                            ) : (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border"/>
                            )}
                            <span className="font-medium">{s.title}</span>
                          </div>
                          <Badge variant="outline">{s.category}</Badge>
                        </div>
                        {s.critical && (
                          <div className="mt-1 text-xs text-amber-700 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Critical</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main: Current step */}
          <section className="lg:col-span-8 xl:col-span-9 space-y-6">
            {/* Incident Meta */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Info className="w-5 h-5"/>Incident Metadata</CardTitle>
                <CardDescription>Fill to include in the exported audit trail</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Name</label>
                  <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="e.g., SEV1-credential-compromise"/>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Severity</label>
                  <select value={meta.severity} onChange={(e) => setMeta({ ...meta, severity: e.target.value as any })} className="w-full h-10 border rounded-md px-3">
                    <option value="TBD">TBD</option>
                    <option value="SEV-1">SEV-1</option>
                    <option value="SEV-2">SEV-2</option>
                    <option value="SEV-3">SEV-3</option>
                    <option value="SEV-4">SEV-4</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">AWS Account ID</label>
                  <Input value={meta.accountId} onChange={(e) => setMeta({ ...meta, accountId: e.target.value })} placeholder="123456789012"/>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Region</label>
                  <Input value={meta.region} onChange={(e) => setMeta({ ...meta, region: e.target.value })} placeholder="us-east-1"/>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Incident Commander</label>
                  <Input value={meta.commander} onChange={(e) => setMeta({ ...meta, commander: e.target.value })} placeholder="Name"/>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Scribe</label>
                  <Input value={meta.scribe} onChange={(e) => setMeta({ ...meta, scribe: e.target.value })} placeholder="Name"/>
                </div>
              </CardContent>
            </Card>

            {/* Current Step Card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {current.category === "Containment" && <Lock className="w-5 h-5"/>}
                  {current.category === "Preparation" && <Shield className="w-5 h-5"/>}
                  {current.category === "Triage" && <Activity className="w-5 h-5"/>}
                  {current.category === "Forensics" && <FileText className="w-5 h-5"/>}
                  {current.category === "Eradication" && <Hammer className="w-5 h-5"/>}
                  {current.category === "Recovery" && <Server className="w-5 h-5"/>}
                  {current.category === "Hardening" && <ShieldCheck className="w-5 h-5"/>}
                  {current.category === "Post-Incident" && <BookOpen className="w-5 h-5"/>}
                  {current.title}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Badge variant="outline">{current.category}</Badge>
                  {current.critical && (
                    <span className="text-amber-700 inline-flex items-center gap-1 text-sm"><AlertTriangle className="w-4 h-4"/> Critical</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="leading-relaxed whitespace-pre-wrap">{current.details}</p>

                {current.commands && current.commands.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Example commands</div>
                    <div className="space-y-2">
                      {current.commands.map((c, i) => (
                        <div key={i} className="group relative">
                          {c.label && <div className="text-xs text-slate-500 mb-1">{c.label}</div>}
                          <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-xs overflow-auto">{c.cmd}</pre>
                          <Button variant="secondary" size="sm" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition" onClick={() => copy(c.cmd)}>
                            {copiedCmd === c.cmd ? <ClipboardCheck className="w-4 h-4"/> : <Clipboard className="w-4 h-4"/>}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {current.links && current.links.length > 0 && (
                  <div className="text-sm">
                    <div className="font-medium mb-2">Docs</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {current.links.map((l, i) => (
                        <li key={i}><a className="text-blue-600 hover:underline" href={l.href} target="_blank" rel="noreferrer">{l.label}</a></li>
                      ))}
                    </ul>
                  </div>
                )}

                <Separator/>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox id="done" checked={currentState.status === "done"} onCheckedChange={onMarkDone} />
                    <label htmlFor="done" className="text-sm select-none">Done</label>
                    {currentState.doneAt && (
                      <span className="text-xs text-slate-500">({new Date(currentState.doneAt).toLocaleString()})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}>
                      <ChevronLeft className="w-4 h-4 mr-2"/> Back
                    </Button>
                    <Button variant="outline" onClick={onSkip}>Skip</Button>
                    <Button onClick={() => setCurrentIndex(Math.min(STEPS.length - 1, currentIndex + 1))}>
                      Next <ChevronRight className="w-4 h-4 ml-2"/>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legend / Notes */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Info className="w-5 h-5"/>Notes & Guidance</CardTitle>
                <CardDescription>Operational cautions</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Containment before eradication: avoid tipping attackers until evidence is preserved.</li>
                  <li>Temporary STS credentials usually cannot be revoked; block with SCPs/permissions and rotate underlying credentials.</li>
                  <li>Prefer isolating compute via quarantine security groups or isolated subnets rather than stop/terminate.</li>
                  <li>Keep a precise timeline; your exported audit helps with the post-incident report.</li>
                  <li>This UI is a guide. Automating actions requires a secured backend (e.g., Step Functions, Lambda, strong authN/Z, and audit logging).</li>
                </ul>
              </CardContent>
            </Card>
          </section>
        </main>

        <footer className="py-8 text-center text-xs text-slate-500">
          Built for training and rehearsals. Adapt to your org policy.
        </footer>
      </div>
    </TooltipProvider>
  );
}
