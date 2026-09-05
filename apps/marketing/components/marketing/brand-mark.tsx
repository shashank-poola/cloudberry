type BrandMarkProps = {
  label?: boolean
  invert?: boolean
}

export function BrandMark({ label = true, invert = false }: BrandMarkProps) {
  return (
    <a className={`brand-mark${invert ? " brand-mark-invert" : ""}`} href="#top" aria-label="Cloudberry home">
      <span className="brand-mark-icon" aria-hidden="true">
        <i /><i /><i /><i /><i /><i />
      </span>
      {label ? <span>Cloudberry</span> : null}
    </a>
  )
}
