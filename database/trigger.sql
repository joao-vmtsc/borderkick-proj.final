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
END
