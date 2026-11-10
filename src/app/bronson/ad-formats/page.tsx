import { BerlinHeader } from "@/components/berlin/Berlin";
import { AdFormatsBoard } from "./AdFormatsBoard";

/** Berlin / Ads / Ad formats — the Krueger method format library. */
export default function AdFormatsPage() {
  return (
    <div>
      <BerlinHeader
        title="Ad formats"
        subtitle="Every ad format in the method: why it works, its production style and length. Filter by goal or style."
      />
      <AdFormatsBoard />
    </div>
  );
}
