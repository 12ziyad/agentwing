import Image from "next/image";
import Link from "next/link";

export function AgentWingBrand() {
  return (
    <Link href="/" className="inline-flex w-fit shrink-0 items-center gap-2.5 text-lg font-bold tracking-[-0.055em] text-foreground">
      <Image
        src="/agentwing-icon.png"
        alt=""
        width={30}
        height={30}
        className="rounded-md hue-rotate-[-105deg]"
        unoptimized
      />
      AgentWing
    </Link>
  );
}
