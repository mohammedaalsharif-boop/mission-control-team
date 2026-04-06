import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicPage = createRouteMatcher(["/login", "/invite"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const { pathname } = request.nextUrl;

  // Let API routes pass through (except /api/auth which is handled by the middleware itself)
  if (pathname.startsWith("/api/") && pathname !== "/api/auth") {
    return;
  }

  const authed = await convexAuth.isAuthenticated();

  if (!authed && !isPublicPage(request)) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  // Redirect authenticated users away from /login, but NOT /invite
  // (authenticated users need to access /invite to accept org invitations)
  if (authed && pathname === "/login") {
    return nextjsMiddlewareRedirect(request, "/");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
