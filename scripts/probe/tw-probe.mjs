// 一次性探针（第四轮，盘中运行）：确认 Wind 台股数据在交易时段是否实时，以及计数是否有上限。
const SERVERS = {
  global_stock_data: "https://mcp.wind.com.cn/vserver_global_stock_data/mcp/",
  index_data: "https://mcp.wind.com.cn/vserver_index_data/mcp/",
  analytics_data: "https://mcp.wind.com.cn/vserver_analytics_data/mcp/",
  financial_docs: "https://mcp.wind.com.cn/vserver_financial_docs/mcp/"
};
const short = (value, n = 1500) => {
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
for (const tool of list?.result?.tools || []) if (tool.name === "get_index_price_indicators") console.log(`INDEX INDEXES (tail): ${tool.inputSchema.properties.indexes.description.slice(600)}`);

const industries = "TWII.TW,TWSE071.TW,TWSE075.TW,TWSE073.TW,TWSE072.TW,TWSE074.TW,TWSE021.TW,TWSE010.TW,TWSE013.TW,TWSE069.TW";
const probes = [
  ["行业指数批量快照(盘中)", "index_data", "get_index_price_indicators", { windcode: industries, indexes: "最新成交价,涨跌幅,成交额,近1分钟涨跌幅,近3分钟涨跌幅,近5分钟涨跌幅,近5分钟成交额,交易时间" }],
  ["台积电盘中", "global_stock_data", "get_global_stock_price_indicators", { windcode: "2330.TW", indexes: "最新成交价,涨跌幅,5分钟涨跌幅,涨停价,跌停价,交易时间" }],
  ["上涨家数(计数上限?)", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市柜股票中今日涨跌幅大于0的股票" }],
  ["下跌家数(计数上限?)", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市柜股票中今日涨跌幅小于0的股票" }],
  ["涨幅≥9.5%(盘中)", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市柜股票中今日涨跌幅大于等于9.5%的股票" }],
  ["跌幅≤-9.5%(盘中)", "global_stock_data", "search_global_stocks", { question: "筛选台湾上市柜股票中今日涨跌幅小于等于-9.5%的股票" }],
  ["涨跌家数聚合", "analytics_data", "get_financial_data", { question: "统计台湾上市柜股票今日涨跌幅大于0的股票数量和小于0的股票数量" }],
  ["加权指数成份涨跌(盘中)", "index_data", "get_index_technicals", { question: "台湾加权指数最新指数成份上涨数量、下跌数量、平盘数量" }],
  ["5分钟涨速个股", "analytics_data", "get_financial_data", { question: "台湾上市柜股票5分钟涨跌幅排名前二十" }],
  ["行业成分盘中", "analytics_data", "get_financial_data", { question: "台湾航运指数成分股今日涨跌幅排名前十" }],
  ["加权指数5分钟K", "index_data", "get_index_kline", { windcode: "TWII.TW", begin_date: "2026-10-13", end_date: "2026-10-13", period: "3" }],
  ["台股新闻(今日)", "financial_docs", "get_financial_news", { query: "台股盘中热点族群", top_k: 3 }]
];
for (const [label, server, tool, args] of probes) {
  try { console.log(`\n### ${label} (${server}/${tool})\n${short(await call(server, tool, args))}`); }
  catch (error) { console.log(`\n### ${label} ✗ ${error.message}`); }
}
