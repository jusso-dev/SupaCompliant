"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import Link from "next/link";

export type TrendPoint = {
  runId: string;
  label: string;
  passRate: number | null;
  critical: number;
  unknownOrError: number;
  fails: number;
};

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    passPct:
      d.passRate == null ? null : Math.round(d.passRate * 1000) / 10,
  }));

  return (
    <div className="space-y-3">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="passPct"
              name="Pass rate %"
              stroke="#15803d"
              strokeWidth={2}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="critical"
              name="Critical fails"
              stroke="#b91c1c"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="unknownOrError"
              name="Unknown/error"
              stroke="#475569"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-wrap gap-2 text-xs">
        {data.map((d) => (
          <li key={d.runId}>
            <Link
              href={`/app/assessments/${d.runId}`}
              className="rounded border border-border px-2 py-1 hover:bg-accent"
            >
              {d.label}:{" "}
              {d.passRate == null
                ? "n/a"
                : `${(d.passRate * 100).toFixed(0)}%`}{" "}
              · {d.fails} fails
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Every point links to the underlying assessment run. No vanity metrics.
      </p>
    </div>
  );
}
