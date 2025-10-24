import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { text } = await req.json();

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `あなたは地名抽出の専門家です。与えられたテキストから地名・観光地・施設名を抽出し、JSON形式で返してください。

重要な指示：
- 必ずJSON形式で返してください
- 地名が見つからない場合は空の配列を返してください
- 山形県の観光地を特に重視してください

抽出対象：
- 都道府県名（例：山形県、東京都）
- 市区町村名（例：上山市、新宿区）
- 観光地・名所（例：蔵王温泉、上山温泉、山寺、立石寺）
- 施設名（例：古窯旅館、あべくん珈琲）
- 駅名（例：上山温泉駅）

出力形式（必ずこの形式で返してください）：
{
  "locations": [
    {
      "name": "地名・施設名",
      "type": "prefecture|city|attraction|facility|station",
      "confidence": 0.0-1.0
    }
  ]
}

例：
テキスト: "1日目は上山温泉、2日目は蔵王温泉、3日目は山寺"
出力:
{
  "locations": [
    {"name": "上山温泉", "type": "attraction", "confidence": 0.9},
    {"name": "蔵王温泉", "type": "attraction", "confidence": 0.9},
    {"name": "山寺", "type": "attraction", "confidence": 0.8}
  ]
}`,
      },
      {
        role: "user",
        content: text,
      },
    ],
    temperature: 0.3,
  });

  const response = completion.choices[0].message.content;
  
  if (!response) {
    console.log("❌ OpenAI response is null");
    return NextResponse.json({ locations: [] });
  }
  
  console.log("🔍 OpenAI response:", response);
  
  try {
    const parsed = JSON.parse(response);
    console.log("✅ Parsed locations:", parsed);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("❌ JSON parse error:", error);
    console.log("Raw response:", response);
    return NextResponse.json({ locations: [] });
  }
}
