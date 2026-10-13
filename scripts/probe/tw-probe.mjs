// 一次性探针（第二轮）：只用 Wind MCP，检查台股短线情绪所需的每一项数据。
import { callWindTool } from "../../api/_lib/short-emotion/wind-client.js";

const SERVERS = {
  global_stock_data: "https://mcp.wind.com.cn/vserver_global_stock_data/mcp/",
  index_data: "https://mcp.wind.com.cn/vserver_index_data/mcp/",
  analytics_data: "https://mcp.wind.com.cn/vserver_analytics_data/mcp/"
};
const short = (value, n = 1400) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > n ? `${text.slice(0, n)}…(${text.length} chars)` : text;
};
const unpack = (result) => { const text = result?.content?.[0]?.text ?? ""; try { return JSON.parse(text); } catch { return text; } };

async function rpc(server, method, params) {
  const response = await fetch(SERVERS[server], {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WIND_API_KEY}`, Accept: "application/json, text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });
  const text = await response.text();
  const line = text.trim().startsWith("{") ? text : text.split(/\r?\n/).filter((l) => l.startsWith("data: ")).at(-1)?.slice(6);
  return JSON.parse(line);
}

console.log("## TOOL SCHEMAS");
for (const server of Object.keys(SERVERS)) {
  try {
    await rpc(server, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "twsvp-probe", version: "1.7.0" } });
    const list = await rpc(server, "tools/list", {});
    for (const tool of list.result?.tools || []) {
      console.log(`\n# ${server}/${tool.name}\n${short(tool.description, 700)}\nPARAMS ${short(tool.inputSchema?.properties, 900)}`);
    }
  } catch (error) {
    console.log(`schema ${server} ✗ ${error.message}`);
  }
}

const probes = [
  // 大盘 / 广度
  ["上市涨跌家数", "analytics_data", "get_financial_data", { question: "台湾证券交易所上市股票今日上涨家数、下跌家数、平盘家数" }],
  ["上柜涨跌家数", "analytics_data", "get_financial_data", { question: "台湾柜买中心上柜股票今日上涨家数和下跌家数" }],
  ["台股涨跌家数统计", "analytics_data", "get_financial_data", { question: "台股今日涨跌家数统计" }],
  ["柜买指数", "index_data", "get_index_price_indicators", { windcode: "TWOII.TWO", indexes: "最新成交价,涨跌幅,成交额,交易时间" }],
  ["加权指数技术面上涨家数", "index_data", "get_index_technicals", { question: "台湾加权指数今日上涨家数下跌家数" }],
  // 涨跌停
  ["台股涨停列表", "analytics_data", "get_financial_data", { question: "台股上市柜股票今日涨停股票列表" }],
  ["台股涨停家数", "analytics_data", "get_financial_data", { question: "台湾上市柜股票今日涨停家数" }],
  ["台股跌停列表", "analytics_data", "get_financial_data", { question: "台股上市柜股票今日跌停股票列表" }],
  ["台股跌幅大于5%", "analytics_data", "get_financial_data", { question: "台湾上市柜股票最新跌幅大于5%的股票家数" }],
  ["global筛选涨停", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市柜股票中今日涨跌幅大于等于9.5%的股票" }],
  // 个股
  ["台积电价格指标", "global_stock_data", "get_global_stock_price_indicators", { windcode: "2330.TW", indexes: "最新成交价,涨跌幅,涨停价,跌停价,成交额,交易时间" }],
  ["台积电基本资料", "global_stock_data", "get_global_stock_basicinfo", { windcode: "2330.TW" }],
  ["台积电分钟K", "global_stock_data", "get_global_stock_kline", { windcode: "2330.TW", begin_date: "20261012", end_date: "20261012", period: "5" }],
  ["昨日涨停今日表现", "analytics_data", "get_financial_data", { question: "台股20261008涨停股票在20261012的涨跌幅" }],
  ["连续涨停", "analytics_data", "get_financial_data", { question: "台股连续两日以上涨停的股票" }],
  // 题材 / 产业
  ["台股产业涨跌幅排名", "analytics_data", "get_financial_data", { question: "台股各产业类股今日涨跌幅排名" }],
  ["台湾半导体类指数", "index_data", "get_index_price_indicators", { windcode: "TWSE24.TW", indexes: "最新成交价,涨跌幅,交易时间" }],
  ["台股电子类指数搜索", "analytics_data", "get_financial_data", { question: "台湾证券交易所半导体类指数代码" }],
  ["台股行业Wind分类", "analytics_data", "get_financial_data", { question: "台股Wind行业板块今日涨跌幅排名" }],
  ["台股所属行业", "analytics_data", "get_financial_data", { question: "6223.TWO旺矽所属行业" }],
  ["台股同行业成分", "analytics_data", "get_financial_data", { question: "台股半导体行业成分股今日涨跌幅排名前十" }],
  ["台股概念股探针", "analytics_data", "get_financial_data", { question: "台股探针卡概念股今日涨跌幅" }],
  ["台股AI服务器概念", "global_stock_data", "search_global_stocks", { question: "台湾AI服务器概念股" }],
  // 短线动量
  ["台股5分钟涨幅", "analytics_data", "get_financial_data", { question: "台股上市柜股票最近5分钟涨幅排名前二十" }],
  ["台股成交额排名", "analytics_data", "get_financial_data", { question: "台股今日成交额排名前二十" }]
];

console.log("\n\n## PROBES");
for (const [label, server, tool, params] of probes) {
  try {
    const out = unpack(await callWindTool(server, tool, params, { timeoutMs: 40_000 }));
    console.log(`\n### ${label} (${server}/${tool}) ✓\n${short(out)}`);
  } catch (error) {
    console.log(`\n### ${label} (${server}/${tool}) ✗ ${error.message.slice(0, 300)}`);
  }
}
