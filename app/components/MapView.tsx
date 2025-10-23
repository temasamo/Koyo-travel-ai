"use client";
import { useEffect, useRef } from "react";

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function initMap() {
      if (!mapRef.current) return;

      // ✅ APIキーを設定
      (globalThis as any).google = (globalThis as any).google || {};
      await (window as any).google.maps.importLibrary("maps");
      await (window as any).google.maps.importLibrary("marker");
      await (window as any).google.maps.importLibrary("places");

      // ✅ セットアップ
      const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;

      // ✅ 地図インスタンスを作成
      const map = new Map(mapRef.current, {
        center: { lat: 38.149, lng: 140.273 },
        zoom: 14,
        mapId: "KOYO_TRAVEL_MAP",
      });

      // ✅ マーカー（新仕様）
      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: 38.1505, lng: 140.275 },
        title: "古窯旅館",
      });

      console.log("✅ Google Map initialized:", map, marker);
    }

    initMap().catch((err) => console.error("Map initialization failed:", err));
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "600px",
        borderRadius: "12px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      }}
    />
  );
}

