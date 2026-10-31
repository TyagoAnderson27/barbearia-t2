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
 
  const state = { servico: SERVICOS[0].id, barbeiro: "qualquer", data: null, hora: null, nome: "" };
  const svc = () => SERVICOS.find((s) => s.id === state.servico);
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
      '<label class="opt"><input class="vh" type="radio" name="servico" id="sv-' + s.id + '" value="' + s.id + '"' + (s.id === state.servico ? " checked" : "") + '>' +
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
      box.innerHTML = '<p class="note">Sem horários disponíveis neste dia. Escolha outra data.</p>';
      return;
    }
    if (lista.indexOf(state.hora) < 0) state.hora = null;
    box.innerHTML = '<div class="slots" role="radiogroup" aria-label="Horário">' + lista.map((m) =>
      '<label class="slot"><input class="vh" type="radio" name="hora" value="' + m + '"' + (m === state.hora ? " checked" : "") + "><span>" + horaFmt(m) + "</span></label>"
    ).join("") + "</div>" +
    (AGENDA.falhou[state.data] ? '<p class="fine">Não foi possível conferir os horários já ocupados agora. A barbearia confirma pelo WhatsApp.</p>' : "");
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
      "*Serviço:* " + svc().nome,
      "*Barbeiro:* " + brb().nome,
      "*Data:* " + dataLonga(),
      "*Hora:* " + horaFmt(state.hora),
      "*Valor:* " + (svc().preco == null ? "a combinar" : moeda(svc().preco)),
      "",
      "Aguardo a confirmação."
    ].join("\n");
  }
  function faltando() {
    const f = [];
    if (state.hora == null) f.push("horário");
    if (state.nome.trim().length < 2) f.push("nome");
    return f;
  }
  function atualizarResumo() {
    $("#rServ").textContent = svc().nome;
    $("#rBarb").textContent = brb().nome;
    $("#rData").textContent = dataLonga();
    $("#rHora").textContent = state.hora == null ? "Escolha" : horaFmt(state.hora);
    $("#rTotal").textContent = precoTxt(svc().preco);
 
    const f = faltando();
    const btn = $("#enviar");
    $("#aviso").hidden = true;
    if (f.length) {
      btn.setAttribute("aria-disabled", "true");
      btn.setAttribute("href", "#agendar");
      $("#falta").textContent = "Falta: " + f.join(" e ") + ".";
      $("#previa").textContent = "Escolha o horário e informe seu nome para ver a mensagem.";
    } else {
      const msg = mensagem();
      btn.removeAttribute("aria-disabled");
      btn.setAttribute("href", "https://wa.me/" + CONFIG.whatsapp.replace(/\D/g, "") + "?text=" + encodeURIComponent(msg));
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
 
  function escolherServico(id) {
    state.servico = id;
    const r = $("#sv-" + id); if (r) r.checked = true;
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
  $("#servicoOpcoes").addEventListener("change", (e) => { if (e.target.name === "servico") escolherServico(e.target.value); });
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
  $("#form").addEventListener("submit", (e) => e.preventDefault());
 
  $("#enviar").addEventListener("click", (e) => {
    if (e.currentTarget.getAttribute("aria-disabled") === "true") {
      e.preventDefault();
      if (state.hora == null) { const s = document.querySelector('input[name="hora"]'); if (s) s.focus(); else $("#data").focus(); }
      else $("#nome").focus();
      return;
    }
    const av = $("#aviso");
    av.textContent = "Abrimos o WhatsApp com a mensagem pronta. Falta você enviar. Se não abrir, copie a mensagem e mande para " + zapFmt(CONFIG.whatsapp) + ".";
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
  state.data = toISO(proximoDiaAberto());
  const campoData = $("#data");
  campoData.min = toISO(new Date());
  campoData.value = state.data;
  atualizarTudo();
 