-- Pacotes e jogos ficticios (executado so quando a tabela pacotes esta vazia)
INSERT INTO jogos (id,estadio_id,data_jogo,descricao) VALUES
 (1,3,'2026-06-16','Fase de grupos (ilustrativo)'),
 (2,1,'2026-06-18','Fase de grupos (ilustrativo)'),
 (3,2,'2026-06-17','Fase de grupos (ilustrativo)');
INSERT INTO pacotes (id,nome,descricao,preco_base) VALUES
 (1,'Fronteira Dupla: México + Nova York','Terça no México, quinta nos EUA. Voos, hotéis e os dois ingressos.',18990.00),
 (2,'Cidade do México + jogo','Futebol e cultura em uma viagem vibrante.',14990.00),
 (3,'Toronto + jogo','Conheça a cidade e curta o clima do torneio.',10990.00),
 (4,'Nova York + jogo','Hospedagem, transporte e experiência de jogo.',12990.00);
INSERT INTO pacote_jogos (pacote_id,jogo_id) VALUES (1,1),(1,2),(2,1),(3,3),(4,2);
