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
  const { planPhase, origin, lodging, setOrigin, setLodging, setPhase, setPlanMessage } = usePlanStore();

  // planning になったらAIへ自動リクエスト
  useEffect(() => {
    if (planPhase === "planning" && origin && lodging) {
      (async () => {
        try {
          const prompt = `出発地: ${origin}、宿泊地: ${lodging}。この条件で3泊4日の旅行プランを提案してください。観光地・温泉・食事内容も含めてください。`;
          const res = await fetch("/api/ai/travelplan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
          });
          const data = await res.json();
          setPlanMessage(data.plan || "プランの生成に失敗しました。");
        } catch (e) {
          setPlanMessage("プランの生成に失敗しました。");
        }
      })();
    }
  }, [planPhase, origin, lodging, setPlanMessage]);

  return (
    <div className="p-4">
      {planPhase === "selecting" ? (
        <div className="space-y-4 bg-gray-50 rounded-2xl shadow-sm p-4">
          <h2 className="text-lg font-semibold">旅の出発地と宿泊地を教えてください</h2>

          <div>
            <label className="block text-sm mb-1">出発地</label>
            <input
              type="text"
              value={origin || ""}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="例：東京駅"
              className="border rounded-md w-full p-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">宿泊地</label>
            <input
              type="text"
              value={lodging || ""}
              onChange={(e) => setLodging(e.target.value)}
              placeholder="例：古窯旅館"
              className="border rounded-md w-full p-2"
            />
          </div>

          <button
            disabled={!origin || !lodging}
            onClick={() => setPhase("planning")}
            className="bg-green-600 text-white rounded-lg px-4 py-2 disabled:opacity-50"
          >
            プランを作成する
          </button>
        </div>
      ) : (
        <ChatInterface onLocationsExtracted={onLocationsExtracted} selectedPlace={selectedPlace} />
      )}
    </div>
  );
}
