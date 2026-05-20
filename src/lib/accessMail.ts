const RECIPIENTS = "founder@gpmai.dev,ziyad@gpmai.dev";

function buildMailto(bodyIntro: string) {
  const subject = "AgentWing Early Access Request";
  const body = `${bodyIntro}

I'm building:
Use case:
Team/company:
What agent actions I need to control:
Notes / bugs / enquiry:

Thanks.`;

  return `mailto:${RECIPIENTS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const EARLY_ACCESS_MAILTO = buildMailto(`Hi AgentWing team,

I'm interested in early access.`);

export const RUNTIME_LIMIT_MAILTO = buildMailto(`Hi AgentWing team,

I tested the Runtime Lab and want early access.`);
