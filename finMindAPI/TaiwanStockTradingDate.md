台股交易日 TaiwanStockTradingDate¶
提供台股交易日。
資料更新時間-星期一至五 18:00，實際更新時間以 API 資料為主。
Example


Python-request

import requests
import pandas as pd
url = "https://api.finmindtrade.com/api/v4/data"
token = "" # 參考登入，獲取金鑰
headers = {"Authorization": f"Bearer {token}"}
parameter = {
    "dataset": "TaiwanStockTradingDate",
}
resp = requests.get(url, headers=headers, params=parameter)
data = resp.json()
data = pd.DataFrame(data["data"])
print(data.head())

R
Output


DataFrame
date
0	2005-01-03
1	2005-01-04
2	2005-01-05
3	2005-01-06
4	2005-01-07
