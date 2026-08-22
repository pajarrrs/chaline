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

    // Update lastReadAt for current user
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
      messages: messages || [],
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
    const { content, type = "TEXT", mediaUrl, replyToId } = body;

    if (!content && !mediaUrl) {
      return NextResponse.json(
        { error: "Message content or media is required." },
        { status: 400 }
      );
    }

    // Safely check replyToId to avoid Foreign Key constraint errors
    let validReplyToId: string | null = null;
    if (replyToId && typeof replyToId === "string" && !replyToId.startsWith("temp_")) {
      const parent = await prisma.message.findUnique({
        where: { id: replyToId },
        select: { id: true },
      });
      if (parent) {
        validReplyToId = parent.id;
      }
    }

    // Direct insert
    const newMessage = await prisma.message.create({
      data: {
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
        replyToId: validReplyToId,
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

    // Touch conversation & participant
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
