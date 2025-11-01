// 古窯旅館の正確な座標を取得するスクリプト
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

async function getKoyoCoordinates() {
  if (!API_KEY) {
    console.error("❌ API KEYが設定されていません");
    return;
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress",
      },
      body: JSON.stringify({
        textQuery: "古窯旅館 山形県上山市",
        languageCode: "ja",
        regionCode: "JP",
      }),
    });

    const data = await response.json();
    
    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      const location = place.location;
      
      console.log("✅ 古窯旅館の座標を取得しました:");
      console.log("名前:", place.displayName?.text);
      console.log("住所:", place.formattedAddress);
      console.log("緯度:", location.latitude);
      console.log("経度:", location.longitude);
      console.log("\n以下の座標を src/constants/map.ts の DEFAULT_ORIGIN に設定してください:");
      console.log(`export const DEFAULT_ORIGIN = { lat: ${location.latitude}, lng: ${location.longitude} }; // 古窯旅館`);
    } else {
      console.error("❌ 古窯旅館が見つかりませんでした");
    }
  } catch (error) {
    console.error("❌ エラー:", error);
  }
}

getKoyoCoordinates();

