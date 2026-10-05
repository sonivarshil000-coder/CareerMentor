import Link from "next/link";

export function Logo() {
  return (
    <Link className="brand" href="/" aria-label="CareerMentor home">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      <span>Career<span className="brand-accent">Mentor</span></span>
    </Link>
  );
}
