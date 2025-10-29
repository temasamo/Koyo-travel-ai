"use client";
import { useEffect, useRef, useState } from "react";
import CustomInfoPanel from "./CustomInfoPanel";

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

        const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
        const geocodedPlaces: { name: string; location: google.maps.LatLng }[] = [];

        // Quota管理: テスト用の地点制限
        const testPlaces = process.env.NEXT_PUBLIC_TEST_PLACES?.split(",") ?? [];
        const filteredLocations = testPlaces.length > 0 
          ? locations.filter(loc => testPlaces.includes(loc.name))
          : locations;

        console.log(`📍 処理対象地点: ${filteredLocations.length}件 (制限: ${testPlaces.length > 0 ? testPlaces.join(", ") : "なし"})`);

        for (const location of filteredLocations) {
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

              // 吹き出しを作成
              const infoWindow = new google.maps.InfoWindow({
                content: `<div style="min-width:200px; font-size:14px;">${place.displayName?.text || location.name}</div>`,
              });

              // マーカークリック時の処理
              marker.addListener("click", async () => {
                // 既存の吹き出しを全部閉じる
                infoWindows.current.forEach(iw => iw.close());

                try {
                  // Step 1: Google Places詳細情報を取得
                  const { Place } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
                  const placeDetails = new Place({
                    id: place.id,
                  });

                  const fields = ["displayName", "formattedAddress", "rating", "userRatingCount", "photos", "websiteURI"];
                  const details = await placeDetails.fetchFields({ fields });

                  // AI要約を取得
                  const res = await fetch("/api/chat/summary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ place: details.place.displayName || location.name }),
                  });
                  const data = await res.json();

                  // Step 2: 画像を含むInfoWindowコンテンツ
                  const photoUrl = details.place.photos && details.place.photos.length > 0
                    ? details.place.photos[0].getURI({ maxWidth: 300 })
                    : null;

                  // GoogleマップURLを生成（placeIdから安全に）
                  const gmUrl = `https://www.google.com/maps/place/?q=place_id:${place.id}`;
                  
                  // websiteは要求しないので、存在すれば使用（型安全のためany経由）
                  const website = (details.place as any).website && typeof (details.place as any).website === "string"
                    ? (details.place as any).website
                    : null;

                  const content = `
                    <div style="max-width: 320px; font-family: system-ui, -apple-system, sans-serif;">
                      ${photoUrl ? `
                        <img src="${photoUrl}" alt="${details.place.displayName || location.name}" 
                             style="width: 100%; aspect-ratio: 16/9; border-radius: 8px; margin-bottom: 8px; object-fit: cover;" />
                      ` : `
                        <div style="width: 100%; aspect-ratio: 16/9; background-color: #f3f4f6; border-radius: 8px; margin-bottom: 8px; 
                                    display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 12px;">
                          画像なし
                        </div>
                      `}
                      <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #1f2937;">
                        ${details.place.displayName || location.name}
                      </h3>
                      <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280;">
                        ${details.place.formattedAddress || "住所情報なし"}
                      </p>
                      <p style="margin: 0 0 8px 0; font-size: 13px; color: #f59e0b;">
                        ⭐ ${details.place.rating ? details.place.rating.toFixed(1) : "評価なし"}
                        ${details.place.userRatingCount ? `(${details.place.userRatingCount}件)` : ""}
                      </p>
                      <p style="margin: 0 0 8px 0; font-size: 13px; color: #374151; line-height: 1.4;">
                        ${data.summary}
                      </p>
                      <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                        <a href="${gmUrl}" target="_blank" rel="noopener noreferrer"
                           style="display: inline-block; padding: 4px 8px; background-color: #10b981; 
                                  color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500;">
                          Googleマップで見る
                        </a>
                        ${website ? `
                          <a href="${website}" target="_blank" rel="noopener noreferrer"
                             style="display: inline-block; padding: 4px 8px; background-color: #3b82f6; 
                                    color: white; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500;">
                            公式サイト
                          </a>
                        ` : ""}
                      </div>
                    </div>
                  `;

                  infoWindow.setContent(content);
                  infoWindow.open(map, marker);

                  // チャットにも通知
                  if (onPlaceClick) {
                    onPlaceClick(details.place.displayName || location.name);
                  }

                  map.panTo(position);
                } catch (error) {
                  console.error("❌ 詳細情報取得エラー:", error);
                  
                  // エラーの種類に応じた詳細なメッセージ
                  let errorMessage = "情報を取得できませんでした";
                  if (error instanceof Error) {
                    if (error.message.includes("QUOTA_EXCEEDED")) {
                      errorMessage = "⚠️ API使用制限に達しました。しばらく待ってから再試行してください。";
                    } else if (error.message.includes("REQUEST_DENIED")) {
                      errorMessage = "⚠️ APIリクエストが拒否されました。APIキーを確認してください。";
                    } else if (error.message.includes("INVALID_REQUEST")) {
                      errorMessage = "⚠️ 無効なリクエストです。地点情報を確認してください。";
                    } else if (error.message.includes("NOT_FOUND")) {
                      errorMessage = "⚠️ 地点が見つかりませんでした。";
                    } else {
                      errorMessage = `⚠️ 通信エラー: ${error.message}`;
                    }
                  }
                  
                  // エラー時のフォールバック表示
                  infoWindow.setContent(`
                    <div style="max-width: 320px; font-family: system-ui, -apple-system, sans-serif;">
                      <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #1f2937;">
                        ${place.displayName?.text || location.name}
                      </h3>
                      <p style="margin: 0 0 8px 0; font-size: 13px; color: #ef4444;">
                        ${errorMessage}
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #6b7280;">
                        基本情報のみ表示しています
                      </p>
                    </div>
                  `);
                  infoWindow.open(map, marker);
                }
              });

              newMarkers.push(marker);
              infoWindows.current.push(infoWindow);
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

        // ルートを描画（古窯旅館から各地点への個別ルート）
        if (geocodedPlaces.length >= 1) {
          drawIndividualRoutes(geocodedPlaces);
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

  // 🔹 古窯旅館から各地点への個別ルートを描く関数
  const drawIndividualRoutes = (geocodedPlaces: { name: string; location: google.maps.LatLng }[]) => {
    if (!map) return;

    // 古窯旅館の座標（固定）
    const defaultOrigin = { lat: 38.1435, lng: 140.2734 };
    const originLatLng = new google.maps.LatLng(defaultOrigin.lat, defaultOrigin.lng);

    const directionsService = new google.maps.DirectionsService();
    
    // 既存のルートをクリア
    if (routePolyline.current) {
      routePolyline.current.setMap(null);
    }

    // 各地点への個別ルートを描画
    geocodedPlaces.forEach((place, index) => {
      try {
        directionsService.route(
          {
            origin: originLatLng,
            destination: place.location,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              console.log(`✅ ルート描画成功: 古窯旅館 → ${place.name}`);
              
              const directionsRenderer = new google.maps.DirectionsRenderer({
                map: map,
                suppressMarkers: true,
                preserveViewport: true,
                polylineOptions: {
                  strokeColor: "#007BFF",
                  strokeWeight: 3,
                  strokeOpacity: 0.6,
                },
              });
              
              directionsRenderer.setDirections(result);
              
              // 最初のルートのみをメインとして保存
              if (index === 0) {
                routePolyline.current = directionsRenderer;
              }
            } else {
              console.warn(`⚠️ ルート描画失敗: 古窯旅館 → ${place.name} (${status})`);
              
              // ZERO_RESULTSの場合は詳細ログ
              if (status === google.maps.DirectionsStatus.ZERO_RESULTS) {
                console.warn(`🚫 ZERO_RESULTS: 古窯旅館から${place.name}へのルートが見つかりません`);
              }
            }
          }
        );
      } catch (error) {
        console.error(`❌ Directions error for ${place.name}:`, error);
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