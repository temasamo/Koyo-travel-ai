"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import extractLocation from "@/lib/extractLocation";

interface Location {
  name: string;
  type: string;
  confidence: number;
}

interface ExtractedLocations {
  locations: Location[];
}

interface AIPin {
  name: string;
  type: string;
}

interface ChatPanelProps {
  onLocationsExtracted?: (locations: Location[]) => void;
  selectedPlace?: string;
  systemPrompt?: string;
  initialMessages?: { role: string; content: string }[];
  onAIPinsExtracted?: (pins: AIPin[]) => void;
  aiName?: string;
}

export default function ChatPanel({ onLocationsExtracted, selectedPlace, systemPrompt, initialMessages, onAIPinsExtracted, aiName = "旅AIプランナー" }: ChatPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
    initialMessages || [
      { role: "assistant", content: `こんにちは！${aiName}です。どちらから出発されますか？` },
    ]
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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
    
    // 地名抽出による自動ルーティング
    const extractedLocation = extractLocation(input);
    if (extractedLocation) {
      // 上山温泉ページで他地域が指定された場合
      if (pathname === "/kaminoyama" && !input.includes("上山")) {
        router.push(`/planner?query=${encodeURIComponent(input)}`);
        return;
      }
      // 富士五湖ページで他地域が指定された場合
      if (pathname === "/fujigoko" && !input.includes("富士") && !input.includes("河口湖") && !input.includes("山中湖")) {
        router.push(`/planner?query=${encodeURIComponent(input)}`);
        return;
      }
    }
    
    const newMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);

    // API呼び出し
    try {
      const res = await fetch("/api/chat/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...messages, newMessage],
          systemPrompt: systemPrompt 
        }),
      });
      const data = await res.json();
      console.log("🔍 APIレスポンス:", data);
      console.log("🔍 data.pins:", data.pins);
      console.log("🔍 data.pins?.length:", data.pins?.length);

      // AIピンが含まれている場合の処理
      if (data.pins && data.pins.length > 0) {
        console.log("🤖 AIピン検出:", data.pins);
        if (onAIPinsExtracted) {
          onAIPinsExtracted(data.pins);
        }
        setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      } else {
        // 従来のテキストレスポンス
        console.log("📝 テキストレスポンス:", data.reply);
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }

      // 地名抽出（従来のテキストレスポンスの場合のみ）
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
