import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";

export default async function Home() {
  const session = await auth();

  if (session) {
      redirect("/app");
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-blue-100/30">
      <Navbar session={session} />

      <main>

          {/* PUBLIC LANDING VIEW */}
          <div className="relative isolate pt-14">
            <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
               <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
            </div>
            
            <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56 text-center">
              <div className="hidden sm:mb-8 sm:flex sm:justify-center">
                <div className="relative rounded-full px-3 py-1 text-sm leading-6 text-muted-foreground ring-1 ring-border hover:ring-border/80 transition-all">
                  Coming soon: collaboration features. <a href="#" className="font-semibold text-blue-600 dark:text-blue-400"><span className="absolute inset-0" aria-hidden="true"></span>Read more <span aria-hidden="true">&rarr;</span></a>
                </div>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
                Document your software with confidence
              </h1>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">
                DocsFlow is the internal engine for WaveMaker's documentation. Create, review, and publish technical content seamlessly.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                 <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/app" });
                  }}
                >
                  <button className="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all active:scale-95">
                    Get started
                  </button>
                </form>
              </div>
            </div>
          </div>
      </main>
    </div>
  );
}
