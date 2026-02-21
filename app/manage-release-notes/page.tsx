import { auth } from "@/auth";
import { 
  FileText
} from "lucide-react";
import { redirect } from "next/navigation";

import { ReleaseNotesProvider } from "./ReleaseNotesContext";
import ReleaseNotesManager from "./ReleaseNotesManager";
import Navbar from "@/components/Navbar";

export const dynamic = 'force-dynamic';

export default async function ManageReleaseNotes() {
  const session = await auth();

  if (!session) {
      redirect("/");
  }

  return (
    <ReleaseNotesProvider>
      <div className="h-screen bg-[#F8FAFC] flex flex-col overflow-hidden">
        <Navbar session={session}>
          <span className="text-slate-300 mx-2">/</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200">
            <FileText size={14} className="text-slate-500" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Manage Release Notes</span>
          </div>
        </Navbar>

        <ReleaseNotesManager />
      </div>
    </ReleaseNotesProvider>
  );
}
