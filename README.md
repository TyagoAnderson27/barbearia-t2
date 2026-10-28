# T2 Barbershop

Site de uma página para a T2 Barbershop, com tabela de preços, equipe, galeria de trabalhos e agendamento de horário por WhatsApp. É feito só com HTML, CSS e JavaScript, sem dependências e sem etapa de build.

## Funcionalidades

- **Agendamento em 4 passos:** serviço, barbeiro e data, horário e nome. No final, o botão abre o WhatsApp da barbearia com a mensagem do pedido já preenchida.
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
├── index.html      # estrutura da página
├── style.css       # visual e cores
├── script.js       # dados da barbearia e lógica do agendamento
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

Todos os dados da barbearia ficam no começo do `script.js`.

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

### Limitações atuais

- A página não sabe quais horários já foram ocupados por outros clientes, então dois pedidos para o mesmo horário são possíveis. A confirmação manual resolve isso.
- O envio depende de o cliente apertar "enviar" no WhatsApp.

## Próximos passos

- Robô de WhatsApp (API oficial da Meta) para ler o pedido, conferir a agenda e confirmar o horário automaticamente.
- Banco de dados compartilhado (Firebase) para a página esconder os horários já reservados.
- Fotos reais dos cortes e dos barbeiros.

## Contato

**T2 Barbershop**
Av. Gov. Leonel Brizola, 508
Instagram: [@t2barbershop](https://instagram.com/t2barbershop)
