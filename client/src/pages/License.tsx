import { Shield, Lock, Ban, UserCheck, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

const License = () => {
  return (
    <div className="min-h-screen bg-background text-white selection:bg-indigo-500/30">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors group"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Voltar para o início
          </Link>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Shield className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Licença e Termos de Uso</h1>
              <p className="text-white/40 text-sm mt-1">Nexus ROAS — Sistema Relevante de Rastreamento</p>
            </div>
          </div>

          <div className="prose prose-invert prose-indigo max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <UserCheck className="h-5 w-5 text-indigo-400" />
                Propriedade e Direitos
              </h2>
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                <p className="text-white/60 leading-relaxed">
                  Este software é de propriedade intelectual exclusiva de <span className="text-white font-medium">Nelsijan</span>. 
                  Todos os direitos, títulos e interesses relativos ao software, incluindo código-fonte, design, algoritmos e documentação associada, permanecem com o proprietário original.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
                <Lock className="h-5 w-5 text-indigo-400" />
                Termos da Licença
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                  <h3 className="text-white font-medium mb-2">Uso Autorizado</h3>
                  <p className="text-sm text-white/50 leading-relaxed">
                    A licença é concedida apenas para o comprador original ou pessoas/entidades que receberam permissão direta de Nelsijan via canais oficiais de venda.
                  </p>
                </div>
                <div className="bg-white/[0.02] border border-red-500/10 rounded-2xl p-6">
                  <h3 className="text-white font-medium mb-2">Transferência</h3>
                  <p className="text-sm text-white/50 leading-relaxed">
                    A licença não é transferível para terceiros, exceto sob autorização expressa e por escrito do proprietário.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4 text-red-400">
                <Ban className="h-5 w-5" />
                Proibições Estritas
              </h2>
              <ul className="grid grid-cols-1 gap-3">
                {[
                  "Copiar o código-fonte original ou partes do design.",
                  "Revender o sistema sem autorização prévia por escrito.",
                  "Distribuir o software de forma não autorizada.",
                  "Engenharia reversa ou modificação não autorizada.",
                  "Uso por quem não adquiriu o software de canais oficiais."
                ].map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm text-white/50 bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <div className="pt-8 border-t border-white/10 text-center">
              <p className="text-xs text-white/20">
                © 2024-2025 Nexus ROAS / Nelsijan. Todos os direitos reservados.
                <br />
                Violações estarão sujeitas a medidas judiciais cabíveis sob as leis de propriedade intelectual.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default License;
