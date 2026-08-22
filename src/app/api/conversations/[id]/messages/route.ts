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

    // Check membership
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.userId,
        },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Conversation not found or access denied." },
        { status: 403 }
      );
    }

    // Update lastReadAt for current user
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.userId,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    // Fetch messages with replyTo data
    const messages = await prisma.message.findMany({
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
    });

    // Also fetch the conversation participants to check read receipt status
    const conversation = await prisma.conversation.findUnique({
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
    });

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
    const { content, type = "TEXT", mediaUrl, replyToId } = body;

    if (!content && !mediaUrl) {
      return NextResponse.json(
        { error: "Message content or media is required." },
        { status: 400 }
      );
    }

    // Ensure user belongs to conversation
    const isMember = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.userId,
        },
      },
    });

    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a participant in this chat." },
        { status: 403 }
      );
    }

    // Create message & update conversation updatedAt + participant lastReadAt
    const [newMessage] = await prisma.$transaction([
      prisma.message.create({
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
      }),
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
    ]);

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
