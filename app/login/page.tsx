"use client";
// @ts-nocheck
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(`登录失败：${error.message}`);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleRegister() {
    setLoading(true);
if (password !== confirmPassword) {
alert("两次密码不一致");
  return;
}
    const res = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const result = await res.json();
    setLoading(false);

    if (!res.ok) {
      alert(result.error || "注册失败");
      return;
    }

    alert("注册成功，请直接登录");
    setMode("login");

  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>
          CS2炼金记账
        </h1>
        <p style={{ marginTop: 10, color: "#64748b", fontSize: 14 }}>
          {mode === "login" ? "  —— Designed by ZaLL" : "联系作者：QQ 2647060757"}
        </p>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "#f1f5f9",
            padding: 6,
            borderRadius: 14,
            gap: 6,
          }}
        >
          <button
            type="button"
            onClick={() => setMode("login")}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "12px 14px",
              cursor: "pointer",
              background: mode === "login" ? "#0f172a" : "transparent",
              color: mode === "login" ? "#fff" : "#0f172a",
              fontWeight: 700,
            }}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "12px 14px",
              cursor: "pointer",
              background: mode === "register" ? "#0f172a" : "transparent",
              color: mode === "register" ? "#fff" : "#0f172a",
              fontWeight: 700,
            }}
          >
            注册
          </button>
        </div>

<div className="space-y-4">
  <div className="space-y-2">
    <Label>邮箱</Label>
    <Input
      type="email"
      value={email}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        setEmail(e.target.value)
      }
      placeholder="请输入邮箱"
      className="h-14 rounded-2xl"
    />
  </div>

 <div className="space-y-2">
    <Label>密码</Label>
    <Input
      type="password"
      value={password}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        setPassword(e.target.value)
      }
      placeholder="请输入密码"
      className="h-14 rounded-2xl"
    />
  </div>

{mode === "register" && (
  <div className="space-y-2">
    <Label>确认密码</Label>
    <Input
      type="password"
      value={confirmPassword}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        setConfirmPassword(e.target.value)
      }
      placeholder="请再次输入密码"
      className="h-14 rounded-2xl"
    />
  </div>
)}
</div>

        <button
          type="button"
          onClick={mode === "login" ? handleLogin : handleRegister}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 22,
            border: "none",
            borderRadius: 14,
            padding: "14px 16px",
            cursor: "pointer",
            background: "#0f172a",
            color: "#fff",
            fontWeight: 800,
            fontSize: 15,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
        </button>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 14,
  fontWeight: 600,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};