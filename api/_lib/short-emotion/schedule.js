// 短线情绪工作台 — 定时更新节奏（唯一需要改频率的地方）
//
// 只有 GitHub Actions 定时任务（scripts/short-emotion/refresh.mjs）会调用 Wind；页面访问只读最新快照。
// 工作流在北京/台北时间（同为 UTC+8）工作日 09:00–15:30 每 30 分钟唤醒一次，
// 每个市场跑哪些任务由下面各自的窗口决定。所有时间单位：分钟（UTC+8）。
//
// A股（cn）：09:00 起每 30 分钟一次，15:00 结束。
//   - 09:00：盘前，只更新新闻催化
//   - 09:30–11:30、13:00–15:00：情绪指标 + 题材异动 + 新闻
//   - 12:00、12:30 午休：只更新新闻
// 台股（tw）：09:00–13:30 连续交易，无午休。
//   - 09:00：开盘，只更新新闻
//   - 09:30–13:30：情绪指标 + 产业异动 + 新闻（13:30 收盘后最后一次）

export const SCHEDULES = {
  cn: {
    slotMinutes: 30,
    jobs: {
      emotion: { everyMinutes: 30, windows: [[9 * 60 + 30, 11 * 60 + 30], [13 * 60, 15 * 60]] },
      anomalies: { everyMinutes: 30, windows: [[9 * 60 + 30, 11 * 60 + 30], [13 * 60, 15 * 60]] },
      news: { everyMinutes: 30, windows: [[9 * 60, 15 * 60]] }
    },
    // 最后一次更新后清理：保留最近 60 个交易日的盘中快照
    cleanupAt: 15 * 60,
    historyTradingDays: 60,
    // 晚于这个时间仍拿不到当日行情，就判定今天休市，当天不再调用 Wind
    holidayCheckAfter: 10 * 60,
    summary: "交易日 09:00–15:00 每30分钟定时更新（行情与题材 09:30–11:30、13:00–15:00，新闻全程）"
  },
  tw: {
    slotMinutes: 30,
    jobs: {
      emotion: { everyMinutes: 30, windows: [[9 * 60 + 30, 13 * 60 + 30]] },
      anomalies: { everyMinutes: 30, windows: [[9 * 60 + 30, 13 * 60 + 30]] },
      news: { everyMinutes: 30, windows: [[9 * 60, 13 * 60 + 30]] }
    },
    cleanupAt: 13 * 60 + 30,
    historyTradingDays: 60,
    holidayCheckAfter: 10 * 60,
    summary: "交易日 09:00–13:30 每 30 分鐘定時更新（行情與產業 09:30–13:30，新聞全程）"
  }
};

// 兼容旧代码：SCHEDULE 指 A股
export const SCHEDULE = SCHEDULES.cn;
export const MARKETS = Object.keys(SCHEDULES);

const TZ = "Asia/Shanghai"; // 台北与北京同为 UTC+8

export function scheduleFor(market = "cn") {
  const schedule = SCHEDULES[market];
  if (!schedule) throw Object.assign(new Error(`未知市场：${market}`), { statusCode: 404 });
  return schedule;
}

export function shanghaiClock(date = new Date(), slotMinutes = 30) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23"
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return {
    day: `${parts.year}${parts.month}${parts.day}`,
    minute,
    slot: Math.floor(minute / slotMinutes) * slotMinutes,
    weekday: parts.weekday,
    isWeekday: !["Sat", "Sun"].includes(parts.weekday),
    label: `${parts.hour}:${parts.minute}`
  };
}

function inWindows(minute, windows) {
  return windows.some(([start, end]) => minute >= start && minute <= end);
}

/** Which jobs are due in the current slot (UTC+8). */
export function duePlan(date = new Date(), market = "cn") {
  const schedule = scheduleFor(market);
  const clock = shanghaiClock(date, schedule.slotMinutes);
  const jobs = {};
  for (const [name, rule] of Object.entries(schedule.jobs)) {
    jobs[name] = clock.isWeekday && inWindows(clock.slot, rule.windows) && clock.slot % rule.everyMinutes === 0;
  }
  jobs.cleanup = clock.isWeekday && clock.slot === schedule.cleanupAt;
  return { ...clock, jobs, anyDue: Object.values(jobs).some(Boolean) };
}

/** Plain-language description shown on the page. */
export function scheduleSummary(market = "cn") {
  return scheduleFor(market).summary;
}
