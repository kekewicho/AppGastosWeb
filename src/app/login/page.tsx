"use client";

import { useState, useEffect } from "react";
import { 
  GoogleAuthProvider, 
  signInWithPopup 
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { 
  Wallet, 
  Loader2, 
  ShieldCheck,
  ChevronRight
} from "lucide-react";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, provider);
      router.push("/dashboard");
    } catch (error) {
      console.error("Error al iniciar sesión con Google", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-nu-purple" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      {/* Mobile-Centric Container */}
      <div className="w-full max-w-[400px] flex flex-col items-center">
        {/* App Logo */}
        <div className="mb-12 flex flex-col items-center">
          <div className="p-4 bg-nu-purple rounded-[2rem] shadow-xl shadow-nu-purple/20 mb-4 transform hover:scale-105 transition-transform">
            <Wallet className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-black text-nu-purple tracking-tight">MyPocket</h1>
        </div>

        {/* Content */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 leading-tight">Bienvenido</h2>
          <p className="text-slate-500 font-medium px-4">
            Únete a miles de personas que ya organizan sus gastos con la simplicidad de MyPocket.
          </p>
        </div>

        {/* Google Login Only */}
        <div className="w-full space-y-4">
          <button 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-nu-purple hover:bg-nu-purple-hover disabled:opacity-50 text-white font-extrabold py-5 rounded-[1.5rem] transition-all shadow-lg shadow-nu-purple/20 active:scale-95 flex items-center justify-center gap-4 text-lg"
          >
            {isLoggingIn ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6 bg-white p-1 rounded-full" />
                Continuar con Google
              </>
            )}
          </button>
        </div>

        {/* Info/Security */}
        <footer className="mt-20 text-center space-y-8">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <p className="text-xs font-bold uppercase tracking-widest">Conexión Segura</p>
            <p className="text-[10px] opacity-70 max-w-[200px]">
              Usamos la autenticación oficial de Google para proteger tu privacidad.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
