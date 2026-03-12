// @ts-nocheck
"use client";

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



function money(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
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

function getDailySummary(date, materials, contracts, dailyExtras = {}) {
  const dayMaterials = materials.filter((item) => item.date === date);
  const dayContracts = contracts.filter((item) => item.date === date);
  const materialProfit = dayMaterials.reduce((sum, item) => {
    if (!item.salePrice) return sum;
    return sum + (Number(item.salePrice) - Number(item.cost || 0));
  }, 0);
  const productProfit = dayContracts.reduce((sum, item) => {
    if (!item.salePrice) return sum;
    return sum + (Number(item.salePrice) - Number(item.refPrice || 0));
  }, 0);
  const furnaceIncome = dayContracts.reduce((sum, item) => sum + Number(item.furnaceFee || 0), 0);
  const materialDetails = dayMaterials.filter((item) => item.salePrice).map((item) => ({
    id: `m-${item.id}`,
    name: item.name,
    value: Number(item.salePrice) - Number(item.cost || 0),
    note: `${item.platform} · ${item.wearLevel}`,
  }));
  const productDetails = dayContracts.filter((item) => item.salePrice).map((item) => ({
    id: `c-${item.id}`,
    name: item.outputName,
    value: Number(item.salePrice) - Number(item.refPrice || 0),
    note: `${item.type || "普通汰换"} · ${item.result}`,
  }));
  const furnaceDetails = dayContracts.filter((item) => Number(item.furnaceFee || 0) > 0).map((item) => ({
    id: `f-${item.id}`,
    name: item.contractName,
    value: Number(item.furnaceFee || 0),
    note: `${item.outputName}`,
  }));
  const extraValue = Number(dailyExtras?.[date] || 0);
  return {
    materialProfit,
    productProfit,
    furnaceIncome,
totalProfit: materialProfit + productProfit + furnaceIncome + extraValue,
extraValue,
    materialDetails,
    productDetails,
    furnaceDetails,
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
await loadMaterials(user.id);
await loadContracts(user.id);
setAuthChecked(true);
  }

  checkAuth();
}, [router]);


async function handleLogout() {
  await supabase.auth.signOut();
  router.replace("/login");
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



  const [showAllMaterials, setShowAllMaterials] = useState(false);

  const [materials, setMaterials] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [keyword, setKeyword] = useState("");
  const batchInputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const [exchangeMode, setExchangeMode] = useState("普通汰换");
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedDailyDate, setSelectedDailyDate] = useState("2026-03-10");
  const [showCalendar, setShowCalendar] = useState(false);
  const [dailyExtras, setDailyExtras] = useState<Record<string, string>>({});
  const [detailPanel, setDetailPanel] = useState("material");
const [visibleStatMap, setVisibleStatMap] = useState({
  materialProfit: true,
  productProfit: true,
  furnaceIncome: true,
  stockCount: true,
  stockCost: true,
  totalProfit: true,
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
    wearRange: "全部",
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
    name: "",
    wearLevel: "全部",
    wearRange: "全部",
    platform: "全部",
  });
  const [packageForm, setPackageForm] = useState({
    date: "2026-03-10",
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

  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      const text = `${item.platform} ${item.name} ${item.date} ${item.status} ${item.wearLevel}`.toLowerCase();
      return text.includes(keyword.toLowerCase());
    });
  }, [materials, keyword]);
const visibleMaterials = useMemo(() => {
  return showAllMaterials ? filteredMaterials : filteredMaterials.slice(0, 10);
}, [filteredMaterials, showAllMaterials]);


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
    return [...materialRows, ...contractRows];
  }, [materials, contracts]);

  const inventoryWearRangeOptions = useMemo(() => ["全部", ...new Set(inventoryRows.map((item) => item.wearRange).filter(Boolean))], [inventoryRows]);

  const filteredInventory = useMemo(() => {
    return inventoryRows.filter((item) => {
      const matchDate = !inventoryFilters.date || item.date === inventoryFilters.date;
      const matchPlatform = inventoryFilters.platform === "全部" || item.platform === inventoryFilters.platform;
      const matchName = !inventoryFilters.name || item.name.toLowerCase().includes(inventoryFilters.name.toLowerCase());
      const matchWearLevel = inventoryFilters.wearLevel === "全部" || item.wearLevel === inventoryFilters.wearLevel;
      const matchWearRange = inventoryFilters.wearRange === "全部" || item.wearRange === inventoryFilters.wearRange;
      return matchDate && matchPlatform && matchName && matchWearLevel && matchWearRange;
    });
  }, [inventoryRows, inventoryFilters]);

  const stats = useMemo(() => {
    const materialProfit = materials.reduce((sum, item) => !item.salePrice ? sum : sum + (Number(item.salePrice) - Number(item.cost)), 0);
    const productProfit = contracts.reduce((sum, item) => !item.salePrice ? sum : sum + (Number(item.salePrice) - Number(item.refPrice || 0)), 0);
    const furnaceIncome = contracts.reduce((sum, item) => sum + Number(item.furnaceFee || 0), 0);
    const inStock = inventoryRows.filter((item) => item.status === "库存中");
    const stockCost = inStock.reduce((sum, item) => sum + Number(item.cost || 0), 0);
    return {
      materialProfit,
      productProfit,
      furnaceIncome,
      stockCount: inStock.length,
      stockCost,
      totalProfit: materialProfit + productProfit + furnaceIncome,
    };
  }, [materials, contracts, inventoryRows]);

  const currentWearRanges = wearRanges[materialForm.wearLevel] || [];
  const currentContractWearRanges = wearRanges[contractForm.outputWearLevel] || [];
  const currentPackageWearRanges = wearRanges[packageForm.outputWearLevel] || [];

  const dailyDates = useMemo(() => [...new Set([...materials.map((item) => item.date), ...contracts.map((item) => item.date)])].sort((a, b) => b.localeCompare(a)), [materials, contracts]);
  const dailySummary = useMemo(
  () => getDailySummary(selectedDailyDate, materials, contracts, dailyExtras),
  [selectedDailyDate, materials, contracts, dailyExtras]
);
  const inventoryOnlyMaterials = useMemo(() => materials.filter((item) => item.status === "库存中"), [materials]);
  const filteredPackageMaterials = useMemo(() => {
    return inventoryOnlyMaterials.filter((item) => {
      const matchName = !packageFilters.name || item.name.toLowerCase().includes(packageFilters.name.toLowerCase());
      const matchPlatform = packageFilters.platform === "全部" || item.platform === packageFilters.platform;
      const matchWearLevel = packageFilters.wearLevel === "全部" || item.wearLevel === packageFilters.wearLevel;
      const itemRange = item.wearRange === "自定义" ? item.customWear || "自定义" : item.wearRange;
      const matchWearRange = packageFilters.wearRange === "全部" || itemRange === packageFilters.wearRange;
      return matchName && matchPlatform && matchWearLevel && matchWearRange;
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
map[date] = getDailySummary(date, materials, contracts, dailyExtras);
    });
    return map;
  }, [dailyDates, materials, contracts]);

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
  setMaterialForm({
    date: new Date().toISOString().slice(0, 10),
    platform: "BUFF",
    name: "",
    wearLevel: "久经沙场",
    wearRange: "0.15 - 0.18",
    customWear: "",
    cost: "",
    salePrice: "",
  });

  console.log("form reset done");
};

  const syncContractResult = (nextResult) => {
    setContractForm((prev) => ({ ...prev, result: nextResult, furnaceRatePercent: nextResult === "成功" ? prev.furnaceRatePercent || "10" : "0" }));
  };

const addContract = async () => {
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
    const validCount = packageForm.selectedIds.length === 5 || packageForm.selectedIds.length === 10;
    if (!validCount || !packageForm.outputName) return;
    const salePrice = packageForm.salePrice ? Number(packageForm.salePrice) : "";
    setMaterials((prev) => prev.map((item) => packageForm.selectedIds.includes(item.id) ? { ...item, status: "已售出", salePrice: Number(item.cost || 0) } : item));
    setContracts((prev) => [{ id: Date.now(), date: packageForm.date, contractName: packageForm.contractName || "包炉记录", outputName: packageForm.outputName, outputWearLevel: packageForm.outputWearLevel, outputWearRange: packageForm.outputWearRange, outputCustomWear: packageForm.outputCustomWear, refPrice: Number(packageCost.toFixed(2)), result: packageForm.result, furnaceRate: 0, furnaceFee: 0, salePrice, status: salePrice ? "已售出" : "库存中", type: "包炉" }, ...prev]);
    setPackageForm((prev) => ({ ...prev, contractName: "", outputName: "", outputWearLevel: "久经沙场", outputWearRange: "0.15 - 0.18", outputCustomWear: "", result: "成功", salePrice: "", selectedIds: [] }));
  };

  const updateInventoryField = (row, field, value) => {
    if (row.itemType === "material") {
      setMaterials((prev) => prev.map((item) => {
        if (item.id !== row.rawId) return item;
        if (field === "wearLevel") {
          return { ...item, wearLevel: value, wearRange: wearRanges[value][0], customWear: "" };
        }
        if (field === "wearRange") {
          return { ...item, wearRange: value, customWear: value === "自定义" ? item.customWear : "" };
        }
        if (field === "cost" || field === "salePrice") {
          const nextValue = value === "" ? "" : Number(value);
          const nextStatus = field === "salePrice" ? (value === "" ? "库存中" : "已售出") : item.status;
          return { ...item, [field]: nextValue, status: nextStatus };
        }
        return { ...item, [field]: value };
      }));
      return;
    }

    setContracts((prev) => prev.map((item) => {
      if (item.id !== row.rawId) return item;
      if (field === "name") return { ...item, outputName: value };
      if (field === "wearLevel") return { ...item, outputWearLevel: value, outputWearRange: wearRanges[value][0], outputCustomWear: "" };
      if (field === "wearRange") return { ...item, outputWearRange: value, outputCustomWear: value === "自定义" ? item.outputCustomWear : "" };
      if (field === "cost") return { ...item, refPrice: value === "" ? 0 : Number(value) };
      if (field === "salePrice") return { ...item, salePrice: value === "" ? "" : Number(value), status: value === "" ? "库存中" : "已售出" };
      return item;
    }));
  };

  const toggleStatsVisibility = (key) => setVisibleStatMap((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleSelectRow = (id, checked) => {
    setSelectedIds((prev) => checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id));
  };

  const selectAllVisible = () => setSelectedIds(filteredInventory.map((item) => item.id));
  const clearSelected = () => setSelectedIds([]);

const deleteSelected = async () => {
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
        <div className="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
  <div>
    <h1 className="text-3xl font-bold tracking-tight text-slate-900">XiaoLu记账1.0</h1>
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
      onClick={handleLogout}
      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
    >
      退出登录
    </button>
  </div>
</div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="材料毛利" value={money(stats.materialProfit)} hidden={!visibleStatMap.materialProfit} icon={<Wallet className="h-8 w-8 text-slate-400" />} onToggle={() => toggleStatsVisibility("materialProfit")} />
          <StatCard title="产物出售利润" value={money(stats.productProfit)} hidden={!visibleStatMap.productProfit} icon={<TrendingUp className="h-8 w-8 text-slate-400" />} onToggle={() => toggleStatsVisibility("productProfit")} />
          <StatCard title="开炉费" value={money(stats.furnaceIncome)} hidden={!visibleStatMap.furnaceIncome} icon={<Layers3 className="h-8 w-8 text-slate-400" />} onToggle={() => toggleStatsVisibility("furnaceIncome")} />
          <StatCard title="库存数量" value={String(stats.stockCount)} hidden={!visibleStatMap.stockCount} icon={<Boxes className="h-8 w-8 text-slate-400" />} onToggle={() => toggleStatsVisibility("stockCount")} />
          <StatCard title="库存成本" value={money(stats.stockCost)} hidden={!visibleStatMap.stockCost} icon={<PackageCheck className="h-8 w-8 text-slate-400" />} onToggle={() => toggleStatsVisibility("stockCost")} />
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
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <CardTitle>库存管理</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {!editMode && (
  <Button
    type="button"
    variant="outline"
    className="rounded-2xl"
    onClick={() => {
      setEditMode(true);
      setSelectedIds([]);
    }}
  >
    <Pencil className="mr-2 h-4 w-4" />
    编辑总开关
  </Button>
)}
                    {editMode && (
                      <>
                      
                        <Button type="button" variant="outline" className="rounded-2xl" onClick={selectAllVisible}>全选</Button>
                        <Button type="button" variant="outline" className="rounded-2xl" onClick={clearSelected}>全不选</Button>
                        <Button type="button" variant="destructive" className="rounded-2xl" onClick={deleteSelected}>
                          <Trash2 className="mr-2 h-4 w-4" />删除
                        </Button>
                        <Button
  type="button"
  variant="default"
  className="rounded-2xl"
  onClick={() => {
    setEditMode(false);
    setSelectedIds([]);
  }}
>
  ✅完成编辑
</Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <FieldDate label="日期筛选" value={inventoryFilters.date} onChange={(value) => setInventoryFilters({ ...inventoryFilters, date: value })} lang="en-CA" />
                  <SelectField label="平台筛选" value={inventoryFilters.platform} options={["全部", ...inventoryPlatformOptions]} onChange={(value) => setInventoryFilters({ ...inventoryFilters, platform: value })} />
                  <TextField label="名称筛选" placeholder="输入名称关键词" value={inventoryFilters.name} onChange={(value) => setInventoryFilters({ ...inventoryFilters, name: value })} />
                  <SelectField label="磨损等级筛选" value={inventoryFilters.wearLevel} options={["全部", ...wearLevelOptions]} onChange={(value) => setInventoryFilters({ ...inventoryFilters, wearLevel: value })} />
                  <SelectField label="磨损区间筛选" value={inventoryFilters.wearRange} options={inventoryWearRangeOptions} onChange={(value) => setInventoryFilters({ ...inventoryFilters, wearRange: value })} />
                </div>

                {editMode && (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    已选 {selectedRows.length} 项 ｜ 求和 {money(selectedSum)} ｜ 平均 {money(selectedAvg)}
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
                      <TableHead>利润</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map((item) => (
                      <TableRow key={item.id}>
                        {editMode && (
                          <TableCell>
                            <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(e) => toggleSelectRow(item.id, e.target.checked)} />
                          </TableCell>
                        )}
                        <TableCell>{formatInventoryDate(item.date, Boolean(inventoryFilters.date))}</TableCell>
                        <TableCell>
                          {editMode && !item.isContract ? (
                            <Select value={item.platform} onValueChange={(value) => updateInventoryField(item, "platform", value)}>
                              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {platformOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : item.platform}
                        </TableCell>
                        <TableCell>
                          {editMode ? <Input value={item.name} onChange={(e) => updateInventoryField(item, "name", e.target.value)} /> : item.name}
                        </TableCell>
                        <TableCell>
                          {editMode ? (
                            <Select value={item.wearLevel} onValueChange={(value) => updateInventoryField(item, "wearLevel", value)}>
                              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {wearLevelOptions.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : item.wearLevel}
                        </TableCell>
                        <TableCell>
                          {editMode ? (
                            <Select value={item.wearRange} onValueChange={(value) => updateInventoryField(item, "wearRange", value)}>
                              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(wearRanges[item.wearLevel] || [item.wearRange]).map((range) => <SelectItem key={range} value={range}>{range}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : item.wearRange}
                        </TableCell>
                        <TableCell>
                          {editMode ? <Input type="number" value={item.cost} onChange={(e) => updateInventoryField(item, "cost", e.target.value)} /> : money(item.cost)}
                        </TableCell>
                        <TableCell>
                          {editMode ? <Input type="number" value={item.salePrice === "" ? "" : item.salePrice} onChange={(e) => updateInventoryField(item, "salePrice", e.target.value)} /> : item.salePrice === "" ? "-" : money(item.salePrice)}
                        </TableCell>
                        <TableCell><Badge className={item.status === "库存中" ? "rounded-full bg-amber-100 text-amber-800 hover:bg-amber-100" : "rounded-full bg-slate-900 text-white hover:bg-slate-900"}>{item.status}</Badge></TableCell>
                        <TableCell>{item.profit === "" ? "-" : money(item.profit)}</TableCell>
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
                <CardHeader>
                  <CardTitle>汰换记录</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                    <Button type="button" variant={exchangeMode === "普通汰换" ? "default" : "ghost"} className="rounded-xl" onClick={() => setExchangeMode("普通汰换")}>普通汰换</Button>
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
                        <div className="grid gap-3 md:grid-cols-2">
                          <TextField label="名称筛选" placeholder="输入名称关键词" value={packageFilters.name} onChange={(value) => setPackageFilters({ ...packageFilters, name: value })} />
                          <SelectField label="平台筛选" value={packageFilters.platform} options={["全部", ...platformOptions]} onChange={(value) => setPackageFilters({ ...packageFilters, platform: value })} />
                          <SelectField label="磨损等级筛选" value={packageFilters.wearLevel} options={["全部", ...wearLevelOptions]} onChange={(value) => setPackageFilters({ ...packageFilters, wearLevel: value })} />
                          <SelectField label="磨损区间筛选" value={packageFilters.wearRange} options={inventoryWearRangeOptions} onChange={(value) => setPackageFilters({ ...packageFilters, wearRange: value })} />
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">已选 {packageForm.selectedIds.length} 个材料，只允许 5 个或 10 个。</div>
                        <div className="max-h-64 space-y-2 overflow-auto rounded-2xl border p-3">
                          {filteredPackageMaterials.map((item) => {
                            const active = packageForm.selectedIds.includes(item.id);
                            return (
                              <button key={item.id} type="button" className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${active ? "bg-slate-900 text-white" : "bg-white"}`} onClick={() => togglePackageMaterial(item.id)}>
                                <div>
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-xs opacity-70">{item.platform} · {item.wearLevel} · {item.wearRange === "自定义" ? item.customWear || "自定义" : item.wearRange}</div>
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
                <CardHeader>
                  <CardTitle>汰换记录</CardTitle>
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
                      {contracts.map((item) => {
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
<TableCell>{outputWearRange === "自定义" ? outputCustomWear || "自定义" : outputWearRange}</TableCell>
<TableCell>{money(furnaceFee)}</TableCell>
<TableCell>{salePrice ? money(salePrice) : "-"}</TableCell>
                            <TableCell><Badge className={item.result === "成功" ? "rounded-full bg-green-100 text-green-700 hover:bg-green-100" : "rounded-full bg-red-100 text-red-700 hover:bg-red-100"}>{item.result}</Badge></TableCell>
                            <TableCell>{money(item.furnaceFee)}</TableCell>
                            <TableCell>{item.salePrice ? money(item.salePrice) : "-"}</TableCell>
                            <TableCell>{money(profit)}</TableCell>
                            <TableCell><Badge variant="secondary" className="rounded-full">{item.status}</Badge></TableCell>
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
                <CardHeader>
                  <CardTitle>收益日历</CardTitle>
                </CardHeader>
                <CardContent
  className="space-y-4"
  onMouseLeave={() => setShowCalendar(false)}
>
  <button
    type="button"
    onClick={() => setShowCalendar((prev) => !prev)}
    className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-left"
  >
    <div>
      <div className="text-sm text-slate-500">当天收益</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">
        {money(dailySummary.totalProfit)}
      </div>
    </div>
    <div className="text-sm text-slate-500">
      {showCalendar ? "收起 ↑" : "展开日历 ↓"}
    </div>
  </button>

  {showCalendar && (
    <>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <CalendarDays className="h-4 w-4" />
        <span>{calendarYear} 年 {calendarMonth} 月</span>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
        {['日','一','二','三','四','五','六'].map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {monthCells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="h-20 rounded-2xl bg-transparent" />;
          const dateKey = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const summary = dateSummaryMap[dateKey];
          if (!summary) {
            return (
              <div
                key={dateKey}
                className="h-20 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-2 text-slate-300"
              >
                {day}
              </div>
            );
          }
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => setSelectedDailyDate(dateKey)}
              className={`h-20 rounded-2xl border p-2 text-left ${
                selectedDailyDate === dateKey
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="text-sm font-semibold">{day}</div>
              <div className="mt-2 text-xs">{money(summary.totalProfit)}</div>
            </button>
          );
        })}
      </div>
    </>
  )}
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
  <input
    type="number"
    value={dailyExtras[selectedDailyDate] ?? ""}
    onChange={(e) =>
      setDailyExtras((prev) => ({
        ...prev,
        [selectedDailyDate]: e.target.value,
      }))
    }
    placeholder="天天开心^.^"
    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
  />
</div>
                  <SummaryRow label="总收益" value={money(dailySummary.totalProfit)} strong />

                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <div className="mb-3 text-sm font-medium text-slate-700">{detailTitle}</div>
                    <div className="space-y-2">
                      {detailItems.length ? detailItems.map((item) => (
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
      <CardContent className="flex items-center justify-between p-5">
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
