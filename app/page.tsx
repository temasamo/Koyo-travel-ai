"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);

  const handleAreaSelect = (area: string) => {
    router.push(`/${area}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* ヘッダー */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            🗾 旅AIマップ
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            日本各地の観光地をAIが提案する旅行プランナー
          </p>
          <p className="text-lg text-gray-500">
            行きたいエリアを選択してください
          </p>
        </div>

        {/* エリア選択カード */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* 上山温泉エリア */}
          <div
            className={`relative group cursor-pointer transition-all duration-300 transform hover:scale-105 ${
              hoveredArea === "kaminoyama" ? "scale-105" : ""
            }`}
            onMouseEnter={() => setHoveredArea("kaminoyama")}
            onMouseLeave={() => setHoveredArea(null)}
            onClick={() => handleAreaSelect("kaminoyama")}
          >
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-transparent hover:border-blue-300 transition-all duration-300">
              {/* 背景画像エリア */}
              <div className="h-48 bg-gradient-to-br from-blue-400 to-blue-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                <div className="absolute bottom-4 left-4 text-white">
                  <div className="text-4xl mb-2">🏔️</div>
                  <h2 className="text-2xl font-bold">上山温泉エリア</h2>
                  <p className="text-blue-100">山形県上山市</p>
                </div>
                {/* 装飾的な要素 */}
                <div className="absolute top-4 right-4 w-16 h-16 bg-white bg-opacity-20 rounded-full"></div>
                <div className="absolute bottom-8 right-8 w-8 h-8 bg-white bg-opacity-30 rounded-full"></div>
              </div>
              
              {/* コンテンツエリア */}
              <div className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center text-gray-600">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    <span>温泉街の散策</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    <span>古窯旅館での宿泊</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    <span>山形の郷土料理</span>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center">
                    <span>上山温泉を探索</span>
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 富士五湖エリア */}
          <div
            className={`relative group cursor-pointer transition-all duration-300 transform hover:scale-105 ${
              hoveredArea === "fujigoko" ? "scale-105" : ""
            }`}
            onMouseEnter={() => setHoveredArea("fujigoko")}
            onMouseLeave={() => setHoveredArea(null)}
            onClick={() => handleAreaSelect("fujigoko")}
          >
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-transparent hover:border-red-300 transition-all duration-300">
              {/* 背景画像エリア */}
              <div className="h-48 bg-gradient-to-br from-red-400 to-orange-500 relative overflow-hidden">
                <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                <div className="absolute bottom-4 left-4 text-white">
                  <div className="text-4xl mb-2">🗻</div>
                  <h2 className="text-2xl font-bold">富士五湖エリア</h2>
                  <p className="text-red-100">山梨県富士五湖</p>
                </div>
                {/* 装飾的な要素 */}
                <div className="absolute top-4 right-4 w-16 h-16 bg-white bg-opacity-20 rounded-full"></div>
                <div className="absolute bottom-8 right-8 w-8 h-8 bg-white bg-opacity-30 rounded-full"></div>
              </div>
              
              {/* コンテンツエリア */}
              <div className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center text-gray-600">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                    <span>富士山の絶景</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                    <span>五湖の湖畔散策</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
                    <span>山梨の名産品</span>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <button className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center">
                    <span>富士五湖を探索</span>
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="text-center mt-12">
          <p className="text-gray-500 text-sm">
            AIが提案する観光スポットで、新しい発見を
          </p>
        </div>
      </div>
    </div>
  );
}