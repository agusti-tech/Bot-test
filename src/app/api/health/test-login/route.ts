import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

// Diagnostic endpoint — tests credential verification WITHOUT NextAuth
// DELETE THIS FILE after debugging is complete
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hashedPassword: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        step: "user_lookup",
        success: false,
        error: `No user found with email: ${email}`,
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

    if (!passwordMatch) {
      return NextResponse.json({
        step: "password_compare",
        success: false,
        error: "Password does not match hash",
        hashPrefix: user.hashedPassword.substring(0, 7),
      });
    }

    return NextResponse.json({
      step: "all_passed",
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      message: "Credentials are valid — issue is in NextAuth cookie/session layer",
    });
  } catch (e) {
    return NextResponse.json({
      step: "exception",
      success: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
