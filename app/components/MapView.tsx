"use client";
import { useEffect, useRef } from "react";

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadGoogleMaps = () =>
      new Promise<void>((resolve, reject) => {
        if (window.google?.maps) return resolve();
        const s = document.createElement("script");
        s.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=marker&v=weekly`;
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
      const map = new Map(mapRef.current!, {
        center: target,
        zoom: 15,
        mapId: "KOYO_TRAVEL_AI_MAP",
      });
      console.log("✅ Map initialized successfully");

      const marker = new AdvancedMarkerElement({
        map,
        position: target,
        title: "上山温泉エリア",
      });

      const info = new google.maps.InfoWindow({ content: "読み込み中…" });

      marker.addListener("click", async () => {
        info.setContent("読み込み中…");
        info.open(map, marker);

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

  return <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />;
}