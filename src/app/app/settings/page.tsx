"use client";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="glass-card !p-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-[#131118]/70">Manage your profile, API connections, and preferences.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile */}
        <section className="glass-card !p-6 space-y-4">
          <div className="font-semibold">Profile</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-[#131118]/80" htmlFor="name">Name</label>
              <input id="name" className="w-full rounded-xl bg-white border-[3px] border-[#131118] px-4 py-3 outline-none" defaultValue="Jane Doe" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#131118]/80" htmlFor="email">Email</label>
              <input id="email" className="w-full rounded-xl bg-white border-[3px] border-[#131118] px-4 py-3 outline-none" defaultValue="jane@example.com" />
            </div>
          </div>
          <button className="btn-primary w-max">Save profile</button>
        </section>

        {/* API Connections */}
        <section className="glass-card !p-6 space-y-4">
          <div className="font-semibold">API Connections</div>
          <div className="space-y-3">
            {[
              { name: "Gemini", key: "GEMINI_KEY" },
              { name: "OpenAI", key: "OPENAI_KEY" },
              { name: "Veo", key: "VEO_KEY" },
            ].map((p) => (
              <div key={p.name} className="border-[3px] border-[#131118] bg-[#131118]/5 p-4">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input placeholder={`Add ${p.name} key`} className="rounded-xl bg-white border-[3px] border-[#131118] px-4 py-3 outline-none" />
                  <button className="btn-ghost">Connect</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Content preferences */}
        <section className="glass-card !p-6 space-y-4 md:col-span-2">
          <div className="font-semibold">Content preferences</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-[#131118]/80">Default aspect ratio</label>
              <select className="w-full rounded-xl bg-white border-[3px] border-[#131118] px-4 py-3 outline-none">
                <option>1080×1350 (4:5)</option>
                <option>1080×1920 (9:16)</option>
                <option>1080×1080 (1:1)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#131118]/80">Default voice</label>
              <select className="w-full rounded-xl bg-white border-[3px] border-[#131118] px-4 py-3 outline-none">
                <option>Default</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[#131118]/80">Brand color</label>
              <input type="color" className="h-12 w-full rounded-xl bg-white border-[3px] border-[#131118] p-1" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary">Save preferences</button>
            <button className="btn-ghost">Export data</button>
            <button className="btn-ghost">Delete account</button>
          </div>
        </section>
      </div>
    </div>
  );
}
