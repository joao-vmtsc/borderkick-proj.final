-- BorderKick: banco completo (MySQL 8 / MariaDB 10.4+). Importe no Workbench ou phpMyAdmin.
-- Opcional: o servidor Node ja cria tudo isso sozinho ao iniciar.
CREATE DATABASE IF NOT EXISTS borderkick CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE borderkick;
-- BorderKick - esquema MySQL em 3a Forma Normal (InnoDB, utf8mb4)
-- 1FN: todos os campos atomicos (nome/sobrenome, DDD/numero, CPF so digitos, sem listas).
-- 2FN/3FN: cada atributo depende so da chave da sua tabela; dominios (papel, pais, status...) em tabelas proprias.

CREATE TABLE IF NOT EXISTS papeis (
  id   TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  nome VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS paises (
  id        TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  nome      VARCHAR(40) NOT NULL UNIQUE,
  sigla     CHAR(3) NOT NULL UNIQUE,
  sede_copa BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cidades (
  id      SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome    VARCHAR(60) NOT NULL,
  pais_id TINYINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_cidade_pais (nome, pais_id),
  CONSTRAINT fk_cidades_pais FOREIGN KEY (pais_id) REFERENCES paises(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estadios (
  id        SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome      VARCHAR(80) NOT NULL UNIQUE,
  cidade_id SMALLINT UNSIGNED NOT NULL,
  CONSTRAINT fk_estadios_cidade FOREIGN KEY (cidade_id) REFERENCES cidades(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(60)  NOT NULL,
  sobrenome  VARCHAR(100) NOT NULL,
  email      VARCHAR(120) NOT NULL UNIQUE,
  senha_hash CHAR(60) NOT NULL,
  papel_id   TINYINT UNSIGNED NOT NULL,
  criado_em  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_papel FOREIGN KEY (papel_id) REFERENCES papeis(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS torcedores (
  usuario_id      INT UNSIGNED NOT NULL PRIMARY KEY,
  cpf             CHAR(11) NOT NULL UNIQUE,
  data_nascimento DATE NOT NULL,
  pais_origem_id  TINYINT UNSIGNED NOT NULL,
  CONSTRAINT ck_torcedores_cpf CHECK (cpf REGEXP '^[0-9]{11}$'),
  CONSTRAINT fk_torcedores_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_torcedores_pais FOREIGN KEY (pais_origem_id) REFERENCES paises(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS telefones (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  torcedor_id INT UNSIGNED NOT NULL,
  ddd         CHAR(2) NOT NULL,
  numero      VARCHAR(9) NOT NULL,
  UNIQUE KEY uq_telefone (torcedor_id, ddd, numero),
  CONSTRAINT ck_telefones CHECK (ddd REGEXP '^[0-9]{2}$' AND numero REGEXP '^[0-9]{8,9}$'),
  CONSTRAINT fk_telefones_torcedor FOREIGN KEY (torcedor_id) REFERENCES torcedores(usuario_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tipos_documento (
  id   TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  nome VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documentos (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  torcedor_id       INT UNSIGNED NOT NULL,
  tipo_documento_id TINYINT UNSIGNED NOT NULL,
  arquivo           VARCHAR(80) NOT NULL UNIQUE,
  nome_original     VARCHAR(255) NOT NULL,
  criado_em         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_documentos_torcedor FOREIGN KEY (torcedor_id) REFERENCES torcedores(usuario_id) ON DELETE CASCADE,
  CONSTRAINT fk_documentos_tipo FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS status_visto (
  id   TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  nome VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vistos (
  torcedor_id     INT UNSIGNED NOT NULL PRIMARY KEY,
  status_visto_id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  observacao      VARCHAR(500) NULL,
  validado_por    INT UNSIGNED NULL,
  atualizado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vistos_torcedor FOREIGN KEY (torcedor_id) REFERENCES torcedores(usuario_id) ON DELETE CASCADE,
  CONSTRAINT fk_vistos_status FOREIGN KEY (status_visto_id) REFERENCES status_visto(id),
  CONSTRAINT fk_vistos_atendente FOREIGN KEY (validado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pacotes (
  id         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(80) NOT NULL UNIQUE,
  descricao  VARCHAR(255) NOT NULL,
  preco_base DECIMAL(10,2) NOT NULL,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT ck_pacotes_preco CHECK (preco_base >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS jogos (
  id         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  estadio_id SMALLINT UNSIGNED NOT NULL,
  data_jogo  DATE NOT NULL,
  descricao  VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_jogo (estadio_id, data_jogo),
  CONSTRAINT fk_jogos_estadio FOREIGN KEY (estadio_id) REFERENCES estadios(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pacote_jogos (
  pacote_id SMALLINT UNSIGNED NOT NULL,
  jogo_id   SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (pacote_id, jogo_id),
  CONSTRAINT fk_pj_pacote FOREIGN KEY (pacote_id) REFERENCES pacotes(id) ON DELETE CASCADE,
  CONSTRAINT fk_pj_jogo FOREIGN KEY (jogo_id) REFERENCES jogos(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS extras (
  id    TINYINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome  VARCHAR(60) NOT NULL UNIQUE,
  preco DECIMAL(10,2) NOT NULL,
  CONSTRAINT ck_extras_preco CHECK (preco >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS status_reserva (
  id   TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  nome VARCHAR(20) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservas (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  torcedor_id       INT UNSIGNED NOT NULL,
  pacote_id         SMALLINT UNSIGNED NOT NULL,
  status_reserva_id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  codigo            CHAR(11) NOT NULL UNIQUE,
  preco_pacote      DECIMAL(10,2) NOT NULL,
  criado_em         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservas_torcedor FOREIGN KEY (torcedor_id) REFERENCES torcedores(usuario_id),
  CONSTRAINT fk_reservas_pacote FOREIGN KEY (pacote_id) REFERENCES pacotes(id),
  CONSTRAINT fk_reservas_status FOREIGN KEY (status_reserva_id) REFERENCES status_reserva(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reserva_extras (
  reserva_id     INT UNSIGNED NOT NULL,
  extra_id       TINYINT UNSIGNED NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (reserva_id, extra_id),
  CONSTRAINT fk_re_reserva FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE CASCADE,
  CONSTRAINT fk_re_extra FOREIGN KEY (extra_id) REFERENCES extras(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS acoes_auditoria (
  id   TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  nome VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auditoria (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id        INT UNSIGNED NULL,          -- quem executou a acao
  acao_id           TINYINT UNSIGNED NOT NULL,
  alvo_usuario_id   INT UNSIGNED NULL,          -- torcedor afetado (ex.: validacao de visto)
  pacote_id         SMALLINT UNSIGNED NULL,
  reserva_id        INT UNSIGNED NULL,
  status_visto_id   TINYINT UNSIGNED NULL,
  tipo_documento_id TINYINT UNSIGNED NULL,
  criado_em         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_auditoria_data (criado_em),
  CONSTRAINT fk_aud_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_aud_acao FOREIGN KEY (acao_id) REFERENCES acoes_auditoria(id),
  CONSTRAINT fk_aud_alvo FOREIGN KEY (alvo_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_aud_pacote FOREIGN KEY (pacote_id) REFERENCES pacotes(id) ON DELETE SET NULL,
  CONSTRAINT fk_aud_reserva FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE SET NULL,
  CONSTRAINT fk_aud_status FOREIGN KEY (status_visto_id) REFERENCES status_visto(id),
  CONSTRAINT fk_aud_tipodoc FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento(id)
) ENGINE=InnoDB;

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

DROP TRIGGER IF EXISTS trg_reservas_exige_visto;
DELIMITER $$
CREATE TRIGGER trg_reservas_exige_visto BEFORE INSERT ON reservas FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM pacote_jogos pj
               JOIN jogos j ON j.id = pj.jogo_id
               JOIN estadios e ON e.id = j.estadio_id
               JOIN cidades c ON c.id = e.cidade_id
               JOIN paises p ON p.id = c.pais_id
              WHERE pj.pacote_id = NEW.pacote_id AND p.sigla = 'USA')
     AND NOT EXISTS (SELECT 1 FROM vistos v
                      WHERE v.torcedor_id = NEW.torcedor_id AND v.status_visto_id = 3)
  THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'VISTO_NAO_VALIDADO';
  END IF;
END$$
DELIMITER ;
-- Atendente: crie pelo servidor Node (a senha precisa de hash bcrypt).
