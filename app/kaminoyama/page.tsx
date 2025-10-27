"use client";

import { useState } from "react";
import MapView from "../components/MapView";
import ChatPanel from "../components/ChatPanel";

interface Location {
  name: string;
  type: string;
  confidence: number;
}

export default function KaminoyamaPage() {
  const [extractedLocations, setExtractedLocations] = useState<Location[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<string>("");

  const handleLocationsExtracted = (locations: Location[]) => {
    setExtractedLocations(locations);
  };

  const handlePlaceClick = (place: string) => {
    setSelectedPlace(place);
  };

  return (
    <main className="w-full h-screen flex">
      {/* 左側：マップエリア */}
      <div className="flex-1 flex flex-col">
        <header className="p-4 text-xl font-semibold bg-blue-50 border-b">
          🏔️ 上山温泉エリア - 旅AIマップ
        </header>
        <MapView 
          area="kaminoyama" 
          locations={extractedLocations} 
          onPlaceClick={handlePlaceClick} 
        />
      </div>
      
      {/* 右側：チャットパネル */}
      <div className="w-96 border-l bg-white">
        <div className="h-full">
          <ChatPanel 
            onLocationsExtracted={handleLocationsExtracted} 
            selectedPlace={selectedPlace}
          />
        </div>
      </div>
    </main>
  );
}
