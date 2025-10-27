"use client";
import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    const loadGoogleMaps = () =>
      new Promise<void>((resolve, reject) => {
        if (window.google?.maps) return resolve();
        const s = document.createElement("script");
        s.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=marker,places,directions&v=weekly`;
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
  }, [map, isMapReady, locations]);

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
        origin: geocodedPlaces[0].location,
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
        const { Polyline } = await google.maps.importLibrary("geometry") as google.maps.GeometryLibrary;
        
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

  return <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />;
}