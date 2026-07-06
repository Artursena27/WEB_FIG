# 🤖 Bot de Figurinhas do WhatsApp (Meta Cloud API)

Bot que recebe **imagem, GIF ou vídeo** por chat e devolve como **figurinha de verdade**
(`type: sticker`). Arquitetura stateless por webhook — sem QR, sem sessão, sem conexão
aberta. Feito para consumir o mínimo de memória no Railway.

## Como funciona

1. Envie `/fig` para o número do bot.
2. Mande uma imagem, GIF ou vídeo.
3. Imagem/GIF → figurinha na hora. Vídeo → escolha "inteiro" ou "recorte exato" (`inicio duracao`, ex: `3 5`).
4. Receba a figurinha. ✨

## Setup na Meta (manual, uma vez só)

1. Acesse [developers.facebook.com](https://developers.facebook.com) → **Criar App** → tipo **Business**.
2. No app, adicione o produto **WhatsApp**. A Meta fornece um **número de teste grátis**
   (ou cadastre seu número dedicado).
3. Anote em **WhatsApp → API Setup**:
   - **Phone Number ID** → var `PHONE_NUMBER_ID`
   - **Access Token** → var `WHATSAPP_TOKEN` (gere um token permanente via System User para produção)
4. Em **WhatsApp → Configuration → Webhook**:
   - **Callback URL**: `https://<seu-app>.up.railway.app/webhook`
   - **Verify token**: a mesma string que você definir na var `VERIFY_TOKEN`
   - Clique **Verify and save** e assine o campo **`messages`**.
5. (Recomendado) Em **App Settings → Basic**, copie o **App Secret** → var `APP_SECRET`
   (valida a assinatura dos webhooks).

> 💰 **Custo**: conversas iniciadas pelo usuário (ele manda mensagem, você responde em até 24h)
> são gratuitas. Este bot só responde — nunca inicia conversa — então o uso é grátis.
> No número de teste, adicione os destinatários permitidos no painel.

## Variáveis de ambiente (Railway → Variables)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `WHATSAPP_TOKEN` | ✅ | Access token da Cloud API |
| `PHONE_NUMBER_ID` | ✅ | ID do número no painel da Meta |
| `VERIFY_TOKEN` | ✅ | String qualquer, igual à usada no cadastro do webhook |
| `APP_SECRET` | recomendada | App Secret para validar assinatura do webhook |
| `GRAPH_API_VERSION` | não | Default `v21.0` |
| `PORT` | não | Railway injeta automaticamente |

## Deploy no Railway

1. Conecte este repositório num serviço Node.
2. Configure as variáveis acima.
3. Deploy — o `npm start` da raiz sobe o webhook (`/health` disponível para healthcheck).
4. Cadastre a URL pública no webhook da Meta (passo 4 do setup).

## Rodar local (para desenvolvimento)

```bash
npm --prefix backend install
WHATSAPP_TOKEN=... PHONE_NUMBER_ID=... VERIFY_TOKEN=qualquercoisa npm start
# exponha com um túnel (ex: cloudflared/ngrok) para receber o webhook da Meta
```

## Limites de figurinha (aplicados automaticamente)

- WebP 512x512, fundo transparente nas bordas.
- Estática < 100KB; animada < 500KB (o bot recomprime até caber).
- Vídeo: máx. 10 segundos, com recorte opcional.
