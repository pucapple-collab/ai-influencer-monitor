
import { NextResponse } from "next/server";
import { getExecutions } from "../../lib/ai/execution-store";

export async function GET() {
  const executions = await getExecutions();

  const summary = {
    total: executions.length,
    completed: executions.filter((x) => x.status === "COMPLETED").length,
    blocked: executions.filter((x) => x.status === "BLOCKED").length,
    errors: executions.filter((x) => x.status === "ERROR").length,
    queued: executions.filter((x) => x.status === "QUEUED").length,
    estimatedCost: executions.reduce(
      (sum, x) => sum + (x.estimatedCost || 0),
      0
    ),
    actualCost: executions.reduce(
      (sum, x) => sum + (x.actualCost || 0),
      0
    ),
  };

  return NextResponse.json({
    ok: true,
    summary,
    executions,
  });
}
