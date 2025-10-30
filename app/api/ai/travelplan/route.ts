import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const systemPrompt = `
あなたは日本の旅行プランナーです。
与えられた出発地・宿泊地をもとに、実在する観光地・温泉・城・寺などを必ず含めた「3泊4日の旅行プラン」を日本語で提案してください。
具体的な地名（例：上山温泉、蔵王温泉、立石寺、米沢城など）を少なくとも5箇所以上含めてください。
出力文の中には観光地名を自然に埋め込み、旅行者が実際に訪れたくなるようにしてください。
`;

    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: String(prompt ?? "条件が不足しています。") },
      ],
      temperature: 0.6,
    });

    const plan = res.choices[0]?.message?.content || "プランの生成に失敗しました。";
    return NextResponse.json({ plan });
  } catch (e) {
    console.error("/api/ai/travelplan error", e);
    return NextResponse.json({ plan: "プランの生成に失敗しました。" }, { status: 500 });
  }
}


