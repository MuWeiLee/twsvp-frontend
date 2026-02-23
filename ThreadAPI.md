關鍵字和主題標籤搜尋
使用特定關鍵字或以主題標籤搜尋公開的 Threads 影音內容。

限制
用戶在連續 24 小時期間內，最多可以發送 2,200 次查詢。查詢一旦送出，即計入此 24 小時的限制。
此限制套用於同一用戶的所有應用程式，不會因為應用程式不同而有所區別。如果多個應用程式為同一用戶發送要求，這些查詢將套用於該用戶的同一限制。
在此時間範圍內針對相同關鍵字發出的後續查詢，也會計入此限制。
未傳回任何結果的查詢不會計入用戶的此限制。如果沒有傳回任何結果，請考慮微調或縮短您的查詢內容。
若有任何要求包含我們判斷屬於敏感或有冒犯性的關鍵字，API 會傳回空陣列。
權限
Threads 關鍵字搜尋 API 需要適當的存取權杖和權限。進行測試時，您可以使用圖形 API 測試工具，輕鬆產生權杖並授予權限給應用程式。

threads_basic — 對所有 Threads API 端點進行任何呼叫時的必要項目。
threads_keyword_search — 對關鍵字搜尋端點進行 GET 呼叫時的必要項目。
如果您的應用程式尚未獲得 threads_keyword_search 權限，則只會針對已驗證用戶所擁有的貼文進行搜尋。獲得權限後，即可搜尋公開貼文。

關鍵字搜尋
若要以關鍵字搜尋公開的 Threads 影音內容，請使用所要查詢的關鍵字，傳送 GET 要求至 /keyword_search 端點。

參數
名稱	說明
q

字串
必要項目。
所要查詢的關鍵字。

search_type

字串
選用項目。
指定搜尋行為。

值：

TOP（預設值）— 取得最熱門的搜尋結果。
RECENT — 取得最新的搜尋結果。
search_mode

字串
選用項目。
指定搜尋模式。

值：

KEYWORD（預設值）— 查詢會視為關鍵字。
TAG — 查詢會視為主題標籤。
media_type

字串
選用項目。
指定所要搜尋的影音內容類型。僅支援下列影音內容類型值。

值：

TEXT — 查詢將搜尋文字貼文。
IMAGE — 查詢將搜尋圖像貼文。
VIDEO — 查詢將搜尋影片貼文。
since

選用項目。
表示擷取開始日期的查詢字串參數（必須是 Unix 時間戳記，或是 strtotime(); 可解析的日期／時間表示法，時間戳記必須大於或等於 1688540400，並小於 until 參數）。

until

選用項目。
表示擷取結束日期的查詢字串參數（必須是 Unix 時間戳記，或是 strtotime(); 可解析的日期／時間表示法，時間戳記必須小於或等於目前時間戳記，並大於 since 參數）。

limit

選用項目。
查詢字串參數，表示所要求傳回之影音素材物件或紀錄的數量上限，預設值為 25，最大值為 100（僅允許輸入非負數的數值）。

author_username

選用項目。
篩選搜尋結果，僅包含由指定用戶名稱或個人檔案建立的貼文。用戶名稱必須完全相符，且不包含 @ 符號。

請參閱影音素材文件，查看可用欄位清單。注意：擁有者欄位不包含在內，且不會傳回。

要求範例
curl -s -X GET \
  -F "q=<KEYWORD>" \
  -F "search_type=TOP" \
  -F "fields=id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply" \
  -F "access_token=<THREADS_ACCESS_TOKEN>" \
"https://graph.threads.net/v1.0/keyword_search"
回應範例
{
  "data": [
    {
      "id": "1234567890",
      "text": "first thread",
      "media_type": "TEXT",
      "permalink": "https://www.threads.net/@<USER>/post/abcdefg",
      "timestamp": "2023-10-17T05:42:03+0000",
      "username": "<USER>",
      "has_replies": false,
      "is_quote_post": false,
      "is_reply": false
    }
  ]
}
主題標籤搜尋
若要以主題標籤搜尋公開的 Threads 影音內容，請使用所要查詢的標籤，傳送 GET 要求至 /keyword_search 端點。為了執行主題標籤搜尋，您需要使用 search_mode 參數，並將值設定為 TAG。

要求範例
curl -s -X GET \
  -F "q=<TAG>" \
  -F "search_mode=TAG" \
  -F "search_type=TOP" \
  -F "fields=id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply" \
  -F "access_token=<THREADS_ACCESS_TOKEN>" \
"https://graph.threads.net/v1.0/keyword_search"
回應範例
{
  "data": [
    {
      "id": "1234567890",
      "text": "second thread",
      "media_type": "TEXT",
      "permalink": "https://www.threads.net/@<USER>/post/abcdefg",
      "timestamp": "2023-10-17T05:42:03+0000",
      "username": "<USER>",
      "has_replies": false,
      "is_quote_post": false,
      "is_reply": false
    }
  ]
}
依影音內容類型搜尋
若要依影音內容類型搜尋公開的 Threads 貼文，請使用 media_type 參數，傳送 GET 要求至 /keyword_search 端點。搜尋可支援文字、圖像和影片等影音內容類型。如果未傳送 media_type 參數，回應中將傳回所有影音內容類型。

要求範例
curl -s -X GET \
  -F "q=<KEYWORD>" \
  -F "media_type=IMAGE"
  -F "fields=id,text,media_type,permalink,timestamp,username" \
  -F "access_token=<THREADS_ACCESS_TOKEN>" \
"https://graph.threads.net/v1.0/keyword_search"
回應範例
{
  "data": [
    {
      "id": "1234567890",
      "text": "third thread",
      "media_type": "IMAGE",
      "permalink": "https://www.threads.net/@<USER>/post/abcdefg",
      "timestamp": "2023-10-17T05:42:03+0000",
      "username": "<USER>"
    }
  ]
}
與公開 Threads 互動
您可以與最近搜尋的公開 Threads 影音內容進行互動。這些動作包括回覆、引用和轉發。

注意：可能還需要這些頁面中列出的其他權限。

最近搜尋的關鍵字
您可以傳送 GET 要求至 /me 端點，並要求 recently_searched_keywords 欄位，以針對目前已驗證的用戶，擷取最近搜尋的關鍵字清單。

要求範例
curl -s -X GET \
  -F "fields=recently_searched_keywords" \
  -F "access_token=<THREADS_ACCESS_TOKEN>" \
"https://graph.threads.net/v1.0/me"
回應範例
{
  "id": "1234567890",
  "recently_searched_keywords": [
    {
      "query": "some keyword",
      "timestamp": 1735707600000,
    },
    {
      "query": "some other keyword",
      "timestamp": 1735707600000,
    }
  ]
}