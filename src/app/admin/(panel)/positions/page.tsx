import type { Metadata } from "next";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPosition, deletePosition, updatePosition } from "./actions";

export const metadata: Metadata = { title: "Positions" };

export default async function PositionsPage() {
  await requireAdmin("admin");
  const groups = await db.positionGroup.findMany({
    orderBy: { displayOrder: "asc" },
    include: { positions: { orderBy: { displayOrder: "asc" }, include: { _count: { select: { candidacies: true } } } } },
  });

  return (
    <div>
      <h1 className="text-[1.75rem]">Positions</h1>
      <p className="mt-1 max-w-2xl text-ink-muted">
        Ballot sections and the posts within them. The display order controls how posts are listed on the site. Assign
        candidates to positions from each candidate’s page.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.id} className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
              <h2 className="border-b border-line bg-canvas px-4 py-2.5 font-sans text-[1.0625rem] font-semibold">{g.name}</h2>
              <ul className="divide-y divide-line">
                {g.positions.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-end gap-3 px-4 py-3">
                    <ActionForm action={updatePosition} className="flex flex-1 flex-wrap items-end gap-3">
                      <input type="hidden" name="id" value={p.id} />
                      <div className="min-w-[14rem] flex-1">
                        <label htmlFor={`name-${p.id}`} className="sr-only">Position name</label>
                        <input id={`name-${p.id}`} name="name" defaultValue={p.name} className="input" maxLength={150} required />
                      </div>
                      <div className="w-24">
                        <label htmlFor={`order-${p.id}`} className="field-hint">Order</label>
                        <input id={`order-${p.id}`} name="displayOrder" type="number" min={0} defaultValue={p.displayOrder} className="input tabular" />
                      </div>
                      <span className="tabular pb-2.5 text-sm text-ink-muted">{p._count.candidacies} on ballot</span>
                      <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">Save</SubmitButton>
                    </ActionForm>
                    {p._count.candidacies === 0 && (
                      <ActionForm action={deletePosition} className="">
                        <input type="hidden" name="id" value={p.id} />
                        <SubmitButton size="sm" variant="danger" confirm={`Delete the position “${p.name}”?`}>Delete</SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="self-start rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          <h2 className="font-sans text-[1.0625rem] font-semibold">Add a position</h2>
          <ActionForm action={createPosition} className="mt-4 space-y-4">
            <div>
              <label htmlFor="groupId" className="field-label">Section</label>
              <select id="groupId" name="groupId" className="input" defaultValue={groups[0]?.id ?? "new"}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
                <option value="new">New section…</option>
              </select>
            </div>
            <Field name="newGroup" label="New section name" hint="Only used when “New section…” is selected." maxLength={150} />
            <Field name="name" label="Position name" required maxLength={150} />
            <Field name="displayOrder" label="Display order" type="number" defaultValue="100" required />
            <SubmitButton pendingLabel="Adding…">Add position</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
