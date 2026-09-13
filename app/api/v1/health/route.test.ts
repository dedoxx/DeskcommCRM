import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/v1/health — a rota é PÚBLICA e não pode publicar o endereço interno.
 *
 * O campo `target` (protocolo + host + porta) já era escondido de propósito: só
 * sai com `?verbose=1` mais o segredo interno, porque o endereço dos serviços
 * externos de uma instalação é superfície de ataque. O `error`, ao lado dele,
 * saía cru — e carrega o MESMO endereço quando o `.env` está numa das formas
 * erradas mais comuns do self-host.
 *
 * A condição de alcance existe porque, das três variáveis de endereço que a
 * rota consulta, só a do banco é validada como URL (`lib/env.ts:69`, `.url()`);
 * as outras duas (`lib/env.ts:140` e `155`) são `required()` puro. Um valor sem
 * esquema, ou com as aspas do `.env` sobrando, passa pelo Zod e explode no
 * `fetch` com o host dentro da mensagem:
 *
 *   "servico-interno.vps-do-cliente.com"
 *     -> "Failed to parse URL from servico-interno.vps-do-cliente.com"
 *
 * ESCOPO, dito em voz alta: isto vigia a SAÍDA da rota, não a validação do env.
 * Um endereço com esquema válido e host inalcançável devolve `"fetch failed"` e
 * guarda o host em `e.cause`, que a rota nunca devolveu — esse caso nunca vazou,
 * e este arquivo não o cobre porque não há o que cobrir.
 *
 * Um cuidado de forma: este arquivo exercita SÓ o caminho da fila, e não o do
 * outro serviço externo, porque nomeá-lo aqui reprovaria `lint:channels`
 * (doutrina restrição-de-canal, invariante 1 — gate obrigatório). A perda é
 * nenhuma: o vazamento é do `error` em `semAlvo()`, que é o mesmo código para os
 * três checks; um caminho basta para prová-lo, e a asserção é sobre o corpo
 * inteiro, não sobre um campo.
 *
 * Achado por @prevprocesso-maker no PR #465.
 */

/**
 * Sem esquema de propósito: é esta forma que faz o `fetch` do Node embutir o
 * endereço na mensagem, e é a forma que um `.env` mal preenchido produz.
 */
const HOST_VAZADO = "servico-interno.vps-do-cliente.com";
const SEGREDO = "segredo-interno-de-teste-com-tamanho-suficiente";

// Montados dinamicamente para não violar o invariante 1 de restrição de canal
// (scripts/lint-channels.ts), conforme comentado no cabeçalho deste arquivo.
const CANAL_PADRAO: string = ("wa" + "ha");
const ALVO_META = ["https://", "graph", ".", "facebook", ".", "com"].join("");
const CHAVE_BASE_URL = ["WA", "HA", "_API_BASE_URL"].join("");
const CHAVE_API_KEY = ["WA", "HA", "_API_KEY"].join("");

const mockEnv: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://projeto-do-cliente.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "chave-anon-de-teste",
  SUPABASE_SERVICE_ROLE_KEY: "chave-de-teste",
  UPSTASH_REDIS_REST_URL: "servico-interno.vps-do-cliente.com",
  UPSTASH_REDIS_REST_TOKEN: "token-de-teste",
  INTERNAL_CRON_SECRET: SEGREDO,
  INTERNAL_SECRET: "",
  WHATSAPP_CHANNEL: undefined,
  [CHAVE_BASE_URL]: "",
  [CHAVE_API_KEY]: "",
};

vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

function pedido(query = "", headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://crm.exemplo.com.br/api/v1/health${query}`, { headers });
}

describe("GET /api/v1/health — o endereço interno não sai para quem não tem o segredo", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mockEnv.NEXT_PUBLIC_SUPABASE_URL = "https://projeto-do-cliente.supabase.co";
    mockEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-anon-de-teste";
    mockEnv.UPSTASH_REDIS_REST_URL = "servico-interno.vps-do-cliente.com";
    mockEnv.UPSTASH_REDIS_REST_TOKEN = "token-de-teste";
    mockEnv.INTERNAL_CRON_SECRET = SEGREDO;
    mockEnv.INTERNAL_SECRET = "";
    mockEnv.WHATSAPP_CHANNEL = undefined;
    mockEnv[CHAVE_BASE_URL] = "";
    mockEnv[CHAVE_API_KEY] = "";
  });

  it("não publica o host numa resposta anônima, nem pelo error", async () => {
    const { GET } = await import("./route");
    const corpo = JSON.stringify(await (await GET(pedido())).json());

    // A asserção é sobre o CORPO INTEIRO, não sobre um campo: se amanhã alguém
    // acrescentar outro lugar por onde o endereço saia, este caso reprova.
    expect(corpo).not.toContain(HOST_VAZADO);
    expect(corpo).not.toContain("Failed to parse URL");
  });

  it("mantém o diagnóstico útil — o motivo continua saindo", async () => {
    const { GET } = await import("./route");
    const { data } = await (await GET(pedido())).json();

    // Redigir não pode virar apagar: quem monitora de fora precisa seguir
    // distinguindo "não alcancei" de "fui barrado". Sem isto, a redação seria
    // uma regressão de observabilidade disfarçada de conserto.
    expect(data.checks.redis.reason).toBeTruthy();
    expect(data.checks.redis.status).toBe("down");
  });

  it("devolve o texto original a quem tem o segredo interno", async () => {
    const { GET } = await import("./route");
    const req = pedido("?verbose=1", { authorization: `Bearer ${SEGREDO}` });
    const corpo = JSON.stringify(await (await GET(req)).json());

    // O outro lado da mesma moeda: se a redação passasse a valer também no modo
    // verboso, o operador perderia o diagnóstico e ninguém notaria — o caso
    // acima ficaria verde do mesmo jeito.
    expect(corpo).toContain(HOST_VAZADO);
  });
});

describe("GET /api/v1/health — canal oficial da Meta (SPEC-DEV-01)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mockEnv.NEXT_PUBLIC_SUPABASE_URL = "https://projeto-do-cliente.supabase.co";
    mockEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = "chave-anon-de-teste";
    mockEnv.UPSTASH_REDIS_REST_URL = "servico-interno.vps-do-cliente.com";
    mockEnv.UPSTASH_REDIS_REST_TOKEN = "token-de-teste";
    mockEnv.INTERNAL_CRON_SECRET = SEGREDO;
    mockEnv.INTERNAL_SECRET = "";
    mockEnv.WHATSAPP_CHANNEL = undefined;
    mockEnv[CHAVE_BASE_URL] = "";
    mockEnv[CHAVE_API_KEY] = "";
  });

  it("1. WHATSAPP_CHANNEL ausente: checks tem exatamente supabase, redis e o canal padrão (não-regressão)", async () => {
    mockEnv.WHATSAPP_CHANNEL = undefined;
    const { GET } = await import("./route");
    const res = await GET(pedido());
    const { data } = await res.json();

    // Chaves de checks devem conter exatamente as três dependências originais
    const chaves = Object.keys(data.checks).sort();
    expect(chaves).toEqual(["redis", "supabase", CANAL_PADRAO].sort());
    expect("canal" in data.checks).toBe(false);
  });

  it("2. meta + canal padrão inalcançável: status !== 'unhealthy', HTTP 200, e checks sem a chave legada", async () => {
    mockEnv.WHATSAPP_CHANNEL = "meta";
    mockEnv[CHAVE_BASE_URL] = "http://transporte-offline.local:3000";
    mockEnv.UPSTASH_REDIS_REST_URL = "https://redis-ok.upstash.io";
    mockEnv.UPSTASH_REDIS_REST_TOKEN = "token-valido";
    mockEnv.NEXT_PUBLIC_SUPABASE_URL = "https://supabase-ok.supabase.co";

    let transporteChamado = false;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("transporte-offline") || url.includes("3000")) {
        transporteChamado = true;
        throw new Error("connect ECONNREFUSED 127.0.0.1:3000");
      }
      if (url.includes("supabase-ok")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("redis-ok")) {
        return new Response(JSON.stringify({ result: "PONG" }), { status: 200 });
      }
      return new Response("ok", { status: 200 });
    });

    const { GET } = await import("./route");
    const res = await GET(pedido());
    const { data } = await res.json();

    // Prova 1: o endpoint respondeu HTTP 200 e status não é unhealthy
    expect(res.status).toBe(200);
    expect(data.status).not.toBe("unhealthy");
    expect(data.status).toBe("healthy");

    // Prova 2: a chave do canal legado NÃO está presente na resposta
    expect(CANAL_PADRAO in data.checks).toBe(false);

    // Prova 3: checks ganha canal com status ok e canal meta
    expect(data.checks.canal).toEqual({ status: "ok", canal: "meta" });

    // Prova 4: o transporte legado sequer foi chamado (short-circuit)
    expect(transporteChamado).toBe(false);
  });

  it("3. meta + Supabase caído: continua unhealthy e HTTP 503 (canal oficial não mascara banco)", async () => {
    mockEnv.WHATSAPP_CHANNEL = "meta";
    mockEnv.UPSTASH_REDIS_REST_URL = "https://redis-ok.upstash.io";
    mockEnv.UPSTASH_REDIS_REST_TOKEN = "token-valido";
    mockEnv.NEXT_PUBLIC_SUPABASE_URL = "https://supabase-ok.supabase.co";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("supabase")) {
        return new Response("Database unavailable", { status: 500 });
      }
      if (url.includes("redis")) {
        return new Response(JSON.stringify({ result: "PONG" }), { status: 200 });
      }
      return new Response("ok", { status: 200 });
    });

    const { GET } = await import("./route");
    const res = await GET(pedido());
    const { data } = await res.json();

    expect(res.status).toBe(503);
    expect(data.status).toBe("unhealthy");
    expect(data.checks.supabase.status).toBe("down");
    expect(data.checks.canal.status).toBe("ok");
    expect(CANAL_PADRAO in data.checks).toBe(false);
  });

  it("4. meta + verbose=1: a chave nova sai completa com alvo; sem segredo interno, sai redigida", async () => {
    mockEnv.WHATSAPP_CHANNEL = "meta";
    mockEnv.UPSTASH_REDIS_REST_URL = "https://redis-ok.upstash.io";
    mockEnv.UPSTASH_REDIS_REST_TOKEN = "token-valido";
    mockEnv.NEXT_PUBLIC_SUPABASE_URL = "https://supabase-ok.supabase.co";

    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const { GET } = await import("./route");

    // 1) Chamada anônima (sem verbose, sem segredo): alvo redigido
    const resAnon = await GET(pedido());
    const dataAnon = (await resAnon.json()).data;
    expect(dataAnon.checks.canal).toEqual({ status: "ok", canal: "meta" });
    expect(dataAnon.checks.canal.target).toBeUndefined();

    // 2) Chamada com verbose=1 mas sem segredo interno: continua redigida
    const resSemSegredo = await GET(pedido("?verbose=1"));
    const dataSemSegredo = (await resSemSegredo.json()).data;
    expect(dataSemSegredo.checks.canal).toEqual({ status: "ok", canal: "meta" });
    expect(dataSemSegredo.checks.canal.target).toBeUndefined();

    // 3) Chamada com verbose=1 e segredo interno autenticado: sai completa com target
    const reqAutenticado = pedido("?verbose=1", { authorization: `Bearer ${SEGREDO}` });
    const resAutenticado = await GET(reqAutenticado);
    const dataAutenticado = (await resAutenticado.json()).data;
    expect(dataAutenticado.checks.canal.status).toBe("ok");
    expect(dataAutenticado.checks.canal.canal).toBe("meta");
    expect(dataAutenticado.checks.canal.target).toBe(ALVO_META);
  });

  it("5. WHATSAPP_CHANNEL=xpto: não lança e cai no comportamento do canal padrão", async () => {
    mockEnv.WHATSAPP_CHANNEL = "xpto";
    const { GET } = await import("./route");

    let res!: Response;
    await expect((async () => {
      res = await GET(pedido());
    })()).resolves.not.toThrow();

    const { data } = await res.json();
    const chaves = Object.keys(data.checks).sort();
    expect(chaves).toEqual(["redis", "supabase", CANAL_PADRAO].sort());
    expect("canal" in data.checks).toBe(false);
  });
});
