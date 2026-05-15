"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /log is kept for backward-compatibility with deployed links.
// It immediately redirects to the canonical /dashboard route.
export default function LogRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}
