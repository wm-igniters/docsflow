import { auth } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { 
  FileText, 
  User,
  Settings
} from "lucide-react";
import { redirect } from "next/navigation";

import { TechStackProvider } from "./TechStackContext";
import TechStackManager from "./TechStackManager";

// Force dynamic rendering to prevent caching issues in production
export const dynamic = 'force-dynamic';

export default async function ManageTechStack() {
  const session = await auth();

  if (!session) {
      redirect("/");
  }

  return (
    <TechStackProvider>
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col max-h-screen overflow-hidden">
        {/* Top Navbar */}
        <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 h-16 flex-none">
          <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <Link href="/app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                    <FileText size={18} className="fill-current" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-slate-900">DocsFlow</span>
              </Link>
              <span className="text-slate-300 mx-2">/</span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200">
                <Settings size={14} className="text-slate-500" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Manage Tech Stack</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-slate-900 leading-none mb-0.5">{session.user?.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium leading-none">{session.user?.email}</p>
                  </div>
                  {session.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt="Profile"
                      width={36}
                      height={36}
                      className="rounded-full border-2 border-white shadow-sm"
                      unoptimized
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm text-blue-600 font-bold">
                      {session.user?.name?.charAt(0) || <User size={18}/>}
                    </div>
                  )}
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <TechStackManager />
      </div>
    </TechStackProvider>
  );
}
