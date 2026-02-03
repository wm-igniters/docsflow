import { auth, signOut } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { 
  FileText, 
  Sparkles,
  ArrowRight,
  Layers
} from "lucide-react";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  const session = await auth();

  if (!session) {
      redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <FileText size={20} className="fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">DocsFlow</span>
          </div>
          <div className="flex items-center gap-4">
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
                    unoptimized
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-blue-100" />
                )}
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
                    Sign out
                  </button>
                </form>
              </div>
          </div>
        </div>
      </nav>

      <main>
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            {/* Hero / Welcome */}
            <div className="mb-12 text-center">
              <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                How would you like to contribute <span className="text-blue-600 relative inline-block">
                  today?
                  <span className="absolute -top-6 -right-6 text-yellow-400">
                    <Sparkles size={24} fill="currentColor" />
                  </span>
                </span>
              </h1>
              <p className="text-lg text-slate-500">
                Select a workflow to get started.
              </p>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/manage-tech-stack">
                <DashboardCard 
                    icon={<Layers className="text-blue-600" />} 
                    title="Tech Stack" 
                    desc="Manage the technology stack documentation."
                    color="bg-blue-50"
                  />
              </Link>
            </div>
          </div>
      </main>
    </div>
  );
}

function DashboardCard({ icon, title, desc, color }: { icon: React.ReactNode, title: string, desc: string, color: string }) {
  return (
    <div className="group relative flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-blue-200 cursor-pointer">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
          {title}
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          {desc}
        </p>
      </div>
      <div className="mt-auto pt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight size={16} className="text-blue-500" />
      </div>
    </div>
  )
}
