import { auth } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { 
  Sparkles,
  ArrowRight,
  Layers,
  FileText
} from "lucide-react";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function Dashboard() {
  const session = await auth();

  if (!session) {
      redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 pb-20">
      <Navbar session={session} />

      <main>
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            {/* Hero / Welcome */}
            <div className="mb-16 text-center">
              <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
                How would you like to contribute <span className="text-blue-600 relative inline-block">
                  today?
                  <span className="absolute -top-8 -right-8 text-yellow-400 animate-pulse">
                    <Sparkles size={32} fill="currentColor" />
                  </span>
                </span>
              </h1>
              <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                Select a workspace to manage documentation and publish updates.
              </p>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/manage-tech-stack" className="group">
                <DashboardCard 
                    icon={<Layers className="text-blue-600" />} 
                    title="Tech Stack" 
                    desc="Manage and update the central technology stack documentation."
                    color="bg-blue-50"
                  />
              </Link>

              <Link href="/manage-release-notes" className="group">
                <DashboardCard 
                    icon={<FileText className="text-indigo-600" />} 
                    title="Release Notes" 
                    desc="Draft, review, and finalize product release notes for distribution."
                    color="bg-indigo-50"
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
    <Card className="h-full border-slate-200 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 hover:border-blue-200 overflow-hidden">
      <CardHeader className="p-8">
        <div className={cn("inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-6 shadow-sm transition-transform group-hover:scale-110 duration-300", color)}>
          {icon}
        </div>
        <CardTitle className="text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
          {title}
        </CardTitle>
        <CardDescription className="mt-4 text-base leading-relaxed text-slate-500">
          {desc}
        </CardDescription>
      </CardHeader>
      <CardFooter className="px-8 pb-8 pt-0 flex justify-end">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
          <ArrowRight size={18} />
        </div>
      </CardFooter>
    </Card>
  )
}
