import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const inviteCode = String(body.inviteCode || "").trim();

    if (!email || !password || !inviteCode) {
      return NextResponse.json(
        { error: "邮箱、密码和邀请码不能为空" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少需要 6 位" },
        { status: 400 }
      );
    }

    const { data: inviteRow, error: inviteError } = await supabaseAdmin
      .from("invite_codes")
      .select("*")
      .eq("code", inviteCode)
      .maybeSingle();

    if (inviteError) {
      return NextResponse.json(
        { error: "邀请码查询失败", detail: inviteError.message },
        { status: 500 }
      );
    }

    if (!inviteRow) {
      return NextResponse.json(
        { error: "邀请码不存在" },
        { status: 400 }
      );
    }

    if (inviteRow.is_used) {
      return NextResponse.json(
        { error: "邀请码已使用" },
        { status: 400 }
      );
    }

    if (inviteRow.expires_at) {
      const expiresAt = new Date(inviteRow.expires_at).getTime();
      if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) {
        return NextResponse.json(
          { error: "邀请码已过期" },
          { status: 400 }
        );
      }
    }

    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) {
      return NextResponse.json(
        { error: "创建用户失败", detail: createError.message },
        { status: 400 }
      );
    }

    const userId = createdUser.user?.id;

    const { error: updateInviteError } = await supabaseAdmin
      .from("invite_codes")
      .update({
        is_used: true,
        used_by: userId,
        used_at: new Date().toISOString(),
      })
      .eq("id", inviteRow.id);

    if (updateInviteError) {
      return NextResponse.json(
        { error: "用户已创建，但邀请码更新失败", detail: updateInviteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "注册成功",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "注册接口异常", detail: error?.message || "unknown error" },
      { status: 500 }
    );
  }
}