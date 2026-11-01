# T2 Barbershop

Site de uma página para a T2 Barbershop, com tabela de preços, equipe, galeria de trabalhos e agendamento de horário por WhatsApp. É feito só com HTML, CSS e JavaScript, sem dependências e sem etapa de build.

## Funcionalidades

- **Agendamento em 4 passos:** serviço, barbeiro e data, horário e nome. No final, o botão abre o WhatsApp da barbearia com a mensagem do pedido já preenchida.
- **Horários que saem do ar quando confirmados:** o dono confirma pelo painel e o horário some do site (com Firebase).
- **Horários calculados automaticamente:** a lista de horários respeita o expediente de cada dia da semana, a duração do serviço escolhido e uma antecedência mínima para o mesmo dia. Horários que já passaram não aparecem.
- **Status em tempo real:** mostra "Aberto agora" ou "Fechado agora" e quando a barbearia abre de novo.
- **Tabela de preços** com valores e duração de cada serviço. Serviços sem preço fixo aparecem como "Sob consulta".
- **Galeria de trabalhos** com legenda. Se uma foto não for encontrada, o espaço mostra o nome do corte em vez de uma imagem quebrada.
- **Resumo do pedido** com o valor total e uma prévia da mensagem, com botão para copiar o texto caso o WhatsApp não abra.
- **Layout responsivo** para celular, tablet e computador, com a identidade visual da marca (preto, vermelho e prata).
- **Acessibilidade:** navegação por teclado com foco visível, rótulos para leitores de tela e animações desativadas para quem prefere menos movimento.

## Tecnologias

- HTML5 e CSS3 (grid, flexbox e variáveis CSS)
- JavaScript puro (sem frameworks)
- Fontes do Google Fonts: Big Shoulders Display, Barlow e Barlow Condensed

## Estrutura do projeto

```
.
├── index.html          # estrutura da página
├── style.css           # visual e cores
├── dados.js            # dados da barbearia: serviços, barbeiros, horários, galeria
├── script.js           # lógica do agendamento
├── firebase-config.js  # dados do projeto Firebase (agenda compartilhada)
├── admin.html          # painel do dono para confirmar e cancelar horários
├── admin.js            # lógica do painel
├── image/
│   ├── logo.jpg    # logo exibida no topo
│   └── ...         # fotos da galeria
└── README.md
```

## Como rodar localmente

Não precisa instalar nada.

1. Baixe ou clone o repositório.
2. Abra o arquivo `index.html` no navegador (dois cliques).

Para atualizar a página automaticamente enquanto edita, use a extensão **Live Server** do VS Code: clique com o botão direito em `index.html` e escolha **Open with Live Server**.

## Como configurar

Todos os dados da barbearia ficam no arquivo `dados.js`.

### Dados gerais (`CONFIG`)

| Campo | O que é |
|---|---|
| `nome` | Nome exibido no cabeçalho, no rodapé e na mensagem do WhatsApp |
| `whatsapp` | Número que recebe os agendamentos, só dígitos, com código do país e DDD (ex.: `5585999999999`) |
| `outroTelefone` | Telefone extra exibido no rodapé (deixe `""` para ocultar) |
| `instagram` | Usuário do Instagram, sem o `@` |
| `endereco` | Endereço exibido no rodapé |
| `mostrarLogo` | `true` ou `false` para mostrar a logo do topo |
| `horarios` | Expediente por dia da semana (`0` = domingo). Use `[abre, fecha]` em horas ou `null` para fechado |
| `passoMin` | Intervalo entre os horários, em minutos |
| `antecedenciaMin` | Antecedência mínima para agendar no mesmo dia, em minutos |
| `galeria` | Lista de fotos (`src` e `legenda`). Lista vazia (`[]`) oculta a seção |

### Serviços (`SERVICOS`)

```js
{ id: "degrade", nome: "Degradê", desc: "Degradê na régua.", min: 40, preco: 30 }
```

- `min` é a duração do atendimento, em minutos, e define os horários disponíveis.
- `preco: null` exibe "Sob consulta" e "a combinar" na mensagem.
- Cada `id` precisa ser único.

### Barbeiros (`BARBEIROS`)

```js
{ id: "thiago", nome: "Thiago", fn: "Corte, barba e sobrancelha." }
```

A primeira opção, "Qualquer barbeiro", deve ser mantida para quem não tem preferência.

### Fotos

Coloque as imagens na pasta `image` e liste cada uma em `galeria` com o nome exato do arquivo, incluindo a extensão. Prefira nomes em minúsculas, sem espaços nem acentos, e fotos em pé com até cerca de 500 KB.

### Cores

As cores estão no bloco `:root` no início do `style.css`:

```css
--bg: #0b0b0c;      /* fundo da página */
--red: #c8171e;     /* cor principal (botões e destaques) */
--ink: #f2f2f2;     /* texto */
```

## Como publicar

Por ser um site estático, qualquer hospedagem gratuita funciona. O arquivo principal precisa se chamar `index.html`.

- **GitHub Pages:** em **Settings > Pages**, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`.
- **Netlify Drop:** arraste a pasta do projeto para `app.netlify.com/drop`.
- **Firebase Hosting:** `firebase init hosting` seguido de `firebase deploy`.

## Como o agendamento funciona

A página monta a mensagem e abre um link `wa.me` para o número configurado. A barbearia recebe algo assim:

```
*Novo agendamento* - T2 Barbershop

*Nome:* Fulano de Tal
*Serviço:* Degradê
*Barbeiro:* Thiago
*Data:* 28/10/2026 (quarta-feira)
*Hora:* 15:00
*Valor:* R$ 30,00

Aguardo a confirmação.
```

O pedido só vale depois que a barbearia confirmar a resposta no WhatsApp.

### Agenda compartilhada (opcional, com Firebase)

Com o `firebase-config.js` preenchido, o dono confirma cada horário no painel `admin.html` (com login) e ele **some do site** para os outros clientes. O site mostra um horário só se o barbeiro escolhido estiver livre, ou, em "Qualquer barbeiro", se pelo menos um dos dois estiver livre. Serviços mais longos também respeitam o que já está marcado.

Os dados ficam em duas coleções do Firestore:

- `agendamentos`: nome, telefone, serviço, barbeiro e horário. Só o dono consegue ler e escrever.
- `pedidos`: pedidos feitos pelo site. Qualquer pessoa consegue criar (com os campos validados), só o dono lê e altera.
- `ocupados`: apenas data, barbeiro e faixa de horas. A página pública lê esta coleção, que não contém dados pessoais.

Regras do Firestore (troque `UID_DO_DONO` pelo UID do usuário criado em Authentication; para mais de um admin, coloque vários UIDs na lista):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function admin() {
      return request.auth != null && request.auth.uid in ["UID_DO_DONO"];
    }
    function texto(v, min, max) {
      return v is string && v.size() >= min && v.size() <= max;
    }

    match /ocupados/{id} {
      allow read: if true;
      allow write: if admin();
    }
    match /agendamentos/{id} {
      allow read, write: if admin();
    }
    match /pedidos/{id} {
      allow create: if request.resource.data.keys().hasOnly(['nome','telefone','servicoId','servicoNome','barbeiroId','barbeiroNome','data','inicio','fim','status','criadoEm'])
        && texto(request.resource.data.nome, 2, 60)
        && texto(request.resource.data.telefone, 12, 13)
        && texto(request.resource.data.servicoId, 1, 30)
        && texto(request.resource.data.servicoNome, 1, 60)
        && texto(request.resource.data.barbeiroId, 1, 30)
        && texto(request.resource.data.barbeiroNome, 1, 60)
        && texto(request.resource.data.data, 10, 10)
        && request.resource.data.inicio is number
        && request.resource.data.fim is number
        && request.resource.data.status == 'pendente'
        && request.resource.data.criadoEm == request.time;
      allow read, update, delete: if admin();
    }
  }
}
```

**Pedidos pelo site:** ao tocar em "Agendar pelo WhatsApp", o site também grava o pedido (com o WhatsApp do cliente) na coleção `pedidos`. No painel, a lista "Pedidos novos" aparece sozinha; **Confirmar** preenche o formulário, **Conversar** abre o WhatsApp do cliente e **Recusar** tira o pedido da lista. Depois de confirmar, o botão **Avisar cliente** manda a confirmação pelo WhatsApp.

Sem o Firebase configurado, a página funciona do mesmo jeito, mas mostra todos os horários e a barbearia confere a agenda antes de confirmar.

### Limitações atuais

- O horário só é bloqueado quando o dono o confirma no painel. Pedidos que ainda não foram confirmados não bloqueiam nada.
- O envio depende de o cliente apertar "enviar" no WhatsApp.

## Próximos passos

- Robô de WhatsApp (API oficial da Meta) para ler o pedido, conferir a agenda e confirmar o horário automaticamente.
- Bloqueio de horários no painel (almoço, folga).
- Fotos reais dos cortes e dos barbeiros.

## Contato

**T2 Barbershop**
Av. Gov. Leonel Brizola, 508
Instagram: [@t2barbershop](https://instagram.com/t2barbershop)