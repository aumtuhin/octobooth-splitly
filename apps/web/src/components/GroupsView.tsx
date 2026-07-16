import { formatMoney } from "../lib/api";
import type { Group } from "../types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

export type GroupFormState = {
  name: string;
  description: string;
};

type Props = {
  groups: Group[];
  groupForm: GroupFormState;
  setGroupForm: React.Dispatch<React.SetStateAction<GroupFormState>>;
  onCreateGroup: () => void;
  onSelectGroup: (id: string) => void;
};

export function GroupsView({ groups, groupForm, setGroupForm, onCreateGroup, onSelectGroup }: Props) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Card>
        <p className="mb-2 text-xs uppercase tracking-[0.2em]">Create Group</p>
        <Input placeholder="Group name" value={groupForm.name} onChange={(e) => setGroupForm((s) => ({ ...s, name: e.target.value }))} />
        <Input className="mt-2" placeholder="Description" value={groupForm.description} onChange={(e) => setGroupForm((s) => ({ ...s, description: e.target.value }))} />
        <Button className="mt-3 w-full" onClick={onCreateGroup}>Create group</Button>
      </Card>

      <Card className="lg:col-span-2">
        <p className="mb-2 text-xs uppercase tracking-[0.2em]">Your Groups</p>
        <div className="space-y-3">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              className="w-full rounded-xl bg-shell p-3 text-left transition hover:bg-aqua/30"
            >
              <p className="font-semibold">{group.name}</p>
              <p className="text-sm text-ink/70">{group.description || "No description"}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-white px-2 py-1">{group.memberCount} members</span>
                <span className="rounded-full bg-white px-2 py-1">{group.expenseCount} expenses</span>
                <span className="rounded-full bg-white px-2 py-1">{formatMoney(group.totalSpentCents)}</span>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </section>
  );
}
