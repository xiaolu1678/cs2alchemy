import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const USERNAME_EMAIL_DOMAIN = "rijindoujin.app";
const USERNAME_RE = /^[A-Za-z0-9]{3,20}$/;

function normalizeUsername(value: string) {
  return String(value || "").trim().toLowerCase();
}

function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "登录状态已失效，请重新登录" },
        { status: 401 }
      );
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user?.id) {
      return NextResponse.json(
        { error: "登录状态已失效，请重新登录", detail: userError?.message },
        { status: 401 }
      );
    }

    const userId = userData.user.id;
    const body = await request.json();
    const username = normalizeUsername(body.username || "");

    if (!username) {
      return NextResponse.json(
        { error: "用户名不能为空" },
        { status: 400 }
      );
    }

    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "用户名只能使用英文字母和数字，长度 3-20 位" },
        { status: 400 }
      );
    }

    const { data: existedMembership, error: existedError } = await supabaseAdmin
      .from("user_memberships")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();

    if (existedError) {
      return NextResponse.json(
        { error: "检查用户名失败", detail: existedError.message },
        { status: 500 }
      );
    }

    if (existedMembership && existedMembership.user_id !== userId) {
      return NextResponse.json(
        { error: "用户名已被使用" },
        { status: 409 }
      );
    }

    const email = usernameToEmail(username);

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
      user_metadata: { username },
    });

    if (authUpdateError) {
      const duplicated = authUpdateError.message?.toLowerCase?.().includes("already") || authUpdateError.message?.toLowerCase?.().includes("registered");
      return NextResponse.json(
        { error: duplicated ? "用户名已被使用" : "更新登录用户名失败", detail: authUpdateError.message },
        { status: duplicated ? 409 : 400 }
      );
    }

    const { data: updatedMembership, error: membershipError } = await supabaseAdmin
      .from("user_memberships")
      .update({ username, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select()
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        { error: "更新用户名失败", detail: membershipError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      username,
      email,
      membership: updatedMembership,
      message: "用户名修改成功，下次登录请使用新用户名",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "修改用户名接口异常", detail: error?.message || "unknown error" },
      { status: 500 }
    );
  }
}
