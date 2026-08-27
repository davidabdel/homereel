"use client";

export default function BillingPage() {
  const invoices = [
    { id: "INV-001", date: "2025-08-01", amount: "$19.00", status: "Paid" },
    { id: "INV-002", date: "2025-09-01", amount: "$19.00", status: "Paid" },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card !p-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-[#131118]/70">Plan, renewal, credits, and invoices.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Plan */}
        <section className="glass-card !p-6 space-y-3 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-[#131118]/70">Current plan</div>
              <div className="text-xl font-semibold">Starter</div>
              <div className="text-xs text-[#131118]/60">Renews on Oct 1, 2025</div>
            </div>
            <div className="flex gap-2">
              <a className="btn-ghost" href="#">Manage in Stripe</a>
              <a className="btn-primary" href="#">Add credits</a>
            </div>
          </div>
        </section>

        {/* Credits */}
        <section className="glass-card !p-6 space-y-3">
          <div className="text-sm text-[#131118]/70">Credits left</div>
          <div className="text-3xl font-extrabold">12</div>
          <div className="text-xs text-[#131118]/60">Used for image & video generation</div>
        </section>
      </div>

      {/* Invoices */}
      <section className="glass-card !p-0 overflow-hidden">
        <div className="border-b-[3px] border-[#131118] px-4 py-3 font-semibold">Invoices</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[#131118]/70">
              <tr className="border-b-[3px] border-[#131118]">
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b-[3px] border-[#131118]">
                  <td className="px-4 py-3">{inv.id}</td>
                  <td className="px-4 py-3">{inv.date}</td>
                  <td className="px-4 py-3">{inv.amount}</td>
                  <td className="px-4 py-3">
                    <span className="border-[2px] border-[#131118] bg-[#D8FF3E] px-2 py-0.5 text-[10px] font-bold uppercase">{inv.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a className="btn-ghost" href="#">Download</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
