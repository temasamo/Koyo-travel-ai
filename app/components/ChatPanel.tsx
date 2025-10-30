"use client";

import { useState, useEffect } from "react";
import { usePlanStore } from "@/store/planStore";

interface Location {
  name: string;
  type: string;
  confidence: number;
}

interface ExtractedLocations {
  locations: Location[];
}

interface ChatPanelProps {
  onLocationsExtracted?: (locations: Location[]) => void;
  selectedPlace?: string;
}

export default function ChatPanel({ onLocationsExtracted, selectedPlace }: ChatPanelProps) {
  const { planPhase, origin, lodging, setOrigin, setLodging, setPhase } = usePlanStore();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "こんにちは！上山旅コンシェルジュです。どちらから出発されますか？" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // フェーズ: selecting の時は入力フォームを表示し、チャットUIは非表示
  if (planPhase === "selecting") {
    return (
      <div className="p-4 space-y-4 bg-gray-50 rounded-2xl shadow-sm">
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
    );
  }

  // 選択された場所の詳細説明を取得
  useEffect(() => {
    if (selectedPlace && selectedPlace.trim()) {
      const fetchPlaceDetails = async () => {
        try {
          const res = await fetch("/api/chat/travel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              messages: [
                { role: "user", content: `${selectedPlace}について詳しく教えてください。歴史、特徴、おすすめポイント、アクセス方法などを含めて教えてください。` }
              ] 
            }),
          });
          const data = await res.json();
          
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `📍 ${selectedPlace}について\n\n${data.reply}` },
          ]);
        } catch (error) {
          console.error("場所詳細取得エラー:", error);
        }
      };

      fetchPlaceDetails();
    }
  }, [selectedPlace]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);

    // API呼び出し
    try {
      const res = await fetch("/api/chat/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, newMessage] }),
      });
      const data = await res.json();

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);

      // 地名抽出
      if (data.reply && onLocationsExtracted) {
        try {
          const extractRes = await fetch("/api/extract-locations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: data.reply }),
          });
          const extractData: ExtractedLocations = await extractRes.json();
          console.log("🔍 地名抽出結果:", extractData);
          
          if (extractData.locations && extractData.locations.length > 0) {
            console.log("📍 抽出された地名:", extractData.locations);
            onLocationsExtracted(extractData.locations);
          } else {
            console.log("❌ 地名が抽出されませんでした");
          }
        } catch (extractError) {
          console.error("地名抽出エラー:", extractError);
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "エラーが発生しました。もう一度お試しください。" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* メッセージ表示エリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-3 rounded-2xl ${
              msg.role === "user"
                ? "bg-blue-100 text-right ml-auto max-w-[80%]"
                : "bg-white text-left mr-auto max-w-[80%] shadow-sm"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && <div className="text-gray-400 text-sm">AIが考えています...</div>}
      </div>

      {/* 入力フォーム */}
      <div className="p-3 border-t bg-white flex gap-2">
        <input
          type="text"
          placeholder="メッセージを入力..."
          className="flex-1 p-2 border rounded-md focus:outline-none focus:ring"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // 日本語入力中でない場合のみ送信
              if (!e.nativeEvent.isComposing && e.keyCode !== 229) {
                handleSend();
              }
            }
          }}
        />
        <button
          onClick={handleSend}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
          disabled={loading}
        >
          送信
        </button>
      </div>
    </div>
  );
}
