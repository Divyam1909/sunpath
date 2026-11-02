import { istDate } from "@/domain/format";
import { db } from "@/server/db";
import { requireStaff } from "@/server/guards";

export default async function MessagesPage() {
  await requireStaff();
  const messages = await db.messageOutbox.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { lead: { select: { name: true, code: true } } },
  });
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-medium">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          WhatsApp is mocked: this outbox shows each message as the customer would get it, in their language.
        </p>
      </div>
      {messages.length === 0 ? (
        <p className="rounded-xl bg-muted px-6 py-10 text-center text-muted-foreground">Messages appear here when a lead is confirmed or a project moves stage.</p>
      ) : (
        <ul className="grid">
          {messages.map((message) => (
            <li key={message.id} data-testid="outbox-row" className="grid gap-1 border-b py-3 sm:grid-cols-[13rem_1fr] sm:gap-6">
              <div className="text-sm">
                <p className="font-medium">{message.lead.name}</p>
                <p className="tabular text-muted-foreground">
                  ••••{message.toPhone.slice(-4)}, {message.locale}, {istDate(message.createdAt)}
                </p>
              </div>
              <p className="max-w-prose text-sm leading-relaxed break-words">{message.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
