import { Users } from "lucide-react";
import { formatMoney } from "../lib/api";
import type { Friend, FriendRequestsPayload } from "../types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

type Props = {
  friends: Friend[];
  friendRecipient: string;
  setFriendRecipient: (value: string) => void;
  onSendRequest: () => void;
  requests: FriendRequestsPayload;
  onRespond: (id: string, action: "accept" | "decline") => void;
};

export function FriendsView({ friends, friendRecipient, setFriendRecipient, onSendRequest, requests, onRespond }: Props) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Card>
        <p className="mb-2 text-xs uppercase tracking-[0.2em]">Add Friend</p>
        <Input placeholder="friend email or username" value={friendRecipient} onChange={(e) => setFriendRecipient(e.target.value)} />
        <Button className="mt-3 w-full" onClick={onSendRequest}>Send request</Button>
      </Card>

      <Card className="lg:col-span-2">
        <p className="mb-2 text-xs uppercase tracking-[0.2em]">Friends & Balances</p>
        <div className="space-y-2">
          {friends.map((friend) => (
            <div key={friend.id} className="flex items-center justify-between rounded-xl bg-shell p-3 text-sm">
              <span className="flex items-center gap-2"><Users size={16} /> {friend.name}</span>
              <span>{friend.netBalanceCents < 0 ? `You owe ${formatMoney(-friend.netBalanceCents)}` : friend.netBalanceCents > 0 ? `${friend.name} owes you ${formatMoney(friend.netBalanceCents)}` : "Settled"}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <p className="mb-3 text-xs uppercase tracking-[0.2em]">Incoming Requests</p>
        <div className="space-y-2">
          {requests.incoming.length === 0 && <p className="text-sm">No incoming requests.</p>}
          {requests.incoming.map((req) => {
            const sender = req.sender as { name?: string; username?: string } | undefined;
            const id = String(req.id);
            return (
              <div key={id} className="flex items-center justify-between rounded-xl bg-shell p-3 text-sm">
                <span>{sender?.name ?? sender?.username ?? "Unknown"}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => onRespond(id, "accept")}>Accept</Button>
                  <Button variant="outline" onClick={() => onRespond(id, "decline")}>Decline</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
