import { NextResponse } from "next/server";
import { extractTimeFromText } from "@/utils/timeParser";
import { getDistanceLimitByTime } from "@/utils/time";
import { getNearbyPlaces, enrichWithDistance } from "@/utils/maps";
import { getRAGTagsForPlaces } from "@/utils/rag";
import { buildTravelPlanPrompt, getAISummary } from "@/utils/prompt";

export async function POST(req: Request) {
  try {
    const { userInput, currentTime, origin, mode } = await req.json();

    // 🕒 時間の決定ロジック
    const inferredTime =
      currentTime ||
      extractTimeFromText(userInput) ||
      new Date().toISOString(); // どれも無ければ現時刻を使用

    const dateObj = new Date(inferredTime);
    const maxDistanceKm = getDistanceLimitByTime(dateObj);

    // 🗺️ Places + Distance
    const rawPlaces = await getNearbyPlaces(origin, maxDistanceKm);
    const withDistance = await enrichWithDistance(origin, rawPlaces);

    // 🏷️ RAGタグ付与
    const ragTags = await getRAGTagsForPlaces(withDistance.map((p) => p.name));
    const enriched = withDistance.map((p, i) => ({
      ...p,
      tags: ragTags[i],
    }));

    // 🧠 AIプロンプト生成
    const prompt = buildTravelPlanPrompt(origin, inferredTime, enriched, userInput);
    const aiSummary = await getAISummary(prompt);

    return NextResponse.json({ suggestions: enriched, aiSummary });
  } catch (err) {
    console.error("[/api/plan] Error:", err);
    return NextResponse.json(
      { suggestions: [], aiSummary: "現在おすすめ情報を取得できませんでした。" },
      { status: 500 }
    );
  }
}
