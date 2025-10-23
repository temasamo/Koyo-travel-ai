"use client";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    initMap: () => void;
  }
}

const categories = [
  { key: "nature", label: "自然", type: "tourist_attraction" },
  { key: "food", label: "食べる", type: "restaurant" },
  { key: "play", label: "遊ぶ", type: "amusement_park" },
  { key: "history", label: "歴史", type: "museum" },
];

export const MapView = ({ center, directions }: any) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [activeCategory, setActiveCategory] = useState("nature");

  const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";

  useEffect(() => {
    console.log("MapView useEffect triggered");
    console.log("GOOGLE_API_KEY:", GOOGLE_API_KEY);
    console.log("GOOGLE_API_KEY length:", GOOGLE_API_KEY?.length);
    console.log("Environment:", process.env.NODE_ENV);
    console.log("mapRef.current:", mapRef.current);
    
    const initializeMap = () => {
      console.log("initializeMap called");
      if (!mapRef.current) {
        console.log("mapRef.current is null");
        return;
      }
      console.log("Creating map instance");
      
      // 少し遅延を追加してDOMの準備を確実にする
      setTimeout(() => {
        if (!mapRef.current) {
          console.log("mapRef.current is null in setTimeout");
          return;
        }
        const mapInstance = new google.maps.Map(mapRef.current, {
          center: { lat: 38.1516, lng: 140.2728 },
          zoom: 12,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
        });
        console.log("Map instance created:", mapInstance);
        setMap(mapInstance);
      }, 100);
    };

    // ✅ すでにGoogle Mapsがロードされていれば再利用
    if (window.google && window.google.maps) {
      console.log("Google Maps already loaded, initializing map");
      initializeMap();
      return;
    }

    // ✅ 重複読み込み防止
    if (document.getElementById("google-maps-script")) {
      console.log("Google Maps script already exists");
      return;
    }

    console.log("Loading Google Maps script");
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&callback=initMap`;
    script.async = true;
    script.onerror = (error) => {
      console.error("Google Maps script failed to load:", error);
      console.error("API Key:", GOOGLE_API_KEY);
      console.error("Check if API key is valid and has proper permissions");
    };
    window.initMap = initializeMap;
    document.body.appendChild(script);
    console.log("Google Maps script added to document");
  }, []);

  // ✅ カテゴリ切り替えでピン更新
  useEffect(() => {
    if (!map) return;
    markers.forEach((m) => m.setMap(null));

    const service = new google.maps.places.PlacesService(map);
    const category = categories.find((c) => c.key === activeCategory);

    service.nearbySearch(
      {
        location: { lat: 38.1516, lng: 140.2728 },
        radius: 8000,
        type: category?.type,
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const newMarkers = results.map((place) => {
            const marker = new google.maps.Marker({
              map,
              position: place.geometry?.location,
              title: place.name,
            });

            const infoWindow = new google.maps.InfoWindow({
              content: `<div><strong>${place.name}</strong><br>${place.vicinity || ""}</div>`,
            });

            marker.addListener("click", () => infoWindow.open(map, marker));
            return marker;
          });
          setMarkers(newMarkers);
        }
      }
    );
  }, [activeCategory, map]);

  return (
    <div className="w-full">
      <div className="flex gap-2 mb-2">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setActiveCategory(c.key)}
            className={`px-3 py-1 rounded ${
              activeCategory === c.key ? "bg-green-600 text-white" : "bg-gray-200"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div 
        ref={mapRef} 
        className="w-full h-[600px] rounded-lg shadow"
        style={{ 
          width: '100%', 
          height: '600px',
          minHeight: '600px',
          backgroundColor: '#f0f0f0'
        }} 
      />
    </div>
  );
};

