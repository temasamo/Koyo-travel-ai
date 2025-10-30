"use client";
import { useEffect, useRef, useState } from "react";
import CustomInfoPanel from "./CustomInfoPanel";
import { DEFAULT_ORIGIN, MAX_PROCESS_PLACES } from "@/constants/map";
import { filterPlacesByConfidence } from "@/utils/maps";

interface Location {
  name: string;
  type: string;
  confidence: number;
}

interface MapViewProps {
  locations?: Location[];
  onPlaceClick?: (place: string) => void;
}

export default function MapView({ locations = [], onPlaceClick }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const routePolyline = useRef<google.maps.DirectionsRenderer | null>(null);
  const infoWindows = useRef<google.maps.InfoWindow[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // グローバル関数を設定（CustomInfoPanel用）
  useEffect(() => {
    (window as any).openCustomPanel = (placeId: string) => {
      setSelectedPlaceId(placeId);
    };
  }, []);

  useEffect(() => {
    const loadGoogleMaps = () =>
      new Promise<void>((resolve, reject) => {
        if (window.google?.maps) return resolve();
        const s = document.createElement("script");
        s.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=marker,places&v=weekly`;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Google Maps failed to load"));
        document.head.appendChild(s);
      });

    const init = async () => {
      await loadGoogleMaps();
      const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;

      const target = { lat: 38.146, lng: 140.274 }; // 上山エリア中心
      const mapInstance = new Map(mapRef.current!, {
        zoom: 12,
        center: target,
        mapId: "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      setMap(mapInstance);
      setIsMapReady(true);
      console.log("✔ Map initialized successfully");
    };

    init();
  }, []);

  // 地名に基づいてピンを追加し、ルートを描画する機能
  useEffect(() => {
    console.log("🔍 MapView useEffect - map:", !!map, "isMapReady:", isMapReady, "locations:", locations);
    if (!map || !isMapReady || locations.length === 0) return;

    const addLocationMarkersAndRoute = async () => {
      try {
        const { AdvancedMarkerElement } = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;
        
        // 既存のマーカーとルートをクリア
        markers.forEach(marker => {
          if (marker && marker.map) {
            marker.map = null;
          }
        });
        setMarkers([]);

        // 既存の吹き出しをクリア
        infoWindows.current.forEach(infoWindow => {
          infoWindow.close();
        });
        infoWindows.current = [];

        // 既存のルートをクリア
        if (routePolyline.current) {
          routePolyline.current.setMap(null);
          routePolyline.current = null;
        }

        // フィルタリング適用（必ず1件以上になる）
        const candidates = filterPlacesByConfidence(locations);
        console.log(`📍 処理対象地点: ${candidates.length}件（制限: ${MAX_PROCESS_PLACES}）`);

        await resolveAndRender(candidates);
      } catch (error) {
        console.error("❌ マーカー・ルート描画エラー:", error);
      }
    };

    addLocationMarkersAndRoute();
  }, [map, isMapReady, locations]);

  // 地名解決とマーカー・ルート描画
  const resolveAndRender = async (candidates: any[]) => {
    if (!map) return;

    const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
    const resolved: { name: string; lat: number; lng: number; placeId?: string }[] = [];

    for (const candidate of candidates) {
      try {
        const query = candidate.name || candidate.text;
        if (!query) continue;

        // 地名で検索
        const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
            "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.photos,places.formattedAddress",
          },
          body: JSON.stringify({
            textQuery: `${query} 山形県`,
            languageCode: "ja",
            regionCode: "JP",
          }),
        });

        const searchData = await searchRes.json();
        const place = searchData.places?.[0];

        if (place?.location) {
          const position = new google.maps.LatLng(place.location.latitude, place.location.longitude);
          
          const marker = new AdvancedMarkerElement({
            map,
            position,
            title: place.displayName?.text || query,
          });

          // 画像・レーティング対応のInfoWindow
          const photoUrl = place.photos && place.photos.length > 0
            ? place.photos[0].getURI({ maxWidth: 300 })
            : null;

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="max-width:300px; font-family: system-ui, -apple-system, sans-serif;">
                ${photoUrl ? `
                  <img src="${photoUrl}" style="width:100%; border-radius:8px; aspect-ratio:16/9; object-fit:cover; margin-bottom:8px;" />
                ` : `
                  <div style="width:100%; aspect-ratio:16/9; background-color:#f3f4f6; border-radius:8px; margin-bottom:8px; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:12px;">
                    画像なし
                  </div>
                `}
                <h3 style="margin:8px 0 4px; font-size:16px; font-weight:bold;">${place.displayName?.text || query}</h3>
                <div style="opacity:.8; font-size:13px; color:#f59e0b; margin-bottom:4px;">
                  ⭐ ${place.rating ? place.rating.toFixed(1) : "-"}（${place.userRatingCount || 0}件）
                </div>
                <div style="margin-top:6px; font-size:13px; color:#6b7280;">
                  ${place.formattedAddress || ""}
                </div>
                <a href="https://www.google.com/maps/place/?q=place_id:${place.id}" target="_blank" 
                   style="display:inline-block;margin-top:8px; padding:4px 8px; background-color:#10b981; color:white; text-decoration:none; border-radius:4px; font-size:12px;">
                  Googleマップで見る
                </a>
              </div>
            `,
          });

          // マーカークリック時の処理
          marker.addListener("click", () => {
            infoWindows.current.forEach(iw => iw.close());
            infoWindow.open(map, marker);
            
            if (onPlaceClick) {
              onPlaceClick(place.displayName?.text || query);
            }
            
            map.panTo(position);
          });

          newMarkers.push(marker);
          infoWindows.current.push(infoWindow);
          resolved.push({ 
            name: place.displayName?.text || query, 
            lat: place.location.latitude, 
            lng: place.location.longitude,
            placeId: place.id
          });
        }
      } catch (error) {
        console.error(`❌ 地点検索エラー (${candidate.name}):`, error);
      }
    }

    if (resolved.length > 0) {
      setMarkers(newMarkers);
      drawRouteFromOrigin(resolved);
    }
  };

  // 古窯旅館からのルート描画
  const drawRouteFromOrigin = (points: { name: string; lat: number; lng: number; placeId?: string }[]) => {
    if (!map || points.length === 0) return;

    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({ 
      suppressMarkers: true, 
      map: map,
      polylineOptions: {
        strokeColor: "#007BFF",
        strokeWeight: 3,
        strokeOpacity: 0.6,
      }
    });

    const waypoints = points.slice(0, Math.max(0, points.length - 1)).map(p => ({ 
      location: { lat: p.lat, lng: p.lng }, 
      stopover: true 
    }));

    directionsService.route({
      origin: DEFAULT_ORIGIN,
      destination: { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng },
      waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true,
    }, (result, status) => {
      if (status === "OK" && result) {
        directionsRenderer.setDirections(result);
        routePolyline.current = directionsRenderer;
        console.log("✅ ルート描画成功");
      } else {
        console.warn("⚠️ ルート描画失敗:", status);
      }
    });
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />
      {selectedPlaceId && (
        <CustomInfoPanel 
          placeId={selectedPlaceId} 
          onClose={() => setSelectedPlaceId(null)} 
        />
      )}
    </div>
  );
}
