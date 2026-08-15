/**
 * modules/shell — RoleHelp (2026-08-15)
 *
 * ONE help page per role with FAQs that actually match the role. The
 * learner portal keeps its richer /learner/help; instructor, org admin
 * and platform admin share this component with their own topics.
 */

import { HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/ui/card";

export interface HelpTopic {
  q: string;
  a: string;
}

export function RoleHelp({ title, topics }: { title: string; topics: HelpTopic[] }) {
  return (
    <div className="space-y-4 md:space-y-6">
      <h1 className="flex items-center gap-2 text-lg font-semibold text-fg md:text-xl">
        <HelpCircle className="h-4 w-4 text-brand" aria-hidden />
        {title}
      </h1>
      <p className="text-sm text-fg-muted">
        Quick answers for your role. Need a human? Visit the support page from the avatar menu.
      </p>
      <div className="grid gap-3">
        {topics.map((t) => (
          <Card key={t.q}>
            <CardHeader>
              <CardTitle className="text-sm">{t.q}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-fg-secondary">{t.a}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
