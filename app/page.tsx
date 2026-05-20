// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { updateContractById } from "@/lib/db/contracts";
import { updateMaterialById } from "@/lib/db/materials";
import {
  fetchDailyExtraIncome,
  upsertDailyExtraIncome,
} from "@/lib/db/daily-extra-income";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Wallet,
  Boxes,
  TrendingUp,
  PackageCheck,
  Layers3,
  Pencil,
  Eye,
  EyeOff,
  CalendarDays,
  Trash2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserRound,
  LockKeyhole,
  Sparkles,
  LayoutDashboard,
  CircleDollarSign,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";

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
const USERNAME_RE = /^[A-Za-z0-9]{3,20}$/;

function normalizeUsername(value: string) {
  return String(value || "").trim().toLowerCase();
}

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

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

function getAutoFurnaceRate(result, type) {
  return result === "成功" && type !== "包炉" ? 0.1 : 0;
}

function computeAutoFurnaceFee(refPrice, result, type) {
  const rate = getAutoFurnaceRate(result, type);
  return Number((Number(refPrice || 0) * rate).toFixed(2));
}

function formatInventoryDate(date, showFullDate) {
  if (showFullDate) return date;
  return typeof date === "string" && date.length >= 10 ? date.slice(5) : date;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(dateStr: string, offset: number) {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  const next = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

function getMonthStart(dateStr: string) {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-01`;
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

function getDailySummary(date: string, materials: any[], contracts: any[], dailyExtraMap: Record<string, number> = {}) {
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

function getCumulativeMonthProfit(targetDate: string, dateSummaryMap: Record<string, any>) {
  if (!targetDate) return 0;
  const [year, month] = targetDate.split("-");
  const monthPrefix = `${year}-${month}`;
  const monthDates = Object.keys(dateSummaryMap)
    .filter((date) => date.startsWith(monthPrefix))
    .sort((a, b) => a.localeCompare(b));

  if (!monthDates.length) return 0;

  return monthDates
    .filter((date) => date <= targetDate)
    .reduce((sum, date) => sum + Number(dateSummaryMap[date]?.totalProfit || 0), 0);
}

export default function CS2TradeRegisterPrototype() {
  const router = useRouter();

  const [toast, setToast] = React.useState({ show: false, message: "", type: "success" });
  const toastTimerRef = React.useRef<any>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 2200);
  }

  const [showPastProfit, setShowPastProfit] = useState(false);
  const [showAllContracts, setShowAllContracts] = useState(false);
  const [exchangeKeyword, setExchangeKeyword] = useState("");
  const [exchangeEditMode, setExchangeEditMode] = useState(false);
  const [exchangeEdits, setExchangeEdits] = useState<Record<string, any>>({});
  const [expandedContractIds, setExpandedContractIds] = useState([]);
  const [isSavingExchangeEdits, setIsSavingExchangeEdits] = useState(false);
  const [showAllMaterials, setShowAllMaterials] = useState(false);
  const [showAllInventory, setShowAllInventory] = useState(false);
  const [inventoryEdits, setInventoryEdits] = useState<Record<string, any>>({});
  const [materials, setMaterials] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [membershipInfo, setMembershipInfo] = useState<any>(null);
  const [isReadonlyMode, setIsReadonlyMode] = useState(false);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [activationCodeInput, setActivationCodeInput] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [keyword, setKeyword] = useState("");
  const [isAddingMaterials, setIsAddingMaterials] = useState(false);
  const [isSavingEcoContract, setIsSavingEcoContract] = useState(false);
  const [isSavingPackageContract, setIsSavingPackageContract] = useState(false);
  const [isSavingInventoryEdits, setIsSavingInventoryEdits] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const batchInputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const [exchangeMode, setExchangeMode] = useState("ECO合炉");
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedDailyDate, setSelectedDailyDate] = useState("");
  const [calendarViewDate, setCalendarViewDate] = useState("");
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
    date: getYesterdayDate(),
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

  const [inventoryNameInput, setInventoryNameInput] = useState("");
  const [debouncedInventoryName, setDebouncedInventoryName] = useState("");

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
    selectedIds: [],
    materialSalePrices: {},
  });

  const [packageFilters, setPackageFilters] = useState({ date: "", name: "", platform: "全部" });
  const [ecoFilters, setEcoFilters] = useState({ date: "", name: "", platform: "全部" });
  const [ecoNameInput, setEcoNameInput] = useState("");
  const [debouncedEcoName, setDebouncedEcoName] = useState("");
  const [packageNameInput, setPackageNameInput] = useState("");
  const [debouncedPackageName, setDebouncedPackageName] = useState("");
  const [showAllEcoMaterials, setShowAllEcoMaterials] = useState(false);
  const [showAllPackageMaterials, setShowAllPackageMaterials] = useState(false);

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

      const expired = !membership?.membership_expires_at || new Date(membership.membership_expires_at).getTime() < Date.now();
      setIsReadonlyMode(expired);

      await Promise.all([loadMaterials(user.id), loadContracts(user.id), loadDailyExtraIncome(user.id)]);
      setAuthChecked(true);
    }

    checkAuth();
  }, [router]);

  React.useEffect(() => {
    setUsernameInput(normalizeUsername(membershipInfo?.username || currentUser?.email?.split("@")[0] || ""));
  }, [membershipInfo?.username, currentUser?.email]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleUpdateUsername() {
    if (isSavingUsername) return;

    const username = normalizeUsername(usernameInput);

    if (!USERNAME_RE.test(username)) {
      showToast("用户名只能使用英文字母和数字，长度 3-20 位", "error");
      return;
    }

    if (username === normalizeUsername(membershipInfo?.username || "")) {
      showToast("用户名没有变化");
      return;
    }

    setIsSavingUsername(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (sessionError || !token) {
        showToast("登录状态已失效，请重新登录", "error");
        return;
      }

      const res = await fetch("/api/update-username", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username }),
      });

      const result = await res.json();

      if (!res.ok) {
        showToast(result?.error || "修改用户名失败", "error");
        return;
      }

      setMembershipInfo((prev) => ({ ...(prev || {}), ...(result?.membership || {}), username }));
      setCurrentUser((prev) => ({ ...(prev || {}), email: result?.email || prev?.email }));
      setUsernameInput(username);
      showToast(result?.message || "用户名修改成功");
    } catch (err) {
      console.error("修改用户名失败", err);
      showToast("修改用户名请求失败", "error");
    } finally {
      setIsSavingUsername(false);
    }
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

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

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

    const currentExpire = membershipInfo?.membership_expires_at ? new Date(membershipInfo.membership_expires_at).getTime() : Date.now();
    const baseTime = currentExpire > Date.now() ? currentExpire : Date.now();
    const nextExpire = new Date(baseTime + Number(codeRow.days || 0) * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateMembershipError } = await supabase
      .from("user_memberships")
      .update({ membership_expires_at: nextExpire, is_readonly: false, updated_at: new Date().toISOString() })
      .eq("user_id", currentUser.id);

    if (updateMembershipError) {
      showToast("激活失败", "error");
      return;
    }

    const { error: markUsedError } = await supabase
      .from("activation_codes")
      .update({ is_used: true, used_by: currentUser.id, used_at: new Date().toISOString() })
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
      if (item.date === PAST_PROFIT_DATE) baseline = amount;
      else map[item.date] = amount;
    });

    setDailyExtraMap(map);
    setPastProfit(baseline);
  }

  async function loadMembership(userId: string, email?: string | null) {
    const { data, error } = await supabase.from("user_memberships").select("*").eq("user_id", userId).maybeSingle();
    if (!error && data) return data;

    const fallbackUsername = email ? email.split("@")[0] : "用户";
    const expiresAt = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inserted, error: insertError } = await supabase
      .from("user_memberships")
      .insert({ user_id: userId, username: fallbackUsername, membership_expires_at: expiresAt, is_readonly: false })
      .select()
      .single();

    if (insertError) {
      console.error("补建会员信息失败", insertError);
      return null;
    }
    return inserted;
  }

  const materialNameSuggestions = useMemo(() => {
    const names = [];
    const seen = new Set();

    materials.forEach((item) => {
      if (!item.name || seen.has(item.name)) return;
      seen.add(item.name);
      names.push(item.name);
    });

    const q = materialForm.name.trim().toLowerCase();
    if (!q) return names.slice(0, 5);

    return names.filter((name) => name.toLowerCase().includes(q)).slice(0, 5);
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

  const visibleContracts = useMemo(() => (showAllContracts ? contracts : contracts.slice(0, 10)), [contracts, showAllContracts]);

  const filteredExchangeContracts = useMemo(() => {
    const q = exchangeKeyword.trim().toLowerCase();
    if (!q) return contracts;

    return contracts.filter((item) => {
      const contractName = item.contractName ?? item.contract_name ?? "";
      const outputName = item.outputName ?? item.output_name ?? "";
      const outputWearLevel = item.outputWearLevel ?? item.output_wear_level ?? "";
      const outputWearRange = item.outputWearRange ?? item.output_wear_range ?? "";
      const type = item.type ?? "ECO合炉";
      const text = [
        item.date,
        type,
        contractName,
        outputName,
        outputWearLevel,
        outputWearRange,
        item.result,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [contracts, exchangeKeyword]);

  const visibleExchangeContracts = useMemo(() => {
    return showAllContracts ? filteredExchangeContracts : filteredExchangeContracts.slice(0, 20);
  }, [filteredExchangeContracts, showAllContracts]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      const text = `${item.platform} ${item.name} ${item.date} ${item.status} ${item.wearLevel}`.toLowerCase();
      return text.includes(keyword.toLowerCase());
    });
  }, [materials, keyword]);

  const visibleMaterials = useMemo(() => (showAllMaterials ? filteredMaterials : filteredMaterials.slice(0, 10)), [filteredMaterials, showAllMaterials]);

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
        wearRange: wearRange === "自定义" ? customWear || "自定义" : wearRange || "-",
        cost: Number(item.cost || 0),
        salePrice: salePrice === "" || salePrice === null || salePrice === undefined ? "" : Number(salePrice || 0),
        profit: salePrice === "" || salePrice === null || salePrice === undefined ? "" : Number(salePrice || 0) - Number(item.cost || 0),
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
        name: outputName || "未开炉暂存",
        wearLevel: outputWearLevel || "-",
        saleDate: item.saleDate ?? item.sale_date ?? "",
        wearRange: outputWearRange === "自定义" ? outputCustomWear || "自定义" : outputWearRange || "-",
        cost: Number(refPrice || 0),
        salePrice: salePrice === "" || salePrice === null || salePrice === undefined ? "" : Number(salePrice || 0),
        profit: salePrice === "" || salePrice === null || salePrice === undefined ? "" : Number(salePrice || 0) - Number(refPrice || 0),
        status: item.status,
        itemType: "contract",
        rawId: item.id,
        isContract: true,
      };
    });

    return [...materialRows, ...contractRows].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return Number(b.rawId || 0) - Number(a.rawId || 0);
    });
  }, [materials, contracts]);

  const filteredInventory = useMemo(() => {
    const matchedRows = inventoryRows.filter((item) => {
      const matchDate = !inventoryFilters.date || item.date === inventoryFilters.date;
      const matchPlatform = inventoryFilters.platform === "全部" || item.platform === inventoryFilters.platform;
      const matchName = !inventoryFilters.name || item.name.toLowerCase().includes(inventoryFilters.name.toLowerCase());
      const matchWearLevel = inventoryFilters.wearLevel === "全部" || item.wearLevel === inventoryFilters.wearLevel;
      const matchStatus = inventoryFilters.status === "全部" || item.status === inventoryFilters.status;
      return matchDate && matchPlatform && matchName && matchWearLevel && matchStatus;
    });

    if (!editMode || !selectedIds.length) return matchedRows;

    const selectedRowSet = new Set(selectedIds);
    const pinnedSelectedRows = inventoryRows.filter((item) => selectedRowSet.has(item.id) && !matchedRows.some((row) => row.id === item.id));
    return [...pinnedSelectedRows, ...matchedRows];
  }, [inventoryRows, inventoryFilters, editMode, selectedIds]);

  const visibleInventory = useMemo(() => (showAllInventory ? filteredInventory : filteredInventory.slice(0, 20)), [filteredInventory, showAllInventory]);

  const stats = useMemo(() => {
    const totalExtraIncome = Object.values(dailyExtraMap).reduce((sum, value) => sum + Number(value || 0), 0);

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
      totalProfit: materialProfit + productProfit + furnaceIncome + totalExtraIncome + Number(pastProfit || 0),
      stockCount,
      stockCost,
    };
  }, [materials, contracts, inventoryRows, dailyExtraMap, pastProfit]);

  const currentWearRanges = wearRanges[materialForm.wearLevel] || [];
  const currentContractWearRanges = wearRanges[contractForm.outputWearLevel] || [];
  const currentPackageWearRanges = wearRanges[packageForm.outputWearLevel] || [];

  const dailyDates = useMemo(() => {
    const set = new Set<string>();
    materials.forEach((item) => {
      const saleDate = item.saleDate ?? item.sale_date;
      if (saleDate) set.add(saleDate);
    });
    contracts.forEach((item) => {
      const saleDate = item.saleDate ?? item.sale_date;
      const contractDate = item.date;
      if (saleDate) set.add(saleDate);
      if (contractDate) set.add(contractDate);
    });
    Object.keys(dailyExtraMap || {}).forEach((date) => {
      if (date) set.add(date);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [materials, contracts, dailyExtraMap]);

  const dailySummary = useMemo(() => getDailySummary(selectedDailyDate, materials, contracts, dailyExtraMap), [selectedDailyDate, materials, contracts, dailyExtraMap]);
  const remainingDays = getRemainingDays(membershipInfo?.membership_expires_at);

  const contractIngredientOptions = useMemo(() => {
    const materialOptions = materials
      .filter((item) => item.status === "库存中")
      .map((item) => ({
        ...item,
        id: `material-${item.id}`,
        rawId: item.id,
        sourceType: "material",
        platform: item.platform,
        name: item.name,
        cost: Number(item.cost || 0),
      }));

    const contractOptions = contracts
      .filter((item) => {
        const status = item.status;
        const outputName = item.outputName ?? item.output_name;
        return status === "库存中" && outputName && outputName !== "未开炉暂存";
      })
      .map((item) => ({
        ...item,
        id: `contract-${item.id}`,
        rawId: item.id,
        sourceType: "contract",
        platform: "汰换",
        name: item.outputName ?? item.output_name,
        wearLevel: item.outputWearLevel ?? item.output_wear_level,
        wearRange: item.outputWearRange ?? item.output_wear_range,
        customWear: item.outputCustomWear ?? item.output_custom_wear,
        cost: Number(item.refPrice ?? item.ref_price ?? 0),
      }));

    return [...materialOptions, ...contractOptions].sort((a, b) => {
      const aDate = a.date || "";
      const bDate = b.date || "";
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return String(b.rawId || "").localeCompare(String(a.rawId || ""));
    });
  }, [materials, contracts]);

  const filteredEcoMaterials = useMemo(() => {
    return contractIngredientOptions.filter((item) => {
      const matchDate = !ecoFilters.date || item.date === ecoFilters.date;
      const matchName = !ecoFilters.name || String(item.name || "").toLowerCase().includes(ecoFilters.name.toLowerCase());
      const matchPlatform = ecoFilters.platform === "全部" || item.platform === ecoFilters.platform;
      return matchDate && matchName && matchPlatform;
    });
  }, [contractIngredientOptions, ecoFilters]);

  const filteredPackageMaterials = useMemo(() => {
    return contractIngredientOptions.filter((item) => {
      const matchDate = !packageFilters.date || item.date === packageFilters.date;
      const matchName = !packageFilters.name || String(item.name || "").toLowerCase().includes(packageFilters.name.toLowerCase());
      const matchPlatform = packageFilters.platform === "全部" || item.platform === packageFilters.platform;
      return matchDate && matchName && matchPlatform;
    });
  }, [contractIngredientOptions, packageFilters]);

  const ecoCost = useMemo(() => {
    return contractIngredientOptions.filter((item) => contractForm.selectedIds.includes(item.id)).reduce((sum, item) => sum + Number(item.cost || 0), 0);
  }, [contractIngredientOptions, contractForm.selectedIds]);

  const ecoProfit = useMemo(() => {
    return contractIngredientOptions.filter((item) => contractForm.selectedIds.includes(item.id)).reduce((sum, item) => {
      const salePrice = Number(contractForm.materialSalePrices?.[item.id] || 0);
      return sum + (salePrice - Number(item.cost || 0));
    }, 0);
  }, [contractIngredientOptions, contractForm.selectedIds, contractForm.materialSalePrices]);

  const packageCost = useMemo(() => {
    return contractIngredientOptions.filter((item) => packageForm.selectedIds.includes(item.id)).reduce((sum, item) => sum + Number(item.cost || 0), 0);
  }, [contractIngredientOptions, packageForm.selectedIds]);

  const shouldShowEcoMaterialList = Boolean(ecoFilters.date) || Boolean(ecoFilters.name.trim()) || ecoFilters.platform !== "全部";
  const shouldShowPackageMaterialList = Boolean(packageFilters.date) || Boolean(packageFilters.name.trim()) || packageFilters.platform !== "全部";

  const selectedRows = useMemo(() => visibleInventory.filter((item) => selectedIds.includes(item.id)), [visibleInventory, selectedIds]);
  const selectedSum = useMemo(() => selectedRows.reduce((sum, item) => sum + Number(item.cost || 0), 0), [selectedRows]);
  const selectedAvg = useMemo(() => (selectedRows.length ? selectedSum / selectedRows.length : 0), [selectedRows, selectedSum]);
  const isRowEditable = (rowId: string) => editMode && selectedIds.includes(rowId);

  const calendarSourceDate = calendarViewDate || getMonthStart(getTodayDate());
  const [calendarYear, calendarMonth] = calendarSourceDate.split("-").map(Number);
  const monthCells = calendarMatrix(calendarYear, calendarMonth - 1);

  const dateSummaryMap = useMemo(() => {
    const map = {};
    dailyDates.forEach((date) => {
      map[date] = getDailySummary(date, materials, contracts, dailyExtraMap);
    });
    return map;
  }, [dailyDates, materials, contracts, dailyExtraMap]);

  const cumulativeProfit = useMemo(() => getCumulativeMonthProfit(selectedDailyDate, dateSummaryMap), [selectedDailyDate, dateSummaryMap]);

  React.useEffect(() => {
    const savedDate = typeof window !== "undefined" ? localStorage.getItem("daily-selected-date") : null;
    const today = getTodayDate();
    const nextDate = savedDate || today;
    setSelectedDailyDate((prev) => prev || nextDate);
    setCalendarViewDate((prev) => prev || getMonthStart(today));
  }, []);

  React.useEffect(() => {
    if (!selectedDailyDate || typeof window === "undefined") return;
    localStorage.setItem("daily-selected-date", selectedDailyDate);
  }, [selectedDailyDate]);

  React.useEffect(() => setShowAllInventory(false), [inventoryFilters]);
  React.useEffect(() => setShowAllEcoMaterials(false), [ecoFilters]);
  React.useEffect(() => setShowAllPackageMaterials(false), [packageFilters]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedEcoName(ecoNameInput), 180);
    return () => clearTimeout(timer);
  }, [ecoNameInput]);

  useEffect(() => {
    setEcoFilters((prev) => ({ ...prev, name: debouncedEcoName }));
  }, [debouncedEcoName]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPackageName(packageNameInput), 180);
    return () => clearTimeout(timer);
  }, [packageNameInput]);

  useEffect(() => {
    setPackageFilters((prev) => ({ ...prev, name: debouncedPackageName }));
  }, [debouncedPackageName]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInventoryName(inventoryNameInput), 180);
    return () => clearTimeout(timer);
  }, [inventoryNameInput]);

  useEffect(() => {
    setInventoryFilters((prev) => ({ ...prev, name: debouncedInventoryName }));
  }, [debouncedInventoryName]);

  const addBatchPriceField = () => setBatchPrices((prev) => [...prev, ""]);
  const updateBatchPrice = (index, value) => setBatchPrices((prev) => prev.map((item, i) => (i === index ? value : item)));

  const addBatchMaterials = async () => {
    if (isAddingMaterials) return;
    if (isReadonlyMode) {
      showToast("会员已过期，当前为只读模式", "error");
      return;
    }

    setIsAddingMaterials(true);
    try {
      if (!currentUser) {
        showToast("当前用户不存在，请重新登录", "error");
        return;
      }
      if (!materialForm.name.trim()) {
        showToast("材料名称不能为空", "error");
        return;
      }

      const prices = batchPrices.map((v) => String(v).trim()).filter(Boolean).map(Number).filter((v) => !Number.isNaN(v));
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

      const { data: insertedRows, error } = await supabase.from("materials").insert(payloads).select();
      if (error) {
        showToast(`批量保存材料失败：${error.message}`, "error");
        return;
      }

      const normalizedInsertedRows = (insertedRows || []).map((item) => ({
        ...item,
        wearLevel: item.wearLevel ?? item.wear_level,
        wearRange: item.wearRange ?? item.wear_range,
        customWear: item.customWear ?? item.custom_wear,
        salePrice: item.salePrice ?? item.sale_price,
        saleDate: item.saleDate ?? item.sale_date,
      }));

      setMaterials((prev) => [...normalizedInsertedRows, ...prev]);
      showToast(`批量添加成功，共 ${payloads.length} 条`);
      setBatchPrices([""]);
      setMaterialForm((prev) => ({ ...prev, name: "", wearLevel: "久经沙场", wearRange: "0.15 - 0.18", customWear: "", cost: "", salePrice: "" }));
    } finally {
      setIsAddingMaterials(false);
    }
  };

  const syncContractResult = (nextResult) => {
    setContractForm((prev) => {
      const currentRate = String(prev.furnaceRatePercent ?? "").trim();
      const nextRate =
        nextResult === "成功"
          ? currentRate && Number(currentRate) > 0
            ? currentRate
            : "10"
          : "0";

      if (nextResult === "未开炉") {
        return {
          ...prev,
          result: nextResult,
          furnaceRatePercent: "0",
          outputName: "",
          outputWearLevel: "待定",
          outputWearRange: "待定",
          outputCustomWear: "",
          refPrice: "",
          salePrice: "",
        };
      }

      if (prev.result === "未开炉" && nextResult !== "未开炉") {
        return {
          ...prev,
          result: nextResult,
          furnaceRatePercent: nextRate,
          outputWearLevel: "久经沙场",
          outputWearRange: "0.15 - 0.18",
          outputCustomWear: "",
        };
      }

      return { ...prev, result: nextResult, furnaceRatePercent: nextRate };
    });
  };

  const syncPackageResult = (nextResult) => {
    setPackageForm((prev) => {
      if (nextResult === "未开炉") {
        return {
          ...prev,
          result: nextResult,
          outputName: "",
          outputWearLevel: "待定",
          outputWearRange: "待定",
          outputCustomWear: "",
          salePrice: "",
        };
      }

      if (prev.result === "未开炉" && nextResult !== "未开炉") {
        return {
          ...prev,
          result: nextResult,
          outputWearLevel: "久经沙场",
          outputWearRange: "0.15 - 0.18",
          outputCustomWear: "",
        };
      }

      return { ...prev, result: nextResult };
    });
  };

  const addContract = async () => {
    if (isSavingEcoContract) return;
    if (isReadonlyMode) {
      showToast("会员已过期，当前为只读模式", "error");
      return;
    }

    setIsSavingEcoContract(true);
    try {
      if (!currentUser?.id) {
        showToast("当前用户不存在，请重新登录", "error");
        return;
      }
      const isPendingFurnace = contractForm.result === "未开炉";
      if (!isPendingFurnace && !contractForm.outputName?.trim()) {
        showToast("请输入产物名称", "error");
        return;
      }

      const selectedMaterials = contractIngredientOptions.filter((item) => contractForm.selectedIds.includes(item.id));
      const missingMaterialSalePrice = selectedMaterials.some((item) => {
        const value = contractForm.materialSalePrices?.[item.id];
        return value === "" || value === null || value === undefined;
      });

      if (!isPendingFurnace && missingMaterialSalePrice) {
        showToast("请把每个已选材料的售价都填写完整", "error");
        return;
      }

      const refPrice = Number(contractForm.refPrice || 0);
      const furnaceFee = isPendingFurnace ? 0 : computeFurnaceFee(refPrice, contractForm.result, contractForm.furnaceRatePercent);
      const salePrice = isPendingFurnace || contractForm.salePrice === "" ? null : Number(contractForm.salePrice);

      const payload = {
        date: contractForm.date,
        type: "ECO合炉",
        contract_name: contractForm.contractName || (isPendingFurnace ? "未开炉暂存" : "ECO合炉记录"),
        output_name: contractForm.outputName?.trim() || (isPendingFurnace ? "未开炉暂存" : ""),
        output_wear_level: contractForm.outputWearLevel || (isPendingFurnace ? "待定" : "久经沙场"),
        output_wear_range: contractForm.outputWearRange || (isPendingFurnace ? "待定" : "0.15 - 0.18"),
        output_custom_wear: contractForm.outputCustomWear || null,
        ref_price: refPrice,
        result: contractForm.result,
        furnace_rate: contractForm.result === "成功" ? Number(contractForm.furnaceRatePercent || 10) / 100 : 0,
        furnace_fee: furnaceFee,
        sale_price: salePrice,
        sale_date: salePrice === null ? null : contractForm.date,
        status: isPendingFurnace ? "未开炉" : salePrice === null ? "库存中" : "已售出",
        user_id: currentUser.id,
      };

      const { data: insertedContract, error: insertError } = await insertContract(payload);
      if (insertError) {
        showToast(`保存 ECO 合炉记录失败：${insertError.message}`, "error");
        return;
      }

      const materialUpdateResults = await Promise.all(selectedMaterials.map(async (item) => {
        const materialSalePrice = isPendingFurnace
          ? Number(contractForm.materialSalePrices?.[item.id] || item.cost || 0)
          : Number(contractForm.materialSalePrices?.[item.id] || 0);

        if (item.sourceType === "contract") {
          const { error } = await updateContractById(Number(item.rawId), { status: "已售出", sale_price: materialSalePrice, sale_date: contractForm.date });
          return { item, error, isContract: true };
        }

        const { error } = await updateMaterialById(Number(item.rawId), { status: "已售出", sale_price: materialSalePrice, sale_date: contractForm.date });
        return { item, error, isContract: false };
      }));

      const failedMaterialUpdate = materialUpdateResults.find((result) => result.error);
      if (failedMaterialUpdate) {
        showToast(`更新 ECO 合炉选材失败：${failedMaterialUpdate.error.message}`, "error");
        return;
      }

      setMaterials((prev) => prev.map((item) => {
        const key = `material-${item.id}`;
        if (!contractForm.selectedIds.includes(key)) return item;
        const materialSalePrice = isPendingFurnace
          ? Number(contractForm.materialSalePrices?.[key] || item.cost || 0)
          : Number(contractForm.materialSalePrices?.[key] || 0);
        return { ...item, status: "已售出", sale_price: materialSalePrice, salePrice: materialSalePrice, sale_date: contractForm.date, saleDate: contractForm.date };
      }));

      setContracts((prev) => prev.map((item) => {
        const key = `contract-${item.id}`;
        if (!contractForm.selectedIds.includes(key)) return item;
        const refPrice = item.refPrice ?? item.ref_price ?? 0;
        const materialSalePrice = isPendingFurnace
          ? Number(contractForm.materialSalePrices?.[key] || refPrice || 0)
          : Number(contractForm.materialSalePrices?.[key] || 0);
        return { ...item, status: "已售出", sale_price: materialSalePrice, salePrice: materialSalePrice, sale_date: contractForm.date, saleDate: contractForm.date };
      }));

      if (insertedContract) {
        const normalizedInsertedContract = {
          ...insertedContract,
          contractName: insertedContract.contractName ?? insertedContract.contract_name,
          outputName: insertedContract.outputName ?? insertedContract.output_name,
          outputWearLevel: insertedContract.outputWearLevel ?? insertedContract.output_wear_level,
          outputWearRange: insertedContract.outputWearRange ?? insertedContract.output_wear_range,
          outputCustomWear: insertedContract.outputCustomWear ?? insertedContract.output_custom_wear,
          refPrice: insertedContract.refPrice ?? insertedContract.ref_price,
          furnaceFee: insertedContract.furnaceFee ?? insertedContract.furnace_fee,
          salePrice: insertedContract.salePrice ?? insertedContract.sale_price,
          saleDate: insertedContract.saleDate ?? insertedContract.sale_date,
        };
        setContracts((prev) => [normalizedInsertedContract, ...prev]);
      }

      setContractForm((prev) => ({ ...prev, contractName: "", outputName: "", outputWearLevel: "久经沙场", outputWearRange: "0.15 - 0.18", outputCustomWear: "", refPrice: "", result: "成功", furnaceRatePercent: "10", salePrice: "", selectedIds: [], materialSalePrices: {} }));
      showToast(isPendingFurnace ? "ECO 合炉已暂存，开炉后可在汰换记录里编辑" : "ECO 合炉记录已保存");
    } finally {
      setIsSavingEcoContract(false);
    }
  };

  const toggleEcoMaterial = (id) => {
    setContractForm((prev) => {
      const exists = prev.selectedIds.includes(id);
      if (exists) {
        const nextPrices = { ...(prev.materialSalePrices || {}) };
        delete nextPrices[id];
        return { ...prev, selectedIds: prev.selectedIds.filter((x) => x !== id), materialSalePrices: nextPrices };
      }
      if (prev.selectedIds.length >= 10) return prev;
      return { ...prev, selectedIds: [...prev.selectedIds, id], materialSalePrices: { ...(prev.materialSalePrices || {}), [id]: "" } };
    });
  };

  const updateEcoMaterialSalePrice = (id, value) => {
    setContractForm((prev) => ({ ...prev, materialSalePrices: { ...(prev.materialSalePrices || {}), [id]: value } }));
  };

  const togglePackageMaterial = (id) => {
    setPackageForm((prev) => {
      const exists = prev.selectedIds.includes(id);
      if (exists) return { ...prev, selectedIds: prev.selectedIds.filter((x) => x !== id) };
      if (prev.selectedIds.length >= 10) return prev;
      return { ...prev, selectedIds: [...prev.selectedIds, id] };
    });
  };

  const clearEcoMaterials = () => {
    if (!contractForm.selectedIds.length) return;

    setContractForm((prev) => ({
      ...prev,
      selectedIds: [],
      materialSalePrices: {},
    }));

    showToast("已清空 ECO 合炉选材");
  };

  const clearPackageMaterials = () => {
    if (!packageForm.selectedIds.length) return;

    setPackageForm((prev) => ({
      ...prev,
      selectedIds: [],
    }));

    showToast("已清空包炉选材");
  };

  const addPackageContract = async () => {
    if (isSavingPackageContract) return;
    if (isReadonlyMode) {
      showToast("会员已过期，当前为只读模式", "error");
      return;
    }

    setIsSavingPackageContract(true);
    try {
      if (!currentUser?.id) {
        showToast("当前用户不存在，请重新登录", "error");
        return;
      }

      const validCount = packageForm.selectedIds.length === 5 || packageForm.selectedIds.length === 10;
      if (!validCount) {
        showToast("包炉材料数量只能是 5 个或 10 个", "error");
        return;
      }
      const isPendingPackage = packageForm.result === "未开炉";
      if (!isPendingPackage && !packageForm.outputName?.trim()) {
        showToast("请输入产物名称", "error");
        return;
      }

      const selectedMaterials = contractIngredientOptions.filter((item) => packageForm.selectedIds.includes(item.id));
      if (!selectedMaterials.length) {
        showToast("未找到被选中的选材", "error");
        return;
      }

      const today = packageForm.date || new Date().toISOString().slice(0, 10);
      const salePrice = isPendingPackage || packageForm.salePrice === "" || packageForm.salePrice === null || packageForm.salePrice === undefined ? null : Number(packageForm.salePrice);

      const contractPayload = {
        date: packageForm.date,
        type: "包炉",
        contract_name: packageForm.contractName || (isPendingPackage ? "未开炉暂存" : "包炉记录"),
        output_name: packageForm.outputName?.trim() || (isPendingPackage ? "未开炉暂存" : ""),
        output_wear_level: packageForm.outputWearLevel || (isPendingPackage ? "待定" : "久经沙场"),
        output_wear_range: packageForm.outputWearRange || (isPendingPackage ? "待定" : "0.15 - 0.18"),
        output_custom_wear: packageForm.outputCustomWear || null,
        ref_price: Number(packageCost.toFixed(2)),
        result: packageForm.result,
        furnace_rate: 0,
        furnace_fee: 0,
        sale_price: salePrice,
        sale_date: salePrice === null ? null : packageForm.date,
        status: isPendingPackage ? "未开炉" : salePrice === null ? "库存中" : "已售出",
        user_id: currentUser.id,
      };

      const { data: insertedContract, error: insertError } = await insertContract(contractPayload);
      if (insertError) {
        showToast(`保存包炉记录失败：${insertError.message}`, "error");
        return;
      }

      const materialUpdateResults = await Promise.all(selectedMaterials.map(async (item) => {
        const materialCost = Number(item.cost || 0);

        if (item.sourceType === "contract") {
          const { error } = await updateContractById(Number(item.rawId), { status: "已售出", sale_price: materialCost, sale_date: today });
          return { item, error, isContract: true };
        }

        const { error } = await updateMaterialById(Number(item.rawId), { status: "已售出", sale_price: materialCost, sale_date: today });
        return { item, error, isContract: false };
      }));

      const failedMaterialUpdate = materialUpdateResults.find((result) => result.error);
      if (failedMaterialUpdate) {
        showToast(`更新包炉选材失败：${failedMaterialUpdate.error.message}`, "error");
        return;
      }

      setMaterials((prev) => prev.map((item) => {
        const key = `material-${item.id}`;
        if (!packageForm.selectedIds.includes(key)) return item;
        const materialCost = Number(item.cost || 0);
        return { ...item, status: "已售出", sale_price: materialCost, salePrice: materialCost, sale_date: today, saleDate: today };
      }));

      setContracts((prev) => prev.map((item) => {
        const key = `contract-${item.id}`;
        if (!packageForm.selectedIds.includes(key)) return item;
        const materialCost = Number(item.refPrice ?? item.ref_price ?? 0);
        return { ...item, status: "已售出", sale_price: materialCost, salePrice: materialCost, sale_date: today, saleDate: today };
      }));

      if (insertedContract) {
        const normalizedInsertedContract = {
          ...insertedContract,
          contractName: insertedContract.contractName ?? insertedContract.contract_name,
          outputName: insertedContract.outputName ?? insertedContract.output_name,
          outputWearLevel: insertedContract.outputWearLevel ?? insertedContract.output_wear_level,
          outputWearRange: insertedContract.outputWearRange ?? insertedContract.output_wear_range,
          outputCustomWear: insertedContract.outputCustomWear ?? insertedContract.output_custom_wear,
          refPrice: insertedContract.refPrice ?? insertedContract.ref_price,
          furnaceFee: insertedContract.furnaceFee ?? insertedContract.furnace_fee,
          salePrice: insertedContract.salePrice ?? insertedContract.sale_price,
          saleDate: insertedContract.saleDate ?? insertedContract.sale_date,
        };
        setContracts((prev) => [normalizedInsertedContract, ...prev]);
      }

      setPackageForm((prev) => ({ ...prev, contractName: "", outputName: "", outputWearLevel: "久经沙场", outputWearRange: "0.15 - 0.18", outputCustomWear: "", result: "成功", salePrice: "", selectedIds: [] }));
      showToast(isPendingPackage ? "包炉已暂存，开炉后可在汰换记录里编辑" : "包炉记录已保存");
    } finally {
      setIsSavingPackageContract(false);
    }
  };

  function updateInventoryField(item: any, field: string, value: any) {
    const rowKey = item.id;
    const rawId = item.rawId ?? item.id;
    const patch: any = { [field]: value };

    if (field === "date") {
      patch.date = value || null;
    }

    if (field === "cost") {
      patch.cost = value;
      if (item.isContract) {
        patch.refPrice = value;
        patch.ref_price = value === "" || value === null || value === undefined ? null : Number(value);
      }
    }

    if (field === "salePrice") {
      const hasSalePrice = value !== "" && value !== null && value !== undefined && !Number.isNaN(Number(value));
      if (hasSalePrice) {
        patch.salePrice = value;
        patch.sale_price = Number(value);
        patch.status = "已售出";
        const currentSaleDate = item.saleDate ?? item.sale_date;
        const currentEditedSaleDate = inventoryEdits[rowKey]?.saleDate;
        if (!currentSaleDate && !currentEditedSaleDate) {
          patch.saleDate = item.isContract ? item.date || "" : new Date().toISOString().slice(0, 10);
          patch.sale_date = patch.saleDate || null;
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
      next.profit = salePrice === "" || salePrice === null || salePrice === undefined ? "" : Number(salePrice) - Number(cost || 0);
      return next;
    };

    if (item.isContract) setContracts((prev: any[]) => prev.map(applyPatch));
    else setMaterials((prev: any[]) => prev.map(applyPatch));

    setInventoryEdits((prev) => ({ ...prev, [rowKey]: { ...(prev[rowKey] || {}), rawId, isContract: item.isContract, ...patch } }));
  }

  async function saveInventoryEdits() {
    if (isSavingInventoryEdits) return;
    if (isReadonlyMode) {
      showToast("会员已过期，当前为只读模式", "error");
      return;
    }

    setIsSavingInventoryEdits(true);
    try {
      const entries = Object.entries(inventoryEdits || {});
      if (!entries.length) {
        showToast("没有需要保存的改动");
        setEditMode(false);
        setSelectedIds([]);
        return;
      }

      const updateResults = await Promise.all(entries.map(async ([rowKey, patch]) => {
        const rawId = patch.rawId;
        const isContract = patch.isContract;
        const salePrice = patch.salePrice === "" || patch.salePrice === null || patch.salePrice === undefined ? null : Number(patch.salePrice);
        const saleDate = patch.saleDate === "" || patch.saleDate === null || patch.saleDate === undefined ? null : patch.saleDate;
        const status = patch.status ?? (salePrice === null ? "库存中" : "已售出");

        if (isContract) {
          const { error } = await updateContractById(rawId, {
            ...(patch.name !== undefined ? { output_name: patch.name } : {}),
            ...(patch.date !== undefined ? { date: patch.date } : {}),
            ...(patch.cost !== undefined ? { ref_price: patch.cost === "" || patch.cost === null || patch.cost === undefined ? null : Number(patch.cost) } : {}),
            ...(patch.wearLevel !== undefined ? { output_wear_level: patch.wearLevel } : {}),
            ...(patch.wearRange !== undefined ? { output_wear_range: patch.wearRange } : {}),
            ...(patch.salePrice !== undefined ? { sale_price: salePrice } : {}),
            ...(patch.status !== undefined || patch.salePrice !== undefined ? { status } : {}),
            ...(patch.saleDate !== undefined || patch.salePrice !== undefined ? { sale_date: saleDate } : {}),
          });
          return { rowKey, patch, isContract: true, error };
        }

        const { error } = await updateMaterialById(rawId, {
          ...(patch.platform !== undefined ? { platform: patch.platform } : {}),
          ...(patch.date !== undefined ? { date: patch.date } : {}),
          ...(patch.cost !== undefined ? { cost: patch.cost === "" || patch.cost === null || patch.cost === undefined ? null : Number(patch.cost) } : {}),
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.wearLevel !== undefined ? { wear_level: patch.wearLevel } : {}),
          ...(patch.wearRange !== undefined ? { wear_range: patch.wearRange } : {}),
          ...(patch.salePrice !== undefined ? { sale_price: salePrice } : {}),
          ...(patch.status !== undefined || patch.salePrice !== undefined ? { status } : {}),
          ...(patch.saleDate !== undefined || patch.salePrice !== undefined ? { sale_date: saleDate } : {}),
        });
        return { rowKey, patch, isContract: false, error };
      }));

      const failedUpdate = updateResults.find((result) => result.error);
      if (failedUpdate) {
        showToast(`${failedUpdate.isContract ? "更新汰换产物失败" : "更新材料失败"}：${failedUpdate.error.message}`, "error");
        return;
      }

      setInventoryEdits({});
      setEditMode(false);
      setSelectedIds([]);
      showToast("库存编辑已保存");
    } catch (err) {
      console.error("saveInventoryEdits 崩了", err);
      showToast("保存库存编辑时发生异常", "error");
    } finally {
      setIsSavingInventoryEdits(false);
    }
  }

  const toggleStatsVisibility = (key) => setVisibleStatMap((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleSelectRow = (id, checked) => setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  const selectAllVisible = () => setSelectedIds(visibleInventory.map((item) => item.id));
  const clearSelected = () => setSelectedIds([]);

  const deleteSelected = async () => {
    if (isDeletingSelected) return;
    if (isReadonlyMode) {
      showToast("会员已过期，当前为只读模式", "error");
      return;
    }
    if (!selectedIds.length) return;
    if (!window.confirm("删除不可再恢复，是否确认删除？")) return;

    setIsDeletingSelected(true);
    try {
      const materialIds = selectedIds.filter((id) => id.startsWith("material-")).map((id) => Number(id.replace("material-", "")));
      const contractIds = selectedIds.filter((id) => id.startsWith("contract-")).map((id) => Number(id.replace("contract-", "")));

      if (materialIds.length) {
        const { error } = await deleteMaterialsByIds(materialIds);
        if (error) {
          showToast(`删除材料失败：${error.message}`, "error");
          return;
        }
      }

      if (contractIds.length) {
        const { error } = await deleteContractsByIds(contractIds);
        if (error) {
          showToast(`删除汰换记录失败：${error.message}`, "error");
          return;
        }
      }

      if (materialIds.length) setMaterials((prev) => prev.filter((item) => !materialIds.includes(Number(item.id))));
      if (contractIds.length) setContracts((prev) => prev.filter((item) => !contractIds.includes(Number(item.id))));

      setSelectedIds([]);
      showToast("删除成功");
    } finally {
      setIsDeletingSelected(false);
    }
  };

  function updateExchangeField(item: any, field: string, value: any) {
    const id = item.id;
    const patch: any = { [field]: value };

    setContracts((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row };

        if (field === "date") next.date = value;
        if (field === "type") next.type = value;
        if (field === "contractName") {
          next.contractName = value;
          next.contract_name = value;
        }
        if (field === "outputName") {
          next.outputName = value;
          next.output_name = value;
        }
        if (field === "outputWearLevel") {
          next.outputWearLevel = value;
          next.output_wear_level = value;
        }
        if (field === "outputWearRange") {
          next.outputWearRange = value;
          next.output_wear_range = value;
        }
        if (field === "result") {
          next.result = value;

          if (value === "未开炉") {
            next.status = "未开炉";
            next.furnaceRate = 0;
            next.furnace_rate = 0;
            next.furnaceFee = 0;
            next.furnace_fee = 0;
            next.salePrice = "";
            next.sale_price = null;
            next.saleDate = "";
            next.sale_date = null;
          } else if (value === "成功") {
            const type = next.type ?? item.type ?? "ECO合炉";
            const refPrice = next.refPrice ?? next.ref_price ?? item.refPrice ?? item.ref_price ?? 0;
            const autoRate = getAutoFurnaceRate("成功", type);
            const autoFee = computeAutoFurnaceFee(refPrice, "成功", type);
            const currentSalePrice = next.salePrice ?? next.sale_price;

            next.furnaceRate = autoRate;
            next.furnace_rate = autoRate;
            next.furnaceFee = autoFee;
            next.furnace_fee = autoFee;
            next.status = currentSalePrice === "" || currentSalePrice === null || currentSalePrice === undefined ? "库存中" : "已售出";
          } else {
            const currentSalePrice = next.salePrice ?? next.sale_price;
            next.furnaceRate = 0;
            next.furnace_rate = 0;
            next.furnaceFee = 0;
            next.furnace_fee = 0;
            next.status = currentSalePrice === "" || currentSalePrice === null || currentSalePrice === undefined ? "库存中" : "已售出";
          }
        }
        if (field === "refPrice") {
          next.refPrice = value;
          next.ref_price = value === "" ? null : Number(value);

          if (next.result === "成功") {
            const type = next.type ?? item.type ?? "ECO合炉";
            const autoRate = getAutoFurnaceRate("成功", type);
            const autoFee = computeAutoFurnaceFee(value, "成功", type);
            next.furnaceRate = autoRate;
            next.furnace_rate = autoRate;
            next.furnaceFee = autoFee;
            next.furnace_fee = autoFee;
          }
        }
        if (field === "type") {
          next.type = value;

          if (next.result === "成功") {
            const refPrice = next.refPrice ?? next.ref_price ?? item.refPrice ?? item.ref_price ?? 0;
            const autoRate = getAutoFurnaceRate("成功", value);
            const autoFee = computeAutoFurnaceFee(refPrice, "成功", value);
            next.furnaceRate = autoRate;
            next.furnace_rate = autoRate;
            next.furnaceFee = autoFee;
            next.furnace_fee = autoFee;
          }
        }
        if (field === "furnaceFee") {
          next.furnaceFee = value;
          next.furnace_fee = value === "" ? null : Number(value);
        }
        if (field === "salePrice") {
          const salePrice = value === "" || value === null || value === undefined ? null : Number(value);
          next.salePrice = value;
          next.sale_price = salePrice;
          next.status = salePrice === null ? "库存中" : "已售出";
          patch.status = next.status;
          if (salePrice !== null && !(next.saleDate ?? next.sale_date)) {
            next.saleDate = next.date;
            next.sale_date = next.date;
            patch.saleDate = next.date;
          }
        }
        if (field === "saleDate") {
          next.saleDate = value;
          next.sale_date = value || null;
        }
        if (field === "status") next.status = value;

        return next;
      })
    );

    setExchangeEdits((prev) => {
      const existingPatch = prev[id] || {};
      const nextPatch = { ...patch };
      const nextType = field === "type" ? value : existingPatch.type ?? item.type ?? "ECO合炉";
      const nextResult = field === "result" ? value : existingPatch.result ?? item.result;
      const nextRefPrice = field === "refPrice" ? value : existingPatch.refPrice ?? item.refPrice ?? item.ref_price ?? 0;

      if (field === "result" && value === "未开炉") {
        nextPatch.status = "未开炉";
        nextPatch.furnaceRate = 0;
        nextPatch.furnaceFee = 0;
        nextPatch.salePrice = "";
        nextPatch.saleDate = "";
      }

      if (nextResult === "成功" && ["result", "refPrice", "type"].includes(field)) {
        const autoRate = getAutoFurnaceRate("成功", nextType);
        const autoFee = computeAutoFurnaceFee(nextRefPrice, "成功", nextType);
        const salePrice = existingPatch.salePrice ?? item.salePrice ?? item.sale_price;
        nextPatch.furnaceRate = autoRate;
        nextPatch.furnaceFee = autoFee;
        nextPatch.status = salePrice === "" || salePrice === null || salePrice === undefined ? "库存中" : "已售出";
      }

      if (field === "result" && value === "失败") {
        const salePrice = existingPatch.salePrice ?? item.salePrice ?? item.sale_price;
        nextPatch.furnaceRate = 0;
        nextPatch.furnaceFee = 0;
        nextPatch.status = salePrice === "" || salePrice === null || salePrice === undefined ? "库存中" : "已售出";
      }

      return {
        ...prev,
        [id]: {
          ...existingPatch,
          ...nextPatch,
        },
      };
    });
  }

  async function saveExchangeEdits() {
    if (isSavingExchangeEdits) return;
    if (isReadonlyMode) {
      showToast("会员已过期，当前为只读模式", "error");
      return;
    }

    const entries = Object.entries(exchangeEdits || {});
    if (!entries.length) {
      showToast("没有需要保存的改动");
      setExchangeEditMode(false);
      return;
    }

    setIsSavingExchangeEdits(true);
    try {
      const results = await Promise.all(
        entries.map(async ([id, patch]: any) => {
          const payload: any = {};
          if (patch.date !== undefined) payload.date = patch.date;
          if (patch.type !== undefined) payload.type = patch.type;
          if (patch.contractName !== undefined) payload.contract_name = patch.contractName;
          if (patch.outputName !== undefined) payload.output_name = patch.outputName;
          if (patch.outputWearLevel !== undefined) payload.output_wear_level = patch.outputWearLevel;
          if (patch.outputWearRange !== undefined) payload.output_wear_range = patch.outputWearRange;
          if (patch.result !== undefined) payload.result = patch.result;
          if (patch.refPrice !== undefined) payload.ref_price = patch.refPrice === "" || patch.refPrice === null || patch.refPrice === undefined ? null : Number(patch.refPrice);
          if (patch.furnaceRate !== undefined) payload.furnace_rate = patch.furnaceRate === "" || patch.furnaceRate === null || patch.furnaceRate === undefined ? 0 : Number(patch.furnaceRate);
          if (patch.furnaceFee !== undefined) payload.furnace_fee = patch.furnaceFee === "" || patch.furnaceFee === null || patch.furnaceFee === undefined ? null : Number(patch.furnaceFee);
          if (patch.salePrice !== undefined) {
            const salePrice = patch.salePrice === "" || patch.salePrice === null || patch.salePrice === undefined ? null : Number(patch.salePrice);
            payload.sale_price = salePrice;
            payload.status = salePrice === null ? "库存中" : "已售出";
          }
          if (patch.saleDate !== undefined) payload.sale_date = patch.saleDate || null;
          if (patch.status !== undefined) payload.status = patch.status;

          const { error } = await updateContractById(Number(id), payload);
          return { id, error };
        })
      );

      const failed = results.find((item) => item.error);
      if (failed) {
        showToast(`保存汰换记录失败：${failed.error.message}`, "error");
        return;
      }

      setExchangeEdits({});
      setExchangeEditMode(false);
      showToast("汰换记录已保存");
    } finally {
      setIsSavingExchangeEdits(false);
    }
  }

  function toggleExpandedContract(id) {
    setExpandedContractIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fff1f6] via-[#fff7fb] to-[#ffe4ef]">
        <div className="rounded-[32px] border border-white/80 bg-[#fff7fb]/80 px-8 py-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e11d48] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-lg font-bold text-[#3b1824]">正在进入日进斗金</div>
          <div className="mt-1 text-sm text-[#7c3a52]">加载账户与交易数据...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#ffe4ef_0%,#fff7fb_34%,#fff1f6_68%,#fdf2f8_100%)] p-3 text-[#3b1824] sm:p-6">
      <FloatingHearts />
      <Toast toast={toast} />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] space-y-5">
        {isReadonlyMode && (
          <div className="flex items-start gap-3 rounded-[24px] border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>当前会员已过期，系统已进入只读模式。你仍可查看数据，但无法新增或编辑。购买激活码请联系作者：QQ 2647060757。</div>
          </div>
        )}

        <HeaderPanel
          currentUser={currentUser}
          membershipInfo={membershipInfo}
          remainingDays={remainingDays}
          totalProfit={stats.totalProfit}
          hidden={!visibleStatMap.totalProfit}
          onToggleTotal={() => toggleStatsVisibility("totalProfit")}
          showUserPanel={showUserPanel}
          setShowUserPanel={setShowUserPanel}
          handleLogout={handleLogout}
        />

        {showUserPanel && (
          <UserPanel
            membershipInfo={membershipInfo}
            currentUser={currentUser}
            remainingDays={remainingDays}
            usernameInput={usernameInput}
            setUsernameInput={setUsernameInput}
            isSavingUsername={isSavingUsername}
            handleUpdateUsername={handleUpdateUsername}
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmNewPassword={confirmNewPassword}
            setConfirmNewPassword={setConfirmNewPassword}
            activationCodeInput={activationCodeInput}
            setActivationCodeInput={setActivationCodeInput}
            handleChangePassword={handleChangePassword}
            redeemActivationCode={redeemActivationCode}
          />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <StatCard tone="emerald" title="材料毛利" value={money(stats.materialProfit)} hidden={!visibleStatMap.materialProfit} icon={<Wallet className="h-7 w-7" />} onToggle={() => toggleStatsVisibility("materialProfit")} />
          <StatCard tone="green" title="产物利润" value={money(stats.productProfit)} hidden={!visibleStatMap.productProfit} icon={<TrendingUp className="h-7 w-7" />} onToggle={() => toggleStatsVisibility("productProfit")} />
          <StatCard tone="indigo" title="开炉费" value={money(stats.furnaceIncome)} hidden={!visibleStatMap.furnaceIncome} icon={<Layers3 className="h-7 w-7" />} onToggle={() => toggleStatsVisibility("furnaceIncome")} />
          <StatCard tone="sky" title="库存数量" value={String(stats.stockCount)} hidden={!visibleStatMap.stockCount} icon={<Boxes className="h-7 w-7" />} onToggle={() => toggleStatsVisibility("stockCount")} />
          <StatCard tone="amber" title="库存成本" value={money(stats.stockCost)} hidden={!visibleStatMap.stockCost} icon={<PackageCheck className="h-7 w-7" />} onToggle={() => toggleStatsVisibility("stockCost")} />
          <StatCard tone="slate" title="其他收益" value={money(stats.totalExtraIncome)} hidden={!visibleStatMap.extraIncome} icon={<CircleDollarSign className="h-7 w-7" />} onToggle={() => toggleStatsVisibility("extraIncome")} />
        </div>

        <Tabs
          defaultValue="materials"
          className="space-y-5"
          onValueChange={() => {
            setEditMode(false);
            setSelectedIds([]);
            setShowAllEcoMaterials(false);
            setShowAllPackageMaterials(false);
          }}
        >
          <div className="pointer-events-none absolute -right-2 -top-3 z-20 hidden rotate-6 rounded-full border border-[#ffc7d9] bg-white/80 px-3 py-1 text-[11px] font-black tracking-[0.12em] text-[#ff5c93] shadow-[0_10px_24px_rgba(225,29,72,0.12)] backdrop-blur-md sm:block">
            520限定
          </div>
          <TabsList className="relative !grid !h-auto !min-h-[136px] w-full !grid-cols-2 items-stretch gap-2 overflow-visible rounded-[30px] border border-[#f9bfd1] bg-white p-2 shadow-[0_8px_30px_rgba(15,23,42,0.06)] sm:!min-h-[72px] sm:!grid-cols-4 sm:items-center">
            <NavTab value="materials" icon={<Plus className="h-4 w-4" />} label="进货" sub="材料登记" />
            <NavTab value="inventory" icon={<Boxes className="h-4 w-4" />} label="库存" sub="管理与出售" />

            <NavTab value="exchange" icon={<Layers3 className="h-4 w-4" />} label="合成" sub="汰换记录" />
            <NavTab value="daily" icon={<LayoutDashboard className="h-4 w-4" />} label="统计" sub="每日收益" />
          </TabsList>

          <TabsContent value="materials" className="space-y-5">
            <div className="space-y-5">
              <Panel title="新增材料" desc="批量登记进价，系统自动进入库存。" icon={<Plus className="h-5 w-5" />}>
                <div className="space-y-4">
                  <SectionTitle title="基础信息" />
                  <FieldDate label="日期" value={materialForm.date} onChange={(value) => setMaterialForm({ ...materialForm, date: value })} />
                  <SelectField label="平台" value={materialForm.platform} options={platformOptions} onChange={(value) => setMaterialForm({ ...materialForm, platform: value })} />
                  <TextFieldWithSuggest label="材料名称" placeholder="例如：AK-47 | 红线" value={materialForm.name} onChange={(value) => setMaterialForm({ ...materialForm, name: value })} suggestions={materialNameSuggestions} onPick={(name) => setMaterialForm({ ...materialForm, name })} />

                  <SectionTitle title="磨损信息" />
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="磨损等级" value={materialForm.wearLevel} options={wearLevelOptions} onChange={(value) => setMaterialForm({ ...materialForm, wearLevel: value, wearRange: wearRanges[value][0], customWear: "" })} />
                    <SelectField label="磨损区间" value={materialForm.wearRange} options={currentWearRanges} onChange={(value) => setMaterialForm({ ...materialForm, wearRange: value, customWear: value === "自定义" ? materialForm.customWear : "" })} />
                  </div>
                  {materialForm.wearRange === "自定义" && <TextField label="自定义磨损 / 区间" placeholder="例如：0.163 或 0.15 - 0.17" value={materialForm.customWear} onChange={(value) => setMaterialForm({ ...materialForm, customWear: value })} />}

                  <SectionTitle title="批量进价" />
                  <div className="space-y-2 rounded-[24px] border border-[#f9bfd1] bg-[#fff7fb]/70 p-3">
                    {batchPrices.map((price, index) => (
                      <Input
                        key={index}
                        ref={(el) => {
                          batchInputRefs.current[index] = el;
                        }}
                        type="number"
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder={`第 ${index + 1} 个进价`}
                        value={price}
                        onChange={(e) => {
                          updateBatchPrice(index, e.target.value);
                          if (index === batchPrices.length - 1 && e.target.value.trim() !== "") addBatchPriceField();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (index === batchPrices.length - 1) {
                              addBatchPriceField();
                              setTimeout(() => batchInputRefs.current[index + 1]?.focus(), 0);
                            } else batchInputRefs.current[index + 1]?.focus();
                          }
                        }}
                        className="h-11 rounded-2xl border-[#f9bfd1] bg-white"
                      />
                    ))}
                  </div>
                  <Button onClick={addBatchMaterials} disabled={isAddingMaterials} className="h-12 w-full rounded-2xl bg-[#e11d48] font-bold shadow-lg shadow-slate-900/10 hover:bg-[#be123c]">
                    <Plus className="mr-2 h-4 w-4" />
                    {isAddingMaterials ? "添加中..." : "完成添加"}
                  </Button>
                </div>
              </Panel>

              <Panel title="材料记录" desc={`共 ${filteredMaterials.length} 条材料记录`} icon={<PackageCheck className="h-5 w-5" />} action={filteredMaterials.length > 10 ? <SoftButton onClick={() => setShowAllMaterials((prev) => !prev)}>{showAllMaterials ? "收起 ↑" : "查看全部 ↓"}</SoftButton> : null}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a35a73]" />
                    <Input className="h-11 rounded-2xl bg-white pl-9" placeholder="搜索材料 / 平台 / 状态" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                  </div>
                </div>
                <ResponsiveTable>
                  <Table className="w-full min-w-[1180px] table-fixed xl:min-w-0">
                    <TableHeader className="sticky top-0 z-10 bg-white">
                      <TableRow>
                        <TableHead className="w-[120px] pl-6">日期</TableHead><TableHead className="w-[78px]">平台</TableHead><TableHead className="w-[170px]">材料</TableHead><TableHead className="w-[120px]">磨损等级</TableHead><TableHead className="w-[120px]">磨损区间</TableHead><TableHead className="w-[120px] pr-6"><div className="flex w-full justify-end">进价</div></TableHead><TableHead className="w-[100px] pr-4"><div className="flex w-full justify-end">售价</div></TableHead><TableHead className="w-[120px] pr-6"><div className="flex w-full justify-end">毛利</div></TableHead><TableHead className="w-[100px] text-center">状态</TableHead>
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
                          <TableRow key={item.id} className="h-14 transition-colors hover:bg-[#fff7fb]/80">
                            <TableCell className="pl-6">{item.date}</TableCell>
                            <TableCell><PlatformBadge platform={item.platform} /></TableCell>
                            <TableCell className="truncate"><div className="truncate font-semibold text-[#3b1824]">{item.name}</div><div className="text-xs text-[#a35a73]">{item.mode === "batch" ? "批量新增" : "单条新增"}</div></TableCell>
                            <TableCell>{wearLevel}</TableCell>
                            <TableCell>{wearRange === "自定义" ? customWear || "自定义" : wearRange}</TableCell>
                            <TableCell className="pr-6">
                              {isRowEditable(item.id) ? (
                                <Input className="ml-auto h-10 w-[120px] rounded-xl bg-white text-right tabular-nums" type="number" value={item.cost ?? ""} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => updateInventoryField(item, "cost", e.target.value)} />
                              ) : (
                                <div className="flex w-full justify-end whitespace-nowrap tabular-nums">{money(item.cost)}</div>
                              )}
                            </TableCell>
                            <TableCell className="pr-6"><div className="flex w-full justify-end whitespace-nowrap tabular-nums">{salePrice ? money(salePrice) : "-"}</div></TableCell>
                            <TableCell className="pr-6"><div className={cx("flex w-full justify-end whitespace-nowrap tabular-nums font-black", profit > 0 ? "text-[#10b981]" : profit < 0 ? "text-rose-600" : "text-[#3b1824]")}>{money(profit)}</div></TableCell>
                            <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </Panel>
            </div>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-5">
            <Panel
              title="库存管理"
              desc="筛选、出售、批量编辑库存与汰换产物。"
              icon={<Boxes className="h-5 w-5" />}
              action={
                !editMode ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {filteredInventory.length > 20 && <SoftButton onClick={() => setShowAllInventory((prev) => !prev)}>{showAllInventory ? "收起 ↑" : "查看全部 ↓"}</SoftButton>}
                    <button
                      type="button"
                      onClick={() => { if (isReadonlyMode) { showToast("会员已过期，当前为只读模式", "error"); return; } setEditMode(true); setSelectedIds([]); setInventoryEdits({}); }}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#fbcfe8] bg-[#fdf2f8] px-5 text-sm font-bold text-[#db2777] shadow-sm transition hover:bg-[#fce7f3]"
                    >
                      <Pencil className="h-4 w-4" /> 编辑模式
                    </button>
                  </div>
                ) : null
              }
            >
              <FilterBar>
                <FieldDate label="日期" value={inventoryFilters.date} onChange={(value) => setInventoryFilters({ ...inventoryFilters, date: value })} />
                <TextField label="名称" placeholder="搜索名称关键词" value={inventoryNameInput} onChange={setInventoryNameInput} />
                <SelectField label="平台" value={inventoryFilters.platform} options={["全部", ...inventoryPlatformOptions]} onChange={(value) => setInventoryFilters({ ...inventoryFilters, platform: value })} />
                <SelectField label="磨损等级" value={inventoryFilters.wearLevel} options={["全部", ...wearLevelOptions]} onChange={(value) => setInventoryFilters({ ...inventoryFilters, wearLevel: value })} />
                <SelectField label="库存状态" value={inventoryFilters.status} options={["全部", "库存中", "已售出", "未开炉"]} onChange={(value) => setInventoryFilters({ ...inventoryFilters, status: value })} />
              </FilterBar>

              {filteredInventory.length > 20 && !showAllInventory && <Hint>当前只展示前 20 条数据。可点击“查看全部”，或先筛选后再编辑。</Hint>}

              {editMode && (
                <div className="mb-4 rounded-[24px] border border-[#f9bfd1] bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3 text-sm text-[#8b3a57]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e11d48] text-white">
                        <Pencil className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-black text-[#3b1824]">编辑模式</div>
                        <div className="text-xs text-[#7c3a52]">
                          已选 {selectedRows.length} 项 ｜ 求和 {money(selectedSum)} ｜ 平均 {money(selectedAvg)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {filteredInventory.length > 20 && (
                        <SoftButton onClick={() => setShowAllInventory((prev) => !prev)}>
                          {showAllInventory ? "收起 ↑" : "查看全部 ↓"}
                        </SoftButton>
                      )}
                      <SoftButton onClick={selectAllVisible}>全选</SoftButton>
                      <SoftButton onClick={clearSelected}>全不选</SoftButton>
                      <Button type="button" variant="destructive" className="h-11 rounded-2xl" disabled={isDeletingSelected} onClick={deleteSelected}>
                        <Trash2 className="mr-2 h-4 w-4" />{isDeletingSelected ? "删除中..." : "删除"}
                      </Button>
                      <Button type="button" className="h-11 rounded-2xl bg-[#e11d48]" disabled={isSavingInventoryEdits} onClick={saveInventoryEdits}>
                        {isSavingInventoryEdits ? "保存中..." : "完成编辑"}
                      </Button>
                      <SoftButton onClick={() => { setEditMode(false); setSelectedIds([]); setInventoryEdits({}); }}>
                        取消
                      </SoftButton>
                    </div>
                  </div>
                </div>
              )}

              <ResponsiveTable maxHeight="640px">
                <Table className="w-full min-w-[1180px] table-fixed xl:min-w-0">
                  <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow>
                      {editMode && <TableHead className="w-[56px] text-center">选择</TableHead>}
                      <TableHead className="w-[96px] pl-4">日期</TableHead><TableHead className="w-[78px]">平台</TableHead><TableHead className="w-[150px]">名称</TableHead><TableHead className="w-[120px]">磨损等级</TableHead><TableHead className="w-[120px]">磨损区间</TableHead><TableHead className="w-[115px] pr-4"><div className="flex w-full justify-end">参考价/成本</div></TableHead><TableHead className="w-[100px] pr-4"><div className="flex w-full justify-end">售价</div></TableHead><TableHead className="w-[86px] text-center">状态</TableHead><TableHead className="w-[120px] text-center">出售日期</TableHead><TableHead className="w-[100px] pr-4"><div className="flex w-full justify-end">利润</div></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleInventory.map((item) => (
                      <TableRow
                        key={item.id}
                        onClick={(e) => {
                          if (!editMode) return;
                          const target = e.target as HTMLElement;
                          if (target.closest('input, button, a, textarea, select, [role="combobox"], [role="option"]')) return;
                          toggleSelectRow(item.id, !selectedIds.includes(item.id));
                        }}
                        className={cx(
                          "transition-colors hover:bg-[#fff7fb] [&>td]:whitespace-nowrap [&>td]:px-2 [&>td]:py-2 [&>td]:text-sm",
                          editMode && "cursor-pointer",
                          selectedIds.includes(item.id) && "bg-indigo-50/70 hover:bg-indigo-50"
                        )}
                      > 
                        {editMode && <TableCell className="text-center align-middle"><input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={selectedIds.includes(item.id)} onChange={(e) => toggleSelectRow(item.id, e.target.checked)} /></TableCell>}
                        <TableCell className="pl-6 pr-4 align-middle">{formatInventoryDate(item.date, Boolean(inventoryFilters.date))}</TableCell>
                        <TableCell className="px-3 align-middle">{isRowEditable(item.id) && !item.isContract ? <Select value={item.platform} onValueChange={(value) => updateInventoryField(item, "platform", value)}><SelectTrigger className="h-9 w-[76px] rounded-xl bg-white text-sm"><SelectValue /></SelectTrigger><SelectContent>{platformOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select> : <PlatformBadge platform={item.platform} />}</TableCell>
                        <TableCell className="px-3 align-middle">{isRowEditable(item.id) ? <Input className="h-9 w-[138px] rounded-xl bg-white px-2 text-sm" value={item.name} onChange={(e) => updateInventoryField(item, "name", e.target.value)} /> : <span className="font-medium">{item.name}</span>}</TableCell>
                        <TableCell>{isRowEditable(item.id) ? <Select value={item.wearLevel} onValueChange={(value) => updateInventoryField(item, "wearLevel", value)}><SelectTrigger className="h-9 w-[108px] rounded-xl bg-white text-sm"><SelectValue /></SelectTrigger><SelectContent>{(item.wearLevel === "待定" ? ["待定", ...wearLevelOptions] : wearLevelOptions).map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select> : item.wearLevel}</TableCell>
                        <TableCell>{isRowEditable(item.id) ? <Select value={item.wearRange} onValueChange={(value) => updateInventoryField(item, "wearRange", value)}><SelectTrigger className="h-9 w-[112px] rounded-xl bg-white text-sm"><SelectValue /></SelectTrigger><SelectContent>{(item.wearLevel === "待定" ? ["待定"] : (wearRanges[item.wearLevel] || [item.wearRange])).map((range) => <SelectItem key={range} value={range}>{range}</SelectItem>)}</SelectContent></Select> : item.wearRange}</TableCell>
                        <TableCell className="pr-6"><div className="flex w-full justify-end whitespace-nowrap tabular-nums">{money(item.cost)}</div></TableCell>
                        <TableCell className="pr-6">
                          {isRowEditable(item.id) ? (
                            <Input className="ml-auto h-10 w-[120px] rounded-xl bg-white text-right tabular-nums" type="number" value={item.salePrice ?? item.sale_price ?? ""} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => updateInventoryField(item, "salePrice", e.target.value)} />
                          ) : (
                            <div className="flex w-full justify-end whitespace-nowrap tabular-nums">{item.salePrice === "" || item.salePrice === null || item.salePrice === undefined ? "-" : money(item.salePrice)}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                        <TableCell className="text-center">{isRowEditable(item.id) ? <Input className="mx-auto h-10 w-[130px] rounded-xl bg-white text-center" type="date" value={item.saleDate ?? item.sale_date ?? ""} onChange={(e) => updateInventoryField(item, "saleDate", e.target.value)} /> : item.saleDate ?? item.sale_date ?? "-"}</TableCell>
                        <TableCell className="pr-6"><div className={cx("flex w-full justify-end whitespace-nowrap tabular-nums font-black", Number(item.profit || 0) > 0 ? "text-[#10b981]" : Number(item.profit || 0) < 0 ? "text-[#ef4444]" : "text-[#8b3a57]")}>{item.profit === "" || item.profit === null || item.profit === undefined ? "-" : money(item.profit)}</div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </Panel>
          </TabsContent>

          <TabsContent value="exchange" className="space-y-5">
            <div className="space-y-5">
              <Panel title="合炉录入" desc="记录 ECO 合炉或包炉结果。" icon={<Layers3 className="h-5 w-5" />}>
                <div className="mb-5 grid grid-cols-2 gap-2 rounded-[26px] border border-[#f9bfd1] bg-white p-2 shadow-sm">
                  <button
                    type="button"
                    className={cx(
                      "h-12 rounded-2xl text-sm font-black transition-all",
                      exchangeMode === "ECO合炉"
                        ? "bg-[#e11d48] text-white shadow-sm"
                        : "bg-white text-[#8b3a57] hover:bg-[#fff0f5]"
                    )}
                    onClick={() => {
                      setShowAllEcoMaterials(false);
                      setExchangeMode("ECO合炉");
                    }}
                  >
                    ECO合炉
                  </button>
                  <button
                    type="button"
                    className={cx(
                      "h-12 rounded-2xl text-sm font-black transition-all",
                      exchangeMode === "包炉"
                        ? "bg-[#e11d48] text-white shadow-sm"
                        : "bg-white text-[#8b3a57] hover:bg-[#fff0f5]"
                    )}
                    onClick={() => {
                      setShowAllPackageMaterials(false);
                      setExchangeMode("包炉");
                    }}
                  >
                    包炉
                  </button>
                </div>

                {exchangeMode === "ECO合炉" ? (
                  <div className="space-y-5">
                    <div className="overflow-hidden rounded-[26px] border border-[#f9bfd1] bg-white p-4 shadow-sm">
                      <SectionTitle title="合同信息" />
                      <div className="mt-3 grid min-w-0 grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4 [&>div]:w-full [&>div]:max-w-full [&>div]:min-w-0 [&_input]:box-border [&_input]:h-11 [&_input]:w-full [&_input]:max-w-full [&_input]:min-w-0 [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:w-full [&_button[role=combobox]]:max-w-full [&_button[role=combobox]]:min-w-0">
                        <FieldDate label="日期" value={contractForm.date} onChange={(value) => setContractForm({ ...contractForm, date: value })} />
                        <TextField label="汰换合同名称" placeholder="例如：FN 红线合同" value={contractForm.contractName} onChange={(value) => setContractForm({ ...contractForm, contractName: value })} />
                        <TextField label="产物名称" placeholder="例如：AK-47 | 火蛇" value={contractForm.outputName} onChange={(value) => setContractForm({ ...contractForm, outputName: value })} />
                        <NumberField label="产物参考价" placeholder="520" value={contractForm.refPrice} onChange={(value) => setContractForm({ ...contractForm, refPrice: value })} />
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[26px] border border-[#f9bfd1] bg-white p-4 shadow-sm">
                      <SectionTitle title="产物信息" />
                      <div className="mt-3 grid min-w-0 grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4 [&>div]:w-full [&>div]:max-w-full [&>div]:min-w-0 [&_input]:box-border [&_input]:h-11 [&_input]:w-full [&_input]:max-w-full [&_input]:min-w-0 [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:w-full [&_button[role=combobox]]:max-w-full [&_button[role=combobox]]:min-w-0">
                        <SelectField label="汰换结果" value={contractForm.result} options={["成功", "失败", "未开炉"]} onChange={syncContractResult} tone={contractForm.result === "成功" ? "success" : contractForm.result === "未开炉" ? "warning" : "danger"} />
                        <NumberField label="开炉费比例" value={contractForm.result === "成功" ? contractForm.furnaceRatePercent : "0"} onChange={(value) => setContractForm({ ...contractForm, furnaceRatePercent: value })} disabled={contractForm.result !== "成功"} />
                        <SelectField label="产物磨损等级" value={contractForm.outputWearLevel} options={contractForm.outputWearLevel === "待定" ? ["待定", ...wearLevelOptions] : wearLevelOptions} onChange={(value) => setContractForm({ ...contractForm, outputWearLevel: value, outputWearRange: value === "待定" ? "待定" : wearRanges[value][0], outputCustomWear: "" })} placeholder="未开炉可不填" />
                        <SelectField label="产物磨损区间" value={contractForm.outputWearRange} options={contractForm.outputWearLevel === "待定" ? ["待定"] : currentContractWearRanges} onChange={(value) => setContractForm({ ...contractForm, outputWearRange: value, outputCustomWear: value === "自定义" ? contractForm.outputCustomWear : "" })} placeholder="未开炉可不填" />
                      </div>
                      {contractForm.outputWearRange === "自定义" && (
                        <div className="mt-3">
                          <TextField label="自定义产物磨损 / 区间" placeholder="例如：0.163 或 0.15 - 0.17" value={contractForm.outputCustomWear} onChange={(value) => setContractForm({ ...contractForm, outputCustomWear: value })} />
                        </div>
                      )}
                    </div>

                    <MaterialPicker
                      title="ECO 合炉选材"
                      filters={ecoFilters}
                      setFilters={setEcoFilters}
                      nameInput={ecoNameInput}
                      setNameInput={setEcoNameInput}
                      selectedCount={contractForm.selectedIds.length}
                      hint="最多 10 个材料"
                      shouldShow={shouldShowEcoMaterialList}
                      items={filteredEcoMaterials}
                      selectedIds={contractForm.selectedIds}
                      onToggle={toggleEcoMaterial}
                      onClear={clearEcoMaterials}
                      materialSalePrices={contractForm.materialSalePrices}
                      onSalePriceChange={updateEcoMaterialSalePrice}
                      mode="eco"
                    />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 [&>div]:w-full [&>div]:min-w-0">
                      <InfoBox label="材料成本" value={money(ecoCost)} />
                      <InfoBox label="材料利润" value={money(ecoProfit)} valueClass={ecoProfit >= 0 ? "text-[#10b981]" : "text-[#ef4444]"} />
                      <InfoBox label="开炉费收入" value={money(computeFurnaceFee(Number(contractForm.refPrice || 0), contractForm.result, contractForm.furnaceRatePercent))} />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-end [&>div]:w-full [&>div]:min-w-0">
                      <NumberField label="产物售价（可后补）" placeholder="548" value={contractForm.salePrice} onChange={(value) => setContractForm({ ...contractForm, salePrice: value })} />
                      <Button onClick={addContract} disabled={isSavingEcoContract} className="h-12 rounded-2xl bg-[#e11d48] px-8 font-bold shadow-lg shadow-slate-900/10 hover:bg-[#be123c]">
                        {isSavingEcoContract ? "保存中..." : "保存 ECO 合炉记录"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="overflow-hidden rounded-[26px] border border-[#f9bfd1] bg-white p-4 shadow-sm">
                      <SectionTitle title="包炉信息" />
                      <div className="mt-3 grid min-w-0 grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4 [&>div]:w-full [&>div]:max-w-full [&>div]:min-w-0 [&_input]:box-border [&_input]:h-11 [&_input]:w-full [&_input]:max-w-full [&_input]:min-w-0 [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:w-full [&_button[role=combobox]]:max-w-full [&_button[role=combobox]]:min-w-0">
                        <FieldDate label="日期" value={packageForm.date} onChange={(value) => setPackageForm({ ...packageForm, date: value })} />
                        <TextField label="包炉名称" placeholder="例如：P250 包炉" value={packageForm.contractName} onChange={(value) => setPackageForm({ ...packageForm, contractName: value })} />
                        <TextField label="产物名称" placeholder="例如：AK-47 | 火蛇" value={packageForm.outputName} onChange={(value) => setPackageForm({ ...packageForm, outputName: value })} />
                        <SelectField label="包炉结果" value={packageForm.result} options={["成功", "失败", "未开炉"]} onChange={syncPackageResult} tone={packageForm.result === "成功" ? "success" : packageForm.result === "未开炉" ? "warning" : "danger"} />
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[26px] border border-[#f9bfd1] bg-white p-4 shadow-sm">
                      <SectionTitle title="产物信息" />
                      <div className="mt-3 grid min-w-0 grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4 [&>div]:w-full [&>div]:max-w-full [&>div]:min-w-0 [&_input]:box-border [&_input]:h-11 [&_input]:w-full [&_input]:max-w-full [&_input]:min-w-0 [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:w-full [&_button[role=combobox]]:max-w-full [&_button[role=combobox]]:min-w-0">
                        <InfoBox label="参考价" value={money(packageCost)} compact />
                        <SelectField label="产物磨损等级" value={packageForm.outputWearLevel} options={packageForm.outputWearLevel === "待定" ? ["待定", ...wearLevelOptions] : wearLevelOptions} onChange={(value) => setPackageForm({ ...packageForm, outputWearLevel: value, outputWearRange: value === "待定" ? "待定" : wearRanges[value][0], outputCustomWear: "" })} placeholder="未开炉可不填" />
                        <SelectField label="产物磨损区间" value={packageForm.outputWearRange} options={packageForm.outputWearLevel === "待定" ? ["待定"] : currentPackageWearRanges} onChange={(value) => setPackageForm({ ...packageForm, outputWearRange: value, outputCustomWear: value === "自定义" ? packageForm.outputCustomWear : "" })} placeholder="未开炉可不填" />
                        <NumberField label="产物售价（可后补）" placeholder="548" value={packageForm.salePrice} onChange={(value) => setPackageForm({ ...packageForm, salePrice: value })} />
                      </div>
                    </div>

                    <MaterialPicker
                      title="包炉选材"
                      filters={packageFilters}
                      setFilters={setPackageFilters}
                      nameInput={packageNameInput}
                      setNameInput={setPackageNameInput}
                      selectedCount={packageForm.selectedIds.length}
                      hint="只允许 5 个或 10 个"
                      shouldShow={shouldShowPackageMaterialList}
                      items={filteredPackageMaterials}
                      selectedIds={packageForm.selectedIds}
                      onToggle={togglePackageMaterial}
                      onClear={clearPackageMaterials}
                      mode="package"
                    />

                    <Button onClick={addPackageContract} disabled={isSavingPackageContract || !((packageForm.selectedIds.length === 5 || packageForm.selectedIds.length === 10) && (packageForm.result === "未开炉" || packageForm.outputName))} className="h-12 w-full rounded-2xl bg-[#e11d48] font-bold shadow-lg shadow-slate-900/10 hover:bg-[#be123c]">
                      {isSavingPackageContract ? "保存中..." : "保存包炉记录"}
                    </Button>
                  </div>
                )}
              </Panel>

              <Panel
                title="汰换记录"
                desc={`共 ${filteredExchangeContracts.length} 条记录，默认显示 20 条`}
                icon={<TrendingUp className="h-5 w-5" />}
                action={
                  <div className="flex flex-wrap justify-end gap-2">
                    {filteredExchangeContracts.length > 20 && (
                      <SoftButton onClick={() => setShowAllContracts((prev) => !prev)}>
                        {showAllContracts ? "收起 ↑" : "查看全部 ↓"}
                      </SoftButton>
                    )}
                    {!exchangeEditMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (isReadonlyMode) {
                            showToast("会员已过期，当前为只读模式", "error");
                            return;
                          }
                          setExchangeEditMode(true);
                          setExchangeEdits({});
                        }}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#fbcfe8] bg-[#fdf2f8] px-5 text-sm font-bold text-[#db2777] shadow-sm transition hover:bg-[#fce7f3]"
                      >
                        <Pencil className="h-4 w-4" />
                        编辑记录
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => { setExchangeEditMode(false); setExchangeEdits({}); }}
                          className="inline-flex h-11 items-center justify-center rounded-full border border-[#f9bfd1] bg-white px-5 text-sm font-bold text-[#8b3a57] shadow-sm transition hover:bg-[#fff7fb]"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          disabled={isSavingExchangeEdits}
                          onClick={saveExchangeEdits}
                          className="inline-flex h-11 items-center justify-center rounded-full border border-[#e11d48] bg-[#e11d48] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#be123c] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingExchangeEdits ? "保存中..." : "保存编辑"}
                        </button>
                      </>
                    )}
                  </div>
                }
              >
                <div className="mb-4 rounded-[26px] border border-[#f9bfd1] bg-white p-4 shadow-sm">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a35a73]" />
                    <Input
                      className="h-11 w-full rounded-2xl border-[#f9bfd1] bg-white pl-9 text-sm font-medium text-[#3b1824]"
                      placeholder="搜索日期 / 类型 / 合同 / 产物 / 磨损 / 结果 / 状态"
                      value={exchangeKeyword}
                      onChange={(e) => setExchangeKeyword(e.target.value)}
                    />
                  </div>
                </div>

                {exchangeEditMode && (
                  <Hint>正在编辑汰换记录。修改后请点击右上角“保存编辑”。</Hint>
                )}

                <ResponsiveTable maxHeight="680px">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-white">
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>合同名称</TableHead>
                        <TableHead>产物名称</TableHead>
                        <TableHead>磨损等级</TableHead>
                        <TableHead>磨损区间</TableHead>
                        <TableHead>结果</TableHead>
                        <TableHead>参考价</TableHead>
                        <TableHead>开炉费</TableHead>
                        <TableHead>售价</TableHead>
                        <TableHead>出售日期</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleExchangeContracts.map((item) => {
                        const contractName = item.contractName ?? item.contract_name;
                        const outputName = item.outputName ?? item.output_name;
                        const outputWearLevel = item.outputWearLevel ?? item.output_wear_level;
                        const outputWearRange = item.outputWearRange ?? item.output_wear_range;
                        const outputCustomWear = item.outputCustomWear ?? item.output_custom_wear;
                        const refPrice = item.refPrice ?? item.ref_price;
                        const furnaceFee = item.furnaceFee ?? item.furnace_fee;
                        const salePrice = item.salePrice ?? item.sale_price;
                        const saleDate = item.saleDate ?? item.sale_date ?? "";
                        const type = item.type ?? "ECO合炉";

                        return (
                          <React.Fragment key={item.id}>
                            <TableRow className="transition-colors hover:bg-[#fff7fb]/80">
                              <TableCell>{exchangeEditMode ? <Input className="w-[145px] rounded-xl bg-white" type="date" value={item.date ?? ""} onChange={(e) => updateExchangeField(item, "date", e.target.value)} /> : item.date}</TableCell>
                              <TableCell>{exchangeEditMode ? <Select value={type} onValueChange={(value) => updateExchangeField(item, "type", value)}><SelectTrigger className="h-9 w-[76px] rounded-xl bg-white text-sm"><SelectValue /></SelectTrigger><SelectContent>{["ECO合炉", "包炉", "普通汰换"].map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select> : type}</TableCell>
                              <TableCell>{exchangeEditMode ? <Input className="w-[150px] rounded-xl bg-white" value={contractName ?? ""} onChange={(e) => updateExchangeField(item, "contractName", e.target.value)} /> : <span className="font-medium">{contractName || "-"}</span>}</TableCell>
                              <TableCell>{exchangeEditMode ? <Input className="w-[170px] rounded-xl bg-white" value={outputName ?? ""} onChange={(e) => updateExchangeField(item, "outputName", e.target.value)} /> : <span className="font-medium">{outputName || "未开炉暂存"}</span>}</TableCell>
                              <TableCell>{exchangeEditMode ? <Select value={outputWearLevel} onValueChange={(value) => updateExchangeField(item, "outputWearLevel", value)}><SelectTrigger className="w-[140px] rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{(outputWearLevel === "待定" ? ["待定", ...wearLevelOptions] : wearLevelOptions).map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select> : outputWearLevel}</TableCell>
                              <TableCell>{exchangeEditMode ? <Select value={outputWearRange} onValueChange={(value) => updateExchangeField(item, "outputWearRange", value)}><SelectTrigger className="w-[150px] rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{(outputWearLevel === "待定" ? ["待定"] : (wearRanges[outputWearLevel] || [outputWearRange])).map((range) => <SelectItem key={range} value={range}>{range}</SelectItem>)}</SelectContent></Select> : outputWearRange === "自定义" ? outputCustomWear || "自定义" : outputWearRange}</TableCell>
                              <TableCell>{exchangeEditMode ? <Select value={item.result} onValueChange={(value) => updateExchangeField(item, "result", value)}><SelectTrigger className="w-[100px] rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{["成功", "失败", "未开炉"].map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select> : <ResultBadge result={item.result} />}</TableCell>
                              <TableCell>{exchangeEditMode ? <Input className="w-[120px] rounded-xl bg-white" type="number" value={refPrice ?? ""} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => updateExchangeField(item, "refPrice", e.target.value)} /> : money(refPrice)}</TableCell>
                              <TableCell>{exchangeEditMode ? <Input className="w-[120px] rounded-xl bg-white" type="number" value={furnaceFee ?? ""} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => updateExchangeField(item, "furnaceFee", e.target.value)} /> : money(furnaceFee)}</TableCell>
                              <TableCell>{exchangeEditMode ? <Input className="w-[120px] rounded-xl bg-white" type="number" value={salePrice ?? ""} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => updateExchangeField(item, "salePrice", e.target.value)} /> : salePrice ? money(salePrice) : "-"}</TableCell>
                              <TableCell>{exchangeEditMode ? <Input className="w-[145px] rounded-xl bg-white" type="date" value={saleDate ?? ""} onChange={(e) => updateExchangeField(item, "saleDate", e.target.value)} /> : saleDate || "-"}</TableCell>
                              <TableCell>{exchangeEditMode ? <Select value={item.status} onValueChange={(value) => updateExchangeField(item, "status", value)}><SelectTrigger className="w-[110px] rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{["库存中", "已售出"].map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select> : <StatusBadge status={item.status} />}</TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              </Panel>
            </div>
          </TabsContent>

          <TabsContent value="daily" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Panel
                title="收益中心"
                desc="用日历看趋势，用右侧面板处理当天收益。"
                icon={<CalendarDays className="h-5 w-5" />}
                action={
                  <div className="flex items-center gap-2">
                    <IconButton onClick={() => setCalendarViewDate((prev) => shiftMonth(prev || getTodayDate(), -1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </IconButton>
                    <SoftButton onClick={() => setCalendarViewDate(getMonthStart(getTodayDate()))}>本月</SoftButton>
                    <IconButton onClick={() => setCalendarViewDate((prev) => shiftMonth(prev || getTodayDate(), 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </IconButton>
                  </div>
                }
              >
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 rounded-[28px] border border-[#f9bfd1] bg-gradient-to-br from-white via-slate-50 to-white p-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-bold text-[#a35a73]">CURRENT MONTH</div>
                      <div className="mt-1 text-3xl font-black tracking-tight text-[#3b1824]">
                        {calendarYear} 年 {calendarMonth} 月
                      </div>
                      <div className="mt-2 text-sm text-[#7c3a52]">
                        当前选择：<span className="font-bold text-[#3b1824]">{selectedDailyDate}</span>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#f9bfd1] bg-white px-5 py-4 shadow-sm">
                      <div className="text-xs font-bold text-[#a35a73]">本月累计</div>
                      <div className={cx("mt-1 text-2xl font-black tracking-tight tabular-nums", cumulativeProfit >= 0 ? "text-[#10b981]" : "text-rose-600")}>
                        {money(cumulativeProfit)}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-[30px] border border-[#f9bfd1] bg-white p-4 shadow-sm">
                    <div className="mb-3 grid min-w-[720px] grid-cols-7 gap-2 text-center text-xs font-black text-[#a35a73]">
                      {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
                        <div key={d}>{d}</div>
                      ))}
                    </div>

                    <div className="grid min-w-[720px] grid-cols-7 gap-2">
                      {monthCells.map((day, index) => {
                        if (!day) {
                          return <div key={`empty-${index}`} className="h-[86px] rounded-[22px] bg-[#fff7fb]/70" />;
                        }

                        const dateKey = `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const summary = dateSummaryMap[dateKey];
                        const value = Number(summary?.totalProfit || 0);
                        const selected = selectedDailyDate === dateKey;
                        const hasValue = value !== 0;
                        const positive = value >= 0;

                        return (
                          <button
                            key={dateKey}
                            type="button"
                            onClick={() => {
                              setSelectedDailyDate(dateKey);
                              setCalendarViewDate(getMonthStart(dateKey));
                            }}
                            className={cx(
                              "group relative h-[86px] overflow-hidden rounded-[22px] border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
                              selected
                                ? "border-indigo-300 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-100"
                                : hasValue && positive
                                  ? "border-emerald-100 bg-emerald-50/80 text-emerald-900"
                                  : hasValue && !positive
                                    ? "border-rose-100 bg-rose-50/80 text-rose-900"
                                    : "border-[#f9bfd1] bg-[#fff7fb]/80 text-[#7c3a52] hover:bg-[#fff7fb]"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-base font-black leading-none">{day}</span>
                              {hasValue && (
                                <span className={cx("h-2.5 w-2.5 rounded-full", positive ? "bg-emerald-500" : "bg-rose-500")} />
                              )}
                            </div>
                            <div className={cx("mt-4 truncate text-xs font-black tabular-nums", !hasValue && "text-[#a35a73]")}>
                              {hasValue ? money(value) : "—"}
                            </div>
                            </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel
                title="当日收益"
                desc="只展示当前日期的关键拆解。"
                icon={<CircleDollarSign className="h-5 w-5" />}
              >
                <div className="flex flex-col gap-4 xl:min-h-[720px]">
                  <div className="rounded-[30px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-6">
                    <div className="text-sm font-bold text-[#7c3a52]">{selectedDailyDate}</div>
                    <div className={cx("mt-2 text-5xl font-black tracking-tight tabular-nums", dailySummary.totalProfit >= 0 ? "text-[#10b981]" : "text-rose-600")}>
                      {money(dailySummary.totalProfit)}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-[#a35a73]">当日净收益</div>
                  </div>

                  <div className="grid gap-3">
                    <IncomeLine label="材料毛利" value={dailySummary.materialProfit} active={detailPanel === "material"} onClick={() => setDetailPanel("material")} />
                    <IncomeLine label="产物利润" value={dailySummary.productProfit} active={detailPanel === "product"} onClick={() => setDetailPanel("product")} />
                    <IncomeLine label="开炉费" value={dailySummary.furnaceIncome} active={detailPanel === "furnace"} onClick={() => setDetailPanel("furnace")} />
                  </div>

                  <div className="rounded-[26px] border border-[#f9bfd1] bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-[#3b1824]">其他收入</div>
                        <div className="mt-2 text-3xl font-black tracking-tight tabular-nums text-[#3b1824]">
                          {money(dailySummary.extraValue)}
                        </div>
                      </div>
                      {editingExtraDate !== selectedDailyDate && (
                        <SoftButton
                          disabled={isReadonlyMode}
                          onClick={() => {
                            if (isReadonlyMode) {
                              showToast("会员已过期，当前为只读模式", "error");
                              return;
                            }
                            setEditingExtraDate(selectedDailyDate);
                            setEditingExtraValue(String(dailyExtraMap[selectedDailyDate] ?? ""));
                          }}
                        >
                          编辑
                        </SoftButton>
                      )}
                    </div>

                    {editingExtraDate === selectedDailyDate && (
                      <div className="mt-4 flex gap-2">
                        <Input
                          type="number"
                          value={editingExtraValue}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => setEditingExtraValue(e.target.value)}
                          placeholder="输入金额"
                          className="h-11 rounded-2xl bg-white"
                        />
                        <Button
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
                              showToast(`保存其他收益失败：${error.message}`, "error");
                              return;
                            }
                            setDailyExtraMap((prev) => ({ ...prev, [selectedDailyDate]: amount }));
                            setEditingExtraDate(null);
                            showToast("其他收益已保存");
                          }}
                          className="h-11 rounded-2xl bg-[#e11d48] px-5"
                        >
                          完成
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[26px] border border-[#f9bfd1] bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-black text-[#3b1824]">
                          <span>过往收益</span>
                          <button
                            type="button"
                            onClick={() => setShowPastProfit((prev) => !prev)}
                            className="rounded-full p-1 text-[#a35a73] hover:bg-[#fff0f5] hover:text-[#8b3a57]"
                          >
                            {showPastProfit ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                        </div>
                        <div className="mt-2 text-3xl font-black tracking-tight tabular-nums text-[#3b1824]">
                          {showPastProfit ? money(pastProfit) : "••••"}
                        </div>
                      </div>

                      {!editingPastProfit && (
                        <SoftButton
                          disabled={isReadonlyMode}
                          onClick={() => {
                            if (isReadonlyMode) {
                              showToast("会员已过期，当前为只读模式", "error");
                              return;
                            }
                            setEditingPastProfit(true);
                            setEditingPastProfitValue(String(pastProfit || ""));
                          }}
                        >
                          编辑
                        </SoftButton>
                      )}
                    </div>

                    {editingPastProfit && (
                      <div className="mt-4 flex gap-2">
                        <Input
                          type="number"
                          value={editingPastProfitValue}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={(e) => setEditingPastProfitValue(e.target.value)}
                          placeholder="输入过往收益"
                          className="h-11 rounded-2xl bg-white"
                        />
                        <Button
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
                              showToast(`保存过往收益失败：${error.message}`, "error");
                              return;
                            }
                            setPastProfit(amount);
                            setEditingPastProfit(false);
                            showToast("过往收益已保存");
                          }}
                          className="h-11 rounded-2xl bg-[#e11d48] px-5"
                        >
                          完成
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto rounded-[26px] border border-[#f9bfd1] bg-white p-5">
                    <div className="text-sm font-black text-[#3b1824]">查看提示</div>
                    <div className="mt-2 text-sm leading-6 text-[#7c3a52]">
                      点击左侧日历中的任意日期，右侧会同步切换为该日期的收益构成。
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <style jsx global>{`
        @keyframes softStickerFloat {
          0%,
          100% {
            transform: translateY(0) rotate(var(--tw-rotate, 0deg));
            opacity: 0.32;
          }
          50% {
            transform: translateY(-8px) rotate(var(--tw-rotate, 0deg));
            opacity: 0.55;
          }
        }

        @keyframes navHeartFloat {
          0%,
          100% {
            transform: translateY(0) rotate(8deg) scale(1);
          }
          45% {
            transform: translateY(-5px) rotate(8deg) scale(1.08);
          }
        }

        @keyframes navTinyFloat {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.55;
          }
          50% {
            transform: translateY(-6px);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}

function FloatingHearts() {
  const stickers = [
    { text: "♡", left: "7%", top: "14%", size: "text-xl", delay: "0s" },
    { text: "♥", left: "24%", top: "9%", size: "text-sm", delay: "0.4s" },
    { text: "520", left: "55%", top: "11%", size: "text-xs", delay: "0.8s" },
    { text: "LOVE", left: "83%", top: "18%", size: "text-[11px]", delay: "1.2s" },
    { text: "✦", left: "12%", top: "78%", size: "text-sm", delay: "0.2s" },
    { text: "♡", left: "72%", top: "80%", size: "text-lg", delay: "1s" },
    { text: "♥", left: "91%", top: "66%", size: "text-sm", delay: "1.4s" },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {stickers.map((item, index) => (
        <span
          key={`${item.text}-${index}`}
          className={`absolute select-none ${item.size} font-black text-[#ff8ab0]/35 animate-[softStickerFloat_6s_ease-in-out_infinite]`}
          style={{
            left: item.left,
            top: item.top,
            animationDelay: item.delay,
            transform: `rotate(${index % 2 ? "-" : ""}${6 + index * 3}deg)`,
          }}
        >
          {item.text}
        </span>
      ))}
      <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-rose-200/30 blur-3xl" />
      <div className="absolute -left-24 bottom-10 h-80 w-80 rounded-full bg-pink-200/35 blur-3xl" />
      <div className="absolute left-[42%] top-[38%] h-56 w-56 rounded-full bg-[#ffe4ef]/35 blur-3xl" />
    </div>
  );
}

function Toast({ toast }) {
  if (!toast.show) return null;
  const success = toast.type === "success";
  return (
    <div className={cx("fixed right-5 top-5 z-[9999] flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-bold text-white shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl animate-in fade-in slide-in-from-top-2", success ? "bg-[#e11d48]" : "bg-rose-600")}>
      {success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      {toast.message}
    </div>
  );
}

function HeaderPanel({ currentUser, membershipInfo, remainingDays, totalProfit, hidden, onToggleTotal, showUserPanel, setShowUserPanel, handleLogout }) {
  const ANNOUNCEMENT_VERSION = "2026-05-19-update-v1";
  const ANNOUNCEMENT_LINES = [
    "日进斗金本次更新：",
  "1、登录和注册改为用户名模式，老邮箱账号仍可兼容登录；",
  "2、用户中心支持修改用户名；",
  "3、合炉选材新增一键清空，选错材料不用再一个个删；",
  "4、ECO 合炉和包炉新增“未开炉”状态，可先暂存后补产物信息；",
  "5、520 限定皮肤已上线。",
  ];
  const announcementKey = `announcement-read-${currentUser?.id || "guest"}-${ANNOUNCEMENT_VERSION}`;
  const [showAnnouncement, setShowAnnouncement] = React.useState(false);
  const [announcementRead, setAnnouncementRead] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setAnnouncementRead(localStorage.getItem(announcementKey) === "1");
  }, [announcementKey]);

  function openAnnouncement() {
    setShowAnnouncement((prev) => !prev);
    setAnnouncementRead(true);
    if (typeof window !== "undefined") localStorage.setItem(announcementKey, "1");
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#f9bfd1] bg-gradient-to-br from-white/95 via-[#fff7fb] to-[#ffe4ef]/80 p-4 shadow-[0_18px_60px_rgba(225,29,72,0.10)] backdrop-blur-xl lg:p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[#ffc7d9]/35 blur-2xl" />
      <div className="pointer-events-none absolute left-8 top-0 h-px w-44 bg-gradient-to-r from-transparent via-[#ff8ab0]/70 to-transparent" />

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e11d48] text-white">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black tracking-[0.18em] text-[#a35a73]">WORKBENCH</div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-black tracking-tight text-[#3b1824] sm:text-3xl">日进斗金</h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-pink-200 bg-gradient-to-r from-rose-50 to-pink-50 px-3 py-1 text-xs font-black text-rose-600 shadow-sm">
                  <span className="text-[#ff5c93]">♥</span>
                  520 限定版本
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:items-center xl:justify-end">
          <div className="inline-flex h-10 items-center justify-center rounded-xl border border-[#fecdd3] bg-[#ffe4ef] px-3 text-sm font-bold text-[#be123c]">
            {remainingDays > 0 ? `会员 ${remainingDays} 天` : "只读模式"}
          </div>

          <button type="button" onClick={openAnnouncement} className="relative inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#f9a8d4] bg-[#fff1f2] px-3 text-sm font-bold text-[#be185d] transition hover:bg-[#ffe4ef]">
            <Sparkles className="h-4 w-4" /> 公告
            {!announcementRead && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#e11d48] ring-2 ring-white" />}
          </button>

          <button type="button" onClick={onToggleTotal} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#f9bfd1] bg-white px-3 text-sm font-bold text-[#3b1824] transition hover:bg-[#fff0f5]">
            <span className="text-[#7c3a52]">总收益</span>
            <span className="tabular-nums">{hidden ? "••••" : money(totalProfit)}</span>
            {hidden ? <EyeOff className="h-4 w-4 text-[#a35a73]" /> : <Eye className="h-4 w-4 text-[#a35a73]" />}
          </button>

          <Button type="button" onClick={() => setShowUserPanel((prev) => !prev)} variant="outline" className="h-10 rounded-xl border-[#f9bfd1] bg-white px-3 text-[#3b1824] hover:bg-[#fff0f5]">
            <UserRound className="mr-2 h-4 w-4" />{showUserPanel ? "收起用户" : "用户中心"}
          </Button>

          <Button type="button" onClick={handleLogout} variant="outline" className="h-10 rounded-xl border-[#f9bfd1] bg-white px-3 text-[#3b1824] hover:bg-[#fff0f5]">
            <LogOut className="mr-2 h-4 w-4" />退出
          </Button>
        </div>
      </div>

      {showAnnouncement && (
        <div className="mt-4 rounded-2xl border border-[#f9bfd1] bg-white p-4 text-sm shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="font-black text-[#3b1824]">系统公告</div>
            <button type="button" onClick={() => setShowAnnouncement(false)} className="rounded-lg p-1 text-[#a35a73] hover:bg-[#fff0f5] hover:text-[#3b1824]"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 grid gap-1 text-[#8b3a57]">
            {ANNOUNCEMENT_LINES.map((line) => <div key={line}>{line}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

function UserPanel(props) {
  return (
    <Panel title="用户中心" desc="管理会员、激活码与密码。" icon={<UserRound className="h-5 w-5" />}>
      <div className="grid gap-3 xl:grid-cols-[220px_180px_minmax(0,1fr)_320px]">
        <div className="rounded-[24px] border border-[#f9bfd1] bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#3b1824]"><UserRound className="h-4 w-4" />修改用户名</div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Input
              placeholder="用户名"
              value={props.usernameInput ?? ""}
              onChange={(e) => props.setUsernameInput(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 20).toLowerCase())}
              className="h-10 rounded-xl"
            />
            <Button onClick={props.handleUpdateUsername} disabled={props.isSavingUsername} className="h-10 rounded-xl px-4">
              {props.isSavingUsername ? "保存中" : "保存"}
            </Button>
          </div>
        </div>
        <MiniInfo icon={<ShieldCheck className="h-4 w-4" />} label="会员剩余" value={props.remainingDays > 0 ? `${props.remainingDays} 天` : "已过期"} />
        <div className="rounded-[24px] border border-[#f9bfd1] bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#3b1824]"><LockKeyhole className="h-4 w-4" />修改密码</div>
          <div className="grid gap-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
            <Input type="password" placeholder="原密码" value={props.currentPassword ?? ""} onChange={(e) => props.setCurrentPassword(e.target.value)} className="h-10 rounded-xl" />
            <Input type="password" placeholder="新密码" value={props.newPassword ?? ""} onChange={(e) => props.setNewPassword(e.target.value)} className="h-10 rounded-xl" />
            <Input type="password" placeholder="确认新密码" value={props.confirmNewPassword ?? ""} onChange={(e) => props.setConfirmNewPassword(e.target.value)} className="h-10 rounded-xl" />
            <Button onClick={props.handleChangePassword} className="h-10 rounded-xl px-4">修改</Button>
          </div>
        </div>
        <div className="rounded-[24px] border border-[#f9bfd1] bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#3b1824]"><Sparkles className="h-4 w-4" />激活会员</div>
          <div className="grid gap-2 xl:grid-cols-[1fr_auto]"><Input placeholder="输入激活码" value={props.activationCodeInput ?? ""} onChange={(e) => props.setActivationCodeInput(e.target.value)} className="h-10 rounded-xl" /><Button onClick={props.redeemActivationCode} className="h-10 rounded-xl px-4">激活</Button></div>
        </div>
      </div>
    </Panel>
  );
}

function Panel({ title, desc, icon, action, children }) {
  return (
    <Card className="overflow-hidden rounded-[30px] border border-[#f9bfd1] bg-white/90 shadow-[0_18px_60px_rgba(225,29,72,0.10)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_72px_rgba(225,29,72,0.16)]">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e11d48] text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]">{icon}</div>
            <div className="min-w-0">
              <CardTitle className="text-xl font-black tracking-tight text-[#3b1824]">{title}</CardTitle>
              {desc ? <div className="mt-1 text-sm leading-6 text-[#7c3a52]">{desc}</div> : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">{children}</CardContent>
    </Card>
  );
}

function StatCard({ title, value, hidden, icon, onToggle, tone = "slate" }) {
  const toneMap = {
    emerald: "from-emerald-50 to-white text-[#10b981] border-emerald-100",
    green: "from-green-50 to-white text-green-600 border-green-100",
    indigo: "from-indigo-50 to-white text-indigo-600 border-indigo-100",
    sky: "from-sky-50 to-white text-sky-600 border-sky-100",
    amber: "from-amber-50 to-white text-amber-600 border-amber-100",
    slate: "from-slate-50 to-white text-[#8b3a57] border-slate-100",
  };
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle?.();
        }
      }}
      className={cx(
        "overflow-hidden rounded-[26px] border bg-gradient-to-br shadow-[0_10px_34px_rgba(15,23,42,0.055)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_44px_rgba(15,23,42,0.08)] active:scale-[0.99] cursor-pointer select-none",
        toneMap[tone]
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-medium text-[#7c3a52]">
              <span>{title}</span>
              <button
                type="button"
                className="rounded-full p-1 hover:bg-[#fff7fb]"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle?.();
                }}
                aria-label={hidden ? `显示${title}` : `隐藏${title}`}
              >
                {hidden ? <EyeOff className="h-3.5 w-3.5 text-[#a35a73]" /> : <Eye className="h-3.5 w-3.5 text-[#a35a73]" />}
              </button>
            </div>
            <div className="mt-2 truncate text-2xl font-black tracking-tight tabular-nums text-[#3b1824]">{hidden ? "••••" : value}</div>
          </div>
          <div className="rounded-2xl bg-[#fff7fb]/80 p-2 shadow-sm">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function NavTab({ value, icon, label, sub }) {
  return (
    <TabsTrigger
      value={value}
      className="group relative !m-0 !h-14 !w-full !min-w-0 rounded-[22px] border border-transparent bg-transparent px-3 text-[#7c3a52] transition-all duration-200 hover:bg-[#fff7fb] hover:text-[#3b1824] data-[state=active]:border-slate-950 data-[state=active]:bg-[#e11d48] data-[state=active]:text-white data-[state=active]:shadow-none sm:px-4"
    >
      {value === "daily" && (
        <span className="pointer-events-none absolute -right-2 -top-3 z-20 hidden text-[30px] leading-none text-[#ff6f9f] drop-shadow-[0_8px_12px_rgba(225,29,72,0.20)] animate-[navHeartFloat_3.2s_ease-in-out_infinite] sm:block">
          ♥
        </span>
      )}

      <div className="flex items-center justify-center gap-2.5 leading-none">
        <span className="text-[#a35a73] group-data-[state=active]:text-white">
          {icon}
        </span>
        <span className="text-sm font-bold">{label}</span>
        <span className="hidden text-xs opacity-55 lg:inline">{sub}</span>
      </div>
    </TabsTrigger>
  );
}

function FilterBar({ children }) {
  return (
    <div className="mb-4 rounded-[26px] border border-[#f9bfd1] bg-white p-4 shadow-sm">
      <div className="grid items-end gap-3 xl:grid-cols-[180px_minmax(260px,1fr)_132px_132px_132px] [&>div]:min-w-0 [&_input]:h-11 [&_input]:w-full [&_input]:rounded-2xl [&_input]:border-[#f9bfd1] [&_input]:bg-white [&_input]:px-4 [&_input]:text-sm [&_input]:font-medium [&_input]:text-[#3b1824] [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:w-full [&_button[role=combobox]]:max-w-full [&_button[role=combobox]]:min-w-0 [&_button[role=combobox]]:rounded-2xl [&_button[role=combobox]]:border-[#f9bfd1] [&_button[role=combobox]]:bg-white [&_button[role=combobox]]:px-4 [&_button[role=combobox]]:text-sm [&_button[role=combobox]]:font-semibold [&_button[role=combobox]]:text-[#8b3a57]">
        {children}
      </div>
    </div>
  );
}

function ResponsiveTable({ children, maxHeight = "560px" }) {
  return (
    <div
      className="w-full max-w-full overflow-auto rounded-[24px] border border-[#f9bfd1] bg-white [&_table]:min-w-[920px] sm:[&_table]:min-w-full"
      style={{ maxHeight }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ title }) {
  return <div className="pt-1 text-xs font-black uppercase tracking-[0.18em] text-[#a35a73]">{title}</div>;
}

function FieldDate({ label, value, onChange, lang }) {
  return (
    <div className="w-full max-w-full min-w-0 space-y-2 overflow-hidden [&_input]:block [&_input]:w-full [&_input]:max-w-full [&_input]:min-w-0">
      <Label className="text-xs font-bold text-[#7c3a52]">{label}</Label>
      <Input type="date" value={value ?? ""} lang={lang} onChange={(e) => onChange(e.target.value)} className="box-border h-11 w-full max-w-full min-w-0 appearance-none rounded-2xl border-[#f9bfd1] bg-white px-4 text-base font-medium text-[#3b1824] transition focus:border-[#e11d48] focus:ring-2 focus:ring-[#ffe4ef] sm:text-sm" />
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div className="w-full min-w-0 space-y-2">
      <Label className="text-xs font-bold text-[#7c3a52]">{label}</Label>
      <Input value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="box-border h-11 w-full max-w-full min-w-0 appearance-none rounded-2xl border-[#f9bfd1] bg-white px-4 text-base font-medium text-[#3b1824] transition focus:border-[#e11d48] focus:ring-2 focus:ring-[#ffe4ef] sm:text-sm" />
    </div>
  );
}

function NumberField({ label, value, onChange, placeholder, disabled }) {
  return (
    <div className="w-full min-w-0 space-y-2">
      <Label className="text-xs font-bold text-[#7c3a52]">{label}</Label>
      <Input type="number" value={value ?? ""} placeholder={placeholder} disabled={disabled} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => onChange(e.target.value)} className="h-11 w-full min-w-0 rounded-2xl border-[#f9bfd1] bg-white px-4 text-base font-medium text-[#3b1824] transition focus:border-[#e11d48] focus:ring-2 focus:ring-[#ffe4ef] disabled:bg-[#fff0f5] disabled:text-[#a35a73] sm:text-sm" />
    </div>
  );
}

function SelectField({ label, value, options, onChange, tone, placeholder }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 focus:ring-emerald-100"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-600 focus:ring-rose-100"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-700 focus:ring-amber-100"
          : "border-[#f9bfd1] bg-white text-[#3b1824] focus:ring-[#ffe4ef]";

  return (
    <div className="w-full min-w-0 space-y-2">
      <Label className="text-xs font-bold text-[#7c3a52]">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cx("h-11 w-full min-w-0 rounded-2xl px-4 text-base font-semibold shadow-none transition hover:bg-[#fff7fb] focus:ring-2 sm:text-sm", toneClass)}>
          <SelectValue placeholder={placeholder || "请选择"} />
        </SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function TextFieldWithSuggest({ label, value, onChange, placeholder, suggestions, onPick }) {
  return (
    <div className="w-full min-w-0 space-y-2">
      <Label className="text-xs font-bold text-[#7c3a52]">{label}</Label>
      <Input placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="box-border h-11 w-full max-w-full min-w-0 appearance-none rounded-2xl border-[#f9bfd1] bg-white px-4 text-base font-medium text-[#3b1824] transition focus:border-[#e11d48] focus:ring-2 focus:ring-[#ffe4ef] sm:text-sm" />
      <SuggestionList items={suggestions} onPick={onPick} />
    </div>
  );
}

function SuggestionList({ items, onPick }) {
  if (!items.length) return null;
  return <div className="flex flex-wrap gap-2 rounded-[20px] border border-[#f9bfd1] bg-white p-3">{items.map((item) => <button key={item} type="button" className="rounded-full border border-[#f9bfd1] bg-white px-3 py-1 text-xs font-medium text-[#8b3a57] hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700" onClick={() => onPick(item)}>{item}</button>)}</div>;
}

function InfoBox({ label, value, note, compact, valueClass }) {
  return (
    <div className="w-full min-w-0 space-y-2">
      <Label className="text-xs font-bold text-[#7c3a52]">{label}</Label>
      <div className="flex h-11 w-full min-w-0 items-center rounded-2xl border border-[#f9bfd1] bg-white px-4 text-sm font-medium text-[#3b1824]">
        <span className={cx("truncate font-black tabular-nums text-[#3b1824]", valueClass)}>{value}</span>
      </div>
      {note ? <div className="text-xs text-[#a35a73]">{note}</div> : null}
    </div>
  );
}

function SummaryRow({ label, value, clickable, active, strong, onClick }) {
  return (
    <button type="button" onClick={onClick} className={cx("flex w-full items-center justify-between rounded-[22px] border px-4 py-3 text-left transition-all", strong || active ? "border-[#e11d48] bg-[#e11d48] text-white shadow-lg shadow-slate-900/15" : "border-[#f9bfd1] bg-white text-[#8b3a57] hover:bg-[#fff0f5]", clickable ? "cursor-pointer" : "cursor-default")}>
      <span>{label}</span><span className="font-black tabular-nums">{value}</span>
    </button>
  );
}

function SoftButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center rounded-full border border-[#fbcfe8] bg-[#fdf2f8] px-5 text-sm font-bold text-[#db2777] shadow-sm transition hover:bg-[#fce7f3] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function IconButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#f9bfd1] bg-white text-[#8b3a57] shadow-sm transition hover:bg-[#fff7fb]"
    >
      {children}
    </button>
  );
}

function Hint({ children }) {
  return <div className="mb-4 rounded-[22px] border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">{children}</div>;
}

function MiniMetric({ label, value, positive = true }) {
  return (
    <div className="rounded-[20px] border border-[#f9bfd1] bg-white px-3 py-3 shadow-sm">
      <div className="text-xs font-bold text-[#a35a73]">{label}</div>
      <div className={cx("mt-1 truncate text-sm font-black tabular-nums", positive ? "text-[#10b981]" : "text-rose-600")}>{value}</div>
    </div>
  );
}

function IncomeLine({ label, value, active, onClick }) {
  const positive = Number(value || 0) >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex w-full items-center justify-between rounded-[20px] border px-4 py-3 text-left transition-all",
        active ? "border-indigo-200 bg-indigo-50" : "border-[#f9bfd1] bg-white hover:bg-[#fff7fb]"
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cx("h-2.5 w-2.5 rounded-full", positive ? "bg-emerald-500" : "bg-rose-500")} />
        <span className="font-bold text-[#8b3a57]">{label}</span>
      </div>
      <span className={cx("font-black tabular-nums", positive ? "text-[#10b981]" : "text-rose-600")}>{money(value)}</span>
    </button>
  );
}

function MiniInfo({ icon, label, value }) {
  return <div className="rounded-[24px] border border-[#f9bfd1] bg-[#fff7fb]/80 p-4"><div className="flex items-center gap-2 text-xs font-bold text-[#7c3a52]">{icon}{label}</div><div className="mt-3 truncate text-2xl font-black tracking-tight text-[#3b1824]" title={value}>{value}</div></div>;
}

function PlatformBadge({ platform }) {
  return <span className="text-sm font-bold text-[#8b3a57]">{platform}</span>;
}

function StatusBadge({ status }) {
  if (status === "未开炉") {
    return <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">未开炉</Badge>;
  }
  const stock = status === "库存中";
  return <Badge className={cx("rounded-full", stock ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-[#e11d48] text-white hover:bg-[#e11d48]")}>{status}</Badge>;
}

function ResultBadge({ result }) {
  if (result === "未开炉") {
    return <Badge className="rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100">未开炉</Badge>;
  }
  const ok = result === "成功";
  return <Badge className={cx("rounded-full", ok ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-rose-100 text-rose-600 hover:bg-red-100")}>{result}</Badge>;
}

function MaterialPicker({ title, filters, setFilters, nameInput, setNameInput, selectedCount, hint, shouldShow, items, selectedIds, onToggle, onClear, materialSalePrices, onSalePriceChange, mode }) {
  return (
    <div className="space-y-3 rounded-[24px] border border-[#f9bfd1] bg-[#fff7fb]/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-black text-[#3b1824]">{title}</div>
        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
          <div className="inline-flex h-11 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-[#7c3a52] shadow-sm">
            已选 {selectedCount} ｜ {hint}
          </div>
          <button
            type="button"
            disabled={!selectedCount}
            onClick={onClear}
            className="inline-flex h-11 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 text-xs font-black text-rose-600 shadow-sm transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            一键清空
          </button>
        </div>
      </div>
      <div className="grid min-w-0 gap-3 md:grid-cols-2 [&>div]:min-w-0"><FieldDate label="日期筛选" value={filters.date} onChange={(value) => setFilters({ ...filters, date: value })} /><TextField label="名称筛选" placeholder="输入名称关键词" value={nameInput} onChange={setNameInput} /></div>
      {!shouldShow ? <div className="rounded-[20px] border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-[#a35a73]">请先输入日期或名称筛选，再选择材料。</div> : (
        <div className="max-h-80 space-y-2 overflow-auto rounded-[22px] border border-[#f9bfd1] bg-white p-3">
          {items.map((item) => {
            const active = selectedIds.includes(item.id);
            const wearLevel = item.wearLevel ?? item.wear_level;
            const wearRange = item.wearRange ?? item.wear_range;
            const customWear = item.customWear ?? item.custom_wear;
            const materialSalePrice = materialSalePrices?.[item.id] ?? "";
            return (
              <div key={item.id} className={cx("rounded-[18px] border px-3 py-3 transition-all", active ? "border-emerald-200 bg-emerald-50 text-[#3b1824] shadow-sm" : "border-[#f9bfd1] bg-white hover:bg-[#fff7fb]")}>
                <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => onToggle(item.id)}>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div className="truncate font-bold">{item.name}</div>
                      {item.sourceType === "contract" && (
                        <span className="shrink-0 rounded-full border border-[#ffc7d9] bg-[#fff0f5] px-2 py-0.5 text-[11px] font-black text-[#db2777]">
                          汰换产物
                        </span>
                      )}
                    </div>
                    <div className={cx("text-sm", active ? "text-emerald-700" : "text-[#7c3a52]")}>
                      {[item.date, item.platform, wearLevel, wearRange === "自定义" ? customWear || "自定义" : wearRange].filter(Boolean).join(" • ")}
                    </div>
                    <div className={cx("mt-1 text-xs", active ? "text-emerald-700" : "text-[#7c3a52]")}>成本：{money(item.cost)}</div>
                  </div>
                  <div className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-black shadow-sm">{active ? "已选" : "选择"}</div>
                </button>
                {mode === "eco" && active && <div className="mt-3"><Label className="text-xs font-bold text-emerald-800">材料售价</Label><Input type="number" placeholder="请输入这条材料的售价" value={materialSalePrice} onClick={(e) => e.stopPropagation()} onWheel={(e) => e.currentTarget.blur()} onChange={(e) => onSalePriceChange(item.id, e.target.value)} className="mt-2 h-11 w-full rounded-2xl bg-white text-[#3b1824]" /></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
