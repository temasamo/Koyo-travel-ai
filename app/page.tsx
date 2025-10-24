import MapView from "./components/MapView";
import ChatPanel from "./components/ChatPanel";

export default function Page() {
  return (
    <main className="w-full h-screen flex">
      {/* 左側：マップエリア */}
      <div className="flex-1 flex flex-col">
        <header className="p-4 text-xl font-semibold">古窯 旅AIマップ</header>
        <MapView />
      </div>
      
      {/* 右側：チャットパネル */}
      <div className="w-96 border-l bg-white">
        <div className="h-full">
          <ChatPanel />
        </div>
      </div>
    </main>
  );
}