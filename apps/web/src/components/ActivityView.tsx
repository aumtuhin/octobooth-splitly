import type { Activity } from "../types";
import { Card } from "./ui/card";

type Props = {
  activity: Activity[];
};

export function ActivityView({ activity }: Props) {
  return (
    <section className="grid gap-3">
      {activity.map((item) => (
        <Card key={item.id} className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{item.actor.name}</p>
            <p className="text-sm text-ink/80">{item.type.replaceAll("_", " ").toLowerCase()}</p>
          </div>
          <p className="text-xs text-ink/60">{new Date(item.createdAt).toLocaleString()}</p>
        </Card>
      ))}
    </section>
  );
}
