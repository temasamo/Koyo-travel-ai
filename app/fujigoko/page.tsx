"use client";

import { useState } from "react";
import MapView from "../components/MapView";
import ChatPanel from "../components/ChatPanel";

interface Location {
  name: string;
  type: string;
  confidence: number;
}

interface AIPin {
  name: string;
  type: string;
}

export default function FujigokoPage() {
  const [extractedLocations, setExtractedLocations] = useState<Location[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<string>("");
  const [aiPins, setAiPins] = useState<AIPin[]>([]);

  // 🗻 富士五湖専用システムプロンプト
  const systemPrompt = `
あなたは「富士五湖エリア」の旅AIプランナー『湖香（ここ）』です。
山梨県の山中湖・河口湖・西湖・精進湖・本栖湖を中心に、
観光、宿泊、温泉、グルメなどの旅行プランを提案してください。

### 行動ルール
- 出発地はユーザーの入力から取得してください。
- 目的地は必ず富士五湖エリア（特に山中湖周辺）とします。
- 上山温泉や山形県など、他地域の情報は一切含めないでください。
- 富士五湖エリアの温泉（例：紅富士の湯）、カフェ、宿泊施設を優先して紹介。
- トーンは明るく親しみやすく、「地元の人が教えるおすすめ」スタイルで話してください。
- 回答は、天候や季節（紅葉・冬の雪景色など）にも軽く触れてOKです。

### 役割設定
- あなたの名前は「湖香（ここ）」です。
- 富士五湖エリアを担当するローカル旅AIとしてユーザーを案内します。
- 冒頭で自己紹介を入れてください（例：「こんにちは！富士五湖担当AIの湖香です！」）。

### ピン表示機能
- ユーザーが「ケーキ屋さんを探して」「カフェを教えて」など具体的な施設検索を求めた場合のみ
- 以下のJSON形式で回答してください：
{
  "response": "富士五湖エリアのおすすめケーキ屋さんを2件見つけました！",
  "pins": [
    { "name": "パティスリー山中湖", "type": "ai" },
    { "name": "スイーツガーデン河口湖", "type": "ai" }
  ]
}

- 通常の旅行プラン相談の場合は、従来通りテキストで回答してください
`;

  const [introMessage] = useState({
    role: "assistant",
    content: "🗻 こんにちは！富士五湖担当AI『湖香（ここ）』です。山中湖や紅富士の湯など、現地のおすすめを紹介しますね！",
  });

  const handleLocationsExtracted = (locations: Location[]) => {
    setExtractedLocations(locations);
  };

  const handlePlaceClick = (place: string) => {
    setSelectedPlace(place);
  };

  const handleAIPinsExtracted = (pins: AIPin[]) => {
    setAiPins(pins);
  };

  return (
    <main className="w-full h-screen flex">
      {/* 左側：マップエリア */}
      <div className="flex-1 flex flex-col">
        <header className="p-4 text-xl font-semibold bg-red-50 border-b">
          🗻 富士五湖エリア - 旅AIマップ
        </header>
        <MapView 
          area="fujigoko" 
          locations={extractedLocations} 
          onPlaceClick={handlePlaceClick}
          aiPins={aiPins}
        />
      </div>
      
      {/* 右側：チャットパネル */}
      <div className="w-96 border-l bg-white">
        <div className="h-full">
          <ChatPanel 
            onLocationsExtracted={handleLocationsExtracted} 
            selectedPlace={selectedPlace}
            systemPrompt={systemPrompt}
            initialMessages={[introMessage]}
            onAIPinsExtracted={handleAIPinsExtracted}
          />
        </div>
      </div>
    </main>
  );
}
