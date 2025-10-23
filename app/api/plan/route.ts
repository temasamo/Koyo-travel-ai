import { NextResponse } from "next/server";

export async function POST() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
  const prompt = `
  あなたは山形県上山市の観光プランナーです。
  古窯旅館を出発点として、日帰り観光ルート（5スポット）を提案してください。
  各スポットは「名称」のみで、日本語で出力してください。
  例: ["上山城", "リナワールド", "蔵王温泉", "くぐり滝", "古窯旅館"]
  `;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const content = data.choices[0].message.content;
  const json = JSON.parse(content.match(/\[.*\]/s)?.[0] || "[]");

  return NextResponse.json({ places: json });
}
