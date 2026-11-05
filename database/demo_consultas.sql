-- ===== BorderKick: roteiro de consultas para a apresentacao (MySQL Workbench) =====
-- Rode uma por vez: selecione o trecho e aperte Ctrl+Enter.
USE borderkick;

-- 1) Estrutura: 20 tabelas
SHOW TABLES;

-- 2) Torcedores cadastrados e status do Visto Americano (mostra a conta criada ao vivo)
SELECT u.id, CONCAT(u.nome,' ',u.sobrenome) AS torcedor, u.email, p.nome AS pais_origem, sv.nome AS visto_eua, u.criado_em
FROM usuarios u
JOIN torcedores t   ON t.usuario_id = u.id
JOIN paises p       ON p.id = t.pais_origem_id
JOIN vistos v       ON v.torcedor_id = t.usuario_id
JOIN status_visto sv ON sv.id = v.status_visto_id
ORDER BY u.id DESC;

-- 3) Dados atomicos: telefone em DDD + numero e documentos enviados por tipo
SELECT u.nome, tel.ddd, tel.numero, td.nome AS tipo_documento, d.nome_original
FROM usuarios u
JOIN telefones tel ON tel.torcedor_id = u.id
LEFT JOIN documentos d ON d.torcedor_id = u.id
LEFT JOIN tipos_documento td ON td.id = d.tipo_documento_id
ORDER BY u.id DESC;

-- 4) Pacotes e seus jogos (relacao N:N) ate o pais
SELECT p.nome AS pacote, j.data_jogo, e.nome AS estadio, c.nome AS cidade, pa.nome AS pais
FROM pacotes p
JOIN pacote_jogos pj ON pj.pacote_id = p.id
JOIN jogos j   ON j.id = pj.jogo_id
JOIN estadios e ON e.id = j.estadio_id
JOIN cidades c ON c.id = e.cidade_id
JOIN paises pa ON pa.id = c.pais_id
ORDER BY p.id, j.data_jogo;

-- 5) Vouchers emitidos (total calculado, nao armazenado: 3FN)
SELECT r.codigo, CONCAT(u.nome,' ',u.sobrenome) AS torcedor, p.nome AS pacote,
       r.preco_pacote + COALESCE(SUM(re.preco_unitario),0) AS total
FROM reservas r
JOIN usuarios u ON u.id = r.torcedor_id
JOIN pacotes p  ON p.id = r.pacote_id
LEFT JOIN reserva_extras re ON re.reserva_id = r.id
GROUP BY r.id, r.codigo, u.nome, u.sobrenome, p.nome, r.preco_pacote;

-- 6) Auditoria: quem fez o que (inclui vendas bloqueadas)
SELECT a.criado_em, ac.nome AS acao, CONCAT(u.nome,' ',u.sobrenome) AS quem,
       CONCAT_WS(' · ', CONCAT(al.nome,' ',al.sobrenome), p.nome, r.codigo, sv.nome, td.nome) AS detalhe
FROM auditoria a
JOIN acoes_auditoria ac ON ac.id = a.acao_id
LEFT JOIN usuarios u  ON u.id  = a.usuario_id
LEFT JOIN usuarios al ON al.id = a.alvo_usuario_id
LEFT JOIN pacotes p   ON p.id  = a.pacote_id
LEFT JOIN reservas r  ON r.id  = a.reserva_id
LEFT JOIN status_visto sv ON sv.id = a.status_visto_id
LEFT JOIN tipos_documento td ON td.id = a.tipo_documento_id
ORDER BY a.id DESC LIMIT 20;

-- 7) REGRA DE NEGOCIO NO PROPRIO BANCO: tenta vender o pacote 4 (Nova York, EUA)
--    a um torcedor SEM visto "Aprovado e Validado". Deve falhar com VISTO_NAO_VALIDADO.
--    (Se nao houver nenhum torcedor sem visto aprovado, nada e inserido.)
INSERT INTO reservas (torcedor_id, pacote_id, codigo, preco_pacote)
SELECT v.torcedor_id, 4, 'BK-TESTE001', 12990.00
FROM vistos v WHERE v.status_visto_id <> 3 LIMIT 1;

-- 8) Prova da estrutura: chaves estrangeiras e restricoes
SHOW CREATE TABLE reservas;

-- (Opcional) Recomecar do zero: apaga o banco; ao reiniciar o servidor (npm start) ele e recriado.
-- DROP DATABASE borderkick;
