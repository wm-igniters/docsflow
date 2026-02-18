"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, LogOut, User, LayoutDashboard, Sun, Moon, Laptop } from "lucide-react";
import { handleSignOut, handleSignIn } from "@/app/auth-actions";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  session?: any;
  showBackButton?: boolean;
  backHref?: string;
  children?: React.ReactNode;
}

export default function Navbar({ session, showBackButton, backHref = "/app", children }: NavbarProps) {
  const { setTheme, theme } = useTheme();

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4">
            {showBackButton && (
              <Button variant="ghost" size="icon" asChild className="rounded-lg">
                <Link href={backHref}>
                  <ChevronLeft size={20} className="text-muted-foreground" />
                </Link>
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Link href={session ? "/app" : "/"} className="flex items-center gap-2 group transition-opacity hover:opacity-90">
                <Image
                  src="/favicon.svg"
                  alt="DocsFlow Logo"
                  width={32}
                  height={32}
                  className="rounded-lg shadow-sm transition-transform group-hover:scale-105"
                  priority
                />
                <span className="text-xl font-bold tracking-tight text-foreground">DocsFlow</span>
              </Link>
              <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/20">
                Beta
              </span>
            </div>
            {children}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {session ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-medium text-muted-foreground sm:block">
                {session.user?.name}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 overflow-hidden ring-offset-background transition-all hover:ring-2 hover:ring-blue-100 dark:hover:ring-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <Avatar className="h-9 w-9 border border-border shadow-sm cursor-pointer">
                      <AvatarImage src={session.user?.image || ""} alt={session.user?.name || "User"} />
                      <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-semibold uppercase">
                        {session.user?.name?.charAt(0) || <User size={16} />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 mt-1" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1 py-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest leading-none">Account</p>
                      <p className="text-sm font-medium leading-none text-foreground mt-1">{session.user?.name}</p>
                      <p className="text-xs leading-none text-muted-foreground truncate mt-0.5">{session.user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem asChild>
                    <Link href="/app" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      {theme === "dark" ? (
                        <Moon className="mr-2 h-4 w-4" />
                      ) : theme === "light" ? (
                        <Sun className="mr-2 h-4 w-4" />
                      ) : (
                        <Laptop className="mr-2 h-4 w-4" />
                      )}
                      <span>Theme</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer">
                          <Sun className="mr-2 h-4 w-4" />
                          <span>Light</span>
                          {theme === "light" && <span className="ml-auto text-xs text-blue-500">✓</span>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer">
                          <Moon className="mr-2 h-4 w-4" />
                          <span>Dark</span>
                          {theme === "dark" && <span className="ml-auto text-xs text-blue-500">✓</span>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("system")} className="cursor-pointer">
                          <Laptop className="mr-2 h-4 w-4" />
                          <span>System</span>
                          {theme === "system" && <span className="ml-auto text-xs text-blue-500">✓</span>}
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => handleSignOut()}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9">
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTheme("light")}>
                    Light
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")}>
                    Dark
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")}>
                    System
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => handleSignIn()} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-5 shadow-sm hover:shadow transition-all active:scale-[0.98]">
                Sign In
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

