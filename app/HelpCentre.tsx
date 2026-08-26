"use client";

const guides = [
  {
    title: "First sign-in",
    audience: "Everyone",
    steps: [
      "Ask your company administrator for the company BB App address or invitation link.",
      "Open the address in a browser, or enter it once in the BB App desktop launcher.",
      "Sign in using the email and temporary password issued by the administrator.",
      "Change the temporary password when prompted and complete the short onboarding checklist.",
    ],
  },
  {
    title: "Member essentials",
    audience: "Members",
    steps: [
      "Use Home to check upcoming meetings, announcements and work requiring attention.",
      "Open Progress to see your attendance percentage and awards without editing official records.",
      "Use Requests to submit eligible award applications and uniform requests, then follow their status.",
      "Use Resources for files your role is allowed to view, and request a profile correction if your details are wrong.",
    ],
  },
  {
    title: "Squad management",
    audience: "NCOs and Squad Leaders",
    steps: [
      "Use People to view your assigned squad and update permitted member details.",
      "Take attendance only for the squad and meetings available to your account.",
      "Review squad leave or service-hour work when assigned, while official award records remain read-only.",
      "Use Programme for duties, parade plans and announcements available to your role.",
    ],
  },
  {
    title: "Company administration",
    audience: "Officers and Administrators",
    steps: [
      "Start from Home and clear the Action Centre queues that link directly to pending work.",
      "Use Manage for award reviews, uniform requests, stock, onboarding, accounts and reports.",
      "Keep member and officer classifications complete so annual Company Statistics calculate correctly.",
      "Use Accounts and roles to apply company branding, create users and grant only the access each person needs.",
    ],
  },
  {
    title: "Stock and uniform requests",
    audience: "Quartermasters",
    steps: [
      "Open Manage, then Stock Centre to review inventory, low stock and recent movements.",
      "Move uniform requests from Pending to Approved, Ready for collection and Issued.",
      "Link every new issue or return to the correct member and confirm the success message before repeating an action.",
      "Do not issue defective items; use transaction history and audit records when checking discrepancies.",
    ],
  },
];

export default function HelpCentre() {
  return (
    <main className="help-centre-page">
      <header className="category-page-header">
        <div>
          <p className="eyebrow">HELP &amp; TUTORIALS</p>
          <h1>Learn BB App</h1>
          <p>Short, role-based guides for connecting, signing in and completing common work safely.</p>
        </div>
        <div className="help-header-actions">
          <a className="primary-button" href="https://nahtanugn.github.io/BB-App/setup/" target="_blank" rel="noreferrer">New company setup</a>
          <a className="secondary-button" href="https://github.com/nahtanugn/BB-App/raw/main/tutorial-output/BB-App-User-Guide.pptx" target="_blank" rel="noreferrer">Download slides</a>
        </div>
      </header>

      <section className="help-guide-callout panel">
        <div><p className="eyebrow">BB GUIDE</p><h2>Help that follows the page you are using</h2><p>Choose <strong>Help me</strong> in the app navigation for instructions in English, 中文 or Bahasa Malaysia. The guide explains your permitted actions and remembers your progress.</p></div>
        <a className="secondary-button" href="https://nahtanugn.github.io/BB-App/setup/" target="_blank" rel="noreferrer">Open setup guide</a>
      </section>

      <section className="help-start panel">
        <div><span aria-hidden="true">1</span><div><strong>Connect</strong><small>Use the company address supplied by an administrator.</small></div></div>
        <div><span aria-hidden="true">2</span><div><strong>Sign in</strong><small>Use only your own account and change a temporary password.</small></div></div>
        <div><span aria-hidden="true">3</span><div><strong>Follow your role</strong><small>The app shows only the tools your account is authorised to use.</small></div></div>
      </section>

      <section className="help-guide-list" aria-label="Role tutorials">
        {guides.map((guide, index) => (
          <details className="panel" key={guide.title} open={index === 0}>
            <summary><div><strong>{guide.title}</strong><small>{guide.audience}</small></div><span aria-hidden="true">＋</span></summary>
            <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          </details>
        ))}
      </section>

      <section className="help-safety panel">
        <div aria-hidden="true">!</div>
        <div><h2>Keep company data safe</h2><p>Never share passwords, setup codes, private exports or sensitive member details. Contact an Officer or Administrator if access or personal information is incorrect.</p></div>
      </section>
    </main>
  );
}
