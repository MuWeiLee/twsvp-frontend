股價日成交資訊 TaiwanStockPrice¶
提供台股，上市、上櫃、興櫃，的股票日成交資訊！
資料區間：1994-10-01 ~ now
資料更新時間 星期一至五 17:30，實際更新時間以 API 資料為主
Example


Package

from FinMind.data import DataLoader

api = DataLoader()
# api.login_by_token(api_token='token')
df = api.taiwan_stock_daily(
    stock_id='2330',
    start_date='2020-04-02',
    end_date='2020-04-12'
)

Python-request

R
Output


DataFrame
date	stock_id	Trading_Volume	Trading_money	open	max	min	close	spread	Trading_turnover
0	2020-04-06	2330	59712754	16324198154	273	275.5	270	275.5	4	19971
1	2020-04-07	2330	48887346	13817936851	283.5	284	280.5	283	7.5	24281
2	2020-04-08	2330	38698826	11016972354	285	285.5	283	285	2	19126
3	2020-04-09	2330	29276430	8346209654	287.5	288	282.5	283	-2	15271
4	2020-04-10	2330	28206858	7894277586	280	