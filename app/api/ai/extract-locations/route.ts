import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const prompt = `以下の日本語の旅行プラン文から、含まれている観光地・温泉地・神社・城などの地名をJSON形式で抽出してください。\n出力形式: { "locations": [{"name": "地名", "type": "観光地|温泉|神社|城|施設|都市|駅"}] }\nテキスト:\n${text}`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" as any },
      temperature: 0.2,
    });

    const content = res.choices[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { locations: [] };
    }

    return NextResponse.json({ locations: parsed.locations ?? [] });
  } catch (e) {
    console.error("/api/ai/extract-locations error", e);
    return NextResponse.json({ locations: [] }, { status: 500 });
  }
}


