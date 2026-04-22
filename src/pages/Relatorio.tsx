import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, useScroll, useSpring } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toPng, toJpeg, toSvg } from "html-to-image";
import jsPDF from "jspdf";
import ExportDashboard from "@/components/dashboard/ExportDashboard";


/* ─── helpers ─── */
function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n: number) {
  return n.toLocaleString("pt-BR");
}
function fmtCurrency(n: number) {
  return `R$ ${fmt(n)}`;
}

/* ─── animated number ─── */
function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !animated.current) {
        animated.current = true;
        const start = performance.now();
        const duration = 1500;
        const ease = (t: number) => 1 - Math.pow(1 - t, 4);
        const tick = (now: number) => {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          setDisplay(value * ease(progress));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  const formatted = decimals > 0 ? display.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : Math.round(display).toLocaleString("pt-BR");
  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
}

/* ─── section reveal ─── */
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── CSS tokens ─── */
const COLORS = {
  preto: "#0C0C0C",
  azulExpert: "#027F97",
  azulInovacao: "#0BA4CF",
  cardBg: "#141414",
  lineDark: "#1E1E1E",
  cinza: "#5A5A5A",
  cinzaClaro: "#8A8A8A",
};

/* ─── types ─── */
interface ReportMetrics {
  spend?: number;
  revenue?: number;
  roas?: number;
  cpa?: number;
  purchases?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpm?: number;
  cpc?: number;
  profit?: number;
  followers?: number;
  engagement_rate?: number;
  likes?: number;
  comments?: number;
  date?: string;
  profile_name?: string;
}

interface ReportSnapshot {
  id: string;
  profile_id: string;
  token: string;
  metrics: ReportMetrics;
  summary: string;
  created_at: string;
  expires_at: string;
}

/* ─── MAIN ─── */
export default function Relatorio() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [profileName, setProfileName] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  useEffect(() => {
    if (!token) { setError(true); setLoading(false); return; }
    (async () => {
      const { data, error: err } = await (supabase as any)
        .from("report_snapshots")
        .select("*")
        .eq("token", token)
        .single();
      if (err || !data) { setError(true); setLoading(false); return; }
      const now = new Date();
      if (new Date(data.expires_at) < now) { setError(true); setLoading(false); return; }
      setReport(data);
      // fetch profile name
      const { data: profile } = await (supabase as any)
        .from("client_profiles")
        .select("name")
        .eq("id", data.profile_id)
        .single();
      setProfileName(profile?.name || data.metrics?.profile_name || "Cliente");
      setLoading(false);
    })();
  }, [token]);

  /* ─── LOADING ─── */

  if (loading) {
    return (
      <div style={{ background: COLORS.preto, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", alignItems: "center" }}>
          {[1,2,3].map(i => (
            <div key={i} className="animate-pulse" style={{
              width: i === 1 ? "200px" : i === 2 ? "300px" : "250px",
              height: i === 1 ? "20px" : "16px",
              borderRadius: "8px",
              background: `linear-gradient(90deg, ${COLORS.cardBg}, ${COLORS.lineDark}, ${COLORS.cardBg})`,
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
            }} />
          ))}
        </div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      </div>
    );
  }

  /* ─── ERROR ─── */
  if (error || !report) {
    return (
      <div style={{ background: COLORS.preto, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1.5rem", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={COLORS.azulExpert} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Relatório não encontrado</h2>
        <p style={{ color: COLORS.cinzaClaro, maxWidth: "360px", textAlign: "center", lineHeight: 1.6 }}>
          Este link expirou ou é inválido. Solicite um novo relatório à sua agência.
        </p>
        <a href="https://wa.me/5551991443171" target="_blank" rel="noopener noreferrer"
          style={{ marginTop: "1rem", padding: "0.8rem 1.5rem", background: COLORS.azulExpert, color: "#fff", borderRadius: "100px", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem" }}>
          Falar com a MTX
        </a>
      </div>
    );
  }

  const m = report.metrics;
  const spend = m.spend || 0;
  const revenue = m.revenue || 0;
  const roas = m.roas || (spend > 0 ? revenue / spend : 0);
  const cpa = m.cpa || 0;
  const purchases = m.purchases || 0;
  const impressions = m.impressions || 0;
  const clicks = m.clicks || 0;
  const ctr = m.ctr || 0;
  const cpm = m.cpm || 0;
  const followers = m.followers || 0;
  const engagementRate = m.engagement_rate || 0;
  const likes = m.likes || 0;
  const comments = m.comments || 0;
  const createdAt = new Date(report.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const metricCardStyle: React.CSSProperties = {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.lineDark}`,
    borderRadius: "16px",
    padding: "2rem",
    transition: "all 0.3s ease",
    position: "relative",
    overflow: "hidden",
  };

  const gradientText: React.CSSProperties = {
    background: `linear-gradient(135deg, ${COLORS.azulExpert}, ${COLORS.azulInovacao})`,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  };

  const sectionLabel: React.CSSProperties = {
    textTransform: "uppercase" as const,
    letterSpacing: "0.2em",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: COLORS.cinzaClaro,
    marginBottom: "0.5rem",
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Scroll progress bar */}
      <motion.div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "3px", zIndex: 9999,
        background: `linear-gradient(90deg, ${COLORS.azulExpert}, ${COLORS.azulInovacao})`,
        scaleX, transformOrigin: "0%",
      }} />

      <div ref={contentRef} id="report-content" style={{
        background: COLORS.preto,
        minHeight: "100vh",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Noise overlay */}
        <svg style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1, opacity: 0.025 }}>
          <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /></filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>

        {/* Floating orbs */}
        {[
          { top: "10%", left: "5%", size: 300, color: COLORS.azulExpert, delay: "0s" },
          { top: "60%", right: "5%", size: 250, color: COLORS.azulInovacao, delay: "3s" },
          { top: "80%", left: "40%", size: 200, color: COLORS.azulExpert, delay: "6s" },
        ].map((orb, i) => (
          <div key={i} style={{
            position: "fixed",
            top: orb.top, left: (orb as any).left, right: (orb as any).right,
            width: orb.size, height: orb.size,
            borderRadius: "50%",
            background: orb.color,
            filter: "blur(80px)",
            opacity: 0.03,
            animation: `float 8s ease-in-out ${orb.delay} infinite alternate`,
            zIndex: 0,
            pointerEvents: "none",
          }} />
        ))}

        <style>{`
          @keyframes float { 0% { transform: translateY(0); } 100% { transform: translateY(-30px); } }
          @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 40px rgba(2,127,151,0.2); } 50% { box-shadow: 0 0 80px rgba(2,127,151,0.35); } }
          @keyframes rotateGradient { 0% { --angle: 0deg; } 100% { --angle: 360deg; } }
          .metric-card:hover { transform: translateY(-4px); border-color: rgba(2,127,151,0.3) !important; box-shadow: 0 8px 32px rgba(2,127,151,0.1); }
        `}</style>

        <div style={{ position: "relative", zIndex: 2 }}>
          {/* ═══ HERO ═══ */}
          <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", padding: "2rem" }}>
            {/* Ghost X */}
            <div style={{ position: "absolute", right: "-5%", top: "50%", transform: "translateY(-50%)", fontSize: "clamp(15rem, 40vw, 40rem)", fontWeight: 900, opacity: 0.02, lineHeight: 1, pointerEvents: "none", animation: "float 10s ease-in-out infinite alternate" }}>X</div>

            <Reveal>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "0.5rem",
                padding: "0.4rem 1rem", borderRadius: "100px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(10px)", fontSize: "0.75rem", fontWeight: 600,
                letterSpacing: "0.15em", textTransform: "uppercase" as const, color: COLORS.azulExpert,
                marginBottom: "2rem",
              }}>
                MTX ROI Command
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <h1 style={{
                fontSize: "clamp(3rem, 9vw, 6rem)", fontWeight: 900, lineHeight: 1.05,
                textTransform: "uppercase" as const, letterSpacing: "-0.02em",
                marginBottom: "1.5rem",
              }}>
                {profileName}
              </h1>
            </Reveal>

            <Reveal delay={0.2}>
              <div style={{ width: "80px", height: "3px", background: `linear-gradient(90deg, ${COLORS.azulExpert}, ${COLORS.azulInovacao})`, borderRadius: "2px", margin: "0 auto 1.5rem", boxShadow: `0 0 20px ${COLORS.azulExpert}` }} />
            </Reveal>

            <Reveal delay={0.3}>
              <p style={{ color: COLORS.azulExpert, fontSize: "1.1rem", fontWeight: 500, letterSpacing: "0.05em", marginBottom: "1rem" }}>
                Relatório de Performance
              </p>
            </Reveal>

            <Reveal delay={0.4}>
              <p style={{ color: COLORS.cinza, fontSize: "0.8rem" }}>
                {m.date ? `Período: ${new Date(m.date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""} • Gerado em {createdAt}
              </p>
            </Reveal>

            {/* Scroll indicator */}
            <Reveal delay={0.6}>
              <div style={{ position: "absolute", bottom: "2rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: "1px", height: "40px", background: `linear-gradient(to bottom, transparent, ${COLORS.azulExpert})` }} />
                <span style={{ fontSize: "0.6rem", letterSpacing: "0.3em", textTransform: "uppercase" as const, color: COLORS.cinza }}>SCROLL</span>
              </div>
            </Reveal>
          </section>

          {/* ═══ ROAS HERO CARD ═══ */}
          <section style={{ maxWidth: "900px", margin: "0 auto", padding: "0 1.5rem 4rem" }}>
            <Reveal>
              <div style={{
                background: `linear-gradient(135deg, ${COLORS.azulExpert}, #015a6b, #026d82)`,
                borderRadius: "24px", padding: "clamp(2rem, 5vw, 4rem) clamp(1.5rem, 4vw, 3rem)",
                textAlign: "center",
                animation: "glowPulse 4s ease-in-out infinite",
              }}>
                <p style={{ ...sectionLabel, color: "rgba(255,255,255,0.6)", marginBottom: "1rem" }}>RETORNO SOBRE INVESTIMENTO</p>
                <p style={{ fontSize: "clamp(2.8rem, 7vw, 4.5rem)", fontWeight: 900, lineHeight: 1 }}>
                  <AnimatedNumber value={roas} suffix="x" decimals={2} />
                </p>
                <p style={{ color: "rgba(255,255,255,0.7)", marginTop: "1rem", fontSize: "0.95rem" }}>
                  {fmtCurrency(spend)} investidos → {fmtCurrency(revenue)} gerados
                </p>
              </div>
            </Reveal>

            {/* 4 KPI cards below */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "1.5rem" }}>
              {[
                { label: "INVESTIMENTO", value: <AnimatedNumber value={spend} prefix="R$ " decimals={2} /> },
                { label: "RECEITA", value: <AnimatedNumber value={revenue} prefix="R$ " decimals={2} /> },
                { label: "VENDAS", value: <AnimatedNumber value={purchases} /> },
                { label: "CPA", value: <AnimatedNumber value={cpa} prefix="R$ " decimals={2} /> },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 0.1}>
                  <div className="metric-card" style={metricCardStyle}>
                    <p style={sectionLabel}>{item.label}</p>
                    <p style={{ ...gradientText, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 900, marginTop: "0.5rem" }}>
                      {item.value}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* ═══ PERFORMANCE METRICS ═══ */}
          <section style={{ maxWidth: "900px", margin: "0 auto", padding: "0 1.5rem 4rem" }}>
            <Reveal>
              <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                <p style={sectionLabel}>ANÁLISE DE PERFORMANCE</p>
                <div style={{ width: "60px", height: "2px", background: `linear-gradient(90deg, ${COLORS.azulExpert}, ${COLORS.azulInovacao})`, borderRadius: "2px", margin: "0.75rem auto 0", boxShadow: `0 0 15px ${COLORS.azulExpert}` }} />
              </div>
            </Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              {[
                { label: "CTR", value: <AnimatedNumber value={ctr} suffix="%" decimals={2} />, badge: ctr > 1 },
                { label: "CPM", value: <AnimatedNumber value={cpm} prefix="R$ " decimals={2} /> },
                { label: "IMPRESSÕES", value: <AnimatedNumber value={impressions} /> },
                { label: "CLIQUES", value: <AnimatedNumber value={clicks} /> },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 0.1}>
                  <div className="metric-card" style={{ ...metricCardStyle, padding: "2.5rem 2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <p style={sectionLabel}>{item.label}</p>
                      {item.badge && (
                        <span style={{ fontSize: "0.6rem", padding: "0.15rem 0.4rem", borderRadius: "4px", background: "rgba(34,197,94,0.15)", color: "#22c55e", fontWeight: 600 }}>BOM</span>
                      )}
                    </div>
                    <p style={{ ...gradientText, fontSize: "clamp(2rem, 3.5vw, 2.8rem)", fontWeight: 900, marginTop: "0.75rem" }}>
                      {item.value}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* ═══ AI SUMMARY ═══ */}
          {report.summary && report.summary.length > 5 && (
            <section style={{ maxWidth: "900px", margin: "0 auto", padding: "0 1.5rem 4rem" }}>
              <Reveal>
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                  <p style={sectionLabel}>INTELIGÊNCIA ARTIFICIAL</p>
                  <div style={{ width: "60px", height: "2px", background: `linear-gradient(90deg, ${COLORS.azulExpert}, ${COLORS.azulInovacao})`, borderRadius: "2px", margin: "0.75rem auto 0", boxShadow: `0 0 15px ${COLORS.azulExpert}` }} />
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div style={{
                  ...metricCardStyle,
                  padding: "2.5rem",
                  borderImage: `linear-gradient(135deg, ${COLORS.azulExpert}, ${COLORS.azulInovacao}, ${COLORS.azulExpert}) 1`,
                }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "0.3rem",
                    padding: "0.3rem 0.8rem", borderRadius: "100px",
                    background: "rgba(2,127,151,0.15)", color: COLORS.azulInovacao,
                    fontSize: "0.7rem", fontWeight: 600, marginBottom: "1.5rem",
                  }}>
                    ⚡ Powered by Claude AI
                  </span>
                  <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "1rem", lineHeight: 1.8, fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                    {report.summary}
                  </p>
                </div>
              </Reveal>
            </section>
          )}

          {/* ═══ SOCIAL ═══ */}
          {followers > 0 && (
            <section style={{ maxWidth: "900px", margin: "0 auto", padding: "0 1.5rem 4rem" }}>
              <Reveal>
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                  <p style={sectionLabel}>PRESENÇA DIGITAL</p>
                  <div style={{ width: "60px", height: "2px", background: `linear-gradient(90deg, ${COLORS.azulExpert}, ${COLORS.azulInovacao})`, borderRadius: "2px", margin: "0.75rem auto 0", boxShadow: `0 0 15px ${COLORS.azulExpert}` }} />
                </div>
              </Reveal>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                {[
                  { label: "SEGUIDORES", value: <AnimatedNumber value={followers} /> },
                  { label: "ENGAJAMENTO", value: <AnimatedNumber value={engagementRate} suffix="%" decimals={2} /> },
                  { label: "CURTIDAS", value: <AnimatedNumber value={likes} /> },
                  { label: "COMENTÁRIOS", value: <AnimatedNumber value={comments} /> },
                ].map((item, i) => (
                  <Reveal key={i} delay={i * 0.1}>
                    <div className="metric-card" style={metricCardStyle}>
                      <p style={sectionLabel}>{item.label}</p>
                      <p style={{ ...gradientText, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 900, marginTop: "0.5rem" }}>
                        {item.value}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>
          )}

          {/* ═══ FOOTER ═══ */}
          <footer style={{ borderTop: `1px solid ${COLORS.lineDark}`, padding: "3rem 1.5rem", textAlign: "center" }}>
            <Reveal>
              <p style={{ fontSize: "1.5rem", fontWeight: 800 }}>
                <span style={gradientText}>MTX</span>{" "}
                <span style={{ fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase" as const, color: COLORS.cinzaClaro, verticalAlign: "middle" }}>ASSESSORIA ESTRATÉGICA</span>
              </p>
              <p style={{ color: COLORS.cinza, fontSize: "0.75rem", marginTop: "1rem" }}>
                Este relatório foi gerado automaticamente pelo MTX ROI Command
              </p>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "0.3rem",
                padding: "0.3rem 0.8rem", borderRadius: "100px",
                background: "rgba(2,127,151,0.1)", color: COLORS.azulInovacao,
                fontSize: "0.65rem", fontWeight: 600, marginTop: "1rem",
              }}>
                ⚡ Powered by Claude AI
              </span>
            </Reveal>
          </footer>
        </div>

        {/* Download action */}
        <div style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 100,
        }}>
          <ExportDashboard 
            elementId="report-content" 
            dashboardName={`Relatorio_${profileName}`}
          />
        </div>
      </div>

    </>
  );
}
