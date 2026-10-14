import { KnowledgeBase } from "@/components/dashboard/KnowledgeBase";
import { AVAL_KNOWLEDGE_BASE } from "@/lib/knowledge-base/aval";

export default function KnowledgeBasePage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--text-strong)]">Knowledge Base</h1>
      <KnowledgeBase sections={AVAL_KNOWLEDGE_BASE} />
    </div>
  );
}
