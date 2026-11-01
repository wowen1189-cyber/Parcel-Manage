import { Card, Notice } from "@/components/ui";
import { requireTenant } from "@/lib/portal";
import { MessageForm } from "./message-form";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { supabase, me, company } = await requireTenant();
  const { data: messages } = await supabase.from("message").select("id, direction, body, sender_name, sender_title, created_at").eq("contact_id", me.id).order("created_at").limit(200);
  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold">Messages</h1>
      <Notice>For repairs, use Repairs so it gets to the right person fastest. For emergencies, call 911 first.</Notice>
      <Card className="space-y-3 p-5">
        {messages?.length ? (
          messages.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-[14px] px-4 py-3 text-[15px] ${m.direction === "inbound" ? "ml-auto bg-accent-softer" : "bg-surface-muted"}`}>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className="mt-1 text-[12px] text-subtle">
                {m.direction === "inbound" ? "You" : [m.sender_name, m.sender_title].filter(Boolean).join(", ")} ·{" "}
                {new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: company.time_zone })}
              </p>
            </div>
          ))
        ) : (
          <p className="text-muted">No messages yet.</p>
        )}
      </Card>
      <MessageForm />
    </div>
  );
}
