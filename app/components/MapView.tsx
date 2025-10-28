"use client";
import { useEffect, useRef, useState } from "react";
import { AREA_CONFIG, AreaKey, buildSearchQuery } from "./MapConfig";

interface Location {
  name: string;
  type: string;
  confidence: number;
}

interface AIPin {
  name: string;
  type: string;
}

interface MapViewProps {
  area?: AreaKey;
  locations?: Location[];
  onPlaceClick?: (place: string) => void;
  aiPins?: AIPin[];
  defaultCenter?: google.maps.LatLngLiteral;
  defaultZoom?: number;
}

export default function MapView({ 
  area, 
  locations = [], 
  onPlaceClick, 
  aiPins = [], 
  defaultCenter, 
  defaultZoom 
}: MapViewProps) {
  const config = area ? AREA_CONFIG[area] : null;
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const routePolyline = useRef<google.maps.DirectionsRenderer | null>(null);
  const infoWindows = useRef<google.maps.InfoWindow[]>([]);
  const aiMarkers = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    const loadGoogleMaps = () =>
      new Promise<void>((resolve, reject) => {
        if (window.google?.maps) return resolve();
        const s = document.createElement("script");
        s.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=marker,places,routes&v=weekly`;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Google Maps failed to load"));
        document.head.appendChild(s);
      });

    const init = async () => {
      await loadGoogleMaps();
      const { Map } = (await google.maps.importLibrary("maps")) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;

      const mapInstance = new Map(mapRef.current!, {
        center: defaultCenter || config?.center || { lat: 35.68, lng: 139.76 },
        zoom: defaultZoom || config?.zoom || 6,
        mapId: "KOYO_TRAVEL_AI_MAP",
      });
      setMap(mapInstance);
      setIsMapReady(true);
      console.log("✅ Map initialized successfully");

      // 🧩 固定ピン表示処理（一時停止）
      // if (config.fixedPlaceIds && config.fixedPlaceIds.length > 0) {
      //   const service = new google.maps.places.PlacesService(mapInstance);
      //   const infoWindow = new google.maps.InfoWindow();

      //   config.fixedPlaceIds.forEach((placeId: string) => {
      //     service.getDetails(
      //       {
      //         placeId,
      //         fields: [
      //           "name",
      //           "geometry",
      //           "photos",
      //           "formatted_address",
      //           "rating",
      //           "url",
      //         ],
      //       },
      //       (place: any, status: any) => {
      //         if (status !== google.maps.places.PlacesServiceStatus.OK) {
      //           console.warn(`❌ Place取得失敗: ${placeId}`, status);
      //           return;
      //         }
      //         if (!place?.geometry?.location) return;

      //         const marker = new AdvancedMarkerElement({
      //           map: mapInstance,
      //           position: place.geometry.location,
      //           title: place.name,
      //           content: new google.maps.marker.PinElement({
      //             background: "#4285F4",
      //             borderColor: "#137333",
      //             glyphColor: "#ffffff",
      //           }),
      //         });

      //         const photoUrl =
      //           place.photos && place.photos.length > 0
      //             ? place.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 })
      //             : "/images/no-image.jpg";

      //         const content = `
      //           <div style="max-width: 260px;">
      //             <h3 style="margin: 0 0 8px; color: #222;">${place.name}</h3>
      //             <img src="${photoUrl}" alt="${place.name}" style="width:100%; border-radius:8px; margin-bottom:8px;">
      //             <p style="font-size:13px; color:#555; margin:0;">📍 ${place.formatted_address || "住所情報なし"}</p>
      //             <p style="font-size:13px; color:#555; margin:4px 0;">⭐ ${place.rating || "評価なし"}</p>
      //             <a href="${place.url}" target="_blank" rel="noopener noreferrer"
      //                style="color:#1a73e8; font-weight:500; text-decoration:none;">
      //               Googleマップで見る
      //             </a>
      //           </div>
      //         `;

      //         marker.addListener("click", () => {
      //           infoWindows.current.forEach(iw => iw.close());
      //           infoWindow.setContent(content);
      //           infoWindow.open(mapInstance, marker);
      //           infoWindows.current.push(infoWindow);
      //         });

      //         console.log("✅ 固定ピン表示成功:", place.name);
      //       }
      //     );
      //   });
      // }
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
                textQuery: buildSearchQuery(location.name, area),
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

                // 読み込み中表示
                infoWindow.setContent(`
                  <div style="min-width:200px; font-size:14px; text-align:center; padding:20px;">
                    📍 情報を取得中...
                  </div>
                `);
                infoWindow.open(map, marker);

                try {
                  // Step 1.5: Place詳細取得 & 情報マージ
                  const placeId = place.id;
                  if (!placeId) throw new Error("Place ID not found");

                  // Google Places API詳細取得
                  const detailRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=ja&regionCode=JP`, {
                    headers: {
                      "X-Goog-Api-Key": String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
                      "X-Goog-FieldMask": [
                        "displayName",
                        "formattedAddress", 
                        "rating",
                        "userRatingCount",
                        "photos",
                        "websiteUri",
                        "googleMapsUri"
                      ].join(","),
                    },
                  });

                  const placeDetails = await detailRes.json();
                  console.log("📸 Place Details:", placeDetails);

                  // AI要約を並行取得
                  const summaryRes = await fetch("/api/chat/summary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ place: placeDetails.displayName?.text || location.name }),
                  });
                  const summaryData = await summaryRes.json();

                  // ✅ 写真URL生成
                  let photoUrl = "";
                  if (placeDetails.photos?.[0]?.name) {
                    photoUrl = `https://places.googleapis.com/v1/${placeDetails.photos[0].name}/media?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&maxWidthPx=400`;
                  }

                  // ✅ 評価HTML生成
                  const ratingHtml = placeDetails.rating
                    ? `⭐ ${placeDetails.rating}（${placeDetails.userRatingCount || 0}件）`
                    : "⭐ N/A";

                  // ✅ GoogleマップURL生成（place.googleMapsUriが優先、なければ検索URL）
                  const mapsUrl = placeDetails.googleMapsUri
                    ? placeDetails.googleMapsUri
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        placeDetails.displayName?.text || location.name
                      )}`;

                  // ✅ 統合HTML生成
                  const contentString = `
                    <div style="max-width:320px; font-family:sans-serif;">
                      ${
                        photoUrl
                          ? `<img src="${photoUrl}" alt="${placeDetails.displayName?.text || location.name}" style="width:100%;border-radius:8px;margin-bottom:8px;">`
                          : ""
                      }
                      <h3 style="margin:4px 0; font-size:16px; font-weight:600;">${placeDetails.displayName?.text || location.name}</h3>
                      <p style="margin:2px 0; color:#666; font-size:14px;">${ratingHtml}</p>
                      <p style="margin:2px 0; color:#666; font-size:12px;">📍 ${placeDetails.formattedAddress || ""}</p>
                      <hr style="margin:8px 0; border:none; border-top:1px solid #eee;">
                      <p style="margin:4px 0; font-size:13px; line-height:1.4;">${summaryData.summary}</p>
                      ${
                        placeDetails.websiteUri
                          ? `<a href="${placeDetails.websiteUri}" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:8px;font-weight:500;color:#1a73e8;text-decoration:none;font-size:12px;">公式サイト</a>`
                          : ""
                      }
                      <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:4px;font-weight:500;color:#1a73e8;text-decoration:none;font-size:12px;">Googleマップで見る</a>
                    </div>
                  `;

                  infoWindow.setContent(contentString);

                  // チャットにも通知
                  if (onPlaceClick) {
                    onPlaceClick(placeDetails.displayName?.text || location.name);
                  }

                  map.panTo(position);
                } catch (error) {
                  console.error("❌ 詳細情報取得エラー:", error);
                  
                  // フォールバック: AI要約のみ表示
                  try {
                    const fallbackRes = await fetch("/api/chat/summary", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ place: location.name }),
                    });
                    const fallbackData = await fallbackRes.json();

                    infoWindow.setContent(`
                      <div style="min-width:200px; font-size:14px;">
                        <strong>${location.name}</strong><br/>
                        ${fallbackData.summary}
                      </div>
                    `);
                  } catch (fallbackError) {
                    console.error("❌ フォールバック失敗:", fallbackError);
                    infoWindow.setContent(`
                      <div style="min-width:200px; font-size:14px;">
                        <strong>${location.name}</strong><br/>
                        説明を取得できませんでした。
                      </div>
                    `);
                  }
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

        // ルートを描画（2点以上ある場合）
        if (geocodedPlaces.length >= 2) {
          console.log("🛣️ ルート描画開始:", geocodedPlaces.length, "地点");
          await drawRoute(geocodedPlaces);
        } else {
          console.log("❌ ルート描画スキップ: 地点数不足", geocodedPlaces.length);
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
  }, [map, isMapReady, locations, area, defaultCenter, defaultZoom]);

  // 🔹 Directions APIでルートを描く関数
  const drawRoute = async (geocodedPlaces: { name: string; location: google.maps.LatLng }[]) => {
    if (!map) return;

    try {
      // Directions ライブラリを動的に読み込み
      const { DirectionsService, DirectionsRenderer } = await google.maps.importLibrary("routes") as google.maps.RoutesLibrary;

      const directionsService = new DirectionsService();
      const directionsRenderer = new DirectionsRenderer({
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

      // 経由地が多すぎる場合は制限（Google Maps APIの制限は23個まで）
      const limitedWaypoints = waypoints.slice(0, 23);

      console.log("🛣️ ルートリクエスト詳細:");
      console.log("📍 出発地:", geocodedPlaces[0].name, geocodedPlaces[0].location.toString());
      console.log("📍 到着地:", geocodedPlaces[geocodedPlaces.length - 1].name, geocodedPlaces[geocodedPlaces.length - 1].location.toString());
      console.log("📍 経由地数:", limitedWaypoints.length);

      const result = await directionsService.route({
        origin: defaultCenter || config?.center || { lat: 35.68, lng: 139.76 },
        destination: geocodedPlaces[geocodedPlaces.length - 1].location,
        waypoints: limitedWaypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true, // 経由地の最適化
      });

      console.log("✅ ルート描画成功:", result);
      directionsRenderer.setDirections(result);
      routePolyline.current = directionsRenderer;

    } catch (error) {
      console.error("❌ Directions API エラー:", error);
      
      // フォールバック: シンプルなポリラインで接続
      if (geocodedPlaces.length >= 2) {
        console.log("🔄 フォールバック: シンプルな線で接続");
        
        const path = geocodedPlaces.map(p => p.location);
        const polyline = new google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: "#007BFF",
          strokeOpacity: 0.7,
          strokeWeight: 3,
        });
        polyline.setMap(map);
        routePolyline.current = polyline as any;
      }
    }
  };

  // AIピンを表示する関数
  const addAIMarkers = async (pins: AIPin[]) => {
    if (!map || !isMapReady) return;
    
    // Google Maps APIが完全に読み込まれているかチェック
    if (!google?.maps?.places?.PlacesService || !google?.maps?.LatLngBounds) {
      console.warn("⚠️ Google Maps API not fully loaded yet");
      return;
    }

    // 既存のAIピンをクリア
    aiMarkers.current.forEach(marker => {
      if (marker && marker.getMap()) {
        marker.setMap(null);
      }
    });
    aiMarkers.current = [];

    const service = new google.maps.places.PlacesService(map);
    const bounds = new google.maps.LatLngBounds();

    for (const pin of pins) {
      try {
        // エリア名を補完して検索精度を向上（areaがない場合はそのまま）
        const searchQuery = area ? buildSearchQuery(pin.name, area) : pin.name;
        
        const request = {
          query: searchQuery,
          fields: ["name", "geometry", "place_id", "formatted_address", "rating", "photos"],
        };

        service.findPlaceFromQuery(request, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
            const place = results[0];
            
            if (place.geometry?.location) {
              const marker = new google.maps.Marker({
                map: map,
                position: place.geometry.location,
                title: place.name,
                icon: {
                  url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                  scaledSize: new google.maps.Size(32, 32),
                },
                zIndex: 50, // Directionsより低く設定
              });

              // InfoWindowを作成
              const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 300, maxHeight: 200 }) || "/images/no-image.jpg";
              const content = `
                <div style="max-width: 260px;">
                  <h3 style="margin: 0 0 8px; color: #222;">${place.name}</h3>
                  <img src="${photoUrl}" alt="${place.name}" style="width:100%; border-radius:8px; margin-bottom:8px;">
                  <p style="font-size:13px; color:#555; margin:0;">📍 ${place.formatted_address || "住所情報なし"}</p>
                  <p style="font-size:13px; color:#555; margin:4px 0;">⭐ ${place.rating || "評価なし"}</p>
                  <p style="font-size:12px; color:#666; margin:2px 0;">🤖 AI推薦</p>
                </div>
              `;

              const infoWindow = new google.maps.InfoWindow({ content });
              
              marker.addListener("click", () => {
                infoWindows.current.forEach(iw => iw.close());
                infoWindow.open(map, marker);
                infoWindows.current.push(infoWindow);
              });

              aiMarkers.current.push(marker);
              bounds.extend(place.geometry.location);
              
              console.log("✅ AIピン表示成功:", place.name);
            }
          } else {
            console.warn("❌ AIピン検索失敗:", pin.name, status);
          }
        });
      } catch (error) {
        console.error("❌ AIピン処理エラー:", pin.name, error);
      }
    }

    // マップをAIピンに合わせてズーム
    setTimeout(() => {
      if (aiMarkers.current.length > 0) {
        map.fitBounds(bounds);
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 15) {
          map.setZoom(15);
        }
      }
    }, 1000);
  };

  // AIピンが変更された時の処理
  useEffect(() => {
    console.log("🎯 AIピン変更検出:", aiPins);
    if (aiPins.length > 0 && isMapReady) {
      addAIMarkers(aiPins);
    }
  }, [aiPins, map, isMapReady]);

  // showAIPinsイベントリスナーを追加
  useEffect(() => {
    const handleShowAIPins = (event: CustomEvent) => {
      const pins = event.detail;
      console.log("📍 受信したpins:", pins);
      if (!pins?.length) return;

      if (map && isMapReady) {
        const service = new google.maps.places.PlacesService(map);
        pins.forEach((p: AIPin) => {
          const query = p.name + " 日本";
          const request = { query, fields: ["geometry", "name"] };
          service.findPlaceFromQuery(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
              new google.maps.Marker({
                map,
                position: results[0].geometry?.location,
                title: results[0].name,
                icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
              });
              console.log("✅ ピン表示:", results[0].name);
            } else {
              console.log("❌ ピン取得失敗:", query);
            }
          });
        });
      }
    };

    // AIルート描画イベントリスナーを追加
    const handleShowAIRoute = async (event: CustomEvent) => {
      const route = event.detail;
      console.log("🛣️ 受信したルート:", route);
      if (!route?.from || !route?.to) return;

      console.log("🚗 経路描画リクエスト:", route.from, "→", route.to);

      if (map && isMapReady) {
        try {
          const directionsService = new google.maps.DirectionsService();

          const result = await directionsService.route({
            origin: route.from,
            destination: route.to,
            travelMode: google.maps.TravelMode.DRIVING,
          });

          if (result?.routes?.length && routePolyline.current) {
            routePolyline.current.setDirections(result);
            console.log("🟢 ルート描画成功:", route.from, "→", route.to);
          } else {
            console.warn("⚠️ Directions API結果なし:", result);
          }
        } catch (error) {
          console.error("❌ Directions APIエラー:", error);
        }
      }
    };

    window.addEventListener("showAIPins", handleShowAIPins as EventListener);
    window.addEventListener("showAIRoute", handleShowAIRoute as any);
    
    return () => {
      window.removeEventListener("showAIPins", handleShowAIPins as EventListener);
      window.removeEventListener("showAIRoute", handleShowAIRoute as any);
    };
  }, [map, isMapReady]);

  return <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />;
}