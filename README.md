# osm-tw

義鼎不動產「地號查經緯度」書籤工具使用的開放街圖（OpenStreetMap）分塊資料。

- 每月 2 日自動從 Geofabrik 下載最新的台灣開放街圖資料，取出具名道路、門牌、公園／學校／廣場／河川，切成 0.01 度見方的小檔（每塊含外擴約 400 公尺的資料），發布到 GitHub Pages。
- 網址：`https://yiding-realty.github.io/osm-tw/t/{經度×100取整}_{緯度×100取整}.json`
- 手動更新：Actions →「每月更新開放街圖資料」→ Run workflow。

資料來源：© OpenStreetMap contributors，依 ODbL 授權。
