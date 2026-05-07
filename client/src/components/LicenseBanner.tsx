import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface LicenseInfo {
  valid: boolean;
  tier: string;
  status: string;
  expires_at: string | null;
}

export function LicenseBanner() {
  const { token } = useAuth();
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/license/info', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setLicense(data))
      .catch(() => {});
  }, [token]);

  if (!license || license.valid || dismissed) return null;
  if (license.status === 'active') return null;

  const message = license.status === 'expired'
    ? 'Sua licença expirou. Renove para continuar utilizando todos os recursos.'
    : license.status === 'revoked'
    ? 'Licença revogada. Entre em contato com o suporte.'
    : 'Licença inválida. Verifique sua chave de licença.';

  return (
    <div className="flex items-center gap-3 bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2.5 text-sm">
      <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
      <span className="text-yellow-200 flex-1">{message}</span>
      <a
        href="mailto:nelsijansilva@gmail.com"
        className="text-yellow-400 underline underline-offset-2 hover:text-yellow-300 font-medium"
      >
        Entrar em contato
      </a>
      <button
        onClick={() => setDismissed(true)}
        className="text-yellow-400/60 hover:text-yellow-400 transition-colors ml-2"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
