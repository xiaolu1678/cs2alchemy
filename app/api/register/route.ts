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
    const body = await request.json();

    const username = normalizeUsername(body.username || "");
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!username || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "用户名、密码和确认密码不能为空" },
        { status: 400 }
      );
    }

    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "用户名只能使用英文字母和数字，长度 3-20 位" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少需要 6 位" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "两次密码不一致" },
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

    if (existedMembership) {
      return NextResponse.json(
        { error: "用户名已被使用" },
        { status: 409 }
      );
    }

    const email = usernameToEmail(username);

    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username },
      });

    if (createError) {
      const duplicated = createError.message?.toLowerCase?.().includes("already") || createError.message?.toLowerCase?.().includes("registered");
      return NextResponse.json(
        { error: duplicated ? "用户名已被使用" : "创建用户失败", detail: createError.message },
        { status: duplicated ? 409 : 400 }
      );
    }

    const userId = createdUser.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "创建用户成功，但未获取到 user id" },
        { status: 500 }
      );
    }

    const expiresAt = new Date(
      Date.now() + 8 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: membershipError } = await supabaseAdmin
      .from("user_memberships")
      .upsert({
        user_id: userId,
        username,
        membership_expires_at: expiresAt,
        is_readonly: false,
        updated_at: new Date().toISOString(),
      });

    if (membershipError) {
      return NextResponse.json(
        {
          error: "用户已创建，但会员信息初始化失败",
          detail: membershipError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      username,
      message: "注册成功，已赠送 8 天免费体验",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "注册接口异常", detail: error?.message || "unknown error" },
      { status: 500 }
    );
  }
}
