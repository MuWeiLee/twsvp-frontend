import { supabase } from "./supabase.js";

const STORAGE_KEY = "twsvp_trade_broker";

export const BROKERS = [
  {
    id: "ctbc-bright",
    name: "中信亮點",
    appStoreUrl:
      "https://apps.apple.com/tw/app/%E4%B8%AD%E4%BF%A1%E4%BA%AE%E9%BB%9E/id1411101548?l=en-GB",
    appScheme: "",
  },
  {
    id: "cathay-securities",
    name: "國泰證券",
    appStoreUrl:
      "https://apps.apple.com/tw/app/%E5%9C%8B%E6%B3%B0%E8%AD%89%E5%88%B8/id1228503534?l=en-GB",
    appScheme: "",
  },
  {
    id: "cathay-tree-elf",
    name: "國泰樹精靈",
    appStoreUrl:
      "https://apps.apple.com/tw/app/%E5%9C%8B%E6%B3%B0%E8%AD%89%E5%88%B8-%E6%A8%B9%E7%B2%BE%E9%9D%88/id1119050613?l=en-GB",
    appScheme: "",
  },
  {
    id: "fubon-ai-pro",
    name: "富邦 AI Pro",
    appStoreUrl:
      "https://apps.apple.com/tw/app/%E5%AF%8C%E9%82%A6-ai-pro/id6751573234?l=en-GB",
    appScheme: "",
  },
  {
    id: "yuanta-investment-mr",
    name: "元大投資先生",
    appStoreUrl:
      "https://apps.apple.com/tw/app/%E6%8A%95%E8%B3%87%E5%85%88%E7%94%9F/id1382114621?l=en-GB",
    appScheme: "",
  },
  {
    id: "fugle",
    name: "富果 FUGLE",
    appStoreUrl:
      "https://apps.apple.com/tw/app/%E5%AF%8C%E6%9E%9C-fugle-%E5%B0%88%E7%82%BA%E5%B9%B4%E8%BC%95%E4%BA%BA%E6%89%93%E9%80%A0%E5%8F%B0%E8%82%A1%E6%8A%95%E8%B3%87%E7%A0%94%E7%A9%B6-%E8%A6%96%E8%A6%BA%E5%8C%96%E9%81%B8%E8%82%A1%E7%9C%8B%E7%9B%A4/id1542310263?l=en-GB",
    appScheme: "",
  },
];

const BROKER_MAP = new Map(BROKERS.map((broker) => [broker.id, broker]));

export const getBrokerById = (id) => {
  if (!id) return null;
  return BROKER_MAP.get(id) || null;
};

const normalizeBrokerId = (id) => (getBrokerById(id) ? id : "");

export const getBrokerPreferenceLocal = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return normalizeBrokerId(stored);
};

export const setBrokerPreferenceLocal = (id) => {
  const key = normalizeBrokerId(id);
  if (key) {
    localStorage.setItem(STORAGE_KEY, key);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  return key;
};

export const fetchBrokerPreferenceSupabase = async (userId) => {
  if (!userId) {
    return getBrokerPreferenceLocal();
  }
  const { data, error } = await supabase
    .from("user_trade_brokers")
    .select("broker_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("获取 user_trade_brokers 失败:", error);
    return getBrokerPreferenceLocal();
  }

  return setBrokerPreferenceLocal(data?.broker_id || "");
};

export const saveBrokerPreferenceSupabase = async (userId, brokerId) => {
  const key = setBrokerPreferenceLocal(brokerId);
  if (!userId) {
    return { ok: false, brokerId: key };
  }

  if (!key) {
    const { error } = await supabase.from("user_trade_brokers").delete().eq("user_id", userId);
    if (error) {
      console.error("清理 user_trade_brokers 失败:", error);
      return { ok: false, brokerId: key };
    }
    return { ok: true, brokerId: key };
  }

  const { error } = await supabase
    .from("user_trade_brokers")
    .upsert({ user_id: userId, broker_id: key }, { onConflict: "user_id" });

  if (error) {
    console.error("更新 user_trade_brokers 失败:", error);
    return { ok: false, brokerId: key };
  }

  return { ok: true, brokerId: key };
};

export const getAppStoreUrl = (broker) => {
  if (!broker?.appStoreUrl) return "";
  return broker.appStoreUrl;
};

export const getAppStoreDeepLink = (broker) => {
  const url = getAppStoreUrl(broker);
  if (!url) return "";
  if (url.startsWith("itms-apps://")) return url;
  return url.replace(/^https?:\/\//, "itms-apps://");
};
