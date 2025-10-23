import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { category } = await req.json();

  const prompt = `
  あなたは山形県上山市周辺の観光案内AIです。
  テーマ「${category}」に沿って3〜4箇所の観光スポットを提案してください。
  出発地点は「日本の宿 古窯」。
  各スポットに短い説明をつけ、JSON形式で出力してください。
  [
    { "name": "", "description": "" }
  ]
  `;

  const response = await client.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return Response.json(response.choices[0].message);
}

