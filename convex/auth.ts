import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
// import Resend from "@auth/core/providers/resend";  // TODO: re-enable when Resend is configured
import { DataModel } from "./_generated/dataModel";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      // ── Password strength validation ────────────────────────────────────
      validatePasswordRequirements: (password: string) => {
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters long.");
        }
        if (!/[A-Z]/.test(password)) {
          throw new Error("Password must contain at least one uppercase letter.");
        }
        if (!/[a-z]/.test(password)) {
          throw new Error("Password must contain at least one lowercase letter.");
        }
        if (!/[0-9]/.test(password)) {
          throw new Error("Password must contain at least one number.");
        }
      },
      // TODO: Re-enable email verification when Resend is configured
      // verify: Resend({
      //   id: "resend-otp",
      //   apiKey: process.env.AUTH_RESEND_KEY,
      //   from: process.env.AUTH_EMAIL_FROM ?? "Mission Control <noreply@yourdomain.com>",
      // }),
    }),
  ],

  // ── Session expiry ────────────────────────────────────────────────────────
  // Total session lifetime: 7 days (user must re-login weekly).
  // Inactive timeout: 24 hours (idle sessions expire after a day).
  session: {
    totalDurationMs: 7 * 24 * 60 * 60 * 1000,    // 7 days
    inactiveDurationMs: 24 * 60 * 60 * 1000,      // 24 hours
  },

  // ── Rate limiting on login ────────────────────────────────────────────────
  // Allow 5 failed attempts per hour (stricter than the default of 10).
  // After 5 failures, one new attempt is allowed every 12 minutes.
  signIn: {
    maxFailedAttempsPerHour: 5,
  },
});
