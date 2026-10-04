import Link from "next/link";

export function Logo() {
  return (
    <Link className="brand" href="/" aria-label="ApplyDesk home">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      <span>apply<span className="brand-accent">desk</span></span>
    </Link>
  );
}
