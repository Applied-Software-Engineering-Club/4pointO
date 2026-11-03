import { Suspense } from "react";
import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { AuthDialog } from "@/components/AuthDialog";
import { getAuthUser } from "@/utils/supabase/server";

function accountAvatar(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.avatar_url ?? metadata?.picture;
  return typeof value === "string" && value.startsWith("https://") ? value : null;
}

export async function NavBar() {
  const user = await getAuthUser();

  return (
    <header className="border-b border-neutral-200 bg-white">
      <nav className="flex min-h-14 flex-wrap items-center gap-3 px-6 py-2">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-neutral-900"
        >
          4pointO
        </Link>
        <div className="ml-auto">
          {user ? (
            <AccountMenu
              avatarUrl={accountAvatar(user.user_metadata)}
              email={user.email ?? null}
            />
          ) : (
            <Suspense fallback={null}>
              <AuthDialog />
            </Suspense>
          )}
        </div>
      </nav>
    </header>
  );
}
