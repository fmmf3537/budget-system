import Image from "next/image"
import Link from "next/link"

export function Brand({
  href = "/budget",
  size = "md",
  showFullName = false,
}: {
  href?: string
  size?: "sm" | "md" | "lg"
  showFullName?: boolean
}) {
  const logoBoxSize = size === "sm" ? 42 : size === "lg" ? 62 : 50
  const titleSize =
    size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base"
  const subtitleSize = size === "sm" ? "text-xs" : "text-sm"

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="辰航卓越"
    >
      <div
        className="bg-background relative overflow-hidden rounded-md border shadow-sm"
        style={{ width: logoBoxSize, height: logoBoxSize }}
      >
        <Image
          src="/brand/chenhang-zhuoyue-mark.png"
          alt="辰航卓越 Logo"
          fill
          priority={size !== "sm"}
          quality={100}
          className="object-contain p-1"
        />
      </div>
      <div className="min-w-0 leading-tight">
        <div
          className={`text-foreground truncate font-semibold tracking-tight ${titleSize}`}
        >
          辰航卓越
        </div>
        {showFullName ? (
          <div className={`text-muted-foreground truncate ${subtitleSize}`}>
            西安辰航卓越科技有限公司
          </div>
        ) : null}
      </div>
    </Link>
  )
}

