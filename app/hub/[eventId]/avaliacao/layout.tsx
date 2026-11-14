import { JudgingTabs } from "@/components/judging/JudgingTabs";
import { hasRole } from "@/lib/access";
import { loadHubEvent } from "@/lib/hub-data";

export default async function JudgingLayout({ children, params }: { children: React.ReactNode; params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, role } = await loadHubEvent(eventId);
  return (
    <>
      <JudgingTabs eventId={event.id} isAdmin={hasRole(role, "admin")} />
      {children}
    </>
  );
}
