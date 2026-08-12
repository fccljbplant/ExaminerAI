import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Avatar Demo — TraineesAI",
  description: "Interactive demo of the AI tutor avatar system.",
};

export default function AvatarDemoPage() {
  return (
    <div style={{ width: "100%", minHeight: "100vh" }}>
      <iframe
        src="/pip-avatar.html"
        style={{ width: "100%", minHeight: "100vh", border: "none" }}
        title="Pip Avatar Demo"
        allow="microphone"
      />
    </div>
  );
}
