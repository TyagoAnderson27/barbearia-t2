// ---- Dados da barbearia: edite aqui (usados pela página e pelo painel admin.html) ----
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
  // whatsapp: número do barbeiro (código do país + DDD + número, só dígitos).
  // Se o barbeiro for escolhido, o pedido vai para o número dele.
  // Deixe "" para usar o número da barbearia (CONFIG.whatsapp). "Qualquer barbeiro" sempre usa o da barbearia.
  const BARBEIROS = [
    { id: "qualquer", nome: "Qualquer barbeiro" },
    { id: "thiago", nome: "Thiago", fn: "Corte, barba e sobrancelha.", whatsapp: "558594471125" },
    { id: "thiego", nome: "Thiego", fn: "Corte, barba e sobrancelha.", whatsapp: "558596978191" }
  ];