"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const INVITE_EXPIRY_DAYS = 7;

// ── Send invite email via Resend ──────────────────────────────────────────────
export const sendInviteEmail = internalAction({
  args: {
    to:       v.string(),
    inviteeName: v.string(),
    orgName:  v.string(),
    inviterName: v.string(),
    token:    v.string(),
  },
  handler: async (_ctx, { to, inviteeName, orgName, inviterName, token }) => {
    const resendKey = process.env.AUTH_RESEND_KEY;
    if (!resendKey) {
      console.warn("AUTH_RESEND_KEY not set — invite email skipped. Share the link manually.");
      return;
    }

    // SITE_URL should be set to your Next.js app's public URL
    // (e.g. https://your-app.vercel.app). Falls back to localhost for dev.
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3001";

    // Build the invite link — points to the app's /invite page
    const inviteLink = `${siteUrl}/invite?token=${token}`;
    const fromEmail = process.env.AUTH_EMAIL_FROM ?? "Mission Control <noreply@yourdomain.com>";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: `You're invited to join ${orgName} on Mission Control`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #1a1a2e; margin-bottom: 8px;">You're invited!</h2>
            <p style="color: #555; line-height: 1.6;">
              Hi ${inviteeName},<br><br>
              <strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on Team Mission Control.
            </p>
            <a href="${inviteLink}" style="display: inline-block; margin: 24px 0; padding: 12px 28px; background: #6366f1; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
              Accept Invitation
            </a>
            <p style="color: #888; font-size: 13px; line-height: 1.5;">
              This invitation expires in ${INVITE_EXPIRY_DAYS} days.<br>
              If you didn't expect this email, you can safely ignore it.
            </p>
            <p style="color: #aaa; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
              Team Mission Control
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend API error:", res.status, body);
      throw new Error("Failed to send invite email. Check your Resend API key.");
    }
  },
});
