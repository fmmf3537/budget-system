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
  const imgSize = size === "sm" ? 24 : size === "lg" ? 40 : 32
  const titleSize =
    size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base"
  const subtitleSize = size === "sm" ? "text-xs" : "text-sm"

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="辰航卓越"
    >
      <div className="bg-background relative grid place-items-center overflow-hidden rounded-md border shadow-sm">
        <Image
          src="/brand/chenhang-zhuoyue.png"
          alt="辰航卓越 Logo"
          width={imgSize}
          height={imgSize}
          priority={size !== "sm"}
          className="block"
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

