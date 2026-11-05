/* BorderKick — script único das páginas (usa as classes do style.css original) */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dia = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const dataHora = (d) => new Date(String(d).replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
const FOTO = { 'Nova York': 'photo-ny', 'Toronto': 'photo-toronto', 'Cidade do México': 'photo-mexico' };
const STATUS_CLASSE = { 'Aprovado e Validado': 'approved', 'Em análise': 'pending', 'Rejeitado': 'rejected', 'Pendente': 'neutral' };
const chip = (s) => `<span class="status ${STATUS_CLASSE[s] || 'neutral'}">${esc(s)}</span>`;

async function api(url, opt = {}) {
  const o = { credentials: 'same-origin', ...opt };
  if (o.body && !(o.body instanceof FormData)) { o.headers = { 'Content-Type': 'application/json', ...o.headers }; o.body = JSON.stringify(o.body); }
  let r;
  try { r = await fetch(url, o); } catch { throw new Error('Sem conexão com o servidor. Verifique se ele está rodando.'); }
  let d = {}; try { d = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(d.erro || 'Erro inesperado. Tente novamente.'); e.status = r.status; e.dados = d; throw e; }
  return d;
}
function aviso(el, msg, tipo = 'erro') { el.className = 'alert alert-' + tipo; el.textContent = msg; el.hidden = false; }

let EU = null, VISTO = null;
async function carregarEu() { try { const d = await api('/api/me'); EU = d.usuario; VISTO = d.visto; } catch { EU = null; } }
const irLogin = () => { location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); };
async function sair(e) { e?.preventDefault(); try { await api('/api/auth/logout', { method: 'POST' }); } catch {} location.href = 'index.html'; }

function topo() {
  const el = $('#topo'); if (!el) return;
  const pg = document.body.dataset.page;
  const links = [['index.html', 'Início', 'index'], ['pacote.html', 'Pacotes', 'pacote']];
  if (EU?.papel === 'torcedor') links.push(['voucher.html', 'Meus vouchers', 'voucher']);
  if (EU?.papel === 'atendente') links.push(['validacao.html', 'Validação', 'validacao']);
  el.innerHTML = `<a class="brand" href="index.html"><span class="brand-mark">BK</span>BorderKick</a>
    <nav>${links.map(([h, t, p]) => `<a href="${h}" class="${p === pg ? 'active' : ''}">${t}</a>`).join('')}
      ${EU ? '<a href="#" class="nav-mobile-only" data-sair>Sair</a>' : '<a href="login.html" class="nav-mobile-only">Entrar</a><a href="cadastro.html" class="nav-mobile-only">Cadastrar</a>'}</nav>
    <div class="nav-actions">${EU
      ? `<span class="muted" style="align-self:center;font-size:13px">Olá, ${esc(EU.nome.split(' ')[0])}</span><button class="btn btn-ghost btn-small" data-sair>Sair</button>`
      : '<a class="btn btn-ghost btn-small" href="login.html">Entrar</a><a class="btn btn-lime btn-small" href="cadastro.html">Cadastrar</a>'}</div>
    <button class="menu-toggle" aria-label="Abrir menu">☰</button>`;
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-sair]')) return sair(e);
    if (e.target.closest('.menu-toggle')) el.classList.toggle('menu-open');
  });
}

const P = {
  index() {},

  login() {
    const f = $('#f'), a = $('#aviso');
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); a.hidden = true;
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        const d = await api('/api/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(f)) });
        const n = new URLSearchParams(location.search).get('next');
        location.href = n && /^[a-z]+\.html(\?[\w=&-]*)?$/.test(n) ? n : d.usuario.papel === 'atendente' ? 'validacao.html' : 'pacote.html';
      } catch (x) { aviso(a, x.message); btn.disabled = false; }
    });
  },

  cadastro() {
    const f = $('#f'), a = $('#aviso'), passos = [...f.querySelectorAll('.passo')], etapas = [...document.querySelectorAll('#steps .step')];
    f.noValidate = true; // validamos passo a passo (campos de passos ocultos não travam o envio)
    let i = 0;
    const valido = (n) => [...passos[n].querySelectorAll('input,select')].every((c) => c.reportValidity());
    const resumo = () => {
      const g = (n) => f.elements[n].value;
      $('#resumo').innerHTML = [['Nome', g('nome')], ['CPF', g('cpf')], ['E-mail', g('email')], ['Telefone', g('telefone')], ['País de origem', g('pais')],
        ['Documento', f.elements.documento.files[0]?.name || '—'], ['Visto EUA', f.elements.visto.files[0]?.name || 'não enviado']].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
    };
    const ir = (n) => { i = n; passos.forEach((p, k) => (p.hidden = k !== n)); etapas.forEach((l, k) => l.classList.toggle('active', k <= n)); if (n === 2) resumo(); };
    f.addEventListener('click', (e) => {
      if (e.target.matches('[data-prox]') && valido(i)) ir(i + 1);
      if (e.target.matches('[data-volta]')) ir(i - 1);
    });
    f.elements.cpf.addEventListener('input', (e) => {
      const d = e.target.value.replace(/\D/g, '').slice(0, 11);
      e.target.value = d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    });
    f.elements.telefone.addEventListener('input', (e) => {
      const d = e.target.value.replace(/\D/g, '').slice(0, 11);
      e.target.value = d.length > 6 ? d.replace(/(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : d.length > 2 ? d.replace(/(\d{2})(\d+)/, '($1) $2') : d;
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); a.hidden = true;
      if (i < 2) { if (valido(i)) ir(i + 1); return; }
      if (!valido(2)) return;
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      try { await api('/api/auth/register', { method: 'POST', body: new FormData(f) }); location.href = 'pacote.html'; }
      catch (x) { aviso(a, x.message); btn.disabled = false; }
    });
  },

  async pacote() {
    const box = $('#lista'), ban = $('#banner');
    let dados;
    try { dados = await api('/api/pacotes'); } catch (x) { box.innerHTML = `<p class="alert alert-erro">${esc(x.message)}</p>`; return; }
    const { pacotes, extras } = dados;
    if (!EU) ban.innerHTML = '<p class="alert alert-aviso">Entre ou cadastre-se para emitir seu pacote. <a href="login.html?next=pacote.html">Entrar</a></p>';
    else if (EU.papel === 'torcedor') {
      const s = VISTO?.status || 'Pendente', ok = s === 'Aprovado e Validado';
      ban.innerHTML = `<p class="alert ${ok ? 'alert-ok' : 'alert-aviso'}">Seu visto americano: <b>${esc(s)}</b>${VISTO?.observacao ? ' — ' + esc(VISTO.observacao) : ''}. ${ok ? 'Você pode emitir pacotes com jogos nos EUA.' : 'Pacotes com jogo nos EUA ficam bloqueados até a validação do atendente.'}</p>`;
    }
    const desenhar = (filtro) => {
      const lista = pacotes.filter((p) => !filtro || p.jogos.some((j) => j.pais === filtro));
      box.innerHTML = lista.length ? lista.map((p) => `<article class="package-card" data-id="${p.id}" data-preco="${p.preco}">
        <div class="package-photo ${FOTO[p.jogos[0]?.cidade] || 'photo-ny'}"></div>
        <div class="package-info">
          <span class="tag">${[...new Set(p.jogos.map((j) => j.pais.toUpperCase()))].join(' + ')}</span>
          <h3>${esc(p.nome)}</h3><p>${esc(p.descricao)}</p>
          <div class="package-meta">${p.jogos.map((j) => `<span>▣ ${dia(j.data)} · ${esc(j.cidade)} · ${esc(j.estadio)}</span>`).join('')}</div>
          ${p.exige_visto_eua ? '<p class="selo-visto">Exige Visto Americano “Aprovado e Validado”</p>' : ''}
          <fieldset class="extras"><legend>Extras</legend>${extras.map((e) => `<label><input type="checkbox" value="${e.id}" data-preco="${e.preco}"> ${esc(e.nome)} (+${brl(e.preco)})</label>`).join('')}</fieldset>
          <div class="price"><span data-total>${brl(p.preco)}</span> <small>/ pessoa</small></div>
          <button class="btn btn-lime btn-block" data-emitir>Emitir pacote →</button>
          <p class="alert alert-erro" role="alert" hidden></p>
        </div></article>`).join('') : '<p class="muted">Nenhum pacote para este destino.</p>';
    };
    desenhar('');
    $('#pills').addEventListener('click', (e) => {
      const s = e.target.closest('span[data-pais]'); if (!s) return;
      document.querySelectorAll('#pills span').forEach((x) => x.classList.toggle('on', x === s));
      desenhar(s.dataset.pais);
    });
    box.addEventListener('change', (e) => {
      const c = e.target.closest('.package-card'); if (!c) return;
      const t = Number(c.dataset.preco) + [...c.querySelectorAll('.extras input:checked')].reduce((s, x) => s + Number(x.dataset.preco), 0);
      $('[data-total]', c).textContent = brl(t);
    });
    box.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-emitir]'); if (!btn) return;
      const c = btn.closest('.package-card'), a = $('.alert', c);
      if (!EU) return irLogin();
      btn.disabled = true; a.hidden = true;
      try {
        const d = await api('/api/reservas', { method: 'POST', body: { pacote_id: Number(c.dataset.id), extras: [...c.querySelectorAll('.extras input:checked')].map((x) => Number(x.value)) } });
        location.href = 'voucher.html?id=' + d.reserva.id;
      } catch (x) {
        if (x.status === 409 && x.dados.id) return (location.href = 'voucher.html?id=' + x.dados.id);
        if (x.status === 401) return irLogin();
        aviso(a, x.message); btn.disabled = false;
      }
    });
  },

  async validacao() {
    if (EU?.papel !== 'atendente') return irLogin();
    $('#avatar').textContent = EU.nome[0].toUpperCase();
    $('#sair').addEventListener('click', sair);
    const tb = $('#tbody'), det = $('#detalhe'), q = $('#q'), st = $('#filtro');
    let todos = [];
    const desenhar = () => {
      const t = q.value.trim().toLowerCase();
      const lista = todos.filter((x) => (!st.value || x.visto_status === st.value) && (!t || (x.nome + ' ' + x.email).toLowerCase().includes(t)));
      tb.innerHTML = lista.length ? lista.map((x) => `<tr data-id="${x.id}"><td>${esc(x.nome)}</td><td>${esc(x.email)}</td><td>${esc(x.pais)}</td><td>${x.docs}</td><td>${chip(x.visto_status)}</td><td><button class="table-action" data-abrir>Revisar</button></td></tr>`).join('')
        : '<tr><td colspan="6">Nenhum torcedor encontrado.</td></tr>';
    };
    const stats = () => {
      const c = (s) => todos.filter((x) => x.visto_status === s).length;
      $('#stats').innerHTML = `<div class="stat-card"><small>Torcedores</small><strong>${todos.length}</strong></div>
        <div class="stat-card"><small>Aguardando análise</small><strong class="yellow">${c('Em análise') + c('Pendente')}</strong></div>
        <div class="stat-card ok"><small>Aprovados e validados</small><strong>${c('Aprovado e Validado')}</strong></div>
        <div class="stat-card"><small>Rejeitados</small><strong class="red">${c('Rejeitado')}</strong></div>`;
    };
    const listar = async () => { todos = (await api('/api/admin/torcedores')).torcedores; stats(); desenhar(); };
    const auditoria = async () => {
      const { eventos } = await api('/api/admin/auditoria');
      $('#audit').innerHTML = eventos.length ? eventos.map((v) => `<li>${esc(dataHora(v.criado_em))} — ${esc(v.nome || 'sistema')}: <b>${esc(v.acao)}</b> ${esc(v.detalhe || '')}</li>`).join('') : '<li>Nenhum evento ainda.</li>';
    };
    const abrir = async (id) => {
      const d = await api('/api/admin/torcedores/' + id), t = d.torcedor;
      const nomes = { identidade: 'Identidade (RG/CNH)', passaporte: 'Passaporte', visto_eua: 'Visto EUA' };
      det.hidden = false;
      det.innerHTML = `<h2>${esc(t.nome)}</h2><p class="muted" style="font-size:12px">CPF ${esc(t.cpf)} · ${esc(t.email)} · ${esc(t.telefone || '')} · nascimento ${esc(t.nascimento)} · ${esc(t.pais)}</p>
        <div class="det-grid"><div>
          <h3>Documentos enviados</h3>${d.documentos.length ? `<ul>${d.documentos.map((x) => `<li><a href="/api/arquivos/${x.id}" target="_blank" rel="noopener">${esc(nomes[x.tipo] || x.tipo)}</a> — ${esc(x.nome_original)}</li>`).join('')}</ul>` : '<p class="muted" style="font-size:13px">Nenhum documento.</p>'}
          <h3>Reservas</h3>${d.reservas.length ? `<ul>${d.reservas.map((r) => `<li>${esc(r.pacote)} — ${esc(r.codigo)} (${esc(r.status)})</li>`).join('')}</ul>` : '<p class="muted" style="font-size:13px">Sem reservas.</p>'}
        </div>
        <form class="demo-form" id="fv">
          <div class="field"><label for="vs">Status do Visto Americano</label><select id="vs" name="status">${['Pendente', 'Em análise', 'Aprovado e Validado', 'Rejeitado'].map((s) => `<option ${s === d.visto.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label for="vo">Observação (obrigatória ao rejeitar)</label><textarea id="vo" name="observacao" maxlength="500">${esc(d.visto.observacao || '')}</textarea></div>
          <p class="alert" role="alert" hidden></p>
          <button class="btn btn-lime" type="submit">Salvar validação</button>
        </form></div>`;
      det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      $('#fv').addEventListener('submit', async (e) => {
        e.preventDefault(); const al = $('.alert', det);
        try { await api(`/api/admin/torcedores/${id}/visto`, { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }); aviso(al, 'Validação salva.', 'ok'); listar(); auditoria(); }
        catch (x) { aviso(al, x.message); }
      });
    };
    tb.addEventListener('click', (e) => {
      const r = e.target.closest('tr[data-id]'); if (!r) return;
      tb.querySelectorAll('tr').forEach((x) => x.classList.remove('sel')); r.classList.add('sel'); abrir(r.dataset.id);
    });
    q.addEventListener('input', desenhar); st.addEventListener('change', desenhar);
    await Promise.all([listar(), auditoria()]);
  },

  async voucher() {
    if (!EU) return irLogin();
    const box = $('#conteudo'), id = new URLSearchParams(location.search).get('id');
    if (!id) {
      const { reservas } = await api('/api/reservas');
      box.innerHTML = `<div class="voucher-intro"><span class="eyebrow">MEUS VOUCHERS</span><h1>Suas viagens</h1><p class="muted">Abra um voucher para ver o detalhe e imprimir.</p></div>` +
        (reservas.length ? `<div class="lista-vouchers">${reservas.map((r) => `<a href="voucher.html?id=${r.id}"><span><b>${esc(r.pacote)}</b><br><small class="muted">${esc(r.codigo)} · ${esc(dataHora(r.criado_em))}</small></span><span class="lime"><b>${brl(r.total)}</b></span></a>`).join('')}</div>`
          : '<p class="muted">Você ainda não emitiu nenhum pacote.</p><a class="btn btn-lime" href="pacote.html">Ver pacotes →</a>');
      return;
    }
    try {
      const d = await api('/api/reservas/' + encodeURIComponent(id)), p = d.pacote;
      box.innerHTML = `<div class="voucher-intro"><span class="eyebrow">${d.valido ? 'PACOTE EMITIDO' : 'ATENÇÃO'}</span><h1>${d.valido ? 'Seu voucher está pronto.' : 'Voucher suspenso.'}</h1><p class="muted">Apresente este voucher no check-in e na imigração.</p></div>
      <div class="voucher">
        <div class="voucher-side"><span class="brand-mark">BK</span><div class="barcode"></div><small>BORDERKICK · COPA 2026</small></div>
        <div class="voucher-main">
          <div class="voucher-head"><div><span class="eyebrow">VOUCHER DE VIAGEM</span><h2>${esc(p.nome)}</h2></div>${chip(d.valido ? 'Aprovado e Validado' : 'Rejeitado').replace(/>[^<]*</, `>${esc(d.reserva.status)}<`)}</div>
          ${d.valido ? '' : `<p class="voucher-susp">${esc(d.motivo || 'Voucher indisponível.')}</p>`}
          ${p.jogos.map((j) => `<div class="voucher-match match-bloco"><div class="match-photo ${FOTO[j.cidade] || 'photo-ny'}"></div><div class="teams"><span>▣</span><b>${esc(j.cidade)} · ${esc(j.pais)}</b><small>${esc(j.estadio.toUpperCase())} — ${dia(j.data).toUpperCase()}</small></div></div>`).join('')}
          <div class="voucher-details">
            <div><small>TORCEDOR</small><b>${esc(d.torcedor.nome)}</b></div><div><small>CPF</small><b>${esc(d.torcedor.cpf)}</b></div>
            <div><small>JOGOS</small><b>${p.jogos.length}</b></div><div><small>EXTRAS</small><b>${d.reserva.extras.length ? d.reserva.extras.map(esc).join(', ') : 'nenhum'}</b></div>
          </div>
          <div class="voucher-bottom"><div><small>CÓDIGO DO VOUCHER</small><b style="font-size:22px;letter-spacing:2px">${d.valido ? esc(d.reserva.codigo) : 'SUSPENSO'}</b><br><small style="margin-top:8px">TOTAL</small><b>${brl(d.reserva.total)}</b></div><div class="qr-placeholder"><span>◎</span></div></div>
        </div>
      </div>
      <p class="notice">Documento demonstrativo — projeto acadêmico. Dados e valores fictícios.</p>
      <div class="acoes"><button class="btn btn-lime" onclick="print()">Imprimir voucher</button><a class="btn btn-ghost" href="voucher.html">Todos os vouchers</a></div>`;
    } catch (x) { box.innerHTML = `<p class="alert alert-erro">${esc(x.message)}</p><a class="btn btn-ghost" href="pacote.html">Ver pacotes</a>`; }
  },
};

(async () => { await carregarEu(); topo(); try { await P[document.body.dataset.page]?.(); } catch (x) { console.error(x); } })();
