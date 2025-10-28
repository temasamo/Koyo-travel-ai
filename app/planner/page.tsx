"use client";
import { useEffect } from "react";
import MapView from "../components/MapView";
import ChatPanel from "../components/ChatPanel";
import { systemPrompt } from "./systemPrompt";

export default function PlannerPage() {
  useEffect(() => {
    console.log("PlannerPage loaded: 全国AIナビ起動中");
  }, []);

  return (
    <div className="relative w-full h-screen">
      {/* 上部にMap */}
      <MapView defaultCenter={{ lat: 35.68, lng: 139.76 }} defaultZoom={6} />
      {/* 下部にチャット */}
      <div className="absolute bottom-0 left-0 w-full bg-white/70 backdrop-blur-md border-t border-gray-200">
        <ChatPanel aiName="ナビ" systemPrompt={systemPrompt} />
      </div>
    </div>
  );
}
