import Image from "next/image"
import { redirect } from "next/navigation"
import { SignIn } from "@/components/auth/sign-in"
import { createServerSupabaseClient } from "@/lib/supabase/supabase_server"

type SignUpPageProps = {
  searchParams: Promise<{ error?: string | string[] }>
}

const errorMessages: Record<string, string> = {
  auth_required: "Please sign in to continue.",
  auth_callback_failed: "We could not complete sign in. Please try again.",
}

const benefits = [
  "Always-on cloud computer",
  "Maintains Cloudpedia",
  "Acts with context",
]

type BrandProps = {
  inverse?: boolean
  iconOnly?: boolean
}

function Brand({ inverse = false, iconOnly = false }: BrandProps) {
  return (
    <div
      className={`flex items-center ${iconOnly ? "" : "gap-1"} ${
        inverse ? "text-white" : "text-zinc-950"
      }`}
    >
      <Image
        src={
          inverse ? "/white_cloudberry_logo.png" : "/black_cloudberry_logo.png"
        }
        alt={iconOnly ? "Cloudberry" : ""}
        width={iconOnly ? 40 : 36}
        height={iconOnly ? 40 : 36}
        className={
          iconOnly ? "size-13 object-contain" : "size-12 object-contain"
        }
        priority
      />
      {!iconOnly ? (
        <span className="text-[24px] leading-none font-semibold tracking-[-0.04em]">
          cloudberry
        </span>
      ) : null}
    </div>
  )
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/")
  }

  const params = await searchParams
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <section
        aria-labelledby="signup-introduction"
        className="relative flex min-h-170 flex-col overflow-hidden bg-white px-6 py-7 text-zinc-950 sm:px-10 sm:py-9 lg:min-h-screen lg:px-[clamp(2.5rem,6vw,6.5rem)] lg:py-12"
      >
        <header className="relative z-10">
          <Brand />
        </header>

        <div className="relative z-10 mt-auto max-w-xl pb-48 sm:pb-52 lg:pb-60">
          <h1
            id="signup-introduction"
            className="max-w-136 text-[clamp(2.5rem,3.5vw,3.5rem)] leading-[1.02] font-light tracking-[-0.055em]"
          >
            Your company brain, always on.
          </h1>
          <p className="mt-6 max-w-124 text-[clamp(1rem,1.5vw,1.2rem)] leading-[1.45] tracking-[-0.02em] text-zinc-600">
            Connect your tools. Cloudberry runs on its own cloud computer and keeps your company context current.
          </p>

          <ul className="mt-8 flex flex-col gap-3 text-[15px] font-medium tracking-[-0.015em] text-zinc-900">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white"
                >
                  <svg
                    aria-hidden="true"
                    className="size-2.5"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="m4 8 2.5 2.5L12 5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.25"
                    />
                  </svg>
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex min-h-155 items-center justify-center bg-[#0b0b0b] px-6 py-16 text-white sm:px-10 lg:min-h-screen lg:px-16">
        <div className="flex w-full max-w-90 flex-col items-center">
          <Brand inverse iconOnly />

          <div className="mt-6 w-full text-center">
            <h2 className="text-[clamp(1.75rem,3vw,2rem)] leading-tight font-light tracking-[-0.04em]">
              Welcome to Cloudberry
            </h2>
            <p className="mt-1.5 text-sm leading-5 text-zinc-400">
              Sign in or create your account to get started.
            </p>

            <div className="mt-7">
              <SignIn
                errorMessage={errorCode ? errorMessages[errorCode] : undefined}
              />
            </div>

            <p className="mt-5 px-2 text-xs leading-5 text-zinc-500">
              By continuing, you agree to our{" "}
              <span className="font-semibold text-zinc-300 underline underline-offset-2">
                Terms
              </span>{" "}
              and{" "}
              <span className="font-semibold text-zinc-300 underline underline-offset-2">
                Privacy Notice
              </span>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
