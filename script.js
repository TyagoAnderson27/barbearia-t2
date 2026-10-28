// ---- Configuração: troque os dados abaixo pelos da barbearia ----
const CONFIG = {
  nome: "T2 Barbershop",
  whatsapp: "5585994471125",           // código do país + DDD + número, só dígitos
  outroTelefone: "(85) 99244-8611",
  instagram: "t2barbershop",
  mostrarLogo: true,                   // false esconde a logo do topo (arquivo: image/logo.jpg)
  endereco: "Av. Gov. Leonel Brizola, 508",
  // dia da semana (0 = domingo): [abre, fecha] em horas, ou null se fechado
  horarios: { 0: null, 1: [9, 20], 2: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 20], 6: [9, 18] },
  // Fotos dos trabalhos: use a pasta "image" ao lado deste arquivo e
  // coloque as fotos lá. Em "src" vai o caminho; em "legenda", o nome do corte.
  // Para tirar a galeria, deixe a lista vazia: galeria: []
  galeria: [
    { src: "image/corte-1.jpg", legenda: "Degradê navalhado" },
    { src: "image/corte-2.jpg", legenda: "Corte clássico" },
    { src: "image/barba-1.jpg", legenda: "Barba na toalha quente" },
    { src: "image/corte-3.jpg", legenda: "Corte + barba" },
    { src: "image/corte-4.jpg", legenda: "Pigmentação" },
    { src: "image/corte-5.jpg", legenda: "Social na tesoura" }
  ],
  passoMin: 30,          // intervalo entre horários
  antecedenciaMin: 30    // antecedência mínima para agendar no mesmo dia
};
// preco: null mostra "Sob consulta". min é o tempo estimado de cada atendimento.
const SERVICOS = [
  { id: "social",  nome: "Social",           desc: "Corte social na tesoura ou máquina.",           min: 30, preco: 25 },
  { id: "degrade", nome: "Degradê",          desc: "Degradê na régua.",                             min: 40, preco: 30 },
  { id: "navalha", nome: "Navalhado",        desc: "Corte com acabamento na navalha.",              min: 45, preco: 35 },
  { id: "sobr",    nome: "Sobrancelha",      desc: "Limpeza e alinhamento.",                        min: 15, preco: 15 },
  { id: "infantil",nome: "Infantil",         desc: "Corte para crianças.",                          min: 30, preco: 30 },
  { id: "barba",   nome: "Barba",            desc: "Barba alinhada na navalha.",                    min: 30, preco: 20 },
  { id: "terapia", nome: "Barba terapia",    desc: "Toalha quente, esfoliação e hidratação.",       min: 45, preco: 40 },
  { id: "pigm",    nome: "Pigmentação",      desc: "Preenche falhas e realça o desenho.",           min: 30, preco: 40 },
  { id: "tintura", nome: "Tintura",          desc: "Coloração do cabelo ou da barba.",              min: 60, preco: 50 },
  { id: "luzes",   nome: "Luzes",            desc: "Valor combinado conforme o cabelo.",            min: 90, preco: null },
  { id: "combo",   nome: "Combo",            desc: "Cabelo, barba e sobrancelha no mesmo atendimento.", min: 75, preco: 60 }
];

  const BARBEIROS = [
  { id: "qualquer", nome: "Qualquer barbeiro" },
  { id: "thiago", nome: "Thiago", fn: "Corte, barba e sobrancelha." },
  { id: "thiego", nome: "Thiego", fn: "Corte, barba e sobrancelha." }
];

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
  const lista = slotsDoDia(dia, svc().min);
  if (!lista.length) {
    state.hora = null;
    box.innerHTML = '<p class="note">Sem horários disponíveis neste dia. Escolha outra data.</p>';
    return;
  }
  if (lista.indexOf(state.hora) < 0) state.hora = null;
  box.innerHTML = '<div class="slots" role="radiogroup" aria-label="Horário">' + lista.map((m) =>
    '<label class="slot"><input class="vh" type="radio" name="hora" value="' + m + '"' + (m === state.hora ? " checked" : "") + "><span>" + horaFmt(m) + "</span></label>"
  ).join("") + "</div>";
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
function atualizarTudo() { renderSlots(); atualizarResumo(); }

function escolherServico(id) {
  state.servico = id;
  const r = $("#sv-" + id); if (r) r.checked = true;
  atualizarTudo();
}
function escolherBarbeiro(id) {
  state.barbeiro = id;
  $("#barbeiro").value = id;
  atualizarResumo();
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
state.data = toISO(proximoDiaAberto());
const campoData = $("#data");
campoData.min = toISO(new Date());
campoData.value = state.data;
atualizarTudo();