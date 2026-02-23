import handler from "../../api/sync-ptt-stock-board.js";
import { invokeHandler } from "./_invoke-handler.mjs";

const parseArgs = () => {
  const out = {
    sinceHours: process.env.PTT_SINCE_HOURS || "24",
    minNetPush: process.env.PTT_MIN_NET_PUSH || "20",
    maxPages: process.env.PTT_MAX_PAGES || "60",
    maxArticles: process.env.PTT_MAX_ARTICLES || "3000",
    requireContent: process.env.PTT_REQUIRE_CONTENT || "1",
    dryRun: process.env.PTT_DRY_RUN || "0",
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--since-hours=")) out.sinceHours = arg.split("=")[1] || out.sinceHours;
    if (arg.startsWith("--min-net-push=")) out.minNetPush = arg.split("=")[1] || out.minNetPush;
    if (arg.startsWith("--max-pages=")) out.maxPages = arg.split("=")[1] || out.maxPages;
    if (arg.startsWith("--max-articles=")) out.maxArticles = arg.split("=")[1] || out.maxArticles;
    if (arg.startsWith("--require-content=")) out.requireContent = arg.split("=")[1] || out.requireContent;
    if (arg.startsWith("--dry-run=")) out.dryRun = arg.split("=")[1] || out.dryRun;
  }

  return out;
};

const run = async () => {
  const args = parseArgs();
  const urlPath = `/api/sync-ptt-stock-board?since_hours=${encodeURIComponent(args.sinceHours)}&min_net_push=${encodeURIComponent(args.minNetPush)}&max_pages=${encodeURIComponent(args.maxPages)}&max_articles=${encodeURIComponent(args.maxArticles)}&require_content=${encodeURIComponent(args.requireContent)}&dry_run=${encodeURIComponent(args.dryRun)}`;

  const result = await invokeHandler({
    handler,
    urlPath,
    method: "GET",
    userAgent: "github-actions/ptt-crawl",
  });

  console.log(JSON.stringify({
    task: "ptt-crawl",
    url: urlPath,
    statusCode: result.statusCode,
    body: result.body,
  }, null, 2));

  if (result.statusCode >= 400) {
    process.exit(1);
  }
};

await run();
