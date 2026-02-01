import { t } from "./i18n.js";

const parseErrorMessage = (error) => {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  try {
    return JSON.stringify(error);
  } catch (stringifyError) {
    return "";
  }
};

export const getFollowErrorMessage = (error, { action = "follow" } = {}) => {
  const actionLabel = action === "unfollow" ? t("取消关注") : t("关注");
  const baseMessage =
    action === "unfollow"
      ? t("取消关注失败，请稍后重试。")
      : t("关注失败，请稍后重试。");
  const message = parseErrorMessage(error);
  if (!message) return baseMessage;
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return t("{action}失败：权限不足，请重新登录后重试。", { action: actionLabel });
  }
  if (message.includes("does not exist")) {
    return t("{action}失败：服务端缺少关注数据表，请联系管理员。", { action: actionLabel });
  }
  if (message.includes("JWT") || message.includes("token")) {
    return t("{action}失败：登录状态过期，请重新登录后重试。", { action: actionLabel });
  }
  if (message.includes("violates check constraint")) {
    return t("关注失败：无法关注自己。");
  }
  return baseMessage;
};
