-- Vagas de uma escola numa fila (Tech Spec, seção 5, "Vaga").
--
-- KEYS[1]: vaga:{fila}:{escola}, um ZSET com membro = jobId e score = vencimento da vaga em ms.
-- ARGV[1]: a operação.
--   tomar   validadeMs limite jobId...  devolve os jobIds que ficaram com vaga
--   renovar validadeMs jobId...         devolve 0 (job em execução: conta mesmo sem a vaga antiga)
--   manter  validadeMs jobId...         devolve 0 (só renova quem ainda tem vaga; a vencida não volta)
--   liberar jobId...                    devolve 0
--   livres  limite                      devolve limite menos as vagas em uso (pode ser negativo)
--
-- Tudo acontece dentro do script: a contagem e a gravação são atômicas, e dois despachantes
-- tomando vaga da mesma escola ao mesmo tempo nunca passam do limite. O relógio é o do Redis, o
-- mesmo para despachante e worker em qualquer máquina.

local chave = KEYS[1]
local operacao = ARGV[1]

if operacao == 'liberar' then
  for indice = 2, #ARGV do
    redis.call('ZREM', chave, ARGV[indice])
  end
  return 0
end

local tempo = redis.call('TIME')
local agora = tonumber(tempo[1]) * 1000 + math.floor(tonumber(tempo[2]) / 1000)

-- Vaga vencida (worker morto, publicação que nunca chegou) sai antes de qualquer contagem.
redis.call('ZREMRANGEBYSCORE', chave, '-inf', agora)

if operacao == 'livres' then
  return tonumber(ARGV[2]) - redis.call('ZCARD', chave)
end

local validade = tonumber(ARGV[2])
local vencimento = agora + validade

if operacao == 'renovar' then
  -- O job está executando: ele conta, com ou sem a vaga antiga. Sem isto, a vaga que venceu
  -- durante um stalled deixaria a escola admitir um job a mais enquanto este ainda roda.
  for indice = 3, #ARGV do
    redis.call('ZADD', chave, vencimento, ARGV[indice])
  end
  redis.call('PEXPIRE', chave, validade)
  return 0
end

if operacao == 'manter' then
  -- Job publicado e ainda não iniciado: segura a vaga que tem, sem readmitir a que já venceu.
  local renovados = 0
  for indice = 3, #ARGV do
    renovados = renovados + redis.call('ZADD', chave, 'XX', 'CH', vencimento, ARGV[indice])
  end
  -- A chave vive o mesmo que a vaga mais nova: sem isto, ela expiraria inteira com as renovadas dentro.
  if renovados > 0 then
    redis.call('PEXPIRE', chave, validade)
  end
  return 0
end

if operacao == 'tomar' then
  local limite = tonumber(ARGV[3])
  local emUso = redis.call('ZCARD', chave)
  local concedidos = {}
  for indice = 4, #ARGV do
    local jobId = ARGV[indice]
    if redis.call('ZSCORE', chave, jobId) then
      -- O job já tem a vaga (despachante que caiu depois de tomar, republicação): renova, sem contar de novo.
      redis.call('ZADD', chave, vencimento, jobId)
      table.insert(concedidos, jobId)
    elseif emUso < limite then
      redis.call('ZADD', chave, vencimento, jobId)
      emUso = emUso + 1
      table.insert(concedidos, jobId)
    end
  end
  if #concedidos > 0 then
    redis.call('PEXPIRE', chave, validade)
  end
  return concedidos
end

return redis.error_reply('operacao de vaga desconhecida')
