import EditorPage from "@/components/EditorPage";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";

export default async function ManageReleaseNotesPage() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar session={session} showBackButton={true} backHref="/app" />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <EditorPage />
      </main>
    </div>
  );
}

