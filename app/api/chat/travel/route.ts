import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { messages, routeRules } = await req.json();

  // 最終ユーザーメッセージから日程（午前/午後/一日）を簡易判定
  const last = Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : null;
  const lastText: string = typeof last?.content === "string" ? last.content : "";

  const includesAny = (s: string, words: string[]) => words.some((w) => s.includes(w));
  let scheduleMode: "morning" | "afternoon" | "fullday" | null = null;
  if (includesAny(lastText, ["午前", "朝"])) scheduleMode = "morning";
  else if (includesAny(lastText, ["午後", "夕方"])) scheduleMode = "afternoon";
  else if (includesAny(lastText, ["一日", "1日", "終日"])) scheduleMode = "fullday";

  // 日程が未指定っぽい場合は先に確認質問だけ返す（OpenAI呼び出しを省略）
  if (!scheduleMode) {
    const ask =
      "プラン作成の前に日程を教えてください。『午前』／『午後』／『一日』のいずれですか？";
    return NextResponse.json({ 
      reply: ask,
      routeRules: routeRules || {
        maxPoints: 6,
        excludeBroadAreas: true,
        minConfidence: 0.9,
        optimizeWaypoints: false,
        autoGenerate: false,
      }
    });
  }

  // 日程モード別の追加システム指示
  const scheduleSystem =
    scheduleMode === "morning"
      ? "午前プラン。移動距離はやや広め（例: 10-15km）。立ち寄りは2-4件。早朝〜昼前の楽しみ方を優先。"
      : scheduleMode === "afternoon"
      ? "午後プラン。移動距離は短め（例: 2-5km）。立ち寄りは1-3件。短時間で楽しめる近場中心。"
      : "一日プラン。午前と午後を通して無理のない行程。移動距離は中程度（例: 5-15km）で3-6件程度。";

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `あなたは山形県上山市周辺の旅行AIプランナーです。ユーザーの希望に合わせて観光地を提案してください。

重要な指示：
- 出発地は「古窯旅館」を想定してください
- 地名は具体的で検索可能な形で記載してください
- 山形県内の観光地を中心に提案してください
- 日程条件: ${scheduleSystem}

**ルート表の形式（必須）**：
提案の最後に、以下の形式でルート表を必ず含めてください：

ルート表：
1. 古窯旅館 → [最初の観光地] [距離]km / [移動時間]
2. [最初の観光地] → [次の観光地] [距離]km / [移動時間]
3. [次の観光地] → [さらに次の観光地] [距離]km / [移動時間]
...

各ルートの距離と移動時間は適切な値を推定して記載してください。
提案はシンプルかつ実在のスポット名を含め、移動時間と滞在時間のバランスを取ってください。`,
      },
      ...messages,
    ],
    temperature: 0.7,
  });

  const reply = completion.choices[0].message.content;
  
  // ルート生成ルールを推論（日程モードに基づく）
  const inferredRouteRules = routeRules || {
    maxPoints: scheduleMode === "morning" ? 4 : scheduleMode === "afternoon" ? 3 : 6,
    excludeBroadAreas: true,
    minConfidence: 0.9,
    optimizeWaypoints: false,
    autoGenerate: false, // デフォルトで自動生成は無効
  };
  
  return NextResponse.json({ 
    reply,
    routeRules: inferredRouteRules
  });
}
