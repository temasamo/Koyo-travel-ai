"use client";
import { usePlanStore } from "@/store/planStore";

interface Location {
  name: string;
  type: string;
  confidence: number;
}

interface ChatInterfaceProps {
  onLocationsExtracted?: (locations: Location[]) => void;
  selectedPlace?: string;
}

export default function ChatInterface({}: ChatInterfaceProps) {
  const { planMessage } = usePlanStore();

  return (
    <div className="bg-white rounded-2xl p-4 shadow-md space-y-4">
      <h2 className="text-lg font-semibold text-green-700">旅プランAI提案</h2>
      {planMessage ? (
        <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{planMessage}</p>
      ) : (
        <p className="text-gray-400">AIがプランを生成中です...</p>
      )}
    </div>
  );
}


