import { auth, signOut } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { 
  FileText, 
  ChevronRight,
  Layers,
  LogOut,
  User
} from "lucide-react";
import { redirect } from "next/navigation";

// Hardcoded version data
const versions = [
  "v11.4.3",
  "v11.4.0",
  "v11.3.0",
  "v11.2.5",
  "v11.2.0",
  "v11.1.0",
  "v10.14.0",
  "v10.13.2"
];

export default async function ManageTechStack() {
  const session = await auth();

  if (!session) {
      redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
       {/* Top Navbar */}
       <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 h-16 flex-none">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Link href="/app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <FileText size={20} className="fill-current" />
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900">DocsFlow</span>
            </Link>
            <span className="text-slate-300 mx-2">/</span>
            <span className="font-medium text-slate-600">Tech Stack</span>
          </div>
          
          {/* User Profile Dropdown / Area */}
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-3">
                <span className="hidden text-sm font-medium text-slate-600 sm:block">
                  {session.user?.name}
                </span>
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt="Profile"
                    width={32}
                    height={32}
                    className="rounded-full border border-slate-200"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <User size={16} className="text-blue-600"/>
                  </div>
                )}
             </div>
          </div>
        </div>
      </nav>

      {/* Main Layout Area */}
      <div className="flex flex-1 max-w-[1440px] w-full mx-auto">
        
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-200 bg-white hidden md:block overflow-y-auto">
            <div className="p-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Layers size={16} />
                    Versions
                </h2>
            </div>
            <nav className="p-2 space-y-1">
                {versions.map((version) => (
                    <button 
                        key={version}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors group"
                    >
                        {version}
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500" />
                    </button>
                ))}
            </nav>
        </aside>

        {/* Main Content Area (Empty for now) */}
        <main className="flex-1 bg-[#F8FAFC] p-8">
            <div className="h-full w-full border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400">
                <p>Select a version from the sidebar to view details</p>
            </div>
        </main>
      </div>
    </div>
  );
}
