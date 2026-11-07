// Painel do dono: confirma e cancela horários. Cada horário confirmado é gravado em:
//  - "agendamentos": dados completos do cliente (só o dono consegue ler)
//  - "ocupados": só data, barbeiro e faixa de horas (a página pública lê para esconder o horário)
(function () {
  const $ = (s) => document.querySelector(s);
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseISO = (s) => { const p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const horaFmt = (m) => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const dataLonga = (iso) => { const d = parseISO(iso); return DIAS[d.getDay()] + " (" + pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + ")"; };
  // Converte o telefone digitado em número com DDI 55; devolve "" se não parecer um celular/fixo válido
  const telZap = (t) => {
    let d = String(t || "").replace(/\D/g, "").replace(/^0+/, "");
    if (d.length === 10 || d.length === 11) d = "55" + d;
    return /^55\d{10,11}$/.test(d) ? d : "";
  };
  const telBonito = (t) => {
    let d = String(t || "").replace(/\D/g, "");
    if ((d.length === 12 || d.length === 13) && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return String(t || "");
  };
  const linkAviso = (r) => {
    const n = telZap(r.telefone);
    if (!n) return "";
    const msg = "Olá, " + r.nome + "! Seu horário na " + CONFIG.nome + " está confirmado: " +
      dataLonga(r.data) + " às " + horaFmt(r.inicio) + ", " + r.servicoNome + " com " + r.barbeiroNome + ". Te esperamos!";
    return "https://wa.me/" + n + "?text=" + encodeURIComponent(msg);
  };

  $("#marca").textContent = CONFIG.nome;
  document.title = "Agenda " + CONFIG.nome;

  if (typeof firebase === "undefined" || typeof firebaseConfig === "undefined" || !firebaseConfig.projectId) {
    $("#telaLogin").hidden = true;
    $("#avisoConfig").hidden = false;
    return;
  }
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  // Mantém o login salvo neste aparelho: o dono só digita e-mail e senha uma vez, até tocar em "Sair".
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((e) => console.warn("Persistência:", e));
  // PWA: registra o service worker também por aqui (caminho relativo, funciona no GitHub Pages)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("Service worker:", e)));
  }
  const db = firebase.firestore();

  let reservas = [];
  let pedidos = [];
  let pedidoAtual = null;
  let pararPedidos = null;
  let iniciado = false;
  const servicos = SERVICOS;
  // Pedido de combo (vários serviços): vira uma opção temporária com o tempo total do pedido (fim - início)
  let extra = null;
  const todos = () => (extra ? servicos.concat([extra]) : servicos);
  const achaServ = (id) => todos().find((x) => x.id === id);
  function montarServicos() {
    $("#servicoSel").innerHTML = todos().map((s) => '<option value="' + esc(s.id) + '">' + esc(s.nome) + " (" + s.min + " min)</option>").join("");
  }
  const barbeiros = BARBEIROS.filter((b) => b.id !== "qualquer");

  // ---- Login ----
  const msgLogin = (code) => ({
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Digite um e-mail válido.",
    "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.",
    "auth/network-request-failed": "Sem conexão com a internet."
  }[code] || "Não foi possível entrar. Tente de novo.");

  $("#formLogin").addEventListener("submit", (e) => {
    e.preventDefault();
    $("#erroLogin").textContent = "";
    auth.signInWithEmailAndPassword($("#email").value.trim(), $("#senha").value)
      .catch((err) => { $("#erroLogin").textContent = msgLogin(err.code); });
  });
  $("#sair").addEventListener("click", () => auth.signOut());

  auth.onAuthStateChanged((user) => {
    $("#telaLogin").hidden = !!user;
    $("#telaAgenda").hidden = !user;
    $("#sair").hidden = !user;
    if (user && !iniciado) { iniciado = true; iniciar(); }
    if (!user) {
      iniciado = false; $("#senha").value = "";
      if (pararPedidos) { pararPedidos(); pararPedidos = null; }
      pedidos = []; pedidoAtual = null;
    }
  });

  // ---- Agenda ----
  function iniciar() {
    montarServicos();
    $("#barbeiroSel").innerHTML = barbeiros.map((b) => '<option value="' + b.id + '">' + esc(b.nome) + "</option>").join("");
    $("#folgaBarbeiro").innerHTML = barbeiros.map((b) => '<option value="' + esc(b.id) + '">' + esc(b.nome) + "</option>").join("");
    $("#folgaData").value = toISO(new Date());
    carregarFolgas();
    $("#dia").value = toISO(new Date());
    carregarDia();
    escutarPedidos();
  }

  // ---- Pedidos feitos pelo site (atualizam sozinhos) ----
  // ---- Alerta de pedido novo (app aberto): som, vibração, aviso na tela, número no título e no ícone ----
  let vistos = new Set();
  let primeiraLeitura = true;
  let audioCtx = null;
  function destravarAudio() {   // o navegador só libera o som depois de um toque na tela
    try {
      if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) {}
  }
  ["click", "touchstart", "keydown"].forEach((ev) => document.addEventListener(ev, destravarAudio, { passive: true }));
  function tocarSom() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const t0 = audioCtx.currentTime;
    [[880, 0], [1175, 0.2], [880, 0.4], [1175, 0.6]].forEach((n) => {
      const osc = audioCtx.createOscillator(), ganho = audioCtx.createGain();
      osc.type = "sine"; osc.frequency.value = n[0];
      ganho.gain.setValueAtTime(0.0001, t0 + n[1]);
      ganho.gain.exponentialRampToValueAtTime(0.4, t0 + n[1] + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + 0.18);
      osc.connect(ganho); ganho.connect(audioCtx.destination);
      osc.start(t0 + n[1]); osc.stop(t0 + n[1] + 0.2);
    });
  }
  let timerAviso = null;
  function mostrarAviso(novos) {
    let el = $("#avisoPedido");
    if (!el) {
      el = document.createElement("button");
      el.type = "button"; el.id = "avisoPedido"; el.className = "aviso-pedido";
      el.setAttribute("role", "status");
      el.addEventListener("click", () => { el.hidden = true; $("#blocoPedidos").scrollIntoView({ behavior: "smooth", block: "start" }); });
      document.body.appendChild(el);
    }
    el.textContent = novos.length === 1 ? "Novo pedido de " + novos[0].nome + ". Toque para ver." : novos.length + " novos pedidos. Toque para ver.";
    el.hidden = false;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { el.hidden = true; }, 10000);
  }
  function alertarNovos(novos) {
    tocarSom();
    try { if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 500]); } catch (e) {}
    mostrarAviso(novos);
  }
  function atualizarIndicadores() {
    const n = pedidos.length;
    document.title = (n ? "(" + n + ") " : "") + "Agenda " + CONFIG.nome;
    try {
      if (n && navigator.setAppBadge) navigator.setAppBadge(n);
      else if (!n && navigator.clearAppBadge) navigator.clearAppBadge();
    } catch (e) {}
  }

  function escutarPedidos() {
    if (pararPedidos) pararPedidos();
    primeiraLeitura = true; vistos = new Set();
    pararPedidos = db.collection("pedidos").where("status", "==", "pendente").onSnapshot((snap) => {
      const hoje = toISO(new Date());
      pedidos = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()))
        .filter((p) => p.data >= hoje)
        .sort((a, b) => (a.data === b.data ? a.inicio - b.inicio : a.data < b.data ? -1 : 1));
      const novos = pedidos.filter((p) => !vistos.has(p.id));
      vistos = new Set(pedidos.map((p) => p.id));
      desenharPedidos();
      if (!primeiraLeitura && novos.length) alertarNovos(novos);
      primeiraLeitura = false;
    }, (err) => {
      console.warn(err);
      $("#vazioPedidos").hidden = false;
      $("#vazioPedidos").textContent = "Não foi possível ler os pedidos. Confira se as regras do Firestore têm a coleção \"pedidos\".";
    });
  }

  function desenharPedidos() {
    atualizarIndicadores();
    $("#contaPedidos").textContent = pedidos.length ? "(" + pedidos.length + ")" : "";
    $("#vazioPedidos").textContent = "Nenhum pedido novo.";
    $("#vazioPedidos").hidden = pedidos.length > 0;
    $("#listaPedidos").innerHTML = pedidos.map((p) => {
      const barb = p.barbeiroId === "qualquer" ? "qualquer barbeiro" : p.barbeiroNome;
      return '<li><div class="hora">' + horaFmt(p.inicio) + '</div>' +
        '<div class="info"><b>' + esc(p.nome) + '</b><span>' + esc(dataLonga(p.data)) + " · " + esc(p.servicoNome) + " · " + esc(barb) +
        " · " + esc(telBonito(p.telefone)) + '</span></div>' +
        '<div class="acoes">' +
        '<button type="button" class="btn btn-small btn-primary" data-pedido-confirmar="' + esc(p.id) + '">Confirmar</button>' +
        '<a class="btn btn-small" href="https://wa.me/' + esc(p.telefone) + '" target="_blank" rel="noopener">Conversar</a>' +
        '<button type="button" class="btn btn-small btn-perigo" data-pedido-recusar="' + esc(p.id) + '">Recusar</button>' +
        '</div></li>';
    }).join("");
  }

  async function usarPedido(p) {
    $("#erroForm").textContent = ""; $("#okForm").textContent = "";
    pedidoAtual = p;
    $("#nome").value = p.nome;
    $("#tel").value = telBonito(p.telefone);
    extra = p.servicoId === "combo-montado" || !servicos.some((x) => x.id === p.servicoId) ? { id: "combo-pedido", nome: "Combo: " + p.servicoNome, min: p.fim - p.inicio } : null;
    montarServicos();
    $("#servicoSel").value = extra ? extra.id : p.servicoId;
    $("#dia").value = p.data;
    await carregarDia();
    const serv = achaServ($("#servicoSel").value);
    let barbId = p.barbeiroId;
    if (barbId === "qualquer" || !barbeiros.some((b) => b.id === barbId)) {
      const livre = barbeiros.find((b) => !reservas.some((r) => r.barbeiroId === b.id && p.inicio < r.fim && p.inicio + serv.min > r.inicio));
      barbId = (livre || barbeiros[0]).id;
    }
    $("#barbeiroSel").value = barbId;
    desenharHoras();
    const opt = $("#hora").querySelector('option[value="' + p.inicio + '"]');
    const info = $("#infoPedido");
    info.hidden = false;
    info.textContent = "Pedido de " + p.nome + ": " + dataLonga(p.data) + " às " + horaFmt(p.inicio) +
      (p.barbeiroId === "qualquer" ? " (qualquer barbeiro, escolhi o primeiro livre)" : "") + ". Confira e toque em Confirmar e bloquear horário.";
    if (opt && !opt.disabled) {
      $("#hora").value = String(p.inicio);
    } else {
      $("#erroForm").textContent = "Esse horário não está livre para esse barbeiro. Escolha outro horário ou barbeiro e fale com o cliente.";
    }
    $("#formConfirmar").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#listaPedidos").addEventListener("click", async (e) => {
    const c = e.target.closest("[data-pedido-confirmar]");
    const r = e.target.closest("[data-pedido-recusar]");
    if (c) {
      const p = pedidos.find((x) => x.id === c.dataset.pedidoConfirmar);
      if (p) usarPedido(p);
    } else if (r) {
      const p = pedidos.find((x) => x.id === r.dataset.pedidoRecusar);
      if (!p || !window.confirm("Recusar o pedido de " + p.nome + "? Ele sai desta lista (o cliente não é avisado automaticamente).")) return;
      try {
        await db.collection("pedidos").doc(p.id).update({ status: "recusado" });
        if (pedidoAtual && pedidoAtual.id === p.id) { pedidoAtual = null; $("#infoPedido").hidden = true; }
      } catch (err) {
        console.warn(err);
        $("#erroForm").textContent = "Não foi possível recusar o pedido. Tente de novo.";
      }
    }
  });

  async function carregarDia() {
    const dia = $("#dia").value;
    if (!dia) return;
    try {
      const snap = await db.collection("agendamentos").where("data", "==", dia).get();
      reservas = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => a.inicio - b.inicio);
      $("#erroForm").textContent = "";
    } catch (e) {
      console.warn(e);
      reservas = [];
      $("#erroForm").textContent = "Não foi possível carregar a agenda. Confira se você está logado com o usuário do dono e se as regras do Firestore foram publicadas.";
    }
    desenharLista();
    desenharHoras();
  }

  function desenharLista() {
    $("#lista").innerHTML = reservas.map((r) => {
      if (r.tipo === "folga") {
        return '<li><div class="hora">Folga</div><div class="info"><b>' + esc(r.barbeiroNome) + '</b><span>Todos os horários suspensos neste dia</span></div>' +
          '<div class="acoes"><button type="button" class="btn btn-small" data-cancelar="' + esc(r.id) + '">Reativar horários</button></div></li>';
      }
      const link = linkAviso(r);
      const aviso = link
        ? '<a class="btn btn-small" href="' + esc(link) + '" target="_blank" rel="noopener">Avisar cliente</a>'
        : '<span class="sem-tel">Sem telefone</span>';
      return '<li><div class="hora">' + horaFmt(r.inicio) + '</div>' +
        '<div class="info"><b>' + esc(r.nome) + '</b><span>' + esc(r.servicoNome) + " · " + esc(r.barbeiroNome) + " · até " + horaFmt(r.fim) +
        (r.telefone ? " · " + esc(r.telefone) : "") + '</span></div>' +
        '<div class="acoes">' + aviso +
        '<button type="button" class="btn btn-small btn-perigo" data-cancelar="' + esc(r.id) + '">Cancelar</button></div></li>';
    }).join("");
    $("#vazioDia").hidden = reservas.length > 0;
  }

  function desenharHoras() {
    const sel = $("#hora");
    const btn = $("#btnConfirmar");
    const dia = $("#dia").value;
    if (!dia) { sel.innerHTML = ""; return; }
    const h = CONFIG.horarios[parseISO(dia).getDay()];
    if (!h) {
      sel.innerHTML = '<option value="">Fechado neste dia</option>';
      sel.disabled = true; btn.disabled = true;
      return;
    }
    sel.disabled = false; btn.disabled = false;
    const serv = achaServ($("#servicoSel").value);
    const barb = $("#barbeiroSel").value;
    const antes = sel.value;
    let opcoes = "";
    for (let m = h[0] * 60; m + serv.min <= h[1] * 60; m += CONFIG.passoMin) {
      const ocupado = reservas.some((r) => r.barbeiroId === barb && m < r.fim && m + serv.min > r.inicio);
      opcoes += '<option value="' + m + '"' + (ocupado ? " disabled" : "") + ">" + horaFmt(m) + (ocupado ? " (ocupado)" : "") + "</option>";
    }
    sel.innerHTML = opcoes || '<option value="">Sem horários</option>';
    if (antes && !sel.querySelector('option[value="' + antes + '"][disabled]')) sel.value = antes;
    else { const livre = sel.querySelector("option:not([disabled])"); if (livre) sel.value = livre.value; }
  }

  $("#dia").addEventListener("change", carregarDia);
  $("#hoje").addEventListener("click", () => { $("#dia").value = toISO(new Date()); carregarDia(); });
  $("#servicoSel").addEventListener("change", desenharHoras);
  $("#barbeiroSel").addEventListener("change", desenharHoras);

  // ---- Confirmar ----
  $("#formConfirmar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = $("#erroForm"), ok = $("#okForm");
    erro.textContent = ""; ok.textContent = "";
    const nome = $("#nome").value.trim();
    const dia = $("#dia").value;
    const serv = achaServ($("#servicoSel").value);
    const barb = barbeiros.find((b) => b.id === $("#barbeiroSel").value);
    const inicio = Number($("#hora").value);
    if (nome.length < 2) { erro.textContent = "Digite o nome do cliente."; $("#nome").focus(); return; }
    if (!dia || !$("#hora").value || Number.isNaN(inicio)) { erro.textContent = "Escolha o dia e o horário."; return; }
    const fim = inicio + serv.min;
    if (reservas.some((r) => r.barbeiroId === barb.id && inicio < r.fim && fim > r.inicio)) {
      erro.textContent = "Esse barbeiro já tem um horário que bate com esse.";
      return;
    }
    const ref = db.collection("agendamentos").doc();
    const lote = db.batch();
    lote.set(ref, {
      nome: nome, telefone: $("#tel").value.trim(),
      servicoId: serv.id === "combo-pedido" ? "combo-montado" : serv.id, servicoNome: serv.id === "combo-pedido" ? serv.nome.replace(/^Combo: /, "") : serv.nome,
      barbeiroId: barb.id, barbeiroNome: barb.nome,
      data: dia, inicio: inicio, fim: fim,
      criadoEm: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : null
    });
    lote.set(db.collection("ocupados").doc(ref.id), { data: dia, barbeiro: barb.id, inicio: inicio, fim: fim });
    const doPedido = pedidoAtual && pedidoAtual.nome.trim() === nome ? pedidoAtual : null;
    if (doPedido) lote.update(db.collection("pedidos").doc(doPedido.id), { status: "confirmado" });
    try {
      await lote.commit();
      if (doPedido) { pedidoAtual = null; $("#infoPedido").hidden = true; }
      if (extra) { extra = null; montarServicos(); desenharHoras(); }
      ok.textContent = "Confirmado: " + nome + ", " + horaFmt(inicio) + ". O horário já saiu do site." +
        (telZap($("#tel").value) ? " Use \"Avisar cliente\" na lista para mandar a confirmação no WhatsApp." : " Sem telefone, não dá para avisar pelo WhatsApp.");
      $("#nome").value = ""; $("#tel").value = "";
      await carregarDia();
    } catch (err) {
      console.warn(err);
      erro.textContent = "Não foi possível salvar. Confira a internet e as regras do Firestore.";
    }
  });

  // ---- Cancelar ----
  $("#lista").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-cancelar]");
    if (!b) return;
    const r = reservas.find((x) => x.id === b.dataset.cancelar);
    if (!r || !window.confirm(r.tipo === "folga" ? "Reativar os horários de " + r.barbeiroNome + " neste dia?" : "Cancelar o horário de " + r.nome + " às " + horaFmt(r.inicio) + "? Ele volta a aparecer livre no site.")) return;
    try {
      const lote = db.batch();
      lote.delete(db.collection("agendamentos").doc(r.id));
      lote.delete(db.collection("ocupados").doc(r.id));
      await lote.commit();
      $("#okForm").textContent = r.tipo === "folga" ? "Horários do barbeiro reativados." : "Horário cancelado e liberado no site.";
      if (r.tipo === "folga") carregarFolgas();
      $("#erroForm").textContent = "";
      await carregarDia();
    } catch (err) {
      console.warn(err);
      $("#erroForm").textContent = "Não foi possível cancelar. Tente de novo.";
    }
  });
  // ---- Folga do barbeiro: suspende todos os horários dele no dia (a barbearia continua aberta) ----
  // Grava um "ocupados" de dia inteiro (00:00 às 24:00) para aquele barbeiro. O site já esconde os horários dele.
  let folgas = [];
  async function carregarFolgas() {
    try {
      const snap = await db.collection("agendamentos").where("tipo", "==", "folga").get();
      const hoje = toISO(new Date());
      folgas = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).filter((f) => f.data >= hoje)
        .sort((x, y) => (x.data === y.data ? (x.barbeiroNome < y.barbeiroNome ? -1 : 1) : x.data < y.data ? -1 : 1));
    } catch (e) { console.warn(e); folgas = []; }
    desenharFolgas();
  }
  function desenharFolgas() {
    $("#vazioFolgas").hidden = folgas.length > 0;
    $("#listaFolgas").innerHTML = folgas.map((f) => {
      const d = parseISO(f.data);
      return '<li><div class="hora">' + pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + '</div>' +
        '<div class="info"><b>' + esc(f.barbeiroNome) + '</b><span>' + esc(dataLonga(f.data)) + ' · dia inteiro</span></div>' +
        '<div class="acoes"><button type="button" class="btn btn-small" data-folga-reativar="' + esc(f.id) + '">Reativar horários</button></div></li>';
    }).join("");
  }
  $("#formFolga").addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = $("#erroFolga"), ok = $("#okFolga");
    erro.textContent = ""; ok.textContent = "";
    const barb = barbeiros.find((b) => b.id === $("#folgaBarbeiro").value);
    const de = $("#folgaData").value;
    const ate = $("#folgaAte").value || de;
    if (!barb || !de) { erro.textContent = "Escolha o barbeiro e o dia."; return; }
    if (ate < de) { erro.textContent = "A data final precisa ser igual ou depois da inicial."; return; }
    const dias = [];
    for (let d = parseISO(de); toISO(d) <= ate && dias.length <= 60; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      if (CONFIG.horarios[d.getDay()]) dias.push(toISO(d));   // pula os dias em que a barbearia fecha
    }
    if (dias.length > 60) { erro.textContent = "Escolha no máximo 60 dias de uma vez."; return; }
    if (!dias.length) { erro.textContent = "A barbearia fecha em todos esses dias, não precisa suspender."; return; }
    const btn = $("#btnFolga");
    btn.disabled = true;
    try {
      // avisa se o barbeiro já tem cliente marcado nesses dias (os clientes continuam marcados)
      let marcados = 0;
      for (const dia of dias) {
        const snap = await db.collection("agendamentos").where("data", "==", dia).get();
        marcados += snap.docs.filter((d) => { const x = d.data(); return x.tipo !== "folga" && x.barbeiroId === barb.id; }).length;
      }
      if (marcados && !window.confirm(barb.nome + " já tem " + marcados + " cliente(s) marcado(s) nesse período. Eles continuam marcados e você precisa avisá-los. Suspender os horários mesmo assim?")) return;
      const lote = db.batch();
      dias.forEach((dia) => {
        const id = "folga_" + barb.id + "_" + dia;
        lote.set(db.collection("agendamentos").doc(id), {
          tipo: "folga", nome: "", telefone: "", servicoId: "", servicoNome: "",
          barbeiroId: barb.id, barbeiroNome: barb.nome, data: dia, inicio: 0, fim: 1440,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        lote.set(db.collection("ocupados").doc(id), { data: dia, barbeiro: barb.id, inicio: 0, fim: 1440 });
      });
      await lote.commit();
      ok.textContent = barb.nome + ": horários suspensos em " + dias.length + " dia(s). Eles já sumiram do site.";
      $("#folgaAte").value = "";
      await Promise.all([carregarFolgas(), carregarDia()]);
    } catch (err) {
      console.warn(err);
      erro.textContent = "Não foi possível suspender. Confira a internet e as regras do Firestore.";
    } finally {
      btn.disabled = false;
    }
  });
  $("#listaFolgas").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-folga-reativar]");
    if (!b) return;
    const f = folgas.find((x) => x.id === b.dataset.folgaReativar);
    if (!f || !window.confirm("Reativar os horários de " + f.barbeiroNome + " em " + dataLonga(f.data) + "? Eles voltam a aparecer no site.")) return;
    try {
      const lote = db.batch();
      lote.delete(db.collection("agendamentos").doc(f.id));
      lote.delete(db.collection("ocupados").doc(f.id));
      await lote.commit();
      $("#okFolga").textContent = "Horários de " + f.barbeiroNome + " reativados."; $("#erroFolga").textContent = "";
      await Promise.all([carregarFolgas(), carregarDia()]);
    } catch (err) {
      console.warn(err);
      $("#erroFolga").textContent = "Não foi possível reativar. Tente de novo.";
    }
  });
})();
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    setTimeout(() => {
        preloader.classList.add('ocultar');
    }, 1500); 
});