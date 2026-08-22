import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim().toLowerCase();

    // If query is provided, search users by LINE ID (excluding self)
    if (query) {
      const users = await prisma.user.findMany({
        where: {
          AND: [
            { id: { not: session.userId } },
            {
              OR: [
                { lineId: { contains: query } },
                { name: { contains: query } },
              ],
            },
          ],
        },
        select: {
          id: true,
          lineId: true,
          name: true,
          avatar: true,
          statusMessage: true,
          createdAt: true,
        },
        take: 10,
      });

      return NextResponse.json({ users });
    }

    // Otherwise return list of friends
    const friendships = await prisma.friendship.findMany({
      where: { userId: session.userId },
      include: {
        friend: {
          select: {
            id: true,
            lineId: true,
            name: true,
            avatar: true,
            statusMessage: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const friends = friendships.map((f) => ({
      id: f.id,
      friend: f.friend,
      createdAt: f.createdAt,
    }));

    return NextResponse.json({ friends });
  } catch (error) {
    console.error("Friends API Error:", error);
    return NextResponse.json({ error: "Failed to fetch friends." }, { status: 500 });
  }
}
