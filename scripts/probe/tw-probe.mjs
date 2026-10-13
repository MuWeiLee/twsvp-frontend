// 一次性探针：检查 Wind 与 TWSE/TPEx 公开数据能否支撑台股短线情绪。只打印结果摘要，不写任何数据。
import { callWindTool } from "../../api/_lib/short-emotion/wind-client.js";

const short = (value, n = 1500) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > n ? `${text.slice(0, n)}…(${text.length} chars)` : text;
};
const unpack = (result) => {
  const text = result?.content?.[0]?.text ?? "";
  try { return JSON.parse(text); } catch { return text; }
};

const windProbes = [
  ["加权指数行情+涨跌家数", "index_data", "get_index_price_indicators", { windcode: "TWII.TW", indexes: "最新成交价,涨跌幅,成交额,上涨家数,下跌家数,平盘家数,交易时间" }],
  ["加权指数K线", "index_data", "get_index_kline", { windcode: "TWII.TW", begin_date: "20261001", end_date: "20261012" }],
  ["台积电行情", "global_stock_data", "get_global_stock_quote", { windcode: "2330.TW" }],
  ["台股涨停筛选", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市股票中最新成交价等于涨停价的股票" }],
  ["台股涨停筛选2", "stock_data", "search_stocks", { question: "筛选台股上市柜股票中当日涨停的股票" }],
  ["台股大涨家数", "analytics_data", "get_financial_data", { question: "台湾上市股票最新涨幅大于5%的股票家数" }],
  ["台股类股指数排名", "analytics_data", "get_financial_data", { question: "台湾证券交易所产业类股指数今日涨跌幅排名" }],
  ["台股概念排名", "analytics_data", "get_financial_data", { question: "台股概念板块今日涨跌幅排名前十" }],
  ["台股概念5分钟", "index_data", "get_index_technicals", { question: "台股产业指数最近5分钟涨幅排名" }],
  ["台股新闻", "financial_docs", "get_financial_news", { query: "台股今日热点题材利好催化", top_k: 5 }],
  ["台股个股所属概念", "analytics_data", "get_financial_data", { question: "2330.TW所属概念板块" }]
];

for (const [label, server, tool, params] of windProbes) {
  const started = Date.now();
  try {
    const out = unpack(await callWindTool(server, tool, params, { timeoutMs: 40_000 }));
    console.log(`\n### WIND ${label} (${server}/${tool}) ✓ ${Date.now() - started}ms\n${short(out)}`);
  } catch (error) {
    console.log(`\n### WIND ${label} (${server}/${tool}) ✗ ${error.message.slice(0, 300)}`);
  }
}

const httpProbes = [
  ["TWSE 盘中加权指数(MIS)", "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw|otc_o00.tw&json=1&delay=0"],
  ["TWSE 盘后 MI_INDEX 涨跌家数", "https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?type=MS&response=json"],
  ["TWSE OpenAPI 类股指数", "https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX"],
  ["TWSE OpenAPI 全部个股日行情", "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"],
  ["TPEx OpenAPI 上柜日行情", "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes"],
  ["TWSE MIS 盘中个股(台积电)", "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_2330.tw&json=1&delay=0"],
  ["TWSE 盘中类股指数(MIS)", "https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t13.tw|tse_t24.tw|tse_t28.tw&json=1&delay=0"]
];

for (const [label, url] of httpProbes) {
  const started = Date.now();
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 twsvp-probe", Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    const text = await response.text();
    let rows = "";
    try { const json = JSON.parse(text); if (Array.isArray(json)) rows = ` rows=${json.length} keys=${Object.keys(json[0] || {}).join(",")}`; } catch {}
    console.log(`\n### HTTP ${label} → ${response.status} ${Date.now() - started}ms${rows}\n${short(text, 1200)}`);
  } catch (error) {
    console.log(`\n### HTTP ${label} ✗ ${error.message}`);
  }
}
