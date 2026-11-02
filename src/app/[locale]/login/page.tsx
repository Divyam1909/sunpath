import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

// Minimal Phase 1 sign-in. Restyled and translated with the homeowner screens.
export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const { error } = await searchParams;
  async function login(form: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        login: form.get("login"),
        password: form.get("password"),
        redirectTo: "/staff",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/en/login?error=1");
      throw e;
    }
  }
  return (
    <main className="mx-auto max-w-sm px-6 py-20">
      <form action={login} className="grid gap-3">
        <input name="login" placeholder="Email or phone" className="border p-2" />
        <input name="password" type="password" placeholder="Password" className="border p-2" />
        <button className="bg-primary p-2 text-primary-foreground">Sign in</button>
        {error ? <p role="alert">Wrong login or password.</p> : null}
      </form>
    </main>
  );
}
