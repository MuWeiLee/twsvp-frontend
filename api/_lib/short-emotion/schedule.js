// 短线情绪工作台 — 定时更新节奏（唯一需要改频率的地方）
//
// 只有定时任务 /api/sync-short-emotion 会调用 Wind；页面访问只读最新快照。
// vercel.json 的 cron 在北京时间 09:00–15:30 每 30 分钟唤醒一次（周一至周五），
// 每次跑哪些任务由下面的窗口决定。所有时间均为北京时间，单位：分钟。
//
// 当前节奏：09:00 起每 30 分钟一次，15:00 结束。
//   - 09:00：盘前，只更新新闻催化（行情尚未切到当日，不调用行情接口）
//   - 09:30–11:30、13:00–15:00：情绪指标 + 题材异动 + 新闻
//   - 12:00、12:30 午休：行情不变，只更新新闻

export const SCHEDULE = {
  slotMinutes: 30,
  jobs: {
    emotion: { everyMinutes: 30, windows: [[9 * 60 + 30, 11 * 60 + 30], [13 * 60, 15 * 60]] },
    anomalies: { everyMinutes: 30, windows: [[9 * 60 + 30, 11 * 60 + 30], [13 * 60, 15 * 60]] },
    news: { everyMinutes: 30, windows: [[9 * 60, 15 * 60]] }
  },
  // 15:00 最后一次更新后清理：保留最近 60 个交易日的盘中快照
  cleanupAt: 15 * 60,
  historyTradingDays: 60,
  // 晚于这个时间仍拿不到当日行情，就判定今天休市，当天不再调用 Wind
  holidayCheckAfter: 10 * 60
};

const TZ = "Asia/Shanghai";

export function shanghaiClock(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23"
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  return {
    day: `${parts.year}${parts.month}${parts.day}`,
    minute,
    slot: Math.floor(minute / SCHEDULE.slotMinutes) * SCHEDULE.slotMinutes,
    weekday: parts.weekday,
    isWeekday: !["Sat", "Sun"].includes(parts.weekday),
    label: `${parts.hour}:${parts.minute}`
  };
}

function inWindows(minute, windows) {
  return windows.some(([start, end]) => minute >= start && minute <= end);
}

/** Which jobs are due in the current slot (Beijing time). */
export function duePlan(date = new Date()) {
  const clock = shanghaiClock(date);
  const jobs = {};
  for (const [name, rule] of Object.entries(SCHEDULE.jobs)) {
    jobs[name] = clock.isWeekday && inWindows(clock.slot, rule.windows) && clock.slot % rule.everyMinutes === 0;
  }
  jobs.cleanup = clock.isWeekday && clock.slot === SCHEDULE.cleanupAt;
  return { ...clock, jobs, anyDue: Object.values(jobs).some(Boolean) };
}

/** Plain-language description shown on the page. */
export function scheduleSummary() {
  return "交易日 09:00–15:00 每30分钟定时更新（行情与题材 09:30–11:30、13:00–15:00，新闻全程）";
}
