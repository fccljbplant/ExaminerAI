import type { Metadata } from "next";
import { CertificatesPanel } from "@/modules/instructor-portal";

/**
 * /instructor/certificates — certificate issue + list
 * (V1 CertificateApprovals re-homed, W10 audit).
 */

export const metadata: Metadata = {
  title: "Certificates — TraineesAI",
};

export default function InstructorCertificatesPage() {
  return <CertificatesPanel />;
}
