# Radar de Rotas

Serviço web único para Render: monitora grupos da conta WhatsApp conectada, usa o GPS enviado pelo painel no celular e responde `eu` a mensagens de empresas cadastradas dentro do raio configurado. O painel recebe alerta sonoro e vibração em tempo real.

## Render

Envie a pasta para um repositório GitHub privado. Na Render, use **New > Blueprint** e conecte o repositório — o arquivo `render.yaml` configura o serviço.

Use um plano que ofereça **Persistent Disk**. O plano gratuito não possui disco persistente; sem ele, a sessão WhatsApp pode pedir novo QR Code após reinício.

## Aviso

Baileys é uma integração não oficial do WhatsApp e seu uso pode contrariar os termos da plataforma ou restringir uma conta. Use apenas conta e grupos autorizados, preferencialmente uma conta secundária. Eventos de digitação não são garantidos; o sistema também avalia a mensagem que chega como fallback.
