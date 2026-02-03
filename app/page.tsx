import { auth, signIn, signOut } from "@/auth";
import Image from "next/image";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (session) {
      redirect("/app");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Image
              src="/favicon.svg"
              alt="DocsFlow Logo"
              width={32}
              height={32}
              className="rounded-lg shadow-sm"
              priority
            />
            <span className="text-xl font-bold tracking-tight text-slate-900">DocsFlow</span>
          </div>
          <div className="flex items-center gap-4">
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/app" });
                }}
              >
                <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 hover:shadow transition-all">
                  Sign In
                </button>
              </form>
          </div>
        </div>
      </nav>

      <main>
          {/* PUBLIC LANDING VIEW */}
          <div className="relative isolate pt-14">
            <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
               <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
            </div>
            
            <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56 text-center">
              <div className="hidden sm:mb-8 sm:flex sm:justify-center">
                <div className="relative rounded-full px-3 py-1 text-sm leading-6 text-slate-600 ring-1 ring-slate-900/10 hover:ring-slate-900/20">
                  Coming soon: collaboration features. <a href="#" className="font-semibold text-blue-600"><span className="absolute inset-0" aria-hidden="true"></span>Read more <span aria-hidden="true">&rarr;</span></a>
                </div>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
                Document your software with confidence
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                DocsFlow is the internal engine for WaveMaker's documentation. Create, review, and publish technical content seamlessly.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                 <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/app" });
                  }}
                >
                  <button className="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                    Get started
                  </button>
                </form>
                {/* <a href="#" className="text-sm font-semibold leading-6 text-slate-900">
                  Learn more <span aria-hidden="true">→</span>
                </a> */}
              </div>
            </div>
          </div>
      </main>
    </div>
  );
}
