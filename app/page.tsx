"use client";
import React, { useState } from "react";
import { MapView } from "./components/MapView";
import RoutePlanner from "./components/RoutePlanner";

export default function Page() {
  const [routeData, setRouteData] = useState<any>(null);
  const [aiRoute, setAiRoute] = useState<string[]>([]);

  const handleCategorySelect = async (category: string) => {
    const res = await fetch("/api/ai/route/route", {
      method: "POST",
      body: JSON.stringify({ category }),
    });
    const data = await res.json();
    setRouteData(data);
  };

  return (
    <main className="p-6 text-center">
      <h1 className="text-2xl font-bold text-green-800 mb-4">古窯旅コンシェルAI（β）</h1>
      
      {/* AI旅程生成ボタン */}
      <RoutePlanner onRouteGenerated={setAiRoute} />
      
      {routeData && <pre className="text-left bg-gray-100 p-4 rounded-lg">{JSON.stringify(routeData, null, 2)}</pre>}
      
      <div className="mt-4">
        <MapView center={{ lat: 38.1517, lng: 140.2728 }} route={aiRoute} />
      </div>
    </main>
  );
}

