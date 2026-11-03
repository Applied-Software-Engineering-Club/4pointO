import { Suspense } from "react";
import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { AuthDialog } from "@/components/AuthDialog";
import { getAuthUser } from "@/utils/supabase/server";
import { isLocalPreview } from "@/utils/preview";
import { WorkspaceNav } from "./WorkspaceNav";

function accountAvatar(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.avatar_url ?? metadata?.picture;
  return typeof value === "string" && value.startsWith("https://") ? value : null;
}

export async function NavBar() {
  const preview = isLocalPreview();
  const user = preview ? null : await getAuthUser();

  return (
    <header className="workspace-header">
      <div className="header-brand">
        <Link
          href="/"
          className="wordmark"
        >
          4pointO
        </Link>
        <span className="semester-context">{preview ? "Fall 2026 · Demo" : `${new Date().getMonth() < 6 ? "Spring" : "Fall"} ${new Date().getFullYear()}`}</span>
      </div>
      <Suspense fallback={<div className="workspace-tabs" />}><WorkspaceNav /></Suspense>
        <div className="header-account">
          {preview ? <span className="demo-label"><span />Local demo preview.</span> : user ? (
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
    </header>
  );
}
