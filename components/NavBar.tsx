import Link from "next/link";

export function NavBar() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <nav className="flex h-14 items-center px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-neutral-900"
        >
          4pointO
        </Link>
      </nav>
    </header>
  );
}
