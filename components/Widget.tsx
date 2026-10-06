import Link from "next/link";

type WidgetProps = {
  name: string;
  href: string;
};

export function Widget({ name, href }: WidgetProps) {
  return (
    <Link
      href={href}
      className="flex h-[7.5rem] w-[8.25rem] items-center justify-center rounded-2xl border border-neutral-200 bg-white p-3 text-base font-medium text-neutral-900 shadow-sm hover:bg-neutral-50"
    >
      {name}
    </Link>
  );
}
