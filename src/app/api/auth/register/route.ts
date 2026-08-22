import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lineId, name, password, avatar, statusMessage } = body;

    if (!lineId || !name || !password) {
      return NextResponse.json(
        { error: "Chaline ID, name, and password are required." },
        { status: 400 }
      );
    }

    const cleanLineId = lineId.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");

    if (cleanLineId.length < 3) {
      return NextResponse.json(
        { error: "Chaline ID must be at least 3 characters long." },
        { status: 400 }
      );
    }

    // Check if Chaline ID already exists
    const existing = await prisma.user.findUnique({
      where: { lineId: cleanLineId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This Chaline ID is already taken. Please choose another one." },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        lineId: cleanLineId,
        name: name.trim(),
        password: hashedPassword,
        avatar:
          avatar ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
            cleanLineId
          )}`,
        statusMessage: statusMessage?.trim() || "Available on LINE",
      },
      select: {
        id: true,
        lineId: true,
        name: true,
        avatar: true,
        statusMessage: true,
        createdAt: true,
      },
    });

    const token = await signToken({
      userId: user.id,
      lineId: user.lineId,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      user,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Register Error:", error);
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }
}
