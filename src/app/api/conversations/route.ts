import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// GET all conversations for the logged in user with deduplication
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: session.userId,
          },
        },
      },
      take: 30,
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
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            mediaUrl: true,
            senderId: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Deduplicate conversations per pair of users to prevent duplicate rooms
    const seenOtherUserIds = new Set<string>();
    const deduplicated: typeof conversations = [];

    for (const conv of conversations) {
      const otherParticipant = conv.participants.find(
        (p) => p.userId !== session.userId
      );
      if (otherParticipant) {
        if (seenOtherUserIds.has(otherParticipant.userId)) {
          continue; // Skip duplicate older room
        }
        seenOtherUserIds.add(otherParticipant.userId);
      }
      deduplicated.push(conv);
    }

    const formatted = deduplicated.map((conv) => {
      const myParticipant = conv.participants.find(
        (p) => p.userId === session.userId
      );
      const lastReadAt = myParticipant?.lastReadAt
        ? new Date(myParticipant.lastReadAt).getTime()
        : 0;

      const lastMessage = conv.messages[0] || null;
      const isUnread =
        lastMessage &&
        lastMessage.senderId !== session.userId &&
        new Date(lastMessage.createdAt).getTime() > lastReadAt;

      return {
        id: conv.id,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        participants: conv.participants,
        lastMessage,
        unreadCount: isUnread ? 1 : 0,
      };
    });

    return NextResponse.json({ conversations: formatted });
  } catch (error) {
    console.error("Conversations GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations." },
      { status: 500 }
    );
  }
}

// POST: Create or retrieve conversation between current user and target user
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "targetUserId is required." },
        { status: 400 }
      );
    }

    if (targetUserId === session.userId) {
      return NextResponse.json(
        { error: "Cannot create conversation with yourself." },
        { status: 400 }
      );
    }

    // Check if 1-on-1 conversation already exists
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: session.userId } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
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
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      // Touch updatedAt to keep it at top
      await prisma.conversation.update({
        where: { id: existing.id },
        data: { updatedAt: new Date() },
      });
      return NextResponse.json({
        conversation: {
          ...existing,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // Create new conversation
    const newConv = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: session.userId },
            { userId: targetUserId },
          ],
        },
      },
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

    return NextResponse.json({ conversation: newConv });
  } catch (error: any) {
    console.error("Create Conversation Error:", error);
    return NextResponse.json(
      { error: "Failed to create conversation." },
      { status: 500 }
    );
  }
}
