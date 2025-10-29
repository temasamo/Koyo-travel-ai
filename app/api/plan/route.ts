import { NextResponse } from "next/server";
import { analyzeUserTimeIntent } from "@/utils/timeParser";
import { getDistanceLimitByTime } from "@/utils/time";
import { getNearbyPlaces, enrichWithDistance } from "@/utils/maps";
import { getRAGTagsForPlaces } from "@/utils/rag";
import { buildTravelPlanPrompt, getAISummary } from "@/utils/prompt";

export async function POST(req: Request) {
  try {
    const { userInput, currentTime, origin, mode } = await req.json();

    // 🔍 時間意図の解析
    const { inferredTime, mode: parsedMode } = analyzeUserTimeIntent(userInput);
    const finalMode = mode || parsedMode;

    // 🕒 フォールバック（時刻指定なし）
    const effectiveTime = inferredTime || currentTime || new Date().toISOString();
    const dateObj = new Date(effectiveTime);
    const maxDistanceKm = finalMode === "instant" ? 3 : getDistanceLimitByTime(dateObj);

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
    const prompt = buildTravelPlanPrompt(origin, effectiveTime, enriched, userInput, finalMode);
    const aiSummary = await getAISummary(prompt);

    return NextResponse.json({ suggestions: enriched, aiSummary, mode: finalMode });
  } catch (err) {
    console.error("[/api/plan] Error:", err);
    return NextResponse.json(
      { suggestions: [], aiSummary: "現在おすすめ情報を取得できませんでした。" },
      { status: 500 }
    );
  }
}
