"use client";
// @ts-nocheck

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Heart } from "lucide-react";

const USERNAME_EMAIL_DOMAIN = "rijindoujin.app";
const USERNAME_RE = /^[A-Za-z0-9]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeUsername(value: string) {
  return String(value || "").trim().toLowerCase();
}

function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
}

function validateUsername(username: string) {
  const normalized = normalizeUsername(username);
  if (!normalized) return "用户名不能为空";
  if (!USERNAME_RE.test(normalized)) return "用户名只能使用英文字母和数字，长度 3-20 位";
  return "";
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleLogin() {
    const identifier = String(username || "").trim();

    if (!identifier) {
      alert("用户名或旧邮箱不能为空");
      return;
    }

    if (!password) {
      alert("密码不能为空");
      return;
    }

    let loginEmail = "";

    if (identifier.includes("@")) {
      if (!EMAIL_RE.test(identifier)) {
        alert("请输入正确的邮箱");
        return;
      }
      loginEmail = identifier;
    } else {
      const usernameError = validateUsername(identifier);
      if (usernameError) {
        alert(usernameError);
        return;
      }
      loginEmail = usernameToEmail(identifier);
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) {
        alert("登录失败：用户名 / 邮箱或密码错误");
        return;
      }

      if (!data?.session) {
        alert("登录成功但 session 没有写入，请刷新后重试");
        return;
      }

      window.location.href = "/";
    } catch (err) {
      console.error("登录失败", err);
      alert("登录请求失败，请检查网络或 Supabase 配置");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    const normalizedUsername = normalizeUsername(username);
    const usernameError = validateUsername(normalizedUsername);
    if (usernameError) {
      alert(usernameError);
      return;
    }

    if (!password || !confirmPassword) {
      alert("密码和确认密码不能为空");
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
          username: normalizedUsername,
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
      setUsername(normalizedUsername);
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fff0f7] px-4 py-8 text-[#3b1020] sm:px-6">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[#ffe0ec] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-260px] right-[-160px] h-[560px] w-[560px] rounded-full bg-[#ffc9dd]/80 blur-3xl" />
      <div className="pointer-events-none absolute left-[-180px] top-[22%] h-[420px] w-[420px] rounded-full bg-[#ffdce8]/70 blur-3xl" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute left-[8%] top-[18%] text-2xl text-[#ff8ab0]/45 animate-[floatHeart_7s_ease-in-out_infinite]">♥</span>
        <span className="absolute left-[16%] top-[72%] text-xl text-[#ffb3c9]/55 animate-[floatHeart_8.4s_ease-in-out_infinite_0.7s]">♡</span>
        <span className="absolute right-[9%] top-[18%] text-3xl text-[#ff7aa8]/35 animate-[floatHeart_7.8s_ease-in-out_infinite_0.3s]">♥</span>
        <span className="absolute right-[14%] bottom-[14%] text-2xl text-[#ffc0d3]/60 animate-[floatHeart_9s_ease-in-out_infinite_1s]">♡</span>
        <span className="absolute left-[48%] top-[8%] text-lg text-[#ff8ab0]/35 animate-[floatHeart_6.8s_ease-in-out_infinite_0.4s]">♥</span>
      </div>

      <div className="relative grid w-full max-w-[980px] overflow-hidden rounded-[38px] border border-[#ffc7d9] bg-[#fff9fb]/95 shadow-[0_30px_110px_rgba(244,114,182,0.22)] backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden min-h-[620px] border-r border-[#ffd1df] bg-gradient-to-br from-[#ffd6e8] via-[#fff1f6] to-[#fffafc] p-12 lg:flex">
          <div className="flex h-full flex-col justify-center">
            <div className="space-y-10">
              <div className="h-[2px] w-24 bg-[#ff7aa8] animate-[fadeIn_1s_ease-out]" />

              <div className="space-y-1">
                <div className="relative inline-block">
                  <div className="absolute -right-24 -top-9 z-10 rounded-full border border-white/70 bg-gradient-to-r from-[#ff6f9f] via-[#ff8ab0] to-[#ffb0c8] px-4 py-1.5 text-sm font-black tracking-[0.18em] text-white shadow-[0_12px_28px_rgba(244,114,182,0.34)] animate-[badgePop_2.8s_ease-in-out_infinite]">
                    520限定版
                  </div>
                  <div className="absolute -right-8 -top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#ff5c93] shadow-[0_10px_24px_rgba(244,114,182,0.25)] animate-[heartBeat_1.8s_ease-in-out_infinite]">
                    <Heart className="h-5 w-5 fill-current" />
                  </div>
                  <div className="animate-[slideUp_0.8s_ease-out] text-[78px] font-black leading-[0.88] tracking-[-0.09em] text-[#3b1020]">
                    日进
                  </div>
                </div>
                <div className="relative inline-block">
                  <div className="absolute -right-12 -top-5 text-2xl text-[#ff7aa8] animate-[heartBeat_2.2s_ease-in-out_infinite_0.2s]">♥</div>
                  <div className="animate-[slideUp_1s_ease-out] text-[78px] font-black leading-[0.88] tracking-[-0.09em] text-[#3b1020]">
                    斗金
                  </div>
                </div>
              </div>

              <div className="relative h-16 overflow-hidden pt-2">
                <div className="absolute inset-0 animate-[featureRoll_8s_ease-in-out_infinite] space-y-4">
                  {["材料登记", "库存管理", "合炉记录", "收益统计", "材料登记"].map((line, index) => (
                    <div
                      key={`${line}-${index}`}
                      className="flex h-12 items-center gap-3 text-lg font-black tracking-[0.18em] text-[#9f4f68]"
                    >
                      <span className="h-1.5 w-8 rounded-full bg-[#ff7aa8]" />
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-[620px] items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-[430px]">
            <div className="mb-9">
              <div className="lg:hidden">
                <div className="h-1.5 w-14 rounded-full bg-[#ff7aa8]" />
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#ffc7d9] bg-white/80 px-3 py-1 text-xs font-black tracking-[0.16em] text-[#ff5c93] shadow-sm">
                  <Heart className="h-3.5 w-3.5 fill-current" />
                  520限定版
                </div>
                <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-[#3b1020]">
                  日进斗金
                </h1>
              </div>

              <p className="hidden text-xs font-black tracking-[0.3em] text-[#c77a92] lg:block">
                {mode === "login" ? "LOGIN" : "REGISTER"}
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#3b1020] sm:text-4xl">
                {mode === "login" ? "登录" : "注册"}
              </h2>
              <p className="mt-3 text-sm text-[#9f4f68]">
                {mode === "login" ? "—— Design by ZaLL" : "联系作者：2647060757"}
              </p>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-1.5 rounded-2xl border border-[#ffd1df] bg-[#fff5f8] p-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setConfirmPassword("");
                }}
                className={`h-12 rounded-xl text-sm font-black transition-all ${
                  mode === "login"
                    ? "bg-gradient-to-r from-[#ff7aa8] to-[#ff9dbb] text-white shadow-sm"
                    : "text-[#9f4f68] hover:bg-white hover:text-[#3b1020]"
                }`}
              >
                登录
              </button>

              <button
                type="button"
                onClick={() => setMode("register")}
                className={`h-12 rounded-xl text-sm font-black transition-all ${
                  mode === "register"
                    ? "bg-gradient-to-r from-[#ff7aa8] to-[#ff9dbb] text-white shadow-sm"
                    : "text-[#9f4f68] hover:bg-white hover:text-[#3b1020]"
                }`}
              >
                注册
              </button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-black text-[#9f4f68]">{mode === "login" ? "用户名 " : "用户名"}</Label>
                <Input
                  type="text"
                  value={username}
                  onKeyDown={submitByEnter}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    setUsername(mode === "login" ? value.trim() : value.replace(/[^A-Za-z0-9]/g, "").slice(0, 20));
                  }}
                  placeholder={mode === "login" ? "请输入用户名" : "请输入用户名"}
                  autoComplete="username"
                  className="h-14 rounded-2xl border-[#ffd1df] bg-white px-4 text-base shadow-none transition placeholder:text-[#d8a0b0] focus:border-[#ff7aa8] focus:ring-4 focus:ring-[#ffe4ef]"
                />
                <div className="text-xs font-medium text-[#c77a92]">{"英文字母和数字，3-20 位"}</div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black text-[#9f4f68]">密码</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onKeyDown={submitByEnter}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="h-14 rounded-2xl border-[#ffd1df] bg-white px-4 pr-12 text-base shadow-none transition placeholder:text-[#d8a0b0] focus:border-[#ff7aa8] focus:ring-4 focus:ring-[#ffe4ef]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#c77a92] hover:bg-[#ffe4ef] hover:text-[#ff5c93]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div className="space-y-2">
                  <Label className="text-xs font-black text-[#9f4f68]">确认密码</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onKeyDown={submitByEnter}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                      placeholder="请再次输入密码"
                      autoComplete="new-password"
                      className="h-14 rounded-2xl border-[#ffd1df] bg-white px-4 pr-12 text-base shadow-none transition placeholder:text-[#d8a0b0] focus:border-[#ff7aa8] focus:ring-4 focus:ring-[#ffe4ef]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#c77a92] hover:bg-[#ffe4ef] hover:text-[#ff5c93]"
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
              className="mt-8 h-14 w-full rounded-2xl bg-gradient-to-r from-[#ff6f9f] via-[#ff86ae] to-[#ffa5bf] text-base font-black text-white shadow-[0_16px_34px_rgba(244,114,182,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
            </button>
          </div>
        </section>
      </div>
      <style jsx global>{`
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
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes featureRoll {
          0%,
          14% {
            transform: translateY(0);
          }
          22%,
          36% {
            transform: translateY(-64px);
          }
          44%,
          58% {
            transform: translateY(-128px);
          }
          66%,
          80% {
            transform: translateY(-192px);
          }
          88%,
          100% {
            transform: translateY(-256px);
          }
        }

        @keyframes heartBeat {
          0%,
          100% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.16);
          }
        }

        @keyframes badgePop {
          0%,
          100% {
            transform: translateY(0) rotate(-3deg);
          }
          50% {
            transform: translateY(-4px) rotate(2deg);
          }
        }

        @keyframes floatHeart {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.45;
          }
          50% {
            transform: translateY(-18px) rotate(8deg);
            opacity: 0.78;
          }
        }
      `}</style>
    </main>
  );
}
