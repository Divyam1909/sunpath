import { auth } from "@/auth";

export default async function StaffHome() {
  const session = await auth();
  return (
    <main className="px-6 py-20">
      <p>Signed in as {session?.user.name}</p>
    </main>
  );
}
