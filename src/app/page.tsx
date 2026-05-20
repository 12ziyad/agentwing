"use client";

import { useRouter } from "next/navigation";
import { Hero } from "@/components/Hero";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-full bg-[#05070d]">
      <Hero onStart={() => router.push("/runtime-lab")} />
    </div>
  );
}
