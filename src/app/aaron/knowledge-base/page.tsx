import { KnowledgeBase } from "@/components/dashboard/KnowledgeBase";
import { AARON_KNOWLEDGE_BASE } from "@/lib/knowledge-base/aaron";

export default function KnowledgeBasePage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-strong)]">Knowledge Base</h1>
      <KnowledgeBase sections={AARON_KNOWLEDGE_BASE} />
    </div>
  );
}
