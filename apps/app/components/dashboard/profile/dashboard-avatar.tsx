type DashboardAvatarProps = {
  displayName: string
  avatarUrl: string | null
  size?: "size-7" | "size-8" | "size-9" | "size-14"
}

function getInitials(displayName: string) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()

  return initials || "C"
}

export function DashboardAvatar({
  displayName,
  avatarUrl,
  size = "size-8",
}: DashboardAvatarProps) {
  const avatarStyle = avatarUrl
    ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` }
    : undefined

  return (
    <span
      aria-hidden="true"
      className={`relative flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-500 text-[11px] font-semibold text-white ring-1 ring-white/10`}
    >
      {avatarUrl ? (
        <span
          className="absolute inset-0 bg-cover bg-center"
          style={avatarStyle}
        />
      ) : null}
      <span className={avatarUrl ? "sr-only" : undefined}>
        {getInitials(displayName)}
      </span>
    </span>
  )
}
