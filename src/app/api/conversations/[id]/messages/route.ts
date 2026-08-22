import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;

    // Fetch messages + participants in parallel
    const [messages, conversation] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        take: 50,
        include: {
          sender: {
            select: {
              id: true,
              lineId: true,
              name: true,
              avatar: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              type: true,
              mediaUrl: true,
              sender: {
                select: {
                  id: true,
                  name: true,
                  lineId: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  lineId: true,
                  name: true,
                  avatar: true,
                  statusMessage: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Update lastReadAt asynchronously in background without blocking response
    prisma.conversationParticipant
      .update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: session.userId,
          },
        },
        data: { lastReadAt: new Date() },
      })
      .catch(() => {});

    return NextResponse.json({
      messages,
      participants: conversation?.participants || [],
    });
  } catch (error) {
    console.error("Fetch Messages Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const body = await req.json();
    const { content, type = "TEXT", mediaUrl, replyToId, id: customId } = body;

    if (!content && !mediaUrl) {
      return NextResponse.json(
        { error: "Message content or media is required." },
        { status: 400 }
      );
    }

    // Direct single fast insert
    const newMessage = await prisma.message.create({
      data: {
        ...(customId ? { id: customId } : {}),
        conversationId,
        senderId: session.userId,
        content:
          content ||
          (type === "STICKER"
            ? "[Sticker]"
            : type === "AUDIO"
            ? "[Voice Message]"
            : "[Image]"),
        type: type as "TEXT" | "STICKER" | "IMAGE" | "AUDIO",
        mediaUrl: mediaUrl || null,
        replyToId: replyToId || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            lineId: true,
            name: true,
            avatar: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            mediaUrl: true,
            sender: {
              select: {
                id: true,
                name: true,
                lineId: true,
              },
            },
          },
        },
      },
    });

    // Touch conversation & participant in background without blocking API response
    Promise.all([
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
      prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: session.userId,
          },
        },
        data: { lastReadAt: new Date() },
      }),
    ]).catch(() => {});

    return NextResponse.json({
      success: true,
      message: newMessage,
    });
  } catch (error) {
    console.error("Send Message Error:", error);
    return NextResponse.json(
      { error: "Failed to send message." },
      { status: 500 }
    );
  }
}
