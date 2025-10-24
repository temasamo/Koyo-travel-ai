"use client";
import { useEffect, useRef, useState } from "react";

interface Location {
  name: string;
  type: string;
  confidence: number;
}

interface MapViewProps {
  locations?: Location[];
}

export default function MapView({ locations = [] }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const routePolyline = useRef<google.maps.DirectionsRenderer | null>(null);

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
        center: target,
        zoom: 15,
        mapId: "KOYO_TRAVEL_AI_MAP",
      });
      setMap(mapInstance);
      setIsMapReady(true);
      console.log("✅ Map initialized successfully");

      const marker = new AdvancedMarkerElement({
        map: mapInstance,
        position: target,
        title: "上山温泉エリア",
      });

      const info = new google.maps.InfoWindow({ content: "読み込み中…" });

      marker.addListener("click", async () => {
        info.setContent("読み込み中…");
        info.open(mapInstance, marker);

        try {
          // 🥇 Step1: 検索して place_id を取得
          const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
              "X-Goog-FieldMask": "places.id",
            },
            body: JSON.stringify({
              textQuery: "あべくん珈琲 山形県上山市",
              languageCode: "ja",
              regionCode: "JP",
            }),
          });
          const searchData = await searchRes.json();
          const placeId = searchData.places?.[0]?.id;
          if (!placeId) throw new Error("place_id 取得失敗");

          // 🥈 Step2: 詳細取得
          const detailRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=ja&regionCode=JP`, {
            headers: {
              "X-Goog-Api-Key": String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
              "X-Goog-FieldMask": [
                "id",
                "displayName",
                "formattedAddress",
                "rating",
                "userRatingCount",
                "photos",
                "types",
                "websiteUri",
                "googleMapsUri",
                "editorialSummary",
                "currentOpeningHours",
              ].join(","),
            },
          });

          const place = await detailRes.json();
          console.log("📸 Full Place Detail:", place);

          // ✅ 写真生成
          let photoUrl = "";
          if (place.photos?.[0]?.name) {
            photoUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&maxWidthPx=400`;
          }

          const html = `
            <div style="width:300px;font-family:sans-serif;">
              ${photoUrl ? `<img src="${photoUrl}" style="width:100%;border-radius:8px;margin-bottom:8px;">` : ""}
              <h3>${place.displayName?.text ?? "名称不明"}</h3>
              <p>${place.formattedAddress ?? ""}</p>
              <p>⭐ ${place.rating ?? "-"} (${place.userRatingCount ?? 0}件)</p>
              ${place.editorialSummary?.text ? `<p>${place.editorialSummary.text}</p>` : ""}
              ${place.websiteUri ? `<p><a href="${place.websiteUri}" target="_blank">公式サイト</a></p>` : ""}
              <p><a href="${place.googleMapsUri}" target="_blank">Googleマップで見る</a></p>
            </div>
          `;
          info.setContent(html);
        } catch (e: any) {
          console.error("❌ Place fetch failed", e);
          info.setContent("<div>情報を取得できませんでした。</div>");
        }
      });
    };

    init();
  }, []);

  // 地名に基づいてピンを追加し、ルートを描画する機能
  useEffect(() => {
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

        // 既存のルートをクリア
        if (routePolyline.current) {
          routePolyline.current.setMap(null);
          routePolyline.current = null;
        }

        const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
        const geocodedPlaces: { name: string; location: google.maps.LatLng }[] = [];

        for (const location of locations) {
          try {
            // 地名で検索
            const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
                "X-Goog-FieldMask": "places.id,places.displayName,places.location",
              },
              body: JSON.stringify({
                textQuery: `${location.name} 山形県`,
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
                title: place.displayName?.text || location.name,
              });

              newMarkers.push(marker);
              geocodedPlaces.push({
                name: place.displayName?.text || location.name,
                location: position
              });
            }
          } catch (error) {
            console.error(`❌ マーカー追加失敗: ${location.name}`, error);
          }
        }

        setMarkers(newMarkers);

        // ルートを描画（2点以上ある場合）
        if (geocodedPlaces.length >= 2) {
          drawRoute(geocodedPlaces);
        }

        // マーカーが追加された場合、地図の中心を調整
        if (newMarkers.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          newMarkers.forEach(marker => {
            if (marker && marker.position) {
              bounds.extend(marker.position);
            }
          });
          if (!bounds.isEmpty()) {
            map.fitBounds(bounds);
          }
        }
      } catch (error) {
        console.error("❌ マーカー追加エラー:", error);
      }
    };

    addLocationMarkersAndRoute();
  }, [map, isMapReady, locations]);

  // 🔹 Directions APIでルートを描く関数
  const drawRoute = (geocodedPlaces: { name: string; location: google.maps.LatLng }[]) => {
    if (!map) return;

    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: true, // マーカーは独自に出してるので抑制
      preserveViewport: true,
      polylineOptions: {
        strokeColor: "#007BFF",
        strokeWeight: 5,
        strokeOpacity: 0.7,
      },
    });

    const waypoints = geocodedPlaces.slice(1, -1).map((p) => ({
      location: p.location,
      stopover: true,
    }));

    directionsService.route(
      {
        origin: geocodedPlaces[0].location,
        destination: geocodedPlaces[geocodedPlaces.length - 1].location,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRenderer.setDirections(result);
          routePolyline.current = directionsRenderer;
        } else {
          console.error("❌ ルート描画失敗:", status);
        }
      }
    );
  };

  return <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />;
}