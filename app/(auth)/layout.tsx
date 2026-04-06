import { Logo } from "../(dashboard)/_components/logo";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Logo href="/" />
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        {children}
      </main>
    </div>
  );
};

export default AuthLayout;
