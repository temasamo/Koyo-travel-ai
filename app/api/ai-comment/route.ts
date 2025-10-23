import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { spotName, description } = await req.json();
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  const prompt = `
あなたは旅館のコンシェルジュAIです。
「${spotName}」という観光地を訪れる旅行者に向けて、
旅館スタッフの口調で約80文字のおすすめコメントを作ってください。
${description ? `参考情報: ${description}` : ""}
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
  const comment = data.choices?.[0]?.message?.content?.trim() || "おすすめコメントを生成できませんでした。";
  return NextResponse.json({ comment });
}
