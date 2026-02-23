import handler from "../../api/sync-ptt-stock-links.js";
import { invokeHandler } from "./_invoke-handler.mjs";

const parseArgs = () => {
  const out = {
    sinceHours: process.env.PTT_SINCE_HOURS || "24",
    minNetPush: process.env.PTT_MIN_NET_PUSH || "20",
    articleLimit: process.env.PTT_ARTICLE_LIMIT || "1200",
    dryRun: process.env.PTT_DRY_RUN || "0",
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--since-hours=")) out.sinceHours = arg.split("=")[1] || out.sinceHours;
    if (arg.startsWith("--min-net-push=")) out.minNetPush = arg.split("=")[1] || out.minNetPush;
    if (arg.startsWith("--article-limit=")) out.articleLimit = arg.split("=")[1] || out.articleLimit;
    if (arg.startsWith("--dry-run=")) out.dryRun = arg.split("=")[1] || out.dryRun;
  }

  return out;
};

const run = async () => {
  const args = parseArgs();
  const urlPath = `/api/sync-ptt-stock-links?since_hours=${encodeURIComponent(args.sinceHours)}&min_net_push=${encodeURIComponent(args.minNetPush)}&article_limit=${encodeURIComponent(args.articleLimit)}&dry_run=${encodeURIComponent(args.dryRun)}`;

  const result = await invokeHandler({
    handler,
    urlPath,
    method: "GET",
    userAgent: "github-actions/ptt-link",
  });

  console.log(JSON.stringify({
    task: "ptt-link",
    url: urlPath,
    statusCode: result.statusCode,
    body: result.body,
  }, null, 2));

  if (result.statusCode >= 400) {
    process.exit(1);
  }
};

await run();
