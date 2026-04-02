import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MasterContext {
  profile: {
    name: string;
    avatar_dossier: string | null;
    product_context: string | null;
    cpa_meta: number;
    ticket_medio: number;
    limite_escala: number;
    budget_maximo: number;
    budget_frequency: string;
    cpa_max_toleravel: number;
    roas_min_escala: number;
    teto_diario_escala: number;
    ad_account_id: string;
    meta_access_token: string | null;
  };
  metaMetrics: {
    spend: number;
    cpa: number;
    roas: number;
    purchases: number;
    revenue: number;
  } | null;
  systemPromptBlock: string;
  blocked: false;
}

export interface MasterContextBlocked {
  blocked: true;
  error: string;
  details?: string;
}

export type MasterContextResult = MasterContext | MasterContextBlocked;

export async function fetchMasterContext(
  profileId: string,
  metaAccessTokenOverride?: string
): Promise<MasterContextResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, supabaseKey);

  // Carga 1: Profile data from Supabase
  const { data: profile, error: profileError } = await sb
    .from("client_profiles")
    .select("name, avatar_dossier, product_context, cpa_meta, ticket_medio, limite_escala, budget_maximo, budget_frequency, cpa_max_toleravel, roas_min_escala, teto_diario_escala, ad_account_id, meta_access_token")
    .eq("id", profileId)
    .single();

  if (profileError || !profile) {
    return { blocked: true, error: "profile_not_found", details: "Perfil não encontrado no banco de dados." };
  }

  // Anti-hallucination: block if no dossier AND no product context
  if (!profile.avatar_dossier && !profile.product_context) {
    return {
      blocked: true,
      error: "missing_dossier",
      details: "O Dossiê do Avatar e o Contexto do Produto estão vazios. Preencha nas Configurações antes de usar a IA.",
    };
  }

  // Resolve access token
  const accessToken = metaAccessTokenOverride || profile.meta_access_token || Deno.env.get("META_ACCESS_TOKEN");

  // Carga 2: Meta API metrics (last 7 days)
  let metaMetrics: MasterContext["metaMetrics"] = null;

  if (accessToken && profile.ad_account_id && profile.ad_account_id !== "act_") {
    try {
      const url = `https://graph.facebook.com/v21.0/${profile.ad_account_id}/insights?date_preset=last_7d&fields=spend,actions,action_values,purchase_roas&level=account&time_increment=all_days`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (resp.ok) {
        const json = await resp.json();
        const row = json.data?.[0];
        if (row) {
          const spend = parseFloat(row.spend || "0");
          const purchases = (row.actions || []).find((a: any) => a.action_type === "purchase")?.value || 0;
          const revenue = (row.action_values || []).find((a: any) => a.action_type === "purchase")?.value || 0;
          const roas = (row.purchase_roas || []).find((a: any) => a.action_type === "purchase")?.value || 0;
          const cpa = Number(purchases) > 0 ? spend / Number(purchases) : 0;

          metaMetrics = {
            spend,
            cpa: Math.round(cpa * 100) / 100,
            roas: Math.round(Number(roas) * 100) / 100,
            purchases: Number(purchases),
            revenue: Math.round(Number(revenue) * 100) / 100,
          };
        }
      } else {
        console.warn("Meta API fetch failed:", resp.status, await resp.text());
        // Don't block — Meta data is optional enrichment
      }
    } catch (e) {
      console.warn("Meta API error:", e);
    }
  }

  // Carga 3: Active agent skills
  let skillsBlock = "";
  try {
    const { data: skills } = await sb
      .from("agent_skills")
      .select("name, platform, content")
      .eq("active", true)
      .order("name");

    if (skills && skills.length > 0) {
      const skillsList = skills.map((s: any) => 
        `### SKILL: ${s.name} (${s.platform})\n${s.content}`
      ).join("\n\n---\n\n");
      
      skillsBlock = `\n## BASE DE CONHECIMENTO ESPECIALIZADA (${skills.length} SKILLS ATIVAS)

INSTRUÇÃO: Quando o usuário fizer uma pergunta, identifique qual(is) skill(s) são relevantes e use o conhecimento delas para responder com profundidade. Combine múltiplas skills quando a pergunta cruzar domínios (ex: "campanha Meta Ads para e-commerce" → use skills de meta-ads + e-commerce + klaviyo).

ROTEAMENTO DE SKILLS:
- Pagamento/cobrança/cartão recusado → stripe
- Email marketing e-commerce / pós-compra → klaviyo  
- Email marketing B2B / CRM → activecampaign
- Anúncios Meta/Facebook/Instagram → paid-ads-meta, ad-creative, copywriting
- Anúncios Google → google-ads
- Anúncios TikTok → tiktok-ads
- Anúncios LinkedIn → linkedin-ads
- SEO / indexação → seo-audit, google-search-console, programmatic-seo
- Analytics / comportamento → google-analytics-4, analytics-tracking
- CRO / conversão → page-cro, hotjar, optimizely
- Automação → n8n-automation, make-zapier
- WhatsApp → evolution-api
- Formulários / quiz → typeform

${skillsList}`;
    }
  } catch (e) {
    console.warn("Failed to fetch agent skills:", e);
  }

  // Build the system prompt block
  const profileBlock = {
    nome: profile.name,
    cpa_meta: profile.cpa_meta,
    ticket_medio: profile.ticket_medio,
    limite_escala: profile.limite_escala,
    budget_maximo: profile.budget_maximo,
    budget_frequency: profile.budget_frequency,
    cpa_max_toleravel: profile.cpa_max_toleravel,
    roas_min_escala: profile.roas_min_escala,
    teto_diario_escala: profile.teto_diario_escala,
  };

  let systemPromptBlock = `🛑 DIRETRIZ MESTRA: Você é o Estrategista Sênior da MTX. Antes de gerar qualquer resposta, sugestão, copy ou diagnóstico, você DEVE basear suas decisões EXCLUSIVAMENTE nestes dados atuais do cliente:

## CONFIGURAÇÕES DO PERFIL
\`\`\`json
${JSON.stringify(profileBlock, null, 2)}
\`\`\`
`;

  if (profile.avatar_dossier) {
    systemPromptBlock += `\n## DOSSIÊ DO AVATAR (VERDADE ABSOLUTA — PRIORIDADE MÁXIMA)
${profile.avatar_dossier}

⚠️ REGRA DE HIERARQUIA: O Dossiê do Avatar é a VERDADE ABSOLUTA. Ele define:
- QUEM é o consumidor final (o avatar/persona que verá os anúncios)
- QUAL é a DOR, o DESEJO e as OBJEÇÕES desse consumidor
- QUAL é o MECANISMO ÚNICO do produto/serviço
- QUAL é o TOM DE VOZ da marca
Se houver CONFLITO entre o Dossiê do Avatar e o Contexto do Produto abaixo, o DOSSIÊ PREVALECE SEMPRE.
As copies devem falar sobre o PRODUTO/SERVIÇO descrito no mecanismo único do dossiê, usando o tom de voz do dossiê, endereçando as dores e desejos do avatar.
`;
  }

  if (profile.product_context) {
    systemPromptBlock += `\n## CONTEXTO DO PRODUTO (COMPLEMENTAR — NÃO SOBREPÕE O DOSSIÊ)
${profile.product_context}

⚠️ ATENÇÃO: Este contexto é COMPLEMENTAR ao Dossiê do Avatar. Se o dossiê descreve uma marca de moda e o contexto menciona "Instagram" ou "marketing digital", a copy NÃO deve vender "estratégia de Instagram" — deve vender o PRODUTO descrito no dossiê (roupas, serviços, etc) usando insights adicionais deste contexto.
`;
  }

  if (metaMetrics) {
    systemPromptBlock += `\n## MÉTRICAS REAIS DA META ADS (ÚLTIMOS 7 DIAS)
\`\`\`json
${JSON.stringify(metaMetrics, null, 2)}
\`\`\`

Se o ROAS está caindo, suas sugestões devem focar em urgência/retargeting. Se o CPA está acima da meta, priorize otimização de público e criativos.
`;
  } else {
    systemPromptBlock += `\n## MÉTRICAS DA META ADS
Dados da Meta não disponíveis neste momento. Baseie-se nas configurações do perfil.
`;
  }

  // Append skills block
  if (skillsBlock) {
    systemPromptBlock += skillsBlock;
  }

  return {
    profile,
    metaMetrics,
    systemPromptBlock,
    blocked: false,
  };
}
