require('./env');
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const { iniciar, q, um, tx } = require('./db');

const app = express();
const PROD = process.env.NODE_ENV === 'production';
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const APROVADO = 3; // status_visto.id = 'Aprovado e Validado'
const TIPO_DOC = { identidade: 1, passaporte: 2, visto_eua: 3 };
const MSG_VISTO = 'Venda bloqueada: este pacote inclui jogo nos EUA e o seu Visto Americano ainda não está "Aprovado e Validado" por um atendente.';

app.set('trust proxy', 1);
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' }); next(); });
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const a = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const erro = (res, s, m, extra) => res.status(s).json({ erro: m, ...extra });
const audit = (uid, acao, d = {}) => q(
  'INSERT INTO auditoria(usuario_id,acao_id,alvo_usuario_id,pacote_id,reserva_id,status_visto_id,tipo_documento_id) SELECT ?,id,?,?,?,?,? FROM acoes_auditoria WHERE nome=?',
  [uid || null, d.alvo || null, d.pacote || null, d.reserva || null, d.visto || null, d.tipo || null, acao]);
const limpar = (files) => Object.values(files || {}).flat().forEach((f) => fs.unlink(f.path, () => {}));
const mascaraCpf = (c) => (c ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : '');

function cpfValido(c) {
  c = String(c || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[t])) return false;
  }
  return true;
}

const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (req, f, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(f.originalname).toLowerCase()) }),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: (req, f, cb) => {
    const ok = /\.(pdf|jpe?g|png)$/i.test(f.originalname) && /^(application\/pdf|image\/(jpeg|png))$/.test(f.mimetype);
    cb(ok ? null : new Error('Envie apenas arquivos PDF, JPG ou PNG.'), ok);
  },
});

// ---------- autenticação ----------
const emitirSessao = (res, id) => res.cookie('bk', jwt.sign({ id }, SECRET, { expiresIn: '8h' }), { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 8 * 3600e3 });

const auth = a(async (req, res, next) => {
  let id;
  try { id = jwt.verify(req.cookies.bk, SECRET).id; } catch { return erro(res, 401, 'Faça login para continuar.'); }
  const u = await um("SELECT u.id, CONCAT(u.nome,' ',u.sobrenome) nome, u.email, p.nome papel FROM usuarios u JOIN papeis p ON p.id=u.papel_id WHERE u.id=?", [id]);
  if (!u) return erro(res, 401, 'Faça login para continuar.');
  req.user = u; next();
});
const staff = (req, res, next) => (req.user.papel === 'atendente' ? next() : erro(res, 403, 'Acesso restrito a atendentes.'));

const tentativas = new Map();
function limiteLogin(req, res, next) {
  const agora = Date.now(), t = (tentativas.get(req.ip) || []).filter((x) => agora - x < 15 * 60e3);
  if (t.length >= 10) return erro(res, 429, 'Muitas tentativas. Aguarde 15 minutos.');
  t.push(agora); tentativas.set(req.ip, t); next();
}

app.get('/health', a(async (req, res) => { await q('SELECT 1'); res.json({ ok: true }); }));

app.post('/api/auth/register', upload.fields([{ name: 'documento', maxCount: 1 }, { name: 'visto', maxCount: 1 }]), a(async (req, res) => {
  const b = req.body, f = req.files || {};
  const falha = (m, s = 400) => { limpar(f); return erro(res, s, m); };
  const partes = String(b.nome || '').trim().split(/\s+/);
  const email = String(b.email || '').trim().toLowerCase(), cpf = String(b.cpf || '').replace(/\D/g, ''), tel = String(b.telefone || '').replace(/\D/g, '');
  if (partes.length < 2 || partes[0].length > 60) return falha('Informe nome e sobrenome.');
  const nome = partes[0], sobrenome = partes.slice(1).join(' ').slice(0, 100);
  if (email.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return falha('E-mail inválido.');
  if (!cpfValido(cpf)) return falha('CPF inválido.');
  if (tel.length < 10 || tel.length > 11) return falha('Telefone inválido (inclua o DDD).');
  if (!b.nascimento || isNaN(Date.parse(b.nascimento)) || new Date(b.nascimento) > new Date()) return falha('Data de nascimento inválida.');
  if (String(b.senha || '').length < 8) return falha('A senha deve ter ao menos 8 caracteres.');
  if (b.termos !== 'true' && b.termos !== 'on') return falha('É preciso aceitar os termos de uso.');
  if (!f.documento) return falha('Envie o documento de identificação.');
  const pais = await um('SELECT id FROM paises WHERE nome=? AND sede_copa=0', [b.pais]);
  if (!pais) return falha('Selecione o país de origem.');
  if (await um('SELECT 1 x FROM usuarios WHERE email=? UNION SELECT 1 FROM torcedores WHERE cpf=?', [email, cpf])) return falha('Já existe cadastro com este e-mail ou CPF.', 409);

  let id;
  try {
    id = await tx(async (c) => {
      const [u] = await c.query('INSERT INTO usuarios(nome,sobrenome,email,senha_hash,papel_id) VALUES(?,?,?,?,1)', [nome, sobrenome, email, bcrypt.hashSync(b.senha, 10)]);
      const uid = u.insertId;
      await c.query('INSERT INTO torcedores(usuario_id,cpf,data_nascimento,pais_origem_id) VALUES(?,?,?,?)', [uid, cpf, b.nascimento, pais.id]);
      await c.query('INSERT INTO telefones(torcedor_id,ddd,numero) VALUES(?,?,?)', [uid, tel.slice(0, 2), tel.slice(2)]);
      const doc = (tipo, file) => file && c.query('INSERT INTO documentos(torcedor_id,tipo_documento_id,arquivo,nome_original) VALUES(?,?,?,?)', [uid, tipo, file.filename, file.originalname]);
      await doc(b.tipo_documento === 'passaporte' ? TIPO_DOC.passaporte : TIPO_DOC.identidade, f.documento[0]);
      await doc(TIPO_DOC.visto_eua, f.visto?.[0]);
      await c.query('INSERT INTO vistos(torcedor_id,status_visto_id) VALUES(?,?)', [uid, f.visto ? 2 : 1]);
      return uid;
    });
  } catch (e) { limpar(f); throw e; }
  await audit(id, 'CADASTRO');
  emitirSessao(res, id);
  res.status(201).json({ ok: true });
}));

app.post('/api/auth/login', limiteLogin, a(async (req, res) => {
  const u = await um("SELECT u.id, CONCAT(u.nome,' ',u.sobrenome) nome, u.senha_hash, p.nome papel FROM usuarios u JOIN papeis p ON p.id=u.papel_id WHERE u.email=?", [String(req.body.email || '').trim().toLowerCase()]);
  if (!u || !bcrypt.compareSync(String(req.body.senha || ''), u.senha_hash)) return erro(res, 401, 'E-mail ou senha incorretos.');
  emitirSessao(res, u.id);
  await audit(u.id, 'LOGIN');
  res.json({ usuario: { id: u.id, nome: u.nome, papel: u.papel } });
}));
app.post('/api/auth/logout', (req, res) => { res.clearCookie('bk'); res.json({ ok: true }); });

app.get('/api/me', auth, a(async (req, res) => {
  const visto = await um('SELECT s.nome status, v.observacao, v.atualizado_em FROM vistos v JOIN status_visto s ON s.id=v.status_visto_id WHERE v.torcedor_id=?', [req.user.id]) || null;
  const documentos = await q('SELECT d.id, t.nome tipo, d.nome_original FROM documentos d JOIN tipos_documento t ON t.id=d.tipo_documento_id WHERE d.torcedor_id=?', [req.user.id]);
  res.json({ usuario: req.user, visto, documentos });
}));

app.post('/api/documentos', auth, upload.single('arquivo'), a(async (req, res) => {
  const tipo = TIPO_DOC[req.body.tipo];
  if (!req.file || !tipo || req.user.papel !== 'torcedor') { if (req.file) fs.unlink(req.file.path, () => {}); return erro(res, 400, 'Envie o arquivo e o tipo do documento.'); }
  await q('INSERT INTO documentos(torcedor_id,tipo_documento_id,arquivo,nome_original) VALUES(?,?,?,?)', [req.user.id, tipo, req.file.filename, req.file.originalname]);
  if (tipo === TIPO_DOC.visto_eua) await q('UPDATE vistos SET status_visto_id=2, observacao=NULL, validado_por=NULL WHERE torcedor_id=?', [req.user.id]);
  await audit(req.user.id, 'UPLOAD_DOCUMENTO', { tipo });
  res.status(201).json({ ok: true });
}));

app.get('/api/arquivos/:id', auth, a(async (req, res) => {
  const d = await um('SELECT arquivo, torcedor_id FROM documentos WHERE id=?', [req.params.id]);
  if (!d || (d.torcedor_id !== req.user.id && req.user.papel !== 'atendente')) return erro(res, 404, 'Arquivo não encontrado.');
  const f = path.join(UPLOAD_DIR, d.arquivo);
  if (!fs.existsSync(f)) return erro(res, 404, 'O arquivo não está mais disponível no servidor. Peça ao torcedor para reenviar.');
  res.sendFile(f);
}));

// ---------- pacotes ----------
async function listarPacotes(id) {
  const ps = await q(`SELECT id, nome, descricao, preco_base preco FROM pacotes WHERE ativo=1 ${id ? 'AND id=?' : ''} ORDER BY id`, id ? [id] : []);
  if (!ps.length) return [];
  const js = await q(`SELECT pj.pacote_id, j.id, j.data_jogo data, j.descricao partida, e.nome estadio, c.nome cidade, pa.nome pais, pa.sigla
    FROM pacote_jogos pj JOIN jogos j ON j.id=pj.jogo_id JOIN estadios e ON e.id=j.estadio_id JOIN cidades c ON c.id=e.cidade_id JOIN paises pa ON pa.id=c.pais_id
    WHERE pj.pacote_id IN (?) ORDER BY j.data_jogo`, [ps.map((p) => p.id)]);
  return ps.map((p) => { const jogos = js.filter((j) => j.pacote_id === p.id); return { ...p, preco: Number(p.preco), jogos, exige_visto_eua: jogos.some((j) => j.sigla === 'USA') }; });
}
app.get('/api/pacotes', a(async (req, res) => {
  const extras = (await q('SELECT id, nome, preco FROM extras ORDER BY id')).map((e) => ({ ...e, preco: Number(e.preco) }));
  res.json({ pacotes: await listarPacotes(), extras });
}));

// ---------- reservas / vouchers (REGRA DE NEGÓCIO) ----------
const vistoAprovado = async (uid) => !!(await um('SELECT 1 x FROM vistos WHERE torcedor_id=? AND status_visto_id=?', [uid, APROVADO]));

app.post('/api/reservas', auth, a(async (req, res) => {
  if (req.user.papel !== 'torcedor') return erro(res, 403, 'Apenas torcedores podem emitir pacotes.');
  const [p] = await listarPacotes(Number(req.body.pacote_id));
  if (!p) return erro(res, 404, 'Pacote não encontrado.');
  if (p.exige_visto_eua && !(await vistoAprovado(req.user.id))) {
    const st = await um('SELECT s.id, s.nome FROM vistos v JOIN status_visto s ON s.id=v.status_visto_id WHERE v.torcedor_id=?', [req.user.id]);
    await audit(req.user.id, 'VENDA_BLOQUEADA', { pacote: p.id, visto: st?.id });
    return erro(res, 403, MSG_VISTO, { codigo: 'VISTO_NAO_VALIDADO', visto: st?.nome || 'Inexistente' });
  }
  const dup = await um('SELECT id FROM reservas WHERE torcedor_id=? AND pacote_id=? AND status_reserva_id=1', [req.user.id, p.id]);
  if (dup) return erro(res, 409, 'Você já possui voucher emitido para este pacote.', { id: dup.id });

  const ids = [...new Set((Array.isArray(req.body.extras) ? req.body.extras : []).map(Number))].filter(Number.isInteger);
  const extras = ids.length ? await q('SELECT id, preco FROM extras WHERE id IN (?)', [ids]) : [];
  const codigo = 'BK-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const id = await tx(async (c) => {
    const [r] = await c.query('INSERT INTO reservas(torcedor_id,pacote_id,codigo,preco_pacote) VALUES(?,?,?,?)', [req.user.id, p.id, codigo, p.preco]);
    for (const e of extras) await c.query('INSERT INTO reserva_extras(reserva_id,extra_id,preco_unitario) VALUES(?,?,?)', [r.insertId, e.id, e.preco]);
    return r.insertId;
  });
  await audit(req.user.id, 'VOUCHER_EMITIDO', { reserva: id, pacote: p.id });
  res.status(201).json({ reserva: { id, codigo } });
}));

app.get('/api/reservas', auth, a(async (req, res) => {
  const rs = await q(`SELECT r.id, r.codigo, s.nome status, p.nome pacote, r.criado_em,
      r.preco_pacote + COALESCE((SELECT SUM(re.preco_unitario) FROM reserva_extras re WHERE re.reserva_id=r.id),0) total
    FROM reservas r JOIN pacotes p ON p.id=r.pacote_id JOIN status_reserva s ON s.id=r.status_reserva_id WHERE r.torcedor_id=? ORDER BY r.id DESC`, [req.user.id]);
  res.json({ reservas: rs.map((r) => ({ ...r, total: Number(r.total) })) });
}));

app.get('/api/reservas/:id', auth, a(async (req, res) => {
  const r = await um(`SELECT r.id, r.codigo, r.torcedor_id, r.pacote_id, r.preco_pacote, r.criado_em, s.nome status, u.nome, u.sobrenome, t.cpf
    FROM reservas r JOIN status_reserva s ON s.id=r.status_reserva_id JOIN torcedores t ON t.usuario_id=r.torcedor_id JOIN usuarios u ON u.id=t.usuario_id WHERE r.id=?`, [req.params.id]);
  if (!r || (r.torcedor_id !== req.user.id && req.user.papel !== 'atendente')) return erro(res, 404, 'Voucher não encontrado.');
  const [p] = await listarPacotes(r.pacote_id);
  const ex = await q('SELECT e.nome, re.preco_unitario preco FROM reserva_extras re JOIN extras e ON e.id=re.extra_id WHERE re.reserva_id=?', [r.id]);
  const valido = r.status === 'Emitido' && (!p.exige_visto_eua || (await vistoAprovado(r.torcedor_id)));
  res.json({
    reserva: { id: r.id, codigo: valido ? r.codigo : null, status: valido ? r.status : 'Suspenso', criado_em: r.criado_em, extras: ex.map((e) => e.nome),
      total: Number(r.preco_pacote) + ex.reduce((s, e) => s + Number(e.preco), 0) },
    torcedor: { nome: `${r.nome} ${r.sobrenome}`, cpf: mascaraCpf(r.cpf) }, pacote: p, valido,
    motivo: valido ? null : 'Voucher suspenso: o Visto Americano deixou de estar "Aprovado e Validado". Procure um atendente.',
  });
}));

// ---------- painel interno ----------
app.get('/api/admin/torcedores', auth, staff, a(async (req, res) => {
  res.json({ torcedores: await q(`SELECT u.id, CONCAT(u.nome,' ',u.sobrenome) nome, u.email, po.nome pais, sv.nome visto_status,
      (SELECT COUNT(*) FROM documentos d WHERE d.torcedor_id=u.id) docs
    FROM usuarios u JOIN torcedores t ON t.usuario_id=u.id JOIN paises po ON po.id=t.pais_origem_id
    JOIN vistos v ON v.torcedor_id=u.id JOIN status_visto sv ON sv.id=v.status_visto_id ORDER BY FIELD(sv.id,2,1,4,3), u.nome`) });
}));

app.get('/api/admin/torcedores/:id', auth, staff, a(async (req, res) => {
  const t = await um(`SELECT u.id, CONCAT(u.nome,' ',u.sobrenome) nome, u.email, t.cpf, t.data_nascimento nascimento, po.nome pais,
      (SELECT CONCAT('(',ddd,') ',numero) FROM telefones WHERE torcedor_id=u.id ORDER BY id LIMIT 1) telefone
    FROM usuarios u JOIN torcedores t ON t.usuario_id=u.id JOIN paises po ON po.id=t.pais_origem_id WHERE u.id=?`, [req.params.id]);
  if (!t) return erro(res, 404, 'Torcedor não encontrado.');
  res.json({
    torcedor: { ...t, cpf: mascaraCpf(t.cpf) },
    visto: await um('SELECT s.nome status, v.observacao FROM vistos v JOIN status_visto s ON s.id=v.status_visto_id WHERE v.torcedor_id=?', [t.id]),
    documentos: await q('SELECT d.id, td.nome tipo, d.nome_original FROM documentos d JOIN tipos_documento td ON td.id=d.tipo_documento_id WHERE d.torcedor_id=?', [t.id]),
    reservas: await q('SELECT r.codigo, s.nome status, p.nome pacote FROM reservas r JOIN pacotes p ON p.id=r.pacote_id JOIN status_reserva s ON s.id=r.status_reserva_id WHERE r.torcedor_id=?', [t.id]),
  });
}));

app.patch('/api/admin/torcedores/:id/visto', auth, staff, a(async (req, res) => {
  const st = await um('SELECT id, nome FROM status_visto WHERE nome=?', [req.body.status]);
  const obs = String(req.body.observacao || '').trim().slice(0, 500);
  if (!st) return erro(res, 400, 'Status inválido.');
  if (st.nome === 'Rejeitado' && !obs) return erro(res, 400, 'Explique o motivo da rejeição.');
  const id = Number(req.params.id);
  if (!(await um('SELECT 1 x FROM torcedores WHERE usuario_id=?', [id]))) return erro(res, 404, 'Torcedor não encontrado.');
  if (st.id === APROVADO && !(await um('SELECT 1 x FROM documentos WHERE torcedor_id=? AND tipo_documento_id=3', [id])))
    return erro(res, 422, 'Não é possível aprovar: o torcedor não enviou o documento do visto.');
  await q('UPDATE vistos SET status_visto_id=?, observacao=?, validado_por=? WHERE torcedor_id=?', [st.id, obs || null, req.user.id, id]);
  await audit(req.user.id, 'VISTO_ATUALIZADO', { alvo: id, visto: st.id });
  res.json({ ok: true });
}));

app.get('/api/admin/auditoria', auth, staff, a(async (req, res) => {
  res.json({ eventos: await q(`SELECT ac.nome acao, a.criado_em, CONCAT(u.nome,' ',u.sobrenome) nome,
      CONCAT_WS(' · ', CONCAT(al.nome,' ',al.sobrenome), p.nome, r.codigo, sv.nome, td.nome) detalhe
    FROM auditoria a JOIN acoes_auditoria ac ON ac.id=a.acao_id
    LEFT JOIN usuarios u ON u.id=a.usuario_id LEFT JOIN usuarios al ON al.id=a.alvo_usuario_id
    LEFT JOIN pacotes p ON p.id=a.pacote_id LEFT JOIN reservas r ON r.id=a.reserva_id
    LEFT JOIN status_visto sv ON sv.id=a.status_visto_id LEFT JOIN tipos_documento td ON td.id=a.tipo_documento_id
    ORDER BY a.id DESC LIMIT 30`) });
}));

// ---------- estáticos e erros ----------
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', (req, res) => erro(res, 404, 'Rota não encontrada.'));
app.use((err, req, res, next) => {
  if (err.errno === 1644 || err.sqlState === '45000') return erro(res, 403, MSG_VISTO, { codigo: 'VISTO_NAO_VALIDADO' });
  if (err.errno === 1062) return erro(res, 409, 'Registro duplicado.');
  if (err.code === 'LIMIT_FILE_SIZE') return erro(res, 400, 'Arquivo acima de 5 MB.');
  if (err instanceof multer.MulterError || /PDF, JPG ou PNG/.test(err.message)) return erro(res, 400, err.message);
  console.error(err);
  erro(res, 500, 'Erro interno. Tente novamente.');
});

iniciar().then(() => app.listen(process.env.PORT || 3000, () => console.log('BorderKick no ar: http://localhost:' + (process.env.PORT || 3000))))
  .catch((e) => { console.error('Falha ao conectar ao MySQL:', e.message); process.exit(1); });
