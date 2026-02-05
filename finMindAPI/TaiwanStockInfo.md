台股總覽 TaiwanStockInfo¶
這張資料表主要是列出台灣所有，上市、上櫃、興櫃，的股票名稱，代碼和產業類別！
資料更新時間 每天 1:30，實際更新時間以 API 資料為主
Example


Package

from FinMind.data import DataLoader

api = DataLoader()
# api.login_by_token(api_token='token')
df = api.taiwan_stock_info()

Python-request

R
Output


DataFrame
industry_category	stock_id	stock_name	type	date
0	ETF	0050	元大台灣50	twse	2021-10-05
1	ETF	0051	元大中型100	twse	2021-10-05
2	ETF	0052	富邦科技	twse	2021-10-05
3	ETF	0053	元大電子	twse	2021-10-05
4	ETF	0054	元大台商50	twse	2021-10-05
