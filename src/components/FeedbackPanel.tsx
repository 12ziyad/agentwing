import type { AgentWingDecision } from "@/lib/types";
import { FileJson2 } from "lucide-react";

export function FeedbackPanel({ feedback }: { feedback?: AgentWingDecision }) {
  return (
    <section className="panel min-h-[250px]">
      <div className="panel-title">
        <FileJson2 size={16} />
        Latest AgentWing Feedback JSON
      </div>
      <pre className="mt-4 max-h-[190px] overflow-auto rounded-lg border border-white/10 bg-[#080b14] p-3 font-mono text-xs leading-5 text-cyan-100">
        {feedback
          ? JSON.stringify(feedback, null, 2)
          : JSON.stringify(
              {
                decision: "pending",
                reason: "Run the agent to see structured policy feedback.",
              },
              null,
              2,
            )}
      </pre>
    </section>
  );
}
