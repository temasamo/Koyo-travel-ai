"use client";

import { useState } from "react";
import MapView from "./components/MapView";
import ChatPanel from "./components/ChatPanel";

interface Location {
  name: string;
  type: string;
  confidence: number;
}

export default function Page() {
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
        <header className="p-4 text-xl font-semibold">古窯 旅AIマップ</header>
        <MapView locations={extractedLocations} onPlaceClick={handlePlaceClick} />
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