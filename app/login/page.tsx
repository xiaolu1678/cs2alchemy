"use client";
// @ts-nocheck

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const featureLines = ["材料登记", "库存管理", "合炉记录", "收益统计"];

  async function handleLogin() {
    if (!email || !password) {
      alert("邮箱和密码不能为空");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        alert(`登录失败：${error.message}`);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("登录失败", err);
      alert("登录请求失败，请检查网络或 Supabase 配置");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!email || !password || !confirmPassword) {
      alert("邮箱、密码和确认密码不能为空");
      return;
    }

    if (password.length < 6) {
      alert("密码至少需要 6 位");
      return;
    }

    if (password !== confirmPassword) {
      alert("两次密码不一致");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: email.split("@")[0],
          email: email.trim(),
          password,
          confirmPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result?.error || "注册失败");
        return;
      }

      alert(result?.message || "注册成功，已赠送 8 天免费体验");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("注册失败", err);
      alert("注册请求失败，请检查网络或接口配置");
    } finally {
      setLoading(false);
    }
  }

  function submitByEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      mode === "login" ? handleLogin() : handleRegister();
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f7fb] px-4 py-8 text-[#0f172a] sm:px-6">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-white blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-260px] right-[-160px] h-[560px] w-[560px] rounded-full bg-[#dbeafe]/70 blur-3xl" />

      <div className="relative grid w-full max-w-[980px] overflow-hidden rounded-[38px] border border-[#e2e8f0] bg-white shadow-[0_30px_110px_rgba(15,23,42,0.12)] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden min-h-[620px] border-r border-[#e2e8f0] bg-gradient-to-br from-[#e0f2fe] via-[#f0f9ff] to-white p-12 lg:flex">
  <div className="flex h-full flex-col justify-center">
    <div className="space-y-10">
      <div className="h-[2px] w-24 bg-[#1e293b] animate-[fadeIn_1s_ease-out]" />

      <div className="space-y-1">
        <div className="text-[78px] leading-[0.88] font-black tracking-[-0.09em] text-[#0f172a] animate-[slideUp_0.8s_ease-out]">
          日进
        </div>
        <div className="text-[78px] leading-[0.88] font-black tracking-[-0.09em] text-[#0f172a] animate-[slideUp_1s_ease-out]">
          斗金
        </div>
      </div>

      <div className="relative h-16 overflow-hidden pt-2">
        <div className="absolute inset-0 animate-[featureRoll_8s_ease-in-out_infinite] space-y-4">
          {featureLines.map((line) => (
            <div key={line} className="flex h-12 items-center gap-3 text-lg font-black tracking-[0.18em] text-[#64748b]">
              <span className="h-1.5 w-8 rounded-full bg-[#1e293b]" />
              {line}
            </div>
          ))}
          <div className="flex h-12 items-center gap-3 text-lg font-black tracking-[0.18em] text-[#64748b]">
            <span className="h-1.5 w-8 rounded-full bg-[#1e293b]" />
            {featureLines[0]}
          </div>
        </div>
      </div>
    </div>
  </div>

  <style jsx>{`
    @keyframes slideUp {
      from {
        transform: translateY(22px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes featureRoll {
      0%, 14% { transform: translateY(0); }
      22%, 36% { transform: translateY(-64px); }
      44%, 58% { transform: translateY(-128px); }
      66%, 80% { transform: translateY(-192px); }
      88%, 100% { transform: translateY(-256px); }
    }
  `}</style>
</section>

        <section className="flex min-h-[620px] items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
          <div className="flex min-h-[500px] w-full max-w-[430px] flex-col justify-center">
            <div className="mb-9">
              <div className="lg:hidden">
                <div className="h-1.5 w-14 rounded-full bg-[#1e293b]" />
                <h1 className="mt-5 text-4xl font-black tracking-[-0.06em] text-[#0f172a]">日进斗金</h1>
              </div>

              <p className="hidden text-xs font-black tracking-[0.3em] text-[#94a3b8] lg:block">
                {mode === "login" ? "LOGIN" : "REGISTER"}
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#0f172a] sm:text-4xl">
                {mode === "login" ? "登录" : "注册"}
              </h2>
              <p className="mt-3 text-sm text-[#64748b]">
                {mode === "login" ? "Designed by ZaLL" : "联系作者：QQ 2647060757"}
              </p>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-1.5 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setConfirmPassword("");
                }}
                className={`h-12 rounded-xl text-sm font-black transition-all ${
                  mode === "login"
                    ? "bg-[#1e293b] text-white shadow-sm"
                    : "text-[#64748b] hover:bg-white hover:text-[#0f172a]"
                }`}
              >
                登录
              </button>

              <button
                type="button"
                onClick={() => setMode("register")}
                className={`h-12 rounded-xl text-sm font-black transition-all ${
                  mode === "register"
                    ? "bg-[#1e293b] text-white shadow-sm"
                    : "text-[#64748b] hover:bg-white hover:text-[#0f172a]"
                }`}
              >
                注册
              </button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-black text-[#64748b]">邮箱</Label>
                <Input
                  type="email"
                  value={email}
                  onKeyDown={submitByEnter}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder="请输入邮箱"
                  className="h-14 rounded-2xl border-[#e2e8f0] bg-white px-4 text-base shadow-none transition focus:border-[#3b82f6] focus:ring-4 focus:ring-[#eff6ff]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black text-[#64748b]">密码</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onKeyDown={submitByEnter}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="h-14 rounded-2xl border-[#e2e8f0] bg-white px-4 pr-12 text-base shadow-none transition focus:border-[#3b82f6] focus:ring-4 focus:ring-[#eff6ff]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:bg-[#eff6ff] hover:text-[#2563eb]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div className="space-y-2">
                  <Label className="text-xs font-black text-[#64748b]">确认密码</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onKeyDown={submitByEnter}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                      placeholder="请再次输入密码"
                      className="h-14 rounded-2xl border-[#e2e8f0] bg-white px-4 pr-12 text-base shadow-none transition focus:border-[#3b82f6] focus:ring-4 focus:ring-[#eff6ff]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:bg-[#eff6ff] hover:text-[#2563eb]"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={mode === "login" ? handleLogin : handleRegister}
              disabled={loading}
              className="mt-8 h-14 w-full rounded-2xl bg-[#1e293b] text-base font-black text-white shadow-[0_16px_34px_rgba(30,41,59,0.20)] transition hover:bg-[#334155] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
