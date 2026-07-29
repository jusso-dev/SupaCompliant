import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  MinusCircle,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { ControlResultStatus } from "@supacompliant/shared";
import { Badge } from "@/components/ui/badge";

const CONFIG: Record<
  ControlResultStatus,
  {
    label: string;
    variant:
      | "pass"
      | "fail"
      | "warning"
      | "manual"
      | "unknown"
      | "error"
      | "secondary"
      | "outline";
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pass: { label: "Pass", variant: "pass", Icon: CheckCircle2 },
  fail: { label: "Fail", variant: "fail", Icon: XCircle },
  warning: { label: "Warning", variant: "warning", Icon: AlertTriangle },
  manual_review: {
    label: "Manual review",
    variant: "manual",
    Icon: ClipboardList,
  },
  not_applicable: {
    label: "Not applicable",
    variant: "outline",
    Icon: MinusCircle,
  },
  not_assessed: {
    label: "Not assessed",
    variant: "unknown",
    Icon: Ban,
  },
  error: { label: "Error", variant: "error", Icon: ShieldAlert },
  unknown: { label: "Unknown", variant: "unknown", Icon: CircleHelp },
};

export function StatusBadge({ status }: { status: ControlResultStatus }) {
  const cfg = CONFIG[status];
  const Icon = cfg.Icon;
  return (
    <Badge variant={cfg.variant}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{cfg.label}</span>
    </Badge>
  );
}
