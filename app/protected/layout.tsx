import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top navigation */}
      <nav className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-6 lg:px-12">
          <div className="flex items-center gap-3">
            <Link
              href="https://acontext.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <Image
                src="https://acontext.io/nav-logo-black.svg"
                alt="Acontext"
                width={120}
                height={32}
                className="h-6 w-auto dark:invert"
                priority
              />
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">
                ← Back to Home
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Suspense>
              <AuthButton />
            </Suspense>
            <ThemeSwitcher />
          </div>
        </div>
      </nav>

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </main>
  );
}
