import { auth } from "@/auth";
import { 
  Settings
} from "lucide-react";
import { redirect } from "next/navigation";

import { TechStackProvider } from "./TechStackContext";
import TechStackManager from "./TechStackManager";

import Navbar from "@/components/Navbar";

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
        <Navbar session={session}>
          <span className="text-slate-300 mx-2">/</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200">
            <Settings size={14} className="text-slate-500" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Manage Tech Stack</span>
          </div>
        </Navbar>

        {/* Main Content Area */}
        <TechStackManager />
      </div>
    </TechStackProvider>
  );
}

