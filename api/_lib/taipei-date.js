const DEFAULT_TIME_ZONE = "Asia/Taipei";

const formatterByTimeZone = new Map();

const getFormatter = (timeZone = DEFAULT_TIME_ZONE) => {
  if (formatterByTimeZone.has(timeZone)) {
    return formatterByTimeZone.get(timeZone);
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  formatterByTimeZone.set(timeZone, formatter);
  return formatter;
};

export const formatDate = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getDateStringInTimeZone = (date = new Date(), timeZone = DEFAULT_TIME_ZONE) => {
  const parts = getFormatter(timeZone).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    return formatDate(date);
  }
  return `${year}-${month}-${day}`;
};

export const getTaipeiDateString = (date = new Date()) =>
  getDateStringInTimeZone(date, DEFAULT_TIME_ZONE);
