import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lineId, password } = body;

    if (!lineId || !password) {
      return NextResponse.json(
        { error: "Chaline ID and password are required." },
        { status: 400 }
      );
    }

    const cleanLineId = lineId.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { lineId: cleanLineId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid Chaline ID or password." },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid LINE ID or password." },
        { status: 401 }
      );
    }

    const token = await signToken({
      userId: user.id,
      lineId: user.lineId,
      name: user.name,
    });

    const userPayload = {
      id: user.id,
      lineId: user.lineId,
      name: user.name,
      avatar: user.avatar,
      statusMessage: user.statusMessage,
      createdAt: user.createdAt,
    };

    const response = NextResponse.json({
      success: true,
      user: userPayload,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login Error:", error);
    return NextResponse.json(
      { error: "Failed to log in. Please try again." },
      { status: 500 }
    );
  }
}
