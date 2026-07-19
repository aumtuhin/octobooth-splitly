import { Button } from "./ui/button";

export type View = "dashboard" | "friends" | "groups" | "expenses" | "activity" | "profile";

const VIEWS: View[] = ["dashboard", "friends", "groups", "expenses", "activity", "profile"];

type Props = {
  view: View;
  onSelect: (view: View) => void;
};

export function NavTabs({ view, onSelect }: Props) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {VIEWS.map((v) => (
        <Button key={v} variant={view === v ? "default" : "outline"} onClick={() => onSelect(v)}>
          {v[0].toUpperCase() + v.slice(1)}
        </Button>
      ))}
    </nav>
  );
}
