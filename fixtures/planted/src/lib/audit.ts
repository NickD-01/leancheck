import { prisma } from "./prisma";

type AuditEvent = { action: string; userId: string };

export async function recordAuditEvents(events: AuditEvent[]): Promise<void> {
  await Promise.all(events.map((event) => prisma.auditLog.create({ data: event })));
}

export async function loadAuditActors(ids: string[]) {
  return Promise.all(ids.map((id) => prisma.user.findUnique({ where: { id } })));
}

export async function countAuditEvents(userId: string) {
  const events = await prisma.auditLog.findMany({ where: { userId } });
  return events.length;
}
