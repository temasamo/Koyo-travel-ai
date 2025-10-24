"use client";

import { useState } from "react";

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
}

export default function ChatPanel({ onLocationsExtracted }: ChatPanelProps) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "こんにちは！旅AIプランナーです。どちらから出発されますか？" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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
          
          if (extractData.locations && extractData.locations.length > 0) {
            onLocationsExtracted(extractData.locations);
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
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
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
