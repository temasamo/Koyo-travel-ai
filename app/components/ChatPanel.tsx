"use client";
import { useEffect } from "react";
import { usePlanStore } from "@/store/planStore";
import ChatInterface from "./ChatInterface";

interface Location {
  name: string;
  type: string;
  confidence: number;
}

interface ChatPanelProps {
  onLocationsExtracted?: (locations: Location[]) => void;
  selectedPlace?: string;
}

export default function ChatPanel({ onLocationsExtracted, selectedPlace }: ChatPanelProps) {
  const { setPlanMessage } = usePlanStore();

  return (
    <div className="p-4">
      <ChatInterface onLocationsExtracted={onLocationsExtracted} selectedPlace={selectedPlace} />
    </div>
  );
}
