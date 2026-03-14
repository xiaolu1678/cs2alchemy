// @ts-nocheck
"use client";

import { updateContractById } from "@/lib/db/contracts";
import { updateMaterialById } from "@/lib/db/materials";
import {
  fetchDailyExtraIncome,
  upsertDailyExtraIncome,
} from "@/lib/db/daily-extra-income";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  fetchMaterials,
  insertMaterial,
  deleteMaterialsByIds,
} from "@/lib/db/materials";
import {
  fetchContracts,
  insertContract,
  deleteContractsByIds,
} from "@/lib/db/contracts";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Wallet, Boxes, TrendingUp, PackageCheck, Layers3, Pencil, Eye, EyeOff, CalendarDays, Trash2 } from "lucide-react";

const platformOptions = ["BUFF", "C5", "UU有品", "ECO"];
const inventoryPlatformOptions = ["BUFF", "C5", "UU有品", "ECO", "汰换"];
const wearLevelOptions = ["崭新出厂", "略有磨损", "久经沙场", "破损不堪", "战痕累累"];
const wearRanges = {
  崭新出厂: ["0.00 - 0.01", "0.01 - 0.02", "0.02 - 0.03", "0.03 - 0.04", "0.04 - 0.07", "自定义"],
  略有磨损: ["0.07 - 0.08", "0.08 - 0.09", "0.09 - 0.10", "0.10 - 0.11", "0.11 - 0.15", "自定义"],
  久经沙场: ["0.15 - 0.18", "0.18 - 0.21", "0.21 - 0.24", "0.24 - 0.27", "0.27 - 0.38", "自定义"],
  破损不堪: ["0.38 - 0.39", "0.39 - 0.40", "0.40 - 0.41", "0.41 - 0.42", "0.42 - 0.45", "自定义"],
  战痕累累: ["0.45 - 0.50", "0.50 - 0.63", "0.63 - 0.76", "0.76 - 0.90", "0.90 - 1.00", "自定义"],
};

const PAST_PROFIT_DATE = "1900-01-01";

function money(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function getRemainingDays(expiresAt?: string | null) {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function computeFurnaceFee(refPrice, result, furnaceRatePercent) {
  const rate = result === "成功" ? Number(furnaceRatePercent || 10) / 100 : 0;
  return Number((refPrice * rate).toFixed(2));
}

function formatInventoryDate(date, showFullDate) {
  if (showFullDate) return date;
  return typeof date === "string" && date.length >= 10 ? date.slice(5) : date;
}

function calendarMatrix(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startWeekDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const cells = [];
  for (let i = 0; i < startWeekDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getDailySummary(
  date: string,
  materials: any[],
  contracts: any[],
  dailyExtraMap: Record<string, number> = {}
) {
  const materialProfit = materials
    .filter((item) => {
      const saleDate = item.saleDate ?? item.sale_date;
      const salePrice = item.salePrice ?? item.sale_price;
      return saleDate === date && salePrice !== null && salePrice !== undefined && salePrice !== "";
    })
    .reduce((sum, item) => {
      const salePrice = item.salePrice ?? item.sale_price;
      return sum + (Number(salePrice || 0) - Number(item.cost || 0));
    }, 0);

  const productProfit = contracts
    .filter((item) => {
      const saleDate = item.saleDate ?? item.sale_date;
      const salePrice = item.salePrice ?? item.sale_price;
      return saleDate === date && salePrice !== null && salePrice !== undefined && salePrice !== "";
    })
    .reduce((sum, item) => {
      const salePrice = item.salePrice ?? item.sale_price;
      const refPrice = item.refPrice ?? item.ref_price;
      return sum + (Number(salePrice || 0) - Number(refPrice || 0));
    }, 0);

  const furnaceIncome = contracts
    .filter((item) => item.date === date)
    .reduce((sum, item) => {
      const furnaceFee = item.furnaceFee ?? item.furnace_fee;
      return sum + Number(furnaceFee || 0);
    }, 0);

  const extraValue = Number(dailyExtraMap?.[date] || 0);

  return {
    materialProfit,
    productProfit,
    furnaceIncome,
    extraValue,
    totalProfit: materialProfit + productProfit + furnaceIncome + extraValue,
  };
}

export default function CS2TradeRegisterPrototype() {

const router = useRouter();
const [toast, setToast] = React.useState({
  show: false,
  message: "",
  type: "success",
});
const toastTimerRef = React.useRef<any>(null);
function showToast(message: string, type: "success" | "error" = "success") {
  if (toastTimerRef.current) {
    clearTimeout(toastTimerRef.current);
  }

  setToast({
    show: true,
    message,
    type,
  });

  toastTimerRef.current = setTimeout(() => {
    setToast((prev) => ({
      ...prev,
      show: false,
    }));
  }, 2200);
}



React.useEffect(() => {
  async function checkAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

setCurrentUser(user);

const membership = await loadMembership(user.id, user.email);
setMembershipInfo(membership);

const expired =
  !membership?.membership_expires_at ||
  new Date(membership.membership_expires_at).getTime() < Date.now();

setIsReadonlyMode(expired);

await loadMaterials(user.id);
await loadContracts(user.id);
await loadDailyExtraIncome(user.id);

setAuthChecked(true);
  }

  checkAuth();
}, [router]);


async function handleLogout() {
  await supabase.auth.signOut();
  router.replace("/login");
}

async function handleChangePassword() {
  if (!currentUser?.email) {
    showToast("当前用户信息异常", "error");
    return;
  }

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    showToast("请填写完整密码信息", "error");
    return;
  }

  if (newPassword !== confirmNewPassword) {
    showToast("两次新密码不一致", "error");
    return;
  }

  if (newPassword.length < 6) {
    showToast("新密码至少 6 位", "error");
    return;
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: currentUser.email,
    password: currentPassword,
  });

  if (verifyError) {
    showToast("原密码错误", "error");
    return;
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    showToast(`修改密码失败：${updateError.message}`, "error");
    return;
  }

  setCurrentPassword("");
  setNewPassword("");
  setConfirmNewPassword("");
  showToast("密码修改成功");
}

async function redeemActivationCode() {
  if (!currentUser?.id) return;

  if (!activationCodeInput.trim()) {
    showToast("请输入激活码", "error");
    return;
  }

  const { data: codeRow, error: codeError } = await supabase
    .from("activation_codes")
    .select("*")
    .eq("code", activationCodeInput.trim())
    .eq("is_used", false)
    .single();

  if (codeError || !codeRow) {
    showToast("激活码无效或已使用", "error");
    return;
  }

  const currentExpire = membershipInfo?.membership_expires_at
    ? new Date(membershipInfo.membership_expires_at).getTime()
    : Date.now();

  const baseTime = currentExpire > Date.now() ? currentExpire : Date.now();
  const nextExpire = new Date(
    baseTime + Number(codeRow.days || 0) * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: updateMembershipError } = await supabase
    .from("user_memberships")
    .update({
      membership_expires_at: nextExpire,
      is_readonly: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", currentUser.id);

  if (updateMembershipError) {
    showToast("激活失败", "error");
    return;
  }

  const { error: markUsedError } = await supabase
    .from("activation_codes")
    .update({
      is_used: true,
      used_by: currentUser.id,
      used_at: new Date().toISOString(),
    })
    .eq("id", codeRow.id);

  if (markUsedError) {
    showToast("激活成功，但激活码状态更新失败", "error");
    return;
  }

  const refreshed = await loadMembership(currentUser.id);
  setMembershipInfo(refreshed);
  setIsReadonlyMode(false);
  setActivationCodeInput("");

  showToast("激活成功");
}


async function loadMaterials(userId: string) {
  const { data, error } = await fetchMaterials(userId);

  if (error) {
    console.error("读取材料失败", error);
    return;
  }

  setMaterials(data || []);
}

async function loadContracts(userId: string) {
  const { data, error } = await fetchContracts(userId);

  if (error) {
    console.error("读取汰换记录失败", error);
    return;
  }

  setContracts(data || []);
}

const [showPastProfit, setShowPastProfit] = useState(false);
const [showAllContracts, setShowAllContracts] = useState(false);
  const [showAllMaterials, setShowAllMaterials] = useState(false);
const [inventoryEdits, setInventoryEdits] = useState<Record<string, any>>({});
  const [materials, setMaterials] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [membershipInfo, setMembershipInfo] = useState<any>(null);
const [isReadonlyMode, setIsReadonlyMode] = useState(false);
const [showUserPanel, setShowUserPanel] = useState(false);

const [activationCodeInput, setActivationCodeInput] = useState("");
const [confirmNewPassword, setConfirmNewPassword] = useState("");
const [currentPassword, setCurrentPassword] = useState("");
const [newPassword, setNewPassword] = useState("");
  const [keyword, setKeyword] = useState("");
  const batchInputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const [exchangeMode, setExchangeMode] = useState("普通汰换");
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedDailyDate, setSelectedDailyDate] = useState("2026-03-10");
  const [showCalendar, setShowCalendar] = useState(false);
const [dailyExtraMap, setDailyExtraMap] = useState<Record<string, number>>({});
const [editingExtraDate, setEditingExtraDate] = useState<string | null>(null);
const [editingExtraValue, setEditingExtraValue] = useState("");
  const [detailPanel, setDetailPanel] = useState("material");
  const [pastProfit, setPastProfit] = useState(0);
const [editingPastProfit, setEditingPastProfit] = useState(false);
const [editingPastProfitValue, setEditingPastProfitValue] = useState("");
const [visibleStatMap, setVisibleStatMap] = useState({
  materialProfit: false,
  productProfit: false,
  furnaceIncome: false,
  extraIncome: false,
  totalProfit: false,
  stockCount: true,
  stockCost: false,
});
  const [materialForm, setMaterialForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    platform: "BUFF",
    name: "",
    wearLevel: "久经沙场",
    wearRange: "0.15 - 0.18",
    customWear: "",
    cost: "",
    salePrice: "",
  });
  const [batchPrices, setBatchPrices] = useState([""]);
const [inventoryFilters, setInventoryFilters] = useState({
  date: "",
  platform: "全部",
  name: "",
  wearLevel: "全部",
  status: "全部",
});
  const [contractForm, setContractForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    contractName: "",
    outputName: "",
    outputWearLevel: "久经沙场",
    outputWearRange: "0.15 - 0.18",
    outputCustomWear: "",
    refPrice: "",
    result: "成功",
    furnaceRatePercent: "10",
    salePrice: "",
  });

const [packageFilters, setPackageFilters] = useState({
  date: "",
  name: "",
  platform: "全部",
});

  const [packageForm, setPackageForm] = useState({
 date: new Date().toISOString().slice(0, 10),
    contractName: "",
    outputName: "",
    outputWearLevel: "久经沙场",
    outputWearRange: "0.15 - 0.18",
    outputCustomWear: "",
    result: "成功",
    salePrice: "",
    selectedIds: [],
  });

  const materialNameSuggestions = useMemo(() => {
    const names = [...new Set(materials.map((item) => item.name).filter(Boolean))];
    if (!materialForm.name.trim()) return [];
    const q = materialForm.name.toLowerCase();
    return names.filter((name) => name.toLowerCase().includes(q)).slice(0, 6);
  }, [materials, materialForm.name]);


  const contractNameSuggestions = useMemo(() => {
    const names = [...new Set(contracts.map((item) => item.contractName).filter(Boolean))];
    if (!contractForm.contractName.trim()) return [];
    const q = contractForm.contractName.toLowerCase();
    return names.filter((name) => name.toLowerCase().includes(q)).slice(0, 6);
  }, [contracts, contractForm.contractName]);

  const outputNameSuggestions = useMemo(() => {
    const names = [...new Set(contracts.map((item) => item.outputName).filter(Boolean).concat(materials.map((item) => item.name).filter(Boolean)))];
    if (!contractForm.outputName.trim()) return [];
    const q = contractForm.outputName.toLowerCase();
    return names.filter((name) => name.toLowerCase().includes(q)).slice(0, 6);
  }, [contracts, materials, contractForm.outputName]);

  const packageContractNameSuggestions = useMemo(() => {
    const names = [...new Set(contracts.map((item) => item.contractName).filter(Boolean))];
    if (!packageForm.contractName.trim()) return [];
    const q = packageForm.contractName.toLowerCase();
    return names.filter((name) => name.toLowerCase().includes(q)).slice(0, 6);
  }, [contracts, packageForm.contractName]);

  const packageOutputNameSuggestions = useMemo(() => {
    const names = [...new Set(contracts.map((item) => item.outputName).filter(Boolean).concat(materials.map((item) => item.name).filter(Boolean)))];
    if (!packageForm.outputName.trim()) return [];
    const q = packageForm.outputName.toLowerCase();
    return names.filter((name) => name.toLowerCase().includes(q)).slice(0, 6);
  }, [contracts, materials, packageForm.outputName]);
const visibleContracts = useMemo(() => {
  return showAllContracts ? contracts : contracts.slice(0, 10);
}, [contracts, showAllContracts]);
  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      const text = `${item.platform} ${item.name} ${item.date} ${item.status} ${item.wearLevel}`.toLowerCase();
      return text.includes(keyword.toLowerCase());
    });
  }, [materials, keyword]);
const visibleMaterials = useMemo(() => {
  return showAllMaterials ? filteredMaterials : filteredMaterials.slice(0, 10);
}, [filteredMaterials, showAllMaterials]);
const PAST_PROFIT_DATE = "1900-01-01";

async function loadDailyExtraIncome(userId: string) {
  const { data, error } = await fetchDailyExtraIncome(userId);

  if (error) {
    console.error("读取其他收益失败", error);
    return;
  }

  const map: Record<string, number> = {};
  let baseline = 0;

  (data || []).forEach((item: any) => {
    const amount = Number(item.amount || 0);

    if (item.date === PAST_PROFIT_DATE) {
      baseline = amount;
    } else {
      map[item.date] = amount;
    }
  });

  setDailyExtraMap(map);
  setPastProfit(baseline);
}

async function loadMembership(userId: string, email?: string | null) {
  const { data, error } = await supabase
    .from("user_memberships")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!error && data) {
    return data;
  }

  const fallbackUsername = email ? email.split("@")[0] : "用户";
  const expiresAt = new Date(
    Date.now() + 8 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("user_memberships")
    .insert({
      user_id: userId,
      username: fallbackUsername,
      membership_expires_at: expiresAt,
      is_readonly: false,
    })
    .select()
    .single();

  if (insertError) {
    console.error("补建会员信息失败", insertError);
    return null;
  }

  return inserted;
}


  const inventoryRows = useMemo(() => {
const materialRows = materials.map((item) => {
  const wearLevel = item.wearLevel ?? item.wear_level;
  const wearRange = item.wearRange ?? item.wear_range;
  const customWear = item.customWear ?? item.custom_wear;
  const salePrice = item.salePrice ?? item.sale_price;

  return {
    id: `material-${item.id}`,
    date: item.date,
    platform: item.platform,
    name: item.name,
    wearLevel: wearLevel || "-",
    saleDate: item.saleDate ?? item.sale_date ?? "",
    wearRange:
      wearRange === "自定义"
        ? customWear || "自定义"
        : wearRange || "-",
    cost: Number(item.cost || 0),
    salePrice:
      salePrice === "" || salePrice === null || salePrice === undefined
        ? ""
        : Number(salePrice || 0),
    profit:
      salePrice === "" || salePrice === null || salePrice === undefined
        ? ""
        : Number(salePrice || 0) - Number(item.cost || 0),
    status: item.status,
    itemType: "material",
    rawId: item.id,
    isContract: false,
  };
});
const contractRows = contracts.map((item) => {
  const outputName = item.outputName ?? item.output_name;
  const outputWearLevel = item.outputWearLevel ?? item.output_wear_level;
  const outputWearRange = item.outputWearRange ?? item.output_wear_range;
  const outputCustomWear = item.outputCustomWear ?? item.output_custom_wear;
  const refPrice = item.refPrice ?? item.ref_price;
  const salePrice = item.salePrice ?? item.sale_price;

  return {
    id: `contract-${item.id}`,
    date: item.date,
    platform: "汰换",
    name: outputName,
    wearLevel: outputWearLevel || "-",
    saleDate: item.saleDate ?? item.sale_date ?? "",
    wearRange:
      outputWearRange === "自定义"
        ? outputCustomWear || "自定义"
        : outputWearRange || "-",
    cost: Number(refPrice || 0),
    salePrice:
      salePrice === "" || salePrice === null || salePrice === undefined
        ? ""
        : Number(salePrice || 0),
    profit:
      salePrice === "" || salePrice === null || salePrice === undefined
        ? ""
        : Number(salePrice || 0) - Number(refPrice || 0),
    status: item.status,
    itemType: "contract",
    rawId: item.id,
    isContract: true,
  };
});
  return [...materialRows, ...contractRows].sort((a, b) => {
  if (a.date !== b.date) {
    return b.date.localeCompare(a.date);
  }
  return Number(b.rawId || 0) - Number(a.rawId || 0);
});
  }, [materials, contracts]);

  const inventoryWearRangeOptions = useMemo(() => ["全部", ...new Set(inventoryRows.map((item) => item.wearRange).filter(Boolean))], [inventoryRows]);

const filteredInventory = useMemo(() => {
  return inventoryRows.filter((item) => {
    const matchDate = !inventoryFilters.date || item.date === inventoryFilters.date;
    const matchPlatform =
      inventoryFilters.platform === "全部" ||
      item.platform === inventoryFilters.platform;
    const matchName =
      !inventoryFilters.name ||
      item.name.toLowerCase().includes(inventoryFilters.name.toLowerCase());
    const matchWearLevel =
      inventoryFilters.wearLevel === "全部" ||
      item.wearLevel === inventoryFilters.wearLevel;
    const matchStatus =
      inventoryFilters.status === "全部" ||
      item.status === inventoryFilters.status;

    return (
      matchDate &&
      matchPlatform &&
      matchName &&
      matchWearLevel &&
      matchStatus
    );
  });
}, [inventoryRows, inventoryFilters]);

const stats = useMemo(() => {
  const totalExtraIncome = Object.values(dailyExtraMap).reduce(
    (sum, value) => sum + Number(value || 0),
    0
  );

  const materialProfit = materials.reduce((sum, item) => {
    const salePrice = item.salePrice ?? item.sale_price;
    if (salePrice === null || salePrice === undefined || salePrice === "") return sum;
    return sum + (Number(salePrice || 0) - Number(item.cost || 0));
  }, 0);

  const productProfit = contracts.reduce((sum, item) => {
    const salePrice = item.salePrice ?? item.sale_price;
    const refPrice = item.refPrice ?? item.ref_price;
    if (salePrice === null || salePrice === undefined || salePrice === "") return sum;
    return sum + (Number(salePrice || 0) - Number(refPrice || 0));
  }, 0);

  const furnaceIncome = contracts.reduce((sum, item) => {
    const furnaceFee = item.furnaceFee ?? item.furnace_fee;
    return sum + Number(furnaceFee || 0);
  }, 0);

  const stockRows = inventoryRows.filter((item) => item.status === "库存中");
  const stockCount = stockRows.length;
  const stockCost = stockRows.reduce((sum, item) => sum + Number(item.cost || 0), 0);

  return {
    materialProfit,
    productProfit,
    furnaceIncome,
    totalExtraIncome,
    totalProfit:
      materialProfit +
      productProfit +
      furnaceIncome +
      totalExtraIncome +
      Number(pastProfit || 0),
    stockCount,
    stockCost,
  };
}, [materials, contracts, inventoryRows, dailyExtraMap, pastProfit]);

  const currentWearRanges = wearRanges[materialForm.wearLevel] || [];
  const currentContractWearRanges = wearRanges[contractForm.outputWearLevel] || [];
  const currentPackageWearRanges = wearRanges[packageForm.outputWearLevel] || [];

  const dailyDates = useMemo(() => [...new Set([...materials.map((item) => item.date), ...contracts.map((item) => item.date)])].sort((a, b) => b.localeCompare(a)), [materials, contracts]);
const dailySummary = useMemo(
  () => getDailySummary(selectedDailyDate, materials, contracts, dailyExtraMap),
  [selectedDailyDate, materials, contracts, dailyExtraMap]
);
const remainingDays = getRemainingDays(membershipInfo?.membership_expires_at);
  const inventoryOnlyMaterials = useMemo(() => materials.filter((item) => item.status === "库存中"), [materials]);
const filteredPackageMaterials = useMemo(() => {
  return inventoryOnlyMaterials.filter((item) => {
    const matchDate = !packageFilters.date || item.date === packageFilters.date;
    const matchName =
      !packageFilters.name ||
      item.name.toLowerCase().includes(packageFilters.name.toLowerCase());
    const matchPlatform =
      packageFilters.platform === "全部" || item.platform === packageFilters.platform;

    return matchDate && matchName && matchPlatform;
  });
}, [inventoryOnlyMaterials, packageFilters]);
  const packageCost = useMemo(() => materials.filter((item) => packageForm.selectedIds.includes(item.id)).reduce((sum, item) => sum + Number(item.cost || 0), 0), [materials, packageForm.selectedIds]);

  const selectedRows = useMemo(() => filteredInventory.filter((item) => selectedIds.includes(item.id)), [filteredInventory, selectedIds]);
  const selectedSum = useMemo(() => selectedRows.reduce((sum, item) => sum + Number(item.cost || 0), 0), [selectedRows]);
  const selectedAvg = useMemo(() => selectedRows.length ? selectedSum / selectedRows.length : 0, [selectedRows, selectedSum]);

  const calendarSourceDate = selectedDailyDate || dailyDates[0] || "2026-03-01";
  const [calendarYear, calendarMonth] = calendarSourceDate.split("-").map(Number);
  const monthCells = calendarMatrix(calendarYear, calendarMonth - 1);
  const dateSummaryMap = useMemo(() => {
    const map = {};
    dailyDates.forEach((date) => {
map[date] = getDailySummary(date, materials, contracts, dailyExtraMap);
    });
    return map;
  }, [dailyDates, materials, contracts, dailyExtraMap]);

const addSingleMaterial = async () => {
if (!currentUser || !materialForm.name || !materialForm.cost) return;

  const salePrice =
    materialForm.salePrice === "" ? null : Number(materialForm.salePrice);

  const payload = {
  date: materialForm.date,
  platform: materialForm.platform,
  name: materialForm.name,
  wear_level: materialForm.wearLevel,
  wear_range: materialForm.wearRange,
  custom_wear: materialForm.customWear || null,
  cost: Number(materialForm.cost),
  sale_price: salePrice,
  status: salePrice === null ? "库存中" : "已售出",
  mode: "single",
  user_id: currentUser.id,
};

  const { error } = await insertMaterial(payload);

if (error) {
  console.error("保存材料失败", error);
  showToast(`保存材料失败：${error.message}`, "error");
  return;
}

const { data, error: reloadError } = await fetchMaterials(currentUser.id);

  if (reloadError) {
    console.error("刷新材料失败", reloadError);
  } else {
    setMaterials(data || []);
    showToast("保存成功");
  }

  setMaterialForm((prev) => ({
    ...prev,
    name: "",
    customWear: "",
    cost: "",
    salePrice: "",
  }));
};

  const addBatchPriceField = () => setBatchPrices((prev) => [...prev, ""]);
  const updateBatchPrice = (index, value) => setBatchPrices((prev) => prev.map((item, i) => (i === index ? value : item)));

const addBatchMaterials = async () => {
  if (isReadonlyMode) {
  showToast("会员已过期，当前为只读模式", "error");
  return;
}
  console.log("addBatchMaterials clicked");

  if (!currentUser) {
    console.log("no currentUser");
    showToast("当前用户不存在，请重新登录", "error");
    return;
  }

  if (!materialForm.name.trim()) {
    console.log("material name empty");
    showToast("材料名称不能为空", "error");
    return;
  }

  const prices = batchPrices
    .map((v) => String(v).trim())
    .filter(Boolean)
    .map(Number)
    .filter((v) => !Number.isNaN(v));

  console.log("parsed prices:", prices);

  if (!prices.length) {
    showToast("请至少填写一个有效进价", "error");
    return;
  }

  const payloads = prices.map((price) => ({
    date: materialForm.date,
    platform: materialForm.platform,
    name: materialForm.name,
    wear_level: materialForm.wearLevel,
    wear_range: materialForm.wearRange,
    custom_wear: materialForm.customWear || null,
    cost: Number(price),
    sale_price: null,
    status: "库存中",
    mode: "batch",
    user_id: currentUser.id,
  }));

  console.log("payloads to insert:", payloads);

  const { error } = await supabase.from("materials").insert(payloads);

  if (error) {
    console.error("批量保存材料失败", error);
    showToast(`批量保存材料失败：${error.message}`, "error");
    return;
  }

  console.log("insert success");

  const { data, error: reloadError } = await fetchMaterials(currentUser.id);

  if (reloadError) {
    console.error("刷新材料失败", reloadError);
    showToast(`刷新材料失败：${reloadError.message}`, "error");
    return;
  }

  console.log("reload success", data);

  setMaterials(data || []);
  showToast(`批量添加成功，共 ${payloads.length} 条`);

  setBatchPrices([""]);
setMaterialForm((prev) => ({
    date: prev.date,
    platform: "BUFF",
    name: "",
    wearLevel: "久经沙场",
    wearRange: "0.15 - 0.18",
    customWear: "",
    cost: "",
    salePrice: "",
  }));

  console.log("form reset done");
};

  const syncContractResult = (nextResult) => {
    setContractForm((prev) => ({ ...prev, result: nextResult, furnaceRatePercent: nextResult === "成功" ? prev.furnaceRatePercent || "10" : "0" }));
  };

const addContract = async () => {
  if (isReadonlyMode) {
  showToast("会员已过期，当前为只读模式", "error");
  return;
}
  if (!currentUser || !contractForm.outputName || !contractForm.refPrice) return;

  const refPrice = Number(contractForm.refPrice || 0);
  const furnaceFee = computeFurnaceFee(
    refPrice,
    contractForm.result,
    contractForm.furnaceRatePercent
  );
  const salePrice =
    contractForm.salePrice === "" ? null : Number(contractForm.salePrice);

  const payload = {
    date: contractForm.date,
    type: "普通汰换",
    contract_name: contractForm.contractName,
    output_name: contractForm.outputName,
    output_wear_level: contractForm.outputWearLevel,
    output_wear_range: contractForm.outputWearRange,
    output_custom_wear: contractForm.outputCustomWear || null,
    ref_price: refPrice,
    result: contractForm.result,
    furnace_rate:
      contractForm.result === "成功"
        ? Number(contractForm.furnaceRatePercent || 10) / 100
        : 0,
    furnace_fee: furnaceFee,
    sale_price: salePrice,
    status: salePrice === null ? "库存中" : "已售出",
    user_id: currentUser.id,
  };

  const { error } = await insertContract(payload);

  if (error) {
    console.error("保存汰换记录失败", error);
    showToast(`保存汰换记录失败：${error.message}`, "error");
    return;
  }

  const { data, error: reloadError } = await fetchContracts(currentUser.id);

  if (reloadError) {
    console.error("刷新汰换记录失败", reloadError);
  } else {
    setContracts(data || []);
    showToast("汰换记录保存成功");
  }

  setContractForm((prev) => ({
    ...prev,
    contractName: "",
    outputName: "",
    outputWearLevel: "久经沙场",
    outputWearRange: "0.15 - 0.18",
    outputCustomWear: "",
    refPrice: "",
    result: "成功",
    furnaceRatePercent: "10",
    salePrice: "",
  }));
};

  const togglePackageMaterial = (id) => {
    setPackageForm((prev) => {
      const exists = prev.selectedIds.includes(id);
      if (exists) return { ...prev, selectedIds: prev.selectedIds.filter((x) => x !== id) };
      if (prev.selectedIds.length >= 10) return prev;
      return { ...prev, selectedIds: [...prev.selectedIds, id] };
    });
  };

  const addPackageContract = () => {
    if (isReadonlyMode) {
  showToast("会员已过期，当前为只读模式", "error");
  return;
}
    const validCount = packageForm.selectedIds.length === 5 || packageForm.selectedIds.length === 10;
    if (!validCount || !packageForm.outputName) return;
    const salePrice = packageForm.salePrice ? Number(packageForm.salePrice) : "";
setMaterials((prev) =>
  prev.map((item) =>
    packageForm.selectedIds.includes(item.id)
      ? {
          ...item,
          status: "已售出",
          salePrice: Number(item.cost || 0),
          sale_price: Number(item.cost || 0),
          saleDate: new Date().toISOString().slice(0, 10),
          sale_date: new Date().toISOString().slice(0, 10),
        }
      : item
  )
);
    setContracts((prev) => [{ id: Date.now(), date: packageForm.date, contractName: packageForm.contractName || "包炉记录", outputName: packageForm.outputName, outputWearLevel: packageForm.outputWearLevel, outputWearRange: packageForm.outputWearRange, outputCustomWear: packageForm.outputCustomWear, refPrice: Number(packageCost.toFixed(2)), result: packageForm.result, furnaceRate: 0, furnaceFee: 0, salePrice, status: salePrice ? "已售出" : "库存中", type: "包炉" }, ...prev]);
    setPackageForm((prev) => ({ ...prev, contractName: "", outputName: "", outputWearLevel: "久经沙场", outputWearRange: "0.15 - 0.18", outputCustomWear: "", result: "成功", salePrice: "", selectedIds: [] }));
  };

function updateInventoryField(item: any, field: string, value: any) {
  const rowKey = item.id;
  const rawId = item.rawId ?? item.id;

  const patch: any = {
    [field]: value,
  };

  if (field === "salePrice") {
    const hasSalePrice =
      value !== "" && value !== null && value !== undefined && !Number.isNaN(Number(value));

    if (hasSalePrice) {
      patch.salePrice = value;
      patch.sale_price = Number(value);
      patch.status = "已售出";

      const currentSaleDate = item.saleDate ?? item.sale_date;
      const currentEditedSaleDate = inventoryEdits[rowKey]?.saleDate;

      if (!currentSaleDate && !currentEditedSaleDate) {
        patch.saleDate = new Date().toISOString().slice(0, 10);
        patch.sale_date = patch.saleDate;
      }
    } else {
      patch.salePrice = "";
      patch.sale_price = null;
      patch.status = "库存中";
      patch.saleDate = "";
      patch.sale_date = null;
    }
  }

  if (field === "saleDate") {
    patch.saleDate = value;
    patch.sale_date = value || null;
  }

  if (field === "wearLevel") {
    patch.wearLevel = value;
    patch.wear_level = value;
  }

  if (field === "wearRange") {
    patch.wearRange = value;
    patch.wear_range = value;
  }

  if (field === "customWear") {
    patch.customWear = value;
    patch.custom_wear = value;
  }

  const applyPatch = (row: any) => {
    if (row.id !== rawId) return row;

    const next = { ...row, ...patch };

    const salePrice = next.salePrice ?? next.sale_price;
    const cost = next.cost ?? 0;

    next.profit =
      salePrice === "" || salePrice === null || salePrice === undefined
        ? ""
        : Number(salePrice) - Number(cost || 0);

    return next;
  };

  if (item.isContract) {
    setContracts((prev: any[]) => prev.map(applyPatch));
  } else {
    setMaterials((prev: any[]) => prev.map(applyPatch));
  }

  setInventoryEdits((prev) => ({
    ...prev,
    [rowKey]: {
      ...(prev[rowKey] || {}),
      rawId,
      isContract: item.isContract,
      ...patch,
    },
  }));
}


async function saveInventoryEdits() {
  if (isReadonlyMode) {
  showToast("会员已过期，当前为只读模式", "error");
  return;
}
  console.log("saveInventoryEdits 开始执行");

  try {
    const entries = Object.entries(inventoryEdits || {});
    console.log("本次只保存改动行数:", entries.length);

    if (!entries.length) {
      showToast("没有需要保存的改动");
      setEditMode(false);
      setSelectedIds([]);
      return;
    }

    for (const [rowKey, patch] of entries) {
      const rawId = patch.rawId;
      const isContract = patch.isContract;

      const salePrice =
        patch.salePrice === "" || patch.salePrice === null || patch.salePrice === undefined
          ? null
          : Number(patch.salePrice);

      const saleDate =
        patch.saleDate === "" || patch.saleDate === null || patch.saleDate === undefined
          ? null
          : patch.saleDate;

      const status =
        patch.status ?? (salePrice === null ? "库存中" : "已售出");

      if (isContract) {
        const { error } = await updateContractById(rawId, {
          ...(patch.name !== undefined ? { output_name: patch.name } : {}),
          ...(patch.wearLevel !== undefined ? { output_wear_level: patch.wearLevel } : {}),
          ...(patch.wearRange !== undefined ? { output_wear_range: patch.wearRange } : {}),
          ...(patch.salePrice !== undefined ? { sale_price: salePrice } : {}),
          ...(patch.status !== undefined || patch.salePrice !== undefined ? { status } : {}),
          ...(patch.saleDate !== undefined || patch.salePrice !== undefined ? { sale_date: saleDate } : {}),
        });

        if (error) {
          console.error("更新汰换产物失败", error, rowKey, patch);
          showToast(`更新汰换产物失败：${error.message}`, "error");
          return;
        }
      } else {
        const { error } = await updateMaterialById(rawId, {
          ...(patch.platform !== undefined ? { platform: patch.platform } : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.wearLevel !== undefined ? { wear_level: patch.wearLevel } : {}),
          ...(patch.wearRange !== undefined ? { wear_range: patch.wearRange } : {}),
          ...(patch.salePrice !== undefined ? { sale_price: salePrice } : {}),
          ...(patch.status !== undefined || patch.salePrice !== undefined ? { status } : {}),
          ...(patch.saleDate !== undefined || patch.salePrice !== undefined ? { sale_date: saleDate } : {}),
        });

        if (error) {
          console.error("更新材料失败", error, rowKey, patch);
          showToast(`更新材料失败：${error.message}`, "error");
          return;
        }
      }
    }

    if (currentUser?.id) {
      const { data: materialData, error: materialReloadError } =
        await fetchMaterials(currentUser.id);

      if (materialReloadError) {
        console.error("刷新材料失败", materialReloadError);
        showToast(`刷新材料失败：${materialReloadError.message}`, "error");
        return;
      }

      const { data: contractData, error: contractReloadError } =
        await fetchContracts(currentUser.id);

      if (contractReloadError) {
        console.error("刷新汰换记录失败", contractReloadError);
        showToast(`刷新汰换记录失败：${contractReloadError.message}`, "error");
        return;
      }

      setMaterials(materialData || []);
      setContracts(contractData || []);
    }

    setInventoryEdits({});
    setEditMode(false);
    setSelectedIds([]);
    showToast("库存编辑已保存");
    console.log("saveInventoryEdits 执行完成");
  } catch (err) {
    console.error("saveInventoryEdits 崩了", err);
    showToast("保存库存编辑时发生异常", "error");
  }
}

  const toggleStatsVisibility = (key) => setVisibleStatMap((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleSelectRow = (id, checked) => {
    setSelectedIds((prev) => checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id));
  };

  const selectAllVisible = () => setSelectedIds(filteredInventory.map((item) => item.id));
  const clearSelected = () => setSelectedIds([]);

const deleteSelected = async () => {
  if (isReadonlyMode) {
  showToast("会员已过期，当前为只读模式", "error");
  return;
}
  if (!selectedIds.length) return;
  if (!window.confirm("删除不可再恢复，是否确认删除？")) return;

  const materialIds = selectedIds
    .filter((id) => id.startsWith("material-"))
    .map((id) => Number(id.replace("material-", "")));

  const contractIds = selectedIds
    .filter((id) => id.startsWith("contract-"))
    .map((id) => Number(id.replace("contract-", "")));

  if (materialIds.length) {
    const { error } = await deleteMaterialsByIds(materialIds);
    if (error) {
      console.error("删除材料失败", error);
      showToast(`删除材料失败：${error.message}`, "error");
      return;
    }
  }

  if (contractIds.length) {
    const { error } = await deleteContractsByIds(contractIds);
    if (error) {
      console.error("删除汰换记录失败", error);
      showToast(`删除汰换记录失败：${error.message}`, "error");
      return;
    }
  }

  if (currentUser?.id) {
    const { data: materialData, error: materialReloadError } =
      await fetchMaterials(currentUser.id);

    if (materialReloadError) {
      console.error("刷新材料失败", materialReloadError);
    } else {
      setMaterials(materialData || []);
    }

    const { data: contractData, error: contractReloadError } =
      await fetchContracts(currentUser.id);

    if (contractReloadError) {
      console.error("刷新汰换记录失败", contractReloadError);
    } else {
      setContracts(contractData || []);
    }
  }

  setSelectedIds([]);
  showToast("删除成功");
};

  const addInventoryItem = () => {
    setMaterials((prev) => [{ id: Date.now(), date: selectedDailyDate || "2026-03-10", platform: "BUFF", name: "", wearLevel: "久经沙场", wearRange: "0.15 - 0.18", customWear: "", cost: 0, salePrice: "", status: "库存中", mode: "single" }, ...prev]);
  };

  const detailItems = detailPanel === "material" ? dailySummary.materialDetails : detailPanel === "product" ? dailySummary.productDetails : dailySummary.furnaceDetails;
  const detailTitle = detailPanel === "material" ? "材料总毛利明细" : detailPanel === "product" ? "产物出售利润明细" : "开炉费收入明细";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {toast.show && (
  <div
    style={{
      position: "fixed",
      top: 20,
      right: 20,
      zIndex: 9999,
      padding: "12px 16px",
      borderRadius: 14,
      color: "#fff",
      fontSize: 14,
      fontWeight: 700,
      background:
        toast.type === "success" ? "rgba(15, 23, 42, 0.92)" : "rgba(185, 28, 28, 0.92)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
      transition: "all 0.3s ease",
    }}
  >
    {toast.message}
  </div>
)}
      <div className="mx-auto max-w-7xl space-y-6">

{isReadonlyMode && (
  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
    当前会员已过期，系统已进入只读模式。你仍可查看数据，但无法新增或编辑。购买激活码请联系作者：QQ 2647060757。
  </div>
)}

{showUserPanel && (
  <Card className="rounded-3xl border-0 shadow-sm">
    <CardHeader className="pb-4">
      <CardTitle>用户中心</CardTitle>
    </CardHeader>

    <CardContent className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-[220px_180px_minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-2xl bg-slate-50 px-4 py-3">
  <div className="text-xs text-slate-500">用户名</div>
  <div
    className="mt-2 truncate text-2xl font-bold text-slate-900"
    title={membershipInfo?.username || currentUser?.email?.split("@")[0] || "-"}
  >
    {membershipInfo?.username || currentUser?.email?.split("@")[0] || "-"}
  </div>
</div>

        <div className="rounded-2xl bg-slate-50 px-4 py-3">
          <div className="text-xs text-slate-500">会员剩余</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {remainingDays > 0 ? `${remainingDays} 天` : "已过期"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="mb-3 text-sm font-semibold text-slate-900">修改密码</div>

          <div className="grid gap-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
            <Input
              type="password"
              placeholder="原密码"
              value={currentPassword ?? ""}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-10 rounded-xl"
            />

            <Input
              type="password"
              placeholder="新密码"
              value={newPassword ?? ""}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 rounded-xl"
            />

            <Input
              type="password"
              placeholder="确认新密码"
              value={confirmNewPassword ?? ""}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="h-10 rounded-xl"
            />

            <Button
              onClick={handleChangePassword}
              className="h-10 rounded-xl px-4"
            >
              修改密码
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="mb-3 text-sm font-semibold text-slate-900">激活会员</div>

          <div className="grid gap-2 xl:grid-cols-[1fr_auto]">
            <Input
              placeholder="输入激活码"
              value={activationCodeInput ?? ""}
              onChange={(e) => setActivationCodeInput(e.target.value)}
              className="h-10 rounded-xl"
            />

            <Button
              onClick={redeemActivationCode}
              className="h-10 rounded-xl px-4"
            >
              使用激活码
            </Button>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
)}


        <div className="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
  <div>
    <h1 className="text-3xl font-bold tracking-tight text-slate-900">CS2炼金记账v1.3</h1>
    <div className="mt-2 text-sm text-slate-500">
      当前用户：{currentUser?.email ? currentUser.email.split("@")[0] : "未登录"}
    </div>
  </div>

  <div className="flex items-center gap-3">
 <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
  <div className="flex items-center gap-2">
    <span>总收益</span>
    <button
      type="button"
      className="rounded-full"
      onClick={() => toggleStatsVisibility("totalProfit")}
    >
      {visibleStatMap.totalProfit ? (
        <EyeOff className="h-4 w-4 text-slate-500" />
      ) : (
        <Eye className="h-4 w-4 text-slate-500" />
      )}
    </button>
  </div>
  <span className="ml-2 text-lg font-semibold text-slate-900">
    {visibleStatMap.totalProfit ? money(stats.totalProfit) : "••••"}
  </span>
</div>
<button
  type="button"
  onClick={() => setShowUserPanel((prev) => !prev)}
  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
    showUserPanel
      ? "bg-slate-900 text-white"
      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
  }`}
>
  {showUserPanel ? "收起用户中心" : "用户中心"}
</button>
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
    >
      退出登录
    </button>
  </div>
</div>

   <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <StatCard title="材料毛利" value={money(stats.materialProfit)} hidden={!visibleStatMap.materialProfit} icon={<Wallet className="h-8 w-8 text-slate-400" />} onToggle={() => toggleStatsVisibility("materialProfit")} />
          <StatCard title="产物出售利润" value={money(stats.productProfit)} hidden={!visibleStatMap.productProfit} icon={<TrendingUp className="h-8 w-8 text-slate-400" />} onToggle={() => toggleStatsVisibility("productProfit")} />
          <StatCard title="开炉费" value={money(stats.furnaceIncome)} hidden={!visibleStatMap.furnaceIncome} icon={<Layers3 className="h-8 w-8 text-slate-400" />} onToggle={() => toggleStatsVisibility("furnaceIncome")} />
          <StatCard title="库存数量" value={String(stats.stockCount)} hidden={!visibleStatMap.stockCount} icon={<Boxes className="h-8 w-8 text-slate-400" />} onToggle={() => toggleStatsVisibility("stockCount")} />
          <StatCard title="库存成本" value={money(stats.stockCost)} hidden={!visibleStatMap.stockCost} icon={<PackageCheck className="h-8 w-8 text-slate-400" />} onToggle={() => toggleStatsVisibility("stockCost")} />
         <StatCard title="其他" value={money(stats.totalExtraIncome)} hidden={!visibleStatMap.extraIncome} icon={<Wallet className="h-8 w-8 text-slate-400" />} onToggle={() => toggleStatsVisibility("extraIncome")}
/>
       </div>

        <Tabs defaultValue="materials" className="space-y-6" onValueChange={() => { setEditMode(false); setSelectedIds([]); }}>
          <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-white p-1 shadow-sm">
 <TabsTrigger value="materials" className="rounded-xl">材料登记</TabsTrigger>
<TabsTrigger value="inventory" className="rounded-xl">库存管理</TabsTrigger>
<TabsTrigger value="exchange" className="rounded-xl">汰换记录</TabsTrigger>
<TabsTrigger value="daily" className="rounded-xl">每日收益</TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>新增材料</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  <FieldDate label="日期" value={materialForm.date} onChange={(value) => setMaterialForm({ ...materialForm, date: value })} />
                  <SelectField label="平台" value={materialForm.platform} options={platformOptions} onChange={(value) => setMaterialForm({ ...materialForm, platform: value })} />
                  <div className="space-y-2">
                    <Label>材料名称</Label>
                    <Input placeholder="例如：AK-47 | 红线" value={materialForm.name} onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })} />
                    <SuggestionList items={materialNameSuggestions} onPick={(name) => setMaterialForm({ ...materialForm, name })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="磨损等级" value={materialForm.wearLevel} options={wearLevelOptions} onChange={(value) => setMaterialForm({ ...materialForm, wearLevel: value, wearRange: wearRanges[value][0], customWear: "" })} />
                    <SelectField label="磨损区间" value={materialForm.wearRange} options={currentWearRanges} onChange={(value) => setMaterialForm({ ...materialForm, wearRange: value, customWear: value === "自定义" ? materialForm.customWear : "" })} />
                  </div>
                  {materialForm.wearRange === "自定义" && <TextField label="自定义磨损 / 区间" placeholder="例如：0.163 或 0.15 - 0.17" value={materialForm.customWear} onChange={(value) => setMaterialForm({ ...materialForm, customWear: value })} />}
                  
                    <>
                      <div className="space-y-2">
                        <Label>批量进价</Label>
                        <div className="space-y-2">
                          {batchPrices.map((price, index) => (
                            <Input
  key={index}
  ref={(el) => {
    batchInputRefs.current[index] = el;
  }}
  type="number"
  placeholder={`第 ${index + 1} 个进价`}
  value={price}
  onChange={(e) => {
    updateBatchPrice(index, e.target.value);
    if (index === batchPrices.length - 1 && e.target.value.trim() !== "") {
      addBatchPriceField();
    }
  }}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      if (index === batchPrices.length - 1) {
        addBatchPriceField();
        setTimeout(() => {
          batchInputRefs.current[index + 1]?.focus();
        }, 0);
      } else {
        batchInputRefs.current[index + 1]?.focus();
      }
    }
  }}
/>
                          ))}
                        </div>
                      </div>
                      <Button onClick={addBatchMaterials} className="w-full rounded-2xl"><Plus className="mr-2 h-4 w-4" />完成添加</Button>
                    </>
                  
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>材料记录</CardTitle>
                  <div className="flex w-full max-w-xl items-center gap-3">
  <div className="relative flex-1">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <Input
      className="pl-9"
      placeholder="搜索材料 / 平台 / 状态"
      value={keyword}
      onChange={(e) => setKeyword(e.target.value)}
    />
  </div>

  {filteredMaterials.length > 10 && (
    <button
      type="button"
      onClick={() => setShowAllMaterials((prev) => !prev)}
      className="shrink-0 rounded-xl border px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      {showAllMaterials ? "收起 ↑" : "查看全部 ↓"}
    </button>
  )}
</div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead>平台</TableHead>
                        <TableHead>材料</TableHead>
                        <TableHead>磨损等级</TableHead>
                        <TableHead>磨损区间</TableHead>
                        <TableHead>进价</TableHead>
                        <TableHead>售价</TableHead>
                        <TableHead>毛利</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleMaterials.map((item) => {
  const wearLevel = item.wearLevel ?? item.wear_level;
  const wearRange = item.wearRange ?? item.wear_range;
  const customWear = item.customWear ?? item.custom_wear;
  const salePrice = item.salePrice ?? item.sale_price;
  const profit = salePrice ? Number(salePrice) - Number(item.cost) : 0;

  return (
    <TableRow key={item.id}>
      <TableCell>{item.date}</TableCell>
      <TableCell>{item.platform}</TableCell>
      <TableCell>
        <div className="font-medium">{item.name}</div>
        <div className="text-xs text-slate-500">
          {item.mode === "batch" ? "批量新增" : "单条新增"}
        </div>
      </TableCell>
      <TableCell>{wearLevel}</TableCell>
      <TableCell>{wearRange === "自定义" ? customWear || "自定义" : wearRange}</TableCell>
      <TableCell>{money(item.cost)}</TableCell>
      <TableCell>{salePrice ? money(salePrice) : "-"}</TableCell>
      <TableCell>{money(profit)}</TableCell>
      <TableCell>
        <Badge variant="secondary" className="rounded-full">
          {item.status}
        </Badge>
      </TableCell>
    </TableRow>
  );
})}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
                    

                    <TabsContent value="inventory">
  <Card className="rounded-3xl border-0 shadow-sm">
<CardHeader className="pb-4">
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <CardTitle className="text-[28px] font-bold tracking-tight text-slate-900">
        库存管理
      </CardTitle>
    </div>

    <div className="flex flex-wrap gap-2">
      {!editMode && (
        <Button
  type="button"
  variant="outline"
  className="rounded-2xl"
  onClick={() => {
    if (isReadonlyMode) {
      showToast("会员已过期，当前为只读模式", "error");
      return;
    }

    setEditMode(true);
    setSelectedIds([]);
    setInventoryEdits({});
  }}
>
  <Pencil className="mr-2 h-4 w-4" />
  编辑总开关
</Button>
      )}

      {editMode && (
        <>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-slate-200 px-4"
            onClick={selectAllVisible}
          >
            全选
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-slate-200 px-4"
            onClick={clearSelected}
          >
            全不选
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="h-10 rounded-xl px-4"
            onClick={deleteSelected}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </Button>

          <Button
            type="button"
            variant="default"
            className="h-10 rounded-xl px-4"
            onClick={async () => {
              await saveInventoryEdits();
            }}
          >
            完成编辑
          </Button>
        </>
      )}
    </div>
  </div>
</CardHeader>

    <CardContent className="space-y-4">
<div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-slate-500">日期</Label>
    <Input
      type="date"
      value={inventoryFilters.date ?? ""}
      onChange={(e) =>
        setInventoryFilters({ ...inventoryFilters, date: e.target.value })
      }
      className="h-10 rounded-xl border-slate-200 bg-white text-sm"
    />
  </div>

  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-slate-500">名称</Label>
    <Input
      placeholder="搜索名称关键词"
      value={inventoryFilters.name ?? ""}
      onChange={(e) =>
        setInventoryFilters({ ...inventoryFilters, name: e.target.value })
      }
      className="h-10 rounded-xl border-slate-200 bg-white text-sm"
    />
  </div>

  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-slate-500">平台</Label>
    <Select
      value={inventoryFilters.platform}
      onValueChange={(value) =>
        setInventoryFilters({ ...inventoryFilters, platform: value })
      }
    >
      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {["全部", ...inventoryPlatformOptions].map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-slate-500">磨损等级</Label>
    <Select
      value={inventoryFilters.wearLevel}
      onValueChange={(value) =>
        setInventoryFilters({ ...inventoryFilters, wearLevel: value })
      }
    >
      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {["全部", ...wearLevelOptions].map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-slate-500">库存状态</Label>
    <Select
      value={inventoryFilters.status}
      onValueChange={(value) =>
        setInventoryFilters({ ...inventoryFilters, status: value })
      }
    >
      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {["全部", "库存中", "已售出"].map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</div>
</div>

      {editMode && (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          已选 {selectedRows.length} 项 ｜ 求和 {money(selectedSum)} ｜ 平均{" "}
          {money(selectedAvg)}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            {editMode && <TableHead className="w-12">选择</TableHead>}
            <TableHead>日期</TableHead>
            <TableHead>平台</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>磨损等级</TableHead>
            <TableHead>磨损区间</TableHead>
            <TableHead>参考价/成本</TableHead>
            <TableHead>售价</TableHead>
            <TableHead>库存状态</TableHead>
            <TableHead>出售日期</TableHead>
            <TableHead>利润</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {filteredInventory.map((item) => (
            <TableRow key={item.id}>
              {editMode && (
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(e) =>
                      toggleSelectRow(item.id, e.target.checked)
                    }
                  />
                </TableCell>
              )}

              <TableCell>
                {formatInventoryDate(item.date, Boolean(inventoryFilters.date))}
              </TableCell>

              <TableCell>
                {editMode && !item.isContract ? (
                  <Select
                    value={item.platform}
                    onValueChange={(value) =>
                      updateInventoryField(item, "platform", value)
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {platformOptions.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  item.platform
                )}
              </TableCell>

              <TableCell>
                {editMode ? (
                  <Input
                    value={item.name}
                    onChange={(e) =>
                      updateInventoryField(item, "name", e.target.value)
                    }
                  />
                ) : (
                  item.name
                )}
              </TableCell>

              <TableCell>
                {editMode ? (
                  <Select
                    value={item.wearLevel}
                    onValueChange={(value) =>
                      updateInventoryField(item, "wearLevel", value)
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {wearLevelOptions.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  item.wearLevel
                )}
              </TableCell>

              <TableCell>
                {editMode ? (
                  <Select
                    value={item.wearRange}
                    onValueChange={(value) =>
                      updateInventoryField(item, "wearRange", value)
                    }
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(wearRanges[item.wearLevel] || [item.wearRange]).map(
                        (range) => (
                          <SelectItem key={range} value={range}>
                            {range}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  item.wearRange
                )}
              </TableCell>

              <TableCell>{money(item.cost)}</TableCell>

              <TableCell>
                {editMode ? (
                  <Input
                    type="number"
                    value={item.salePrice ?? item.sale_price ?? ""}
                    onChange={(e) =>
                      updateInventoryField(item, "salePrice", e.target.value)
                    }
                  />
                ) : item.salePrice === "" ||
                  item.salePrice === null ||
                  item.salePrice === undefined ? (
                  "-"
                ) : (
                  money(item.salePrice)
                )}
              </TableCell>

              <TableCell>
  <Badge
    className={
      item.status === "库存中"
        ? "rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100"
        : "rounded-full bg-slate-900 text-white hover:bg-slate-900"
    }
  >
    {item.status}
  </Badge>
</TableCell>

              <TableCell>
                {editMode ? (
                  <Input
                    type="date"
                    value={item.saleDate ?? item.sale_date ?? ""}
                    onChange={(e) =>
                      updateInventoryField(item, "saleDate", e.target.value)
                    }
                  />
                ) : (
                  item.saleDate ?? item.sale_date ?? "-"
                )}
              </TableCell>

              <TableCell>
                {item.profit === "" || item.profit === null || item.profit === undefined
                  ? "-"
                  : money(item.profit)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</TabsContent>

          <TabsContent value="exchange" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
  <CardTitle>汰换记录</CardTitle>

  {contracts.length > 10 && (
    <button
      type="button"
      onClick={() => setShowAllContracts((prev) => !prev)}
      className="rounded-xl border px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      {showAllContracts ? "收起 ↑" : "查看全部 ↓"}
    </button>
  )}
</CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                    <Button type="button" variant={exchangeMode === "普通汰换" ? "default" : "ghost"} className="rounded-xl" onClick={() => setExchangeMode("普通汰换")}>ECO合炉</Button>
                    <Button type="button" variant={exchangeMode === "包炉" ? "default" : "ghost"} className="rounded-xl" onClick={() => setExchangeMode("包炉")}>包炉</Button>
                  </div>
                  {exchangeMode === "普通汰换" ? (
                    <>
                      <FieldDate label="日期" value={contractForm.date} onChange={(value) => setContractForm({ ...contractForm, date: value })} />
                      <div className="space-y-2">
                        <Label>汰换合同名称</Label>
                        <Input placeholder="例如：FN 红线合同" value={contractForm.contractName} onChange={(e) => setContractForm({ ...contractForm, contractName: e.target.value })} />
                        <SuggestionList items={contractNameSuggestions} onPick={(name) => setContractForm({ ...contractForm, contractName: name })} />
                      </div>
                      <div className="space-y-2">
                        <Label>产物名称</Label>
                        <Input placeholder="例如：AK-47 | 火蛇" value={contractForm.outputName} onChange={(e) => setContractForm({ ...contractForm, outputName: e.target.value })} />
                        <SuggestionList items={outputNameSuggestions} onPick={(name) => setContractForm({ ...contractForm, outputName: name })} />
                      </div>
                      <NumberField label="产物参考价" placeholder="520" value={contractForm.refPrice} onChange={(value) => setContractForm({ ...contractForm, refPrice: value })} />
                      <div className="grid grid-cols-2 gap-3">
                        <SelectField label="汰换结果" value={contractForm.result} options={["成功", "失败"]} onChange={syncContractResult} />
                        <NumberField label="开炉费比例" value={contractForm.result === "失败" ? "0" : contractForm.furnaceRatePercent} onChange={(value) => setContractForm({ ...contractForm, furnaceRatePercent: value })} disabled={contractForm.result === "失败"} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <SelectField label="产物磨损等级" value={contractForm.outputWearLevel} options={wearLevelOptions} onChange={(value) => setContractForm({ ...contractForm, outputWearLevel: value, outputWearRange: wearRanges[value][0], outputCustomWear: "" })} />
                        <SelectField label="产物磨损区间" value={contractForm.outputWearRange} options={currentContractWearRanges} onChange={(value) => setContractForm({ ...contractForm, outputWearRange: value, outputCustomWear: value === "自定义" ? contractForm.outputCustomWear : "" })} />
                      </div>
                      {contractForm.outputWearRange === "自定义" && <TextField label="自定义产物磨损 / 区间" placeholder="例如：0.163 或 0.15 - 0.17" value={contractForm.outputCustomWear} onChange={(value) => setContractForm({ ...contractForm, outputCustomWear: value })} />}
                      <InfoBox label="开炉费收入" value={money(computeFurnaceFee(Number(contractForm.refPrice || 0), contractForm.result, contractForm.furnaceRatePercent))} note="开炉费单独统计，不参与汰换利润计算。" />
                      <NumberField label="产物售价（可后补）" placeholder="548" value={contractForm.salePrice} onChange={(value) => setContractForm({ ...contractForm, salePrice: value })} />
                      <InfoBox label="汰换利润" value={money(Number(contractForm.salePrice || 0) - Number(contractForm.refPrice || 0))} />
                      <Button onClick={addContract} className="w-full rounded-2xl">保存汰换记录</Button>
                    </>
                  ) : (
                    <>
                      <FieldDate label="日期" value={packageForm.date} onChange={(value) => setPackageForm({ ...packageForm, date: value })} />
                      <div className="space-y-2">
                        <Label>包炉名称</Label>
                        <Input placeholder="例如：P250 包炉" value={packageForm.contractName} onChange={(e) => setPackageForm({ ...packageForm, contractName: e.target.value })} />
                        <SuggestionList items={packageContractNameSuggestions} onPick={(name) => setPackageForm({ ...packageForm, contractName: name })} />
                      </div>
                      <div className="space-y-2">
                        <Label>产物名称</Label>
                        <Input placeholder="例如：AK-47 | 火蛇" value={packageForm.outputName} onChange={(e) => setPackageForm({ ...packageForm, outputName: e.target.value })} />
                        <SuggestionList items={packageOutputNameSuggestions} onPick={(name) => setPackageForm({ ...packageForm, outputName: name })} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <SelectField label="包炉结果" value={packageForm.result} options={["成功", "失败"]} onChange={(value) => setPackageForm({ ...packageForm, result: value })} />
                        <div className="space-y-2">
                          <Label>参考价（自动汇总）</Label>
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{money(packageCost)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <SelectField label="产物磨损等级" value={packageForm.outputWearLevel} options={wearLevelOptions} onChange={(value) => setPackageForm({ ...packageForm, outputWearLevel: value, outputWearRange: wearRanges[value][0], outputCustomWear: "" })} />
                        <SelectField label="产物磨损区间" value={packageForm.outputWearRange} options={currentPackageWearRanges} onChange={(value) => setPackageForm({ ...packageForm, outputWearRange: value, outputCustomWear: value === "自定义" ? packageForm.outputCustomWear : "" })} />
                      </div>
                      {packageForm.outputWearRange === "自定义" && <TextField label="自定义产物磨损 / 区间" placeholder="例如：0.163 或 0.15 - 0.17" value={packageForm.outputCustomWear} onChange={(value) => setPackageForm({ ...packageForm, outputCustomWear: value })} />}
                      <div className="space-y-3 rounded-2xl border p-4">
                        <div className="text-sm font-medium text-slate-700">包炉选材</div>
                        <div className="grid gap-2 md:grid-cols-3">
  <div className="space-y-1">
    <Label className="text-xs text-slate-500">日期筛选</Label>
    <Input
      type="date"
      value={packageFilters.date}
      onChange={(e) =>
        setPackageFilters({ ...packageFilters, date: e.target.value })
      }
      className="h-9 rounded-xl"
    />
  </div>

  <div className="space-y-1">
    <Label className="text-xs text-slate-500">名称筛选</Label>
    <Input
      placeholder="输入名称关键词"
      value={packageFilters.name}
      onChange={(e) =>
        setPackageFilters({ ...packageFilters, name: e.target.value })
      }
      className="h-9 rounded-xl"
    />
  </div>

  <div className="space-y-1">
    <Label className="text-xs text-slate-500">平台筛选</Label>
    <Select
      value={packageFilters.platform}
      onValueChange={(value) =>
        setPackageFilters({ ...packageFilters, platform: value })
      }
    >
      <SelectTrigger className="h-9 rounded-xl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {["全部", ...platformOptions].map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">已选 {packageForm.selectedIds.length} 个材料，只允许 5 个或 10 个。</div>
                        <div className="max-h-64 space-y-2 overflow-auto rounded-2xl border p-3">
                          {filteredPackageMaterials.map((item) => {
                            const active = packageForm.selectedIds.includes(item.id);
                            return (
                              <button key={item.id} type="button" className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${active ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => togglePackageMaterial(item.id)}>
                                <div>
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-sm text-slate-500">
  {[item.platform, item.wearLevel, item.wearRange].filter(Boolean).join(" • ")}
</div>
                                </div>
                                <div>{money(item.cost)}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <NumberField label="产物售价（可后补）" placeholder="548" value={packageForm.salePrice} onChange={(value) => setPackageForm({ ...packageForm, salePrice: value })} />
                      <Button onClick={addPackageContract} disabled={!((packageForm.selectedIds.length === 5 || packageForm.selectedIds.length === 10) && packageForm.outputName)} className="w-full rounded-2xl">保存包炉记录</Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
  <CardTitle>汰换记录</CardTitle>

  {contracts.length > 10 && (
    <button
      type="button"
      onClick={() => setShowAllContracts((prev) => !prev)}
      className="rounded-xl border px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      {showAllContracts ? "收起 ↑" : "查看全部 ↓"}
    </button>
  )}
</CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>合同名称</TableHead>
                        <TableHead>产物名称</TableHead>
                        <TableHead>参考价</TableHead>
                        <TableHead>磨损等级</TableHead>
                        <TableHead>磨损区间</TableHead>
                        <TableHead>结果</TableHead>
                        <TableHead>开炉费</TableHead>
                        <TableHead>售价</TableHead>
                        <TableHead>利润</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                     {visibleContracts.map((item) => {
  const contractName = item.contractName ?? item.contract_name;
  const outputName = item.outputName ?? item.output_name;
  const outputWearLevel = item.outputWearLevel ?? item.output_wear_level;
  const outputWearRange = item.outputWearRange ?? item.output_wear_range;
  const outputCustomWear = item.outputCustomWear ?? item.output_custom_wear;
  const refPrice = item.refPrice ?? item.ref_price;
  const furnaceFee = item.furnaceFee ?? item.furnace_fee;
  const salePrice = item.salePrice ?? item.sale_price;
  const type = item.type ?? "普通汰换";
  const profit = salePrice ? Number(salePrice) - Number(refPrice || 0) : 0;

  return (
                          <TableRow key={item.id}>
  <TableCell>{item.date}</TableCell>
  <TableCell>{type}</TableCell>
  <TableCell>{contractName}</TableCell>
  <TableCell>{outputName}</TableCell>
  <TableCell>{money(refPrice)}</TableCell>
  <TableCell>{outputWearLevel}</TableCell>
  <TableCell>
    {outputWearRange === "自定义"
      ? outputCustomWear || "自定义"
      : outputWearRange}
  </TableCell>
  <TableCell>
    <Badge
      className={
        item.result === "成功"
          ? "rounded-full bg-green-100 text-green-700 hover:bg-green-100"
          : "rounded-full bg-red-100 text-red-700 hover:bg-red-100"
      }
    >
      {item.result}
    </Badge>
  </TableCell>
  <TableCell>{money(furnaceFee)}</TableCell>
  <TableCell>{salePrice ? money(salePrice) : "-"}</TableCell>
  <TableCell>{money(profit)}</TableCell>
  <TableCell>
    <Badge variant="secondary" className="rounded-full">
      {item.status}
    </Badge>
  </TableCell>
</TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>



          <TabsContent value="daily">
            <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
              <Card className="rounded-3xl border-0 shadow-sm">
  <CardHeader className="pb-3">
    <div className="flex items-center justify-between">
      <CardTitle>收益日历</CardTitle>

      <button
        type="button"
        onClick={() => {
          setShowPastProfit((prev) => !prev);
          setEditingPastProfit(false);
        }}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        {showPastProfit ? "隐藏过往收益" : "显示过往收益"}
      </button>
    </div>
  </CardHeader>

  <CardContent onMouseLeave={() => setShowCalendar(false)}>
    <div
      className={
        showPastProfit
          ? "grid items-stretch gap-4 xl:grid-cols-[220px_minmax(0,1fr)]"
          : "grid grid-cols-1"
      }
    >
      {showPastProfit && (
        <div className="flex h-full min-h-[108px] flex-col justify-between rounded-2xl bg-slate-50 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-slate-500">过往收益</div>

            {!editingPastProfit && (
              <button
  type="button"
  disabled={isReadonlyMode}
  onClick={() => {
    if (isReadonlyMode) {
      showToast("会员已过期，当前为只读模式", "error");
      return;
    }

    setEditingPastProfit(true);
    setEditingPastProfitValue(String(pastProfit || ""));
  }}
  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
>
  编辑
</button>
            )}
          </div>

          {editingPastProfit ? (
            <div className="mt-3 space-y-2">
              <input
                type="number"
                value={editingPastProfitValue}
                onChange={(e) => setEditingPastProfitValue(e.target.value)}
                placeholder="输入过往收益"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!currentUser?.id) return;

                    const amount = Number(editingPastProfitValue || 0);

                    const { error } = await upsertDailyExtraIncome({
                      user_id: currentUser.id,
                      date: PAST_PROFIT_DATE,
                      amount,
                      note: "past_profit_baseline",
                    });

                    if (error) {
                      console.error("保存过往收益失败", error);
                      showToast(`保存过往收益失败：${error.message}`, "error");
                      return;
                    }

                    setPastProfit(amount);
                    setEditingPastProfit(false);
                    showToast("过往收益已保存");
                  }}
                  className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                >
                  完成
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingPastProfit(false);
                    setEditingPastProfitValue(String(pastProfit || ""));
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
              {money(pastProfit)}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex min-h-[108px] items-center justify-between rounded-2xl bg-slate-50 px-5 py-4">
          <div>
            <div className="text-sm text-slate-500">当天收益</div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {money(dailySummary.totalProfit)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCalendar((prev) => !prev)}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            {showCalendar ? "收起日历 ↑" : "展开日历 ↓"}
          </button>
        </div>

        {showCalendar && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" />
              <span>
                {calendarYear} 年 {calendarMonth} 月
              </span>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-slate-400">
              {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {monthCells.map((day, index) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${index}`}
                     className="h-16 sm:h-20 rounded-[20px] bg-transparent"
                    />
                  );
                }

                const dateKey = `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const summary = dateSummaryMap[dateKey];

                return (
                  <button
  key={dateKey}
  type="button"
  onClick={() => setSelectedDailyDate(dateKey)}
  className={`h-16 sm:h-20 rounded-[20px] border px-1.5 py-2 text-center transition ${
    selectedDailyDate === dateKey
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-slate-200 bg-white hover:bg-slate-50"
  }`}
>
  <div className="text-base font-semibold leading-none sm:text-sm">{day}</div>
  <div className="mt-2 text-[11px] leading-none sm:text-xs">
    {money(summary?.totalProfit || 0)}
  </div>
</button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  </CardContent>
</Card>

              <Card className="rounded-3xl border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>{selectedDailyDate} 收益概览</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SummaryRow label="材料总毛利" value={money(dailySummary.materialProfit)} clickable active={detailPanel === "material"} onClick={() => setDetailPanel("material")} />
                  <SummaryRow label="产物出售利润" value={money(dailySummary.productProfit)} clickable active={detailPanel === "product"} onClick={() => setDetailPanel("product")} />
                  <SummaryRow label="开炉费收入" value={money(dailySummary.furnaceIncome)} clickable active={detailPanel === "furnace"} onClick={() => setDetailPanel("furnace")} />
                 <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
  <div className="min-w-[80px] text-slate-700">其他</div>

  {editingExtraDate === selectedDailyDate ? (
    <>
      <input
        type="number"
        value={editingExtraValue}
        onChange={(e) => setEditingExtraValue(e.target.value)}
        placeholder="输入金额"
        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
      />
      <button
        type="button"
        onClick={async () => {
          if (!currentUser?.id) return;

          const amount = Number(editingExtraValue || 0);

          const { error } = await upsertDailyExtraIncome({
            user_id: currentUser.id,
            date: selectedDailyDate,
            amount,
          });

          if (error) {
            console.error("保存其他收益失败", error);
            showToast(`保存其他收益失败：${error.message}`, "error");
            return;
          }

          setDailyExtraMap((prev) => ({
            ...prev,
            [selectedDailyDate]: amount,
          }));
          setEditingExtraDate(null);
          showToast("其他收益已保存");
        }}
        className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
      >
        完成
      </button>
    </>
  ) : (
    <>
      <div className="flex-1 text-sm font-medium text-slate-900">
        {money(dailySummary.extraValue)}
      </div>
      <button
  type="button"
  disabled={isReadonlyMode}
  onClick={() => {
    if (isReadonlyMode) {
      showToast("会员已过期，当前为只读模式", "error");
      return;
    }

    setEditingExtraDate(selectedDailyDate);
    setEditingExtraValue(String(dailyExtraMap[selectedDailyDate] ?? ""));
  }}
  className="rounded-xl border px-3 py-2 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
>
  编辑
</button>
    </>
  )}
</div>
          <SummaryRow
  label="总收益"
  value={money(dailySummary.totalProfit + Number(pastProfit || 0))}
  strong
/>

                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <div className="mb-3 text-sm font-medium text-slate-700">{detailTitle}</div>
                    <div className="space-y-2">
            {(detailItems || []).length ? (detailItems || []).map((item) => (
                        <div key={item.id} className="rounded-xl bg-white px-3 py-3">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{item.name}</div>
                            <div className="font-semibold">{money(item.value)}</div>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{item.note}</div>
                        </div>
                      )) : <div className="rounded-xl bg-white px-3 py-4 text-sm text-slate-500">当天暂无这类收益明细。</div>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}



function StatCard({ title, value, hidden, icon, onToggle }) {
  return (
    <Card className="rounded-3xl border-0 shadow-sm">
      <CardContent className="flex items-center justify-between p3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-500">{title}</p>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onToggle}>
              {hidden ? <Eye className="h-4 w-4 text-slate-500" /> : <EyeOff className="h-4 w-4 text-slate-500" />}
            </Button>
          </div>
          <p className="mt-1 text-2xl font-bold">{hidden ? "••••" : value}</p>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function FieldDate({ label, value, onChange, lang }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="date" value={value} lang={lang} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumberField({ label, value, onChange, placeholder, disabled }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SuggestionList({ items, onPick }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-3">
      {items.map((item) => (
        <button key={item} type="button" className="rounded-full border px-3 py-1 text-xs text-slate-700" onClick={() => onPick(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

function InfoBox({ label, value, note }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
      {label}：<span className="font-semibold text-slate-900">{value}</span>
      {note ? <div className="mt-1 text-xs text-slate-500">{note}</div> : null}
    </div>
  );
}

function SummaryRow({ label, value, clickable, active, strong, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ${strong ? "bg-slate-900 text-white" : active ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700"} ${clickable ? "cursor-pointer" : "cursor-default"}`}>
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </button>
  );
}
