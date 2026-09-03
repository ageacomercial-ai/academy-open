/* ═══════════════════════════════════════════════════════════
   ACADEMY — FEEDBACK.JS
   Caixa de avaliação pós-geração (estrelas + tags + comentário)
   Guardada em Supabase (avaliacoes) com fallback localStorage.
   Depende de: state.js, supabase.js (opcional)
   ═══════════════════════════════════════════════════════════ */

const FB_TAGS = ['Qualidade', 'Rapidez', 'Fácil de usar', 'Referências', 'Design', 'Suporte'];
let _fbNota = 0;
let _fbTags = new Set();
let _fbEnviando = false;

/* ── Verificar se já avaliou este documento ── */
function fbJaAvaliado() {
  try {
    const docs = typeof getDocs === 'function' ? getDocs() : [];
    const lastId = docs.length ? docs[docs.length - 1]?.id : null;
    if (lastId && localStorage.getItem('acy_fb_' + lastId)) return true;
    if (localStorage.getItem('acy_fb_geral')) return true;
  } catch {}
  return false;
}

/* ── HTML da caixa (inline, sem modal) ── */
function fbCardHTML() {
  if (fbJaAvaliado()) return '';
  return `
  <div id="fbCard" style="background:var(--card);border:.5px solid var(--eb);border-radius:var(--r4);padding:20px 18px;max-width:380px;width:100%;text-align:center;animation:aparecer .35s var(--expo)">
    <div style="font-family:var(--fm);font-size:7.5px;letter-spacing:.14em;color:var(--b);margin-bottom:8px">AVALIA A TUA EXPERIÊNCIA</div>
    <div style="font-size:17px;font-weight:800;color:var(--t1);letter-spacing:-.02em;margin-bottom:4px">Como foi gerar o teu trabalho?</div>
    <div style="font-size:12px;color:var(--t3);margin-bottom:14px">A tua opinião ajuda a melhorar a ACADEMY</div>

    <!-- Estrelas -->
    <div id="fbEstrelas" style="display:flex;justify-content:center;gap:8px;margin-bottom:16px">
      ${[1,2,3,4,5].map(n => `
        <button onclick="fbSetNota(${n})" data-n="${n}" class="fb-star"
          style="width:42px;height:42px;border-radius:12px;border:1px solid var(--e1);background:var(--z2);font-size:20px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;color:var(--t3)"
          aria-label="${n} estrelas">☆</button>
      `).join('')}
    </div>
    <div id="fbLabel" style="font-family:var(--fm);font-size:9px;color:var(--t3);min-height:14px;margin-bottom:14px"></div>

    <!-- Tags -->
    <div id="fbTags" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:14px">
      ${FB_TAGS.map(t => `
        <button onclick="fbToggleTag('${t}')" data-tag="${t}" class="fb-chip"
          style="font-family:var(--fm);font-size:9px;padding:6px 12px;border-radius:20px;border:.5px solid var(--e1);background:var(--z2);color:var(--t2);cursor:pointer;transition:all .15s">${t}</button>
      `).join('')}
    </div>

    <!-- Comentário -->
    <textarea id="fbComent" class="inp" placeholder="Comentário opcional — o que mais gostaste ou o que melhoravas?"
      style="min-height:68px;resize:vertical;font-size:13px;margin-bottom:14px" maxlength="500"></textarea>

    <!-- Ações -->
    <div style="display:flex;gap:8px">
      <button class="btn G" style="flex:1" onclick="fbDispensar()">Depois</button>
      <button id="fbEnviarBtn" class="btn B" style="flex:1;opacity:.5;pointer-events:none" onclick="fbEnviar()">Enviar ★</button>
    </div>
    <div style="font-family:var(--fm);font-size:7.5px;color:var(--t4);margin-top:10px">Anónimo · demora 10 segundos</div>
  </div>`;
}

/* ── Interações ── */
function fbSetNota(n) {
  _fbNota = n;
  const labels = ['', 'Fraco', 'Razoável', 'Bom', 'Muito bom', 'Excelente!'];
  document.querySelectorAll('.fb-star').forEach(btn => {
    const v = parseInt(btn.dataset.n);
    const ativo = v <= n;
    btn.style.background = ativo ? 'var(--eb)' : 'var(--z2)';
    btn.style.borderColor = ativo ? 'var(--eb)' : 'var(--e1)';
    btn.style.color = ativo ? 'var(--b)' : 'var(--t3)';
    btn.textContent = ativo ? '★' : '☆';
    btn.style.transform = ativo ? 'scale(1.05)' : 'scale(1)';
  });
  const lb = document.getElementById('fbLabel');
  if (lb) { lb.textContent = labels[n] || ''; lb.style.color = n >= 4 ? 'var(--b)' : n >= 3 ? 'var(--t2)' : 'var(--t3)'; }
  const envBtn = document.getElementById('fbEnviarBtn');
  if (envBtn) {
    const pode = n >= 1;
    envBtn.style.opacity = pode ? '1' : '.5';
    envBtn.style.pointerEvents = pode ? 'auto' : 'none';
  }
}

function fbToggleTag(tag) {
  if (_fbTags.has(tag)) _fbTags.delete(tag);
  else _fbTags.add(tag);
  document.querySelectorAll('.fb-chip').forEach(btn => {
    const ativo = _fbTags.has(btn.dataset.tag);
    btn.style.background = ativo ? 'var(--eb)' : 'var(--z2)';
    btn.style.borderColor = ativo ? 'var(--eb)' : 'var(--e1)';
    btn.style.color = ativo ? 'var(--b)' : 'var(--t2)';
    btn.style.fontWeight = ativo ? '700' : '400';
  });
}

function fbDispensar() {
  try { localStorage.setItem('acy_fb_geral', 'disp_' + Date.now()); } catch {}
  const card = document.getElementById('fbCard');
  if (card) {
    card.style.transition = 'opacity .25s, transform .25s';
    card.style.opacity = '0';
    card.style.transform = 'translateY(8px)';
    setTimeout(() => card.remove(), 260);
  }
}

async function fbEnviar() {
  if (_fbEnviando) return;
  if (_fbNota < 1) { mostrarToast('Escolhe de 1 a 5 estrelas.', 'erro'); return; }
  _fbEnviando = true;
  const btn = document.getElementById('fbEnviarBtn');
  if (btn) { btn.textContent = '⏳ A enviar…'; btn.disabled = true; }

  const comentario = (document.getElementById('fbComent')?.value || '').trim().substring(0, 500);
  const payload = {
    nota: _fbNota,
    tags: [..._fbTags],
    comentario,
    contexto: 'pos_geracao',
    tema: (typeof State !== 'undefined' ? State.getCfg('tema') : '') || '',
    tipo: (typeof tipoActual === 'function' ? (tipoActual()?.n || '') : ''),
    pags: (typeof State !== 'undefined' ? State.getCfg('pags') : null) || null,
    uid: (typeof sbUserId === 'function' ? sbUserId() : null) || (localStorage.getItem('sb_uid') || 'anon'),
    created_at: new Date().toISOString()
  };

  let ok = false;
  /* Tentar Supabase — falha silenciosamente se tabela não existir */
  try {
    if (typeof SB_URL !== 'undefined' && typeof SB_H === 'function') {
      const r = await fetch(SB_URL + '/rest/v1/avaliacoes', {
        method: 'POST',
        headers: { ...SB_H(), 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          uid: payload.uid,
          nota: payload.nota,
          comentario: payload.comentario || null,
          tags: payload.tags,
          contexto: payload.contexto,
          doc_id: null,
          meta: { tema: payload.tema, tipo: payload.tipo, pags: payload.pags }
        })
      });
      ok = r.ok || r.status === 201;
    }
  } catch (e) { /* sem rede ou tabela ainda não criada */ }

  /* Sempre guardar localmente como backup / prova de envio */
  try {
    const docs = typeof getDocs === 'function' ? getDocs() : [];
    const lastId = docs.length ? docs[docs.length - 1]?.id : 'geral';
    localStorage.setItem('acy_fb_' + lastId, JSON.stringify(payload));
    localStorage.setItem('acy_fb_geral', 'done_' + Date.now());
    const hist = JSON.parse(localStorage.getItem('acy_fb_hist') || '[]');
    hist.push(payload);
    localStorage.setItem('acy_fb_hist', JSON.stringify(hist.slice(-20)));
  } catch {}

  _fbEnviando = false;
  const card = document.getElementById('fbCard');
  if (card) {
    card.innerHTML = `
      <div style="font-size:32px;margin-bottom:10px">✓</div>
      <div style="font-size:16px;font-weight:700;color:var(--t1);margin-bottom:6px">Obrigado pelo feedback!</div>
      <div style="font-size:13px;color:var(--t2);line-height:1.6;margin-bottom:14px">A tua avaliação ajuda a melhorar a ACADEMY para todos.</div>
      <button class="btn G w" onclick="document.getElementById('fbCard')?.remove()">Continuar →</button>`;
  }
  try { mostrarToast('✓ Obrigado pela avaliação!'); } catch {}
}

/* Expor globalmente */
if (typeof window !== 'undefined') {
  window.fbCardHTML = fbCardHTML;
  window.fbSetNota = fbSetNota;
  window.fbToggleTag = fbToggleTag;
  window.fbDispensar = fbDispensar;
  window.fbEnviar = fbEnviar;
  window.fbJaAvaliado = fbJaAvaliado;
}
