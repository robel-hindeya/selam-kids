/**
 * # NOTE: auth.test.js
 * Role: Auth Middleware Unit Tests
 * Layer: Testing / Security
 * Description: Tests JWT extraction from cookies and headers, token verification, and 401 handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

const state = vi.hoisted(() => {
  return { query: vi.fn() };
});

vi.mock("../../../backend/lib/postgres.js", () => ({
  query: state.query,
}));

const { requireAuth } = await import("../../../backend/middleware/auth.js");

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe("requireAuth", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-jwt-secret";
    state.query.mockReset();
  });

  it("rejects requests with no token (not authenticated)", async () => {
    const req = { cookies: {} };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("Not authenticated");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests with an invalid/expired token", async () => {
    const req = { cookies: { token: "not-a-valid-jwt" } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/Invalid|expired/i);
  });

  it("rejects a token whose user no longer exists", async () => {
    state.query.mockResolvedValue({ rows: [] });
    const token = jwt.sign({ userId: "missing-user" }, process.env.JWT_SECRET);
    const req = { cookies: { token } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("User not found");
  });

  it("rejects disabled accounts with 403", async () => {
    state.query.mockResolvedValue({
      rows: [{ id: "u1", is_disabled: true }],
    });
    const token = jwt.sign({ userId: "u1" }, process.env.JWT_SECRET);
    const req = { cookies: { token } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/disabled/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.userId and req.user for a valid session", async () => {
    state.query.mockResolvedValue({
      rows: [
        {
          id: "u1",
          username: "kid1",
          email: "kid@example.com",
          display_name: "Kid One",
          role: "Family",
          is_admin: false,
          is_super_admin: false,
          is_disabled: false,
        },
      ],
    });
    const token = jwt.sign({ userId: "u1" }, process.env.JWT_SECRET);
    const req = { cookies: { token } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe("u1");
    expect(req.user.email).toBe("kid@example.com");
    expect(req.user.isAdmin).toBe(false);
  });
});
