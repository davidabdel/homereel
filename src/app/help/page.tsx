export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div className="glass-card !p-6">
        <h1 className="text-2xl font-bold">Help & FAQ</h1>
        <p className="text-sm text-[#131118]/70">Search our knowledge base or contact us.</p>
      </div>

      <div className="glass-card !p-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input placeholder="Search articles" className="rounded-xl bg-white border-[3px] border-[#131118] px-4 py-3 outline-none" />
          <button className="btn-primary">Search</button>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <div className="font-semibold">Getting started</div>
            <ul className="mt-2 space-y-1 text-sm text-[#131118]/80">
              <li>• Create your first reel</li>
              <li>• Persona generation</li>
              <li>• Dialogue best practices</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold">Billing</div>
            <ul className="mt-2 space-y-1 text-sm text-[#131118]/80">
              <li>• Plans & pricing</li>
              <li>• Credits</li>
              <li>• Invoices</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold">Troubleshooting</div>
            <ul className="mt-2 space-y-1 text-sm text-[#131118]/80">
              <li>• Upload issues</li>
              <li>• Generation failed</li>
              <li>• Quotas</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="glass-card !p-6">
        <div className="font-semibold">Contact us</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input placeholder="Your email" className="rounded-xl bg-white border-[3px] border-[#131118] px-4 py-3 outline-none" />
          <input placeholder="Subject" className="rounded-xl bg-white border-[3px] border-[#131118] px-4 py-3 outline-none" />
          <textarea placeholder="How can we help?" className="min-h-[120px] rounded-xl bg-white border-[3px] border-[#131118] px-4 py-3 outline-none sm:col-span-2" />
          <button className="btn-primary w-max">Send</button>
        </div>
        <div className="mt-2 text-xs text-[#131118]/60">This would connect to Zendesk or email in production.</div>
      </div>
    </div>
  );
}
