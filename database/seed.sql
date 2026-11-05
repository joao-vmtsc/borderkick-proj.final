-- Dados de dominio (idempotente)
INSERT IGNORE INTO papeis (id,nome) VALUES (1,'torcedor'),(2,'atendente');
INSERT IGNORE INTO paises (id,nome,sigla,sede_copa) VALUES
 (1,'Brasil','BRA',FALSE),(2,'Argentina','ARG',FALSE),(3,'Outro','OUT',FALSE),
 (4,'EUA','USA',TRUE),(5,'Canadá','CAN',TRUE),(6,'México','MEX',TRUE);
INSERT IGNORE INTO cidades (id,nome,pais_id) VALUES (1,'Nova York',4),(2,'Toronto',5),(3,'Cidade do México',6);
INSERT IGNORE INTO estadios (id,nome,cidade_id) VALUES (1,'MetLife Stadium',1),(2,'BMO Field',2),(3,'Estadio Azteca',3);
INSERT IGNORE INTO tipos_documento (id,nome) VALUES (1,'identidade'),(2,'passaporte'),(3,'visto_eua');
INSERT IGNORE INTO status_visto (id,nome) VALUES (1,'Pendente'),(2,'Em análise'),(3,'Aprovado e Validado'),(4,'Rejeitado');
INSERT IGNORE INTO status_reserva (id,nome) VALUES (1,'Emitido'),(2,'Cancelado');
INSERT IGNORE INTO acoes_auditoria (id,nome) VALUES
 (1,'CADASTRO'),(2,'LOGIN'),(3,'UPLOAD_DOCUMENTO'),(4,'VENDA_BLOQUEADA'),(5,'VOUCHER_EMITIDO'),(6,'VISTO_ATUALIZADO');
INSERT IGNORE INTO extras (id,nome,preco) VALUES (1,'Seguro viagem',390.00),(2,'Traslado aeroporto–hotel',290.00);
