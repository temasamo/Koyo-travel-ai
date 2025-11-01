import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface RouteSegment {
  from: string;
  to: string;
  distance?: string;
  duration?: string;
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ routeSegments: [] });
    }

    // AI生成テキストからルート情報を抽出
    const prompt = `以下の旅行プランテキストから、ルート情報を抽出してください。

テキスト内に以下のような形式があれば、それを抽出してください：
- 「1. [出発地] → [目的地] [距離]km / [時間]」
- 「[出発地] → [目的地] [距離] / [時間]」
- 「[番号]. [出発地] → [目的地] [距離] / [時間]」

また、テキスト内に観光地が順番に記載されている場合（例：「1. 上山城」「2. 上山温泉街散策」「3. 山形市郷土館」など）、
その順番と記載内容からルートを推論してください。

テキスト:
${text}

出力形式（JSON）:
{
  "routeSegments": [
    {
      "from": "出発地名",
      "to": "目的地名",
      "distance": "距離（例: 25.0km、見つからない場合は「推定」）",
      "duration": "移動時間（例: 47分、見つからない場合は「推定」）"
    }
  ]
}

重要な指示：
- テキスト内に明確なルート表があれば、それをそのまま抽出してください
- ルート表がなくても、観光地が順番に記載されている場合は、その順番からルートを推論してください
- 出発地が明示されていない場合は「古窯旅館」を出発地としてください
- 必ずJSON形式で返してください

ルート情報が見つからない場合は空の配列を返してください。`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" as any },
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { routeSegments?: RouteSegment[] } = {};
    
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { routeSegments: [] };
    }

    // 正規表現でも抽出を試みる（フォールバック）
    const regex = /(\d+)\.\s*([^→]+)→\s*([^\d]+?)\s*([\d.]+)\s*km\s*\/\s*([^\n]+)/g;
    const manualExtraction: RouteSegment[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (manualExtraction.length >= 10) break;
      manualExtraction.push({
        from: match[2].trim(),
        to: match[3].trim(),
        distance: `${match[4]}km`,
        duration: match[5].trim(),
      });
    }

    // AI抽出結果と正規表現抽出結果をマージ（AI抽出を優先）
    const routeSegments = (parsed.routeSegments && parsed.routeSegments.length > 0)
      ? parsed.routeSegments
      : manualExtraction;

    return NextResponse.json({ routeSegments });
  } catch (e) {
    console.error("/api/ai/extract-route error", e);
    return NextResponse.json({ routeSegments: [] }, { status: 500 });
  }
}

