import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc.js";
import { User } from "../models/User.js";
import { OtpCode } from "../models/OtpCode.js";
import { SignJWT } from "jose";
import { ENV } from "../_core/env.js";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getSessionCookieOptions } from "../_core/cookies.js";
import bcrypt from "bcryptjs";

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createSessionToken(userId, email, role) {
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  return new SignJWT({ userId: userId.toString(), email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
}

export const localAuthRouter = router({
  /**
   * Register — send OTP after saving user
   */
  register: publicProcedure
    .input(z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const existing = await User.findOne({ email: input.email });

      if (existing && existing.isEmailVerified) {
        throw new TRPCError({ code: "CONFLICT", message: "Email already registered. Please sign in." });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      if (!existing) {
        await User.create({
          openId: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: input.name,
          email: input.email,
          passwordHash,
          isEmailVerified: false,
          loginMethod: "email",
          lastSignedIn: new Date(),
        });
      } else {
        existing.name = input.name;
        existing.passwordHash = passwordHash;
        existing.loginMethod = "email";
        await existing.save();
      }

      await OtpCode.deleteMany({ email: input.email, type: "register" });
      await OtpCode.create({ email: input.email, code: otp, type: "register", expiresAt });

      return { success: true, otp, message: "OTP sent to your email" };
    }),

  /**
   * Verify OTP — for register or forgot_password
   */
  verifyOTP: publicProcedure
    .input(z.object({
      email: z.string().email(),
      otp: z.string().length(6),
      type: z.enum(["register", "forgot_password"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const now = new Date();
      const record = await OtpCode.findOne({
        email: input.email,
        code: input.otp,
        type: input.type,
        used: false,
        expiresAt: { $gt: now },
      });

      if (!record) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired OTP" });
      }

      record.used = true;
      await record.save();

      if (input.type === "register") {
        const user = await User.findOneAndUpdate(
          { email: input.email },
          { isEmailVerified: true },
          { new: true }
        );
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

        const token = await createSessionToken(user._id, user.email, user.role);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return {
          success: true,
          user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
        };
      }

      return { success: true };
    }),

  /**
   * Login — unified for admin + users
   */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const { adminEmail, adminPassword } = ENV;

      if (input.email === adminEmail && input.password === adminPassword) {
        const token = await createSessionToken("000000000000000000000000", adminEmail, "admin");
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return {
          success: true,
          user: {
            id: "000000000000000000000000",
            name: "Admin",
            email: adminEmail,
            role: "admin",
          },
        };
      }

      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid admin credentials" });
    }),

  /**
   * Forgot Password — send OTP
   */
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await User.findOne({ email: input.email });

      if (!user || !user.passwordHash) {
        return { success: true, message: "If that email exists, we sent an OTP" };
      }

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await OtpCode.deleteMany({ email: input.email, type: "forgot_password" });
      await OtpCode.create({ email: input.email, code: otp, type: "forgot_password", expiresAt });

      return { success: true, otp, message: "OTP sent to your email" };
    }),

  /**
   * Reset Password — verify OTP + set new password
   */
  resetPassword: publicProcedure
    .input(z.object({
      email: z.string().email(),
      otp: z.string().length(6),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ input, ctx }) => {
      const now = new Date();
      const record = await OtpCode.findOne({
        email: input.email,
        code: input.otp,
        type: "forgot_password",
        used: false,
        expiresAt: { $gt: now },
      });

      if (!record) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired OTP. Please restart the flow." });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await User.updateOne({ email: input.email }, { passwordHash });
      record.used = true;
      await record.save();

      const user = await User.findOne({ email: input.email });
      if (user) {
        const token = await createSessionToken(user._id, user.email, user.role);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, role: user.role };
      }

      return { success: true };
    }),
});
