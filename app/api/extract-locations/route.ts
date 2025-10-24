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
        
        抽出対象：
        - 都道府県名（例：山形県、東京都）
        - 市区町村名（例：上山市、新宿区）
        - 観光地・名所（例：蔵王温泉、リナワールド）
        - 施設名（例：古窯旅館、あべくん珈琲）
        - 駅名（例：上山温泉駅）
        
        出力形式：
        {
          "locations": [
            {
              "name": "地名・施設名",
              "type": "prefecture|city|attraction|facility|station",
              "confidence": 0.0-1.0
            }
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
    return NextResponse.json({ locations: [] });
  }
  
  try {
    const parsed = JSON.parse(response);
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json({ locations: [] });
  }
}
