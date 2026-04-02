
CREATE TABLE IF NOT EXISTS public.agent_skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  platform text,
  content text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active skills" ON public.agent_skills
  FOR SELECT TO authenticated USING (active = true);

INSERT INTO public.agent_skills (name, platform, content) VALUES (
  'paid-ads-meta',
  'meta',
  E'SKILL: PAID ADS META EXPERT\n\nOTIMIZAÇÃO DE CPA ALTO:\n1. Verifique a landing page (problema pós-clique?)\n2. Restrinja targeting de audience\n3. Teste novos ângulos de criativo\n4. Melhore relevância do anúncio\n5. Ajuste bid strategy\n\nCTR BAIXO → criativo não ressoa → testar novos hooks/ângulos\nCPM ALTO → audience muito estreita → expandir targeting\n\nJANELAS DE RETARGETING:\n- Hot (carrinho/trial): 1-7 dias, frequência alta OK\n- Warm (páginas chave): 7-30 dias, 3-5x/semana\n- Cold (qualquer visita): 30-90 dias, 1-2x/semana\n\nEXCLUSÕES OBRIGATÓRIAS:\n- Clientes existentes\n- Conversores recentes (7-14 dias)\n- Visitantes bounce (<10 seg)\n\nPROGRESSÃO DE BID STRATEGY:\n1. Iniciar manual ou cost caps\n2. Coletar dados (50+ conversões)\n3. Migrar para automatizado com targets históricos\n\nHIERARQUIA DE TESTES CRIATIVOS:\n1. Conceito/ângulo (maior impacto)\n2. Hook/headline\n3. Estilo visual\n4. Copy do corpo\n5. CTA\n\nESTRUTURA DE VÍDEO (15-30s):\n- 0-3s: Hook (interrupção de padrão)\n- 3-8s: Problema (dor relatável)\n- 8-20s: Solução (mostrar produto)\n- 20-30s: CTA claro\n\nALOCAÇÃO DE BUDGET:\n- Fase teste (2-4 semanas): 70% campanhas provadas, 30% testes\n- Fase escala: consolidar em combinações vencedoras\n- Aumentar budget 20-30% por vez\n- Aguardar 3-5 dias entre aumentos (aprendizado do algoritmo)\n\nERROS CRÍTICOS A EVITAR:\n- Lançar sem pixel/conversion tracking\n- Muitas campanhas (fragmenta budget)\n- Não dar tempo de aprendizado ao algoritmo\n- Otimizar para métrica errada\n- Audiences sobrepostas competindo entre si\n- Não renovar criativo (fadiga)\n- Mismatch entre anúncio e landing page\n\nMÉTRICAS POR OBJETIVO:\n- Awareness: CPM, Reach, Video view rate\n- Consideração: CTR, CPC, Tempo no site\n- Conversão: CPA, ROAS, Taxa de conversão\n\nATRIBUIÇÃO:\n- Dados da plataforma são inflados\n- Comparar sempre com dados reais (GA4/Pixel)\n- Olhar CAC blended, não só CPA da plataforma'
);
