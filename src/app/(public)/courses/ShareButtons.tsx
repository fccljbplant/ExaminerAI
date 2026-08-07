"use client";
import { useState } from "react";
import { Linkedin, Twitter, MessageCircle, Copy, Check } from "lucide-react";

export default function ShareButtons({ courseName, courseUrl }: { courseName: string; courseUrl: string }) {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(courseUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const encodedUrl = encodeURIComponent(courseUrl);
  const encodedText = encodeURIComponent(`Check out this course: ${courseName}`);

  return (
    <div className="flex items-center gap-2">
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-border bg-background p-2 hover:bg-accent transition-colors"
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="h-4 w-4" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-border bg-background p-2 hover:bg-accent transition-colors"
        aria-label="Share on Twitter"
      >
        <Twitter className="h-4 w-4" />
      </a>
      <a
        href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-border bg-background p-2 hover:bg-accent transition-colors"
        aria-label="Share on WhatsApp"
      >
        <MessageCircle className="h-4 w-4" />
      </a>
      <button
        onClick={copyLink}
        className="rounded-md border border-border bg-background p-2 hover:bg-accent transition-colors"
        aria-label="Copy link"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
