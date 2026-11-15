import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
}));

vi.mock("@/modules/learner-portal/use-api", () => ({ useApi: mocks.useApi }));

import { CertificatesPanel } from "./certificates";

const certData = {
  students: [{ id: "s1", name: "Aven Learner" }],
  courses: [{ id: "c1", name: "Structural Basics" }],
  certificates: [
    {
      id: "cert-1",
      studentName: "Aven Learner",
      courseName: "Structural Basics",
      grade: "A",
      score: 92,
      signedBy: "Instructor Rowan",
      issuedAt: "2026-11-01T00:00:00.000Z",
      verifyUrl: "https://verify.example/cert-1",
    },
  ],
};

describe("CertificatesPanel (rules 6 + 8 + 12)", () => {
  beforeEach(() => {
    mocks.useApi.mockReturnValue({ data: certData, error: null, isLoading: false, retry: vi.fn() });
  });

  it("shows the issue form inline with labeled selects and a disabled submit until a student and course are chosen", () => {
    const html = renderToStaticMarkup(createElement(CertificatesPanel));
    expect(html).toContain("Issue certificate");
    expect(html).toContain('aria-label="Student"');
    expect(html).toContain('aria-label="Course"');
    expect(html).toContain('aria-label="Score"');
    const submit = html.split("<button ").find((b) => b.startsWith('type="submit"'));
    expect(submit).toContain('disabled=""');
  });

  it("scaffolds the request queue while it loads — no fabricated requests", () => {
    const html = renderToStaticMarkup(createElement(CertificatesPanel));
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("No pending certificate requests.");
    expect(html).not.toContain("window.prompt");
  });

  it("keeps Verify a 44px ringed external link", () => {
    const html = renderToStaticMarkup(createElement(CertificatesPanel));
    const link = html.split("<a ")[1].split(">")[0];
    expect(link).toContain("min-h-11");
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(link).toContain("focus-visible:outline-focus");
    expect(html).toContain("Verify");
  });
});
