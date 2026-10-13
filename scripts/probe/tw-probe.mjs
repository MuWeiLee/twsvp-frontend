// 一次性探针（第三轮）：只用 Wind MCP，确认台股行业指数、批量行情、5分钟涨速、涨跌停计数。
const SERVERS = {
  global_stock_data: "https://mcp.wind.com.cn/vserver_global_stock_data/mcp/",
  index_data: "https://mcp.wind.com.cn/vserver_index_data/mcp/",
  analytics_data: "https://mcp.wind.com.cn/vserver_analytics_data/mcp/"
};
const short = (value, n = 1600) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > n ? `${text.slice(0, n)}…(${text.length} chars)` : text;
};
async function rpc(server, method, params) {
  const response = await fetch(SERVERS[server], {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WIND_API_KEY}`, Accept: "application/json, text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    signal: AbortSignal.timeout(45_000)
  });
  const text = await response.text();
  const line = text.trim().startsWith("{") ? text : text.split(/\r?\n/).filter((l) => l.startsWith("data: ")).at(-1)?.slice(6);
  return JSON.parse(line);
}
const ready = new Set();
async function call(server, name, args) {
  if (!ready.has(server)) { await rpc(server, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "twsvp-probe", version: "1.7.0" } }); ready.add(server); }
  const out = await rpc(server, "tools/call", { name, arguments: args, _meta: { clientVersion: "1.7.0" } });
  const text = out.result?.content?.[0]?.text ?? JSON.stringify(out.error || out);
  try { return JSON.parse(text); } catch { return text; }
}

console.log(`now=${new Date().toISOString()}`);
const list = await rpc("index_data", "tools/list", {}).catch(() => null);
for (const tool of list?.result?.tools || []) if (tool.name === "get_index_price_indicators") console.log(`INDEX INDEXES: ${tool.inputSchema.properties.indexes.description}`);
const glist = await rpc("global_stock_data", "tools/list", {}).catch(() => null);
for (const tool of glist?.result?.tools || []) if (tool.name === "get_global_stock_price_indicators") console.log(`GLOBAL INDEXES: ${tool.inputSchema.properties.indexes.description}`);

const probes = [
  ["上市行业指数清单", "analytics_data", "get_financial_data", { question: "台湾证券交易所全部行业指数的Wind代码和简称" }],
  ["上柜行业指数清单", "analytics_data", "get_financial_data", { question: "台湾柜买中心全部行业指数的Wind代码和简称" }],
  ["柜买指数代码", "analytics_data", "get_financial_data", { question: "台湾柜买指数的Wind代码" }],
  ["多指数快照", "index_data", "get_index_price_indicators", { windcode: "TWII.TW,TWSE071.TW,TWOTC102.TWO", indexes: "最新成交价,涨跌幅,成交额,近5分钟成交额,交易时间" }],
  ["加权指数涨跌家数字段", "index_data", "get_index_price_indicators", { windcode: "TWII.TW", indexes: "上涨家数,下跌家数,平盘家数,涨停家数,跌停家数,交易时间" }],
  ["加权指数成份涨跌家数", "index_data", "get_index_technicals", { question: "台湾加权指数最新指数成份上涨数量、下跌数量、平盘数量、涨停数量、跌停数量" }],
  ["台积电5分钟涨跌幅涨停价", "global_stock_data", "get_global_stock_price_indicators", { windcode: "2330.TW", indexes: "最新成交价,涨跌幅,5分钟涨跌幅,涨停价,跌停价,前收盘价,交易时间" }],
  ["涨停计数", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市柜股票中最新成交价等于涨停价的股票" }],
  ["涨幅≥9.5%", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市柜股票中今日涨跌幅大于等于9.5%的股票" }],
  ["跌幅≥9.5%", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市柜股票中今日涨跌幅小于等于-9.5%的股票" }],
  ["涨幅>5%", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市柜股票中今日涨跌幅大于5%的股票" }],
  ["跌幅>5%", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市柜股票中今日涨跌幅小于-5%的股票" }],
  ["5分钟涨速", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市柜股票中5分钟涨跌幅大于1%的股票" }],
  ["批量个股涨跌幅", "analytics_data", "get_financial_data", { question: "2429.TW、1516.TW、3008.TW、2603.TW的最新涨跌幅" }],
  ["行业成分排名", "analytics_data", "get_financial_data", { question: "台湾半导体指数成分股今日涨跌幅排名前十" }],
  ["Wind行业汇总", "analytics_data", "get_financial_data", { question: "台股按Wind二级行业统计今日平均涨跌幅和涨停家数" }],
  ["加权指数5分钟K", "index_data", "get_index_kline", { windcode: "TWII.TW", period: "3", count: -6 }],
  ["行业指数5日", "index_data", "get_index_kline", { windcode: "TWSE071.TW", begin_date: "2026-10-01", end_date: "2026-10-12" }]
];
for (const [label, server, tool, args] of probes) {
  try { console.log(`\n### ${label} (${server}/${tool})\n${short(await call(server, tool, args))}`); }
  catch (error) { console.log(`\n### ${label} ✗ ${error.message}`); }
}
