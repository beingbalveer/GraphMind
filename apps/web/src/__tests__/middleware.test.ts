import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { sanitizeRedirectPath } from "../lib/urls";

function createMockRequest(path: string, cookies: Record<string, string> = {}): NextRequest {
  const url = new URL(path, "http://localhost:3300");
  const request = new NextRequest(url);
  for (const [key, val] of Object.entries(cookies)) {
    request.cookies.set(key, val);
  }
  return request;
}

describe("Middleware & Public Route Boundary (LSI-004)", () => {
  describe("Unauthenticated access to public routes", () => {
    it("allows unauthenticated access to /login", () => {
      const req = createMockRequest("/login");
      const res = middleware(req);
      // Status 200 / next() without redirect
      expect(res.headers.get("location")).toBeNull();
      expect(res.status).toBe(200);
    });

    it("allows unauthenticated guest access to public catalog /learn and child lessons", () => {
      const paths = [
        "/learn",
        "/learn/python-backend",
        "/learn/python-backend/lessons/async-intro",
        "/studio-preview",
        "/dashboard-preview",
        "/font-comparison",
      ];

      for (const p of paths) {
        const req = createMockRequest(p);
        const res = middleware(req);
        expect(res.headers.get("location")).toBeNull();
        expect(res.status).toBe(200);
      }
    });
  });

  describe("Unauthenticated access to protected private routes", () => {
    it("redirects root path / to /login when unauthenticated", () => {
      const req = createMockRequest("/");
      const res = middleware(req);
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toBe("http://localhost:3300/login");
    });

    it("redirects workspace routes /w/{id} to /login with encoded safe next parameter", () => {
      const req = createMockRequest("/w/ws-123/chat/chat-456?node=node-789");
      const res = middleware(req);
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/login?next=");
      expect(location).toContain(encodeURIComponent("/w/ws-123/chat/chat-456?node=node-789"));
    });

    it("redirects private collection route /learning to /login", () => {
      const req = createMockRequest("/learning");
      const res = middleware(req);
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/login?next=%2Flearning");
    });
  });

  describe("Authenticated access", () => {
    it("allows authenticated user to reach private workspace routes", () => {
      const req = createMockRequest("/w/ws-123", { access_token: "mock-valid-token" });
      const res = middleware(req);
      expect(res.headers.get("location")).toBeNull();
      expect(res.status).toBe(200);
    });

    it("redirects authenticated user on /login to / by default", () => {
      const req = createMockRequest("/login", { access_token: "mock-valid-token" });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3300/");
    });

    it("redirects authenticated user on /login with valid next param to the specified path", () => {
      const req = createMockRequest("/login?next=%2Fw%2Fmy-workspace", { refresh_token: "mock-refresh" });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3300/w/my-workspace");
    });
  });

  describe("Hostile redirect defense (sanitizeRedirectPath)", () => {
    it("rejects open-redirect attempts with external protocol or host", () => {
      expect(sanitizeRedirectPath("https://evil.com")).toBe("/");
      expect(sanitizeRedirectPath("http://attacker.org/phish")).toBe("/");
      expect(sanitizeRedirectPath("//evil.com/path")).toBe("/");
      expect(sanitizeRedirectPath("///evil.com")).toBe("/");
      expect(sanitizeRedirectPath("/\\evil.com")).toBe("/");
      expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/");
      expect(sanitizeRedirectPath("data:text/html,<script>alert(1)</script>")).toBe("/");
    });

    it("preserves valid in-app relative paths with query parameters", () => {
      expect(sanitizeRedirectPath("/w/ws-1/chat/c-2")).toBe("/w/ws-1/chat/c-2");
      expect(sanitizeRedirectPath("/learn/python?ref=catalog")).toBe("/learn/python?ref=catalog");
      expect(sanitizeRedirectPath("/w/ws-1?node=n-5#hash")).toBe("/w/ws-1?node=n-5#hash");
    });

    it("middleware redirects hostile ?next= parameter safely to / when authenticated", () => {
      const req = createMockRequest("/login?next=https%3A%2F%2Fevil.com%2Fsteal", { access_token: "token" });
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3300/");
    });
  });
});
