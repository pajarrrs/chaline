import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { targetLineId } = body;

    if (!targetLineId) {
      return NextResponse.json(
        { error: "Chaline ID is required." },
        { status: 400 }
      );
    }

    const cleanTargetId = targetLineId.trim().toLowerCase();

    // Check if adding self
    if (cleanTargetId === session.lineId) {
      return NextResponse.json(
        { error: "You cannot add yourself as a friend." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { lineId: cleanTargetId },
      select: {
        id: true,
        lineId: true,
        name: true,
        avatar: true,
        statusMessage: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: `User with Chaline ID "${targetLineId}" not found.` },
        { status: 404 }
      );
    }

    // Check if already friends
    const existing = await prisma.friendship.findUnique({
      where: {
        userId_friendId: {
          userId: session.userId,
          friendId: targetUser.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `${targetUser.name} is already in your friends list.` },
        { status: 409 }
      );
    }

    // Create mutual friendship
    await prisma.$transaction([
      prisma.friendship.create({
        data: {
          userId: session.userId,
          friendId: targetUser.id,
        },
      }),
      prisma.friendship.upsert({
        where: {
          userId_friendId: {
            userId: targetUser.id,
            friendId: session.userId,
          },
        },
        create: {
          userId: targetUser.id,
          friendId: session.userId,
        },
        update: {},
      }),
    ]);

    return NextResponse.json({
      success: true,
      friend: targetUser,
    });
  } catch (error: any) {
    console.error("Add Friend Error:", error);
    return NextResponse.json(
      { error: "Failed to add friend. Please try again." },
      { status: 500 }
    );
  }
}
