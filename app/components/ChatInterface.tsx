"use client";
import { useEffect, useState } from "react";
import { usePlanStore } from "@/store/planStore";

interface Location {
  name: string;
  type: string;
  confidence: number;
}

interface ExtractedLocations {
  locations: Location[];
}

interface ChatInterfaceProps {
  onLocationsExtracted?: (locations: Location[]) => void;
  selectedPlace?: string;
}

export default function ChatInterface({ onLocationsExtracted, selectedPlace }: ChatInterfaceProps) {
  const { planMessage } = usePlanStore();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "こんにちは！上山旅コンシェルジュです。行きたい場所や気分を教えてください。" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // 選択された場所の詳細説明
  useEffect(() => {
    if (selectedPlace && selectedPlace.trim()) {
      (async () => {
        try {
          const res = await fetch("/api/chat/travel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                { role: "user", content: `${selectedPlace}について詳しく教えてください。歴史、特徴、おすすめポイント、アクセス方法などを含めて教えてください。` },
              ],
            }),
          });
          const data = await res.json();
          setMessages((prev) => [...prev, { role: "assistant", content: `📍 ${selectedPlace}\n\n${data.reply}` }]);
        } catch (e) {}
      })();
    }
  }, [selectedPlace]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, newMessage] }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);

      if (data.reply && onLocationsExtracted) {
        const extractRes = await fetch("/api/extract-locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: data.reply }),
        });
        const extractData: ExtractedLocations = await extractRes.json();
        if (extractData.locations && extractData.locations.length > 0) {
          onLocationsExtracted(extractData.locations);
        }
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "エラーが発生しました。もう一度お試しください。" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 従来のチャットUI */}
      <div className="flex flex-col h-full bg-white rounded-2xl p-4 shadow-md">
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`p-3 rounded-2xl ${msg.role === "user" ? "bg-blue-100 text-right ml-auto max-w-[80%]" : "bg-gray-50 text-left mr-auto max-w-[80%]"}`}>
              {msg.content}
            </div>
          ))}
          {loading && <div className="text-gray-400 text-sm">AIが考えています...</div>}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            placeholder="メッセージを入力..."
            className="flex-1 p-2 border rounded-md focus:outline-none focus:ring"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !(e as any).nativeEvent.isComposing) handleSend();
            }}
          />
          <button onClick={handleSend} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md" disabled={loading}>
            送信
          </button>
        </div>
      </div>
    </div>
  );
}


