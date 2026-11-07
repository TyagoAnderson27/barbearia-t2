// PWA: registra o service worker (caminho relativo, funciona no GitHub Pages)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function (e) { console.warn("Service worker:", e); });
  });
}

  // ---- Utilidades ----
  const $ = (s) => document.querySelector(s);
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseISO = (s) => { const p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const horaFmt = (m) => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  const moeda = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const precoTxt = (v) => (v == null ? "Sob consulta" : moeda(v));
  const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const hLabel = (h) => (h % 1 ? pad(Math.floor(h)) + "h30" : h + "h");

  function zapFmt(n) {
    const d = n.replace(/\D/g, "").replace(/^55/, "");
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return n;
  }

  // % de desconto do combo (2 ou mais serviços). Pode mudar em dados.js com descontoCombo: 5 (0 desliga)
  const PCT = typeof CONFIG.descontoCombo === "number" ? CONFIG.descontoCombo : 5;
  const state = { servicos: [], barbeiro: "qualquer", data: null, hora: null, nome: "", tel: "" };
  // Serviços escolhidos somados em um único atendimento: tempo total, subtotal e desconto de combo (2 ou mais).
  const svc = () => {
    const sel = SERVICOS.filter((s) => state.servicos.indexOf(s.id) >= 0);
    if (!sel.length) return { id: "", nome: "", lista: [], qtd: 0, min: 0, semPreco: false, subtotal: 0, pct: 0, desconto: 0, preco: 0 };
    const min = sel.reduce((a, s) => a + s.min, 0);
    const semPreco = sel.some((s) => s.preco == null);
    const subtotal = semPreco ? null : sel.reduce((a, s) => a + s.preco, 0);
    const pct = sel.length > 1 && subtotal != null ? PCT : 0;
    const desconto = Math.round(subtotal * pct) / 100;
    return {
      id: sel.length > 1 ? "combo-montado" : sel[0].id,
      nome: sel.map((s) => s.nome).join(" + "),
      lista: sel, qtd: sel.length, min: min, semPreco: semPreco,
      subtotal: subtotal, pct: pct, desconto: desconto,
      preco: subtotal == null ? null : subtotal - desconto
    };
  };
  const brb = () => BARBEIROS.find((b) => b.id === state.barbeiro);

  function slotsDoDia(dia, duracao) {
    const h = CONFIG.horarios[dia.getDay()];
    if (!h) return [];
    const ini = h[0] * 60, fim = h[1] * 60;
    const agora = new Date();
    const hoje = toISO(agora) === toISO(dia);
    const limite = hoje ? agora.getHours() * 60 + agora.getMinutes() + CONFIG.antecedenciaMin : -1;
    const out = [];
    for (let m = ini; m + duracao <= fim; m += CONFIG.passoMin) if (m >= limite) out.push(m);
    return out;
  }
  function proximoDiaAberto() {
    const t = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i);
      if (slotsDoDia(d, svc().min).length) return d;
    }
    return t;
  }

  // ---- Agenda compartilhada (Firebase) ----
  // Só funciona se o firebase-config.js estiver preenchido. Sem isso, a página
  // mostra todos os horários e a barbearia confirma tudo pelo WhatsApp.
  const AGENDA = { ativa: false, db: null, cache: {}, falhou: {} };
  function iniciarAgenda() {
    try {
      if (typeof firebase === "undefined" || typeof firebaseConfig === "undefined" || !firebaseConfig.projectId) return;
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      AGENDA.db = firebase.firestore();
      AGENDA.ativa = true;
    } catch (e) { console.warn("Agenda desativada:", e); }
  }
  function agendaCarregando(data) { return AGENDA.ativa && !AGENDA.cache[data] && !AGENDA.falhou[data]; }
  async function carregarOcupados(data) {
    if (!AGENDA.ativa) return;
    const c = AGENDA.cache[data];
    if (c && Date.now() - c.t < 60000) return;
    try {
      const snap = await AGENDA.db.collection("ocupados").where("data", "==", data).get();
      AGENDA.cache[data] = { t: Date.now(), lista: snap.docs.map((d) => d.data()) };
      AGENDA.falhou[data] = false;
    } catch (e) {
      console.warn("Não foi possível ler a agenda:", e);
      AGENDA.falhou[data] = true;
    }
  }
  // Um horário só aparece se o barbeiro escolhido (ou algum barbeiro, em "Qualquer") estiver livre
  function horarioLivre(data, inicio, dur) {
    if (!AGENDA.ativa) return true;
    const c = AGENDA.cache[data];
    const lista = c ? c.lista : [];
    const fim = inicio + dur;
    const ocupado = (b) => lista.some((o) => o.barbeiro === b && inicio < o.fim && fim > o.inicio);
    if (state.barbeiro === "qualquer") return BARBEIROS.some((b) => b.id !== "qualquer" && !ocupado(b.id));
    return !ocupado(state.barbeiro);
  }

  // Guarda o pedido no Firebase para o dono confirmar no painel. Falhar aqui nunca impede o WhatsApp.
  let ultimoPedido = "";
  function registrarPedido() {
    if (!AGENDA.ativa) return;
    const tel = telDigitos(state.tel);
    const chave = [state.data, state.hora, state.servicos.join(","), state.barbeiro, tel].join("|");
    if (!tel || chave === ultimoPedido) return;
    ultimoPedido = chave;
    AGENDA.db.collection("pedidos").add({
      nome: state.nome.trim().slice(0, 60),
      telefone: tel,
      servicoId: svc().id, servicoNome: svc().nome.slice(0, 60),
      barbeiroId: brb().id, barbeiroNome: brb().nome,
      data: state.data, inicio: state.hora, fim: state.hora + svc().min,
      status: "pendente",
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    }).catch((e) => { ultimoPedido = ""; console.warn("Pedido não registrado:", e); });
  }

  // ---- Cabeçalho e rodapé ----
  function textoMarca() {
    $("#marca").textContent = CONFIG.nome;
    $("#fMarca").textContent = CONFIG.nome;
    $("#fEnd").textContent = CONFIG.endereco;
    $("#fZap").textContent = zapFmt(CONFIG.whatsapp);
    $("#fOutro").textContent = CONFIG.outroTelefone ? "Outro contato: " + CONFIG.outroTelefone : "";
    $("#fInsta").textContent = "@" + CONFIG.instagram;
    $("#fInsta").href = "https://instagram.com/" + CONFIG.instagram;
    $("#heroArt").hidden = !CONFIG.mostrarLogo;
    document.title = CONFIG.nome;
  }
  function renderSemana() {
    const hoje = new Date().getDay();
    const ordem = [1, 2, 3, 4, 5, 6, 0];
    $("#semana").innerHTML = ordem.map((d) => {
      const h = CONFIG.horarios[d];
      return '<div class="' + (d === hoje ? "hoje" : "") + '"><dt>' + DIAS_CURTO[d] + "</dt><dd>" +
        (h ? hLabel(h[0]) + " às " + hLabel(h[1]) : "Fechado") + "</dd></div>";
    }).join("");
  }
  function renderStatus() {
    const agora = new Date();
    const h = CONFIG.horarios[agora.getDay()];
    const min = agora.getHours() * 60 + agora.getMinutes();
    const dot = $("#dot"), tx = $("#statusTxt"), sub = $("#statusSub");
    if (h && min >= h[0] * 60 && min < h[1] * 60) {
      dot.classList.add("on"); tx.textContent = "Aberto agora"; sub.textContent = "Atendemos até as " + hLabel(h[1]) + " hoje.";
      return;
    }
    dot.classList.remove("on"); tx.textContent = "Fechado agora";
    for (let i = 0; i < 8; i++) {
      const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i);
      const hh = CONFIG.horarios[d.getDay()];
      if (!hh) continue;
      if (i === 0 && min >= hh[0] * 60) continue;
      sub.textContent = "Abrimos " + (i === 0 ? "hoje" : i === 1 ? "amanhã" : DIAS[d.getDay()]) + " às " + hLabel(hh[0]) + ".";
      return;
    }
  }

  // ---- Serviços, equipe e formulário ----
  function renderServicos() {
    $("#menu").innerHTML = SERVICOS.map((s) =>
      '<li><div class="nome">' + s.nome + '</div><div class="preco">' + precoTxt(s.preco) + '</div>' +
      '<div class="desc">' + s.desc + '</div><div class="min">' + s.min + ' min</div>' +
      '<a class="btn btn-small go" href="#agendar" data-servico="' + s.id + '">Agendar</a></li>'
    ).join("");
    $("#servicoOpcoes").innerHTML = SERVICOS.map((s) =>
      '<label class="opt"><input class="vh" type="checkbox" name="servico" id="sv-' + s.id + '" value="' + s.id + '"' + (state.servicos.indexOf(s.id) >= 0 ? " checked" : "") + '>' +
      '<span class="opt-body"><b>' + s.nome + '</b><span>' + s.min + " min · " + precoTxt(s.preco) + "</span></span></label>"
    ).join("");
  }
  function renderEquipe() {
    $("#equipe").innerHTML = BARBEIROS.filter((b) => b.id !== "qualquer").map((b) =>
      '<article class="person"><div class="avatar" aria-hidden="true">' + b.nome[0] + "</div><h3>" + b.nome + "</h3><p>" + b.fn + "</p>" +
      '<a class="btn btn-small" href="#agendar" data-barbeiro="' + b.id + '">Agendar com ' + b.nome + "</a></article>"
    ).join("");
    $("#barbeiro").innerHTML = BARBEIROS.map((b) => '<option value="' + b.id + '">' + b.nome + "</option>").join("");
  }
  function renderGaleria() {
    const sec = $("#trabalhos");
    if (!CONFIG.galeria.length) { sec.hidden = true; return; }
    $("#galeria").innerHTML = CONFIG.galeria.map((g) =>
      '<figure><img src="' + g.src + '" alt="' + g.legenda + '" loading="lazy"><figcaption>' + g.legenda + "</figcaption></figure>"
    ).join("");
    document.querySelectorAll("#galeria figure").forEach((fig) => {
      const img = fig.querySelector("img");
      const legenda = img.alt;
      const semFoto = () => {
        img.remove();
        const cap = fig.querySelector("figcaption"); if (cap) cap.remove();
        const v = document.createElement("div");
        v.className = "vazio";
        v.textContent = "Foto: " + legenda;
        fig.appendChild(v);
      };
      img.addEventListener("error", semFoto);
      if (img.complete && img.naturalWidth === 0) semFoto();
    });
  }

  function renderSlots() {
    const box = $("#horarios");
    const dia = parseISO(state.data);
    if (!svc().qtd) {
      state.hora = null;
      box.innerHTML = '<p class="note">Marque pelo menos um serviço acima para ver os horários.</p>';
      return;
    }
    if (!CONFIG.horarios[dia.getDay()]) {
      state.hora = null;
      box.innerHTML = '<p class="note">A barbearia fecha neste dia. Escolha outra data.</p>';
      return;
    }
    if (agendaCarregando(state.data)) {
      state.hora = null;
      box.innerHTML = '<p class="note">Carregando horários...</p>';
      return;
    }
    const lista = slotsDoDia(dia, svc().min).filter((m) => horarioLivre(state.data, m, svc().min));
    if (!lista.length) {
      state.hora = null;
      const c = AGENDA.cache[state.data];
      const folga = state.barbeiro !== "qualquer" && c && c.lista.some((o) => o.barbeiro === state.barbeiro && o.inicio === 0 && o.fim === 1440);
      box.innerHTML = folga
        ? '<p class="note">' + brb().nome + ' não atende neste dia. Escolha outra data ou outro barbeiro.</p>'
        : '<p class="note">Sem horários disponíveis neste dia. Escolha outra data.</p>';
      return;
    }
    if (lista.indexOf(state.hora) < 0) state.hora = null;
    box.innerHTML = '<div class="slots" role="radiogroup" aria-label="Horário">' + lista.map((m) =>
      '<label class="slot"><input class="vh" type="radio" name="hora" value="' + m + '"' + (m === state.hora ? " checked" : "") + "><span>" + horaFmt(m) + "</span></label>"
    ).join("") + "</div>" +
    (AGENDA.falhou[state.data] ? '<p class="fine">Não foi possível conferir os horários já ocupados agora. A barbearia confirma pelo WhatsApp.</p>' : "");
  }

  // Número que recebe o pedido: o do barbeiro escolhido ou, sem ele, o da barbearia
  function zapDestino() {
    const n = (brb().whatsapp || "").replace(/\D/g, "");
    return n.length >= 12 ? n : CONFIG.whatsapp.replace(/\D/g, "");
  }

  // ---- Resumo e mensagem do WhatsApp ----
  function dataLonga() {
    const d = parseISO(state.data);
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " (" + DIAS[d.getDay()] + ")";
  }
  function mensagem() {
    return [
      "*Novo agendamento* - " + CONFIG.nome,
      "",
      "*Nome:* " + state.nome.trim(),
      "*Serviço" + (svc().qtd > 1 ? "s (combo)" : "") + ":* " + svc().nome,
      "*Barbeiro:* " + brb().nome,
      "*Data:* " + dataLonga(),
      "*Hora:* " + horaFmt(state.hora),
      "*Valor:* " + (svc().preco == null ? "a combinar" : svc().desconto ? moeda(svc().preco) + " (combo com " + svc().pct + "% de desconto)" : moeda(svc().preco)),
      "",
      "Aguardo a confirmação."
    ].join("\n");
  }
  // Aceita (85) 99999-9999, 85999999999 ou 5585999999999. Devolve "55" + DDD + número, ou "" se inválido.
  function telDigitos(t) {
    let d = String(t || "").replace(/\D/g, "").replace(/^0+/, "");
    if ((d.length === 12 || d.length === 13) && d.indexOf("55") === 0) d = d.slice(2);
    return d.length === 10 || d.length === 11 ? "55" + d : "";
  }
  function listaPt(f) { return f.length > 1 ? f.slice(0, -1).join(", ") + " e " + f[f.length - 1] : f.join(""); }
  function faltando() {
    const f = [];
    if (!svc().qtd) f.push("serviço");
    if (state.hora == null) f.push("horário");
    if (state.nome.trim().length < 2) f.push("nome");
    if (AGENDA.ativa && !telDigitos(state.tel)) f.push("WhatsApp com DDD");
    return f;
  }
  function atualizarResumo() {
    $("#rServ").textContent = svc().qtd ? svc().nome : "Escolha";
    $("#rBarb").textContent = brb().nome;
    $("#rData").textContent = dataLonga();
    $("#rHora").textContent = state.hora == null ? "Escolha" : horaFmt(state.hora);
    $("#rTotal").textContent = svc().qtd ? precoTxt(svc().preco) : "—";
    $("#rDescLinha").hidden = !svc().desconto;
    $("#rDescRot").textContent = "Desconto do combo (" + svc().pct + "%)";
    $("#rDesc").textContent = "- " + moeda(svc().desconto);
    desenharCombo();

    const f = faltando();
    const btn = $("#enviar");
    $("#aviso").hidden = true;
    if (f.length) {
      btn.setAttribute("aria-disabled", "true");
      btn.setAttribute("href", "#agendar");
      $("#falta").textContent = "Falta: " + listaPt(f) + ".";
      $("#previa").textContent = "Escolha o horário e preencha seus dados para ver a mensagem.";
    } else {
      const msg = mensagem();
      btn.removeAttribute("aria-disabled");
      btn.setAttribute("href", "https://wa.me/" + zapDestino() + "?text=" + encodeURIComponent(msg));
      $("#falta").textContent = "";
      $("#previa").textContent = msg;
    }
  }
  function atualizarTudo() {
    renderSlots();
    atualizarResumo();
    const d = state.data;
    if (AGENDA.ativa) {
      carregarOcupados(d).then(() => {
        if (state.data === d) { renderSlots(); atualizarResumo(); }
      });
    }
  }

  // Caixa "Seu combo": serviços, tempo, subtotal, desconto e preço final
  function desenharCombo() {
    const c = svc(), pct = PCT;
    if (!c.qtd) {
      $("#dicaCombo").textContent = pct ? "Marque os serviços que quiser. Com 2 ou mais, você ganha " + pct + "% de desconto no total." : "Marque os serviços que quiser.";
      $("#comboBox").innerHTML = '<h4>Seu combo</h4><p class="obs">Nenhum serviço marcado ainda. Toque nos serviços acima para ver o preço.</p>';
      return;
    }
    $("#dicaCombo").textContent = pct
      ? "Marque os serviços que quiser. Com 2 ou mais, você ganha " + pct + "% de desconto no total."
      : "Marque os serviços que quiser.";
    let h = '<h4>Seu combo</h4><ul>' + c.lista.map((s) => "<li><span>" + s.nome + "</span><span>" + precoTxt(s.preco) + "</span></li>").join("") + "</ul>" +
      '<p class="linha"><span>Tempo total</span><span>' + c.min + " min</span></p>";
    if (c.subtotal != null && c.desconto) {
      h += '<p class="linha"><span>Subtotal</span><span>' + moeda(c.subtotal) + "</span></p>" +
        '<p class="linha desc"><span>Desconto de ' + c.pct + "%</span><span>- " + moeda(c.desconto) + "</span></p>";
    }
    h += '<p class="final"><span>Preço final</span><strong>' + (c.preco == null ? "A combinar" : moeda(c.preco)) + "</strong></p>";
    if (c.semPreco) h += '<p class="obs">Um dos serviços tem valor combinado, então o desconto é calculado na confirmação.</p>';
    else if (c.qtd === 1 && pct && SERVICOS.length > 1) h += '<p class="obs">Adicione mais um serviço para ganhar ' + pct + "% de desconto.</p>";
    $("#comboBox").innerHTML = h;
  }
  // Botões "Agendar" da lista de preços escolhem só aquele serviço
  function escolherServico(id) {
    state.servicos = [id];
    document.querySelectorAll('#servicoOpcoes input').forEach((i) => { i.checked = i.value === id; });
    state.hora = null;
    atualizarTudo();
  }
  function alternarServico(id, marcado) {
    const i = state.servicos.indexOf(id);
    if (marcado && i < 0) state.servicos.push(id);
    if (!marcado && i >= 0) {
      state.servicos.splice(i, 1);
    }
    state.hora = null;
    atualizarTudo();
  }
  function escolherBarbeiro(id) {
    state.barbeiro = id;
    $("#barbeiro").value = id;
    atualizarTudo();
  }

  // ---- Eventos ----
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-servico]"); if (a) escolherServico(a.dataset.servico);
    const b = e.target.closest("a[data-barbeiro]"); if (b) escolherBarbeiro(b.dataset.barbeiro);
  });
  $("#servicoOpcoes").addEventListener("change", (e) => { if (e.target.name === "servico") alternarServico(e.target.value, e.target.checked); });
  $("#barbeiro").addEventListener("change", (e) => escolherBarbeiro(e.target.value));
  $("#data").addEventListener("change", (e) => {
    if (e.target.value) state.data = e.target.value;
    state.hora = null;
    atualizarTudo();
  });
  $("#horarios").addEventListener("change", (e) => {
    if (e.target.name === "hora") { state.hora = Number(e.target.value); atualizarResumo(); }
  });
  $("#nome").addEventListener("input", (e) => { state.nome = e.target.value; atualizarResumo(); });
  $("#tel").addEventListener("input", (e) => { state.tel = e.target.value; atualizarResumo(); });
  $("#form").addEventListener("submit", (e) => e.preventDefault());

  $("#enviar").addEventListener("click", (e) => {
    if (e.currentTarget.getAttribute("aria-disabled") === "true") {
      e.preventDefault();
      if (state.hora == null) { const s = document.querySelector('input[name="hora"]'); if (s) s.focus(); else $("#data").focus(); }
      else if (state.nome.trim().length < 2) $("#nome").focus();
      else $("#tel").focus();
      return;
    }
    registrarPedido();
    const av = $("#aviso");
    av.textContent = "Abrimos o WhatsApp com a mensagem pronta. Falta você enviar. Se não abrir, copie a mensagem e mande para " + zapFmt(zapDestino()) + ".";
    av.hidden = false;
  });

  $("#copiar").addEventListener("click", async () => {
    const pre = $("#previa");
    const btn = $("#copiar");
    try {
      await navigator.clipboard.writeText(pre.textContent);
      btn.textContent = "Copiado";
    } catch (err) {
      const r = document.createRange(); r.selectNodeContents(pre);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      btn.textContent = "Selecionado: copie com Ctrl+C";
    }
    setTimeout(() => { btn.textContent = "Copiar mensagem"; }, 2500);
  });

  // ---- Início ----
  textoMarca();
  renderSemana();
  renderStatus();
  renderServicos();
  renderEquipe();
  renderGaleria();
  iniciarAgenda();
  $("#campoTel").hidden = !AGENDA.ativa;
  state.data = toISO(proximoDiaAberto());
  const campoData = $("#data");
  campoData.min = toISO(new Date());
  campoData.value = state.data;
  atualizarTudo();

  window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    setTimeout(() => {
        preloader.classList.add('ocultar');
    }, 2000); 
});