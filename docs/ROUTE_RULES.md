# ルート作成ルール

## 現在の実装ルール（自動表示時）

### 1. 地点の収集と優先順位

#### 地点ソース（優先順位順）
1. **スタッフおすすめスポット** (`showStaffRecommendations = true` の場合)
   - `STAFF_RECOMMENDATIONS` から取得
   - 座標が事前定義済み（API呼び出し不要）
   - 信頼度: 1.0（最高）

2. **カテゴリ検索結果** (`selectedCategories` が選択されている場合)
   - Places APIでカテゴリ別に検索
   - キャッシュ機能あり
   - 信頼度: 0.9

3. **propsのlocations** (親コンポーネントから渡される)
   - 直接指定された地点

4. **AI生成テキストから抽出** (`planMessage` から抽出)
   - `/api/ai/extract-locations` で地名抽出
   - 信頼度: 抽出結果による（0.6〜0.9）

### 2. フィルタリングルール

#### カテゴリフィルタ（`selectedCategories` が選択時）
- 選択されたカテゴリに一致する地点のみ表示
- カテゴリ: 「歴史」「自然」「遊ぶ」「食べる」「学ぶ」
- マッチング方法:
  - スタッフおすすめ: `categories` プロパティで判定
  - その他: 地名の文字列パターンで判定（例: 「城|寺|神社」→「歴史」）

#### 信頼度フィルタ (`filterPlacesByConfidence`)
- 最小信頼度: `MIN_CONFIDENCE = 0.9` (`src/constants/map.ts`)
- 最大地点数: `MAX_PROCESS_PLACES = 8` (`src/constants/map.ts`)
- 最低1件保証（全件除外の場合は最上位1件を強制採用）
- 信頼度の降順でソート

#### スタッフおすすめの特別扱い
- `showStaffRecommendations = true` かつ座標定義済みの場合:
  - 信頼度フィルタなし
  - 件数制限なし
  - API呼び出し不要

### 3. 地点解決（座標取得）

#### 座標定義済みの場合（スタッフおすすめなど）
- API呼び出し不要
- `lat`, `lng` を直接使用

#### 座標未定義の場合
- Google Places API (`places:searchText`) で検索
- クエリ: `{query} 山形県`
- 最初の検索結果を使用

### 4. ルート描画ルール (`drawRouteFromOrigin`)

#### 地点フィルタリング（ルート描画前）
- 広範囲な地名を除外:
  - 「県」を含む地名
  - 「市」を含む地名
  - 「町」を含む地名
  - 特定除外: 「山形県」「上山市」「山形市」

#### 地点数制限
- **最大6地点まで** (`limitedPoints.slice(0, 6)`)
  - 理由: Google Directions APIの料金制限を考慮
  - 6地点 = 出発地1 + 経由地5 + 目的地1 → 通常料金（$5.00/1,000リクエスト）

#### ルート計算
- Google Directions API (`google.maps.DirectionsService`)
- `optimizeWaypoints: false` → 通常料金を適用
- `travelMode`: 'DRIVING' | 'WALKING' | 'TRANSIT'（ユーザー選択可能）

#### 出発地と目的地
- 出発地:
  - `origin` が設定されている場合: `origin`
  - 未設定の場合: `DEFAULT_ORIGIN`（古窯旅館: `{lat: 38.1435, lng: 140.2734}`）
- 目的地:
  - `lodging` が設定されている場合: `lodging`
  - 未設定の場合: 最後の地点を目的地として使用

#### 経由地設定
- `limitedPoints.slice(0, -1)` を経由地として設定
- `stopover: true` で各地点で停止

### 5. ルート表表示

#### 表示条件
- `routeLegs.length > 0` の場合に表示
- 各レッグ（セグメント）ごとに:
  - 番号: `i + 1` (1〜6)
  - 出発地名: `routePointNames[i]`
  - 目的地名: `routePointNames[i + 1]`
  - 距離: `leg.distance.text`
  - 時間: `leg.duration.text`

### 6. 自動表示のタイミング

現在は以下の場合に自動的にルートが描画されます:

1. `map`, `isMapReady` が準備完了
2. `locations`, `extractedFromPlan`, `showStaffRecommendations` のいずれかが変更
3. 地点が解決されると自動的に `drawRouteFromOrigin` が呼ばれる

---

## 変更予定: AI生成時にルールを設定可能にする

### 変更内容
1. ルート表の自動表示を無効化
2. AI生成時にルート生成ルールを設定可能にする
3. 手動でルート生成をトリガーする機能を追加

### 設定可能なルール
- 最大地点数（現在は固定6地点）
- 地点フィルタリング条件（広範囲地名除外の有無）
- 信頼度の閾値
- カテゴリフィルタの適用/非適用
- ルート最適化の有無 (`optimizeWaypoints`)

