# 🔧 Console de Conteúdo - Backend API

Backend API para o Console de Conteúdo da VeloAcademy.

## 📁 Estrutura

```
backend/
├── server.js              # Servidor principal
├── package.json           # Dependências
├── .env                   # Variáveis de ambiente
├── vercel.json           # Configuração do Vercel
└── README.md             # Este arquivo
```

## 🚀 Como Executar

### Desenvolvimento Local
```bash
npm start
```

### Produção
```bash
npm start
```

## ⚙️ Configuração

### Variáveis de Ambiente
- `MONGODB_URI`: URI de conexão com MongoDB
- `DB_NAME`: Nome do banco de dados (padrão: console_conteudo)
- `FRONTEND_URL`: URL do frontend para CORS
- `NODE_ENV`: Ambiente (development/production)

### Exemplo de .env
```env
DB_NAME=console_conteudo
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
FRONTEND_URL=https://seu-frontend-url.com
```

## 🔧 Funcionalidades

- ✅ API REST para envio de dados
- ✅ Conexão persistente com MongoDB
- ✅ Rate limiting para proteção
- ✅ CORS configurado
- ✅ Health checks
- ✅ Logging detalhado
- ✅ Validação de dados
- ✅ Tratamento de erros

## 📡 Endpoints

### Health Check
- `GET /health` - Status da API e MongoDB

### API Principal
- `GET /` - Documentação da API
- `GET /api/test` - Teste de conexão
- `POST /api/submit` - Envio de dados
- `GET /api/data/:collection` - Busca de dados

### Exemplo de Uso

#### Enviar dados
```bash
curl -X POST https://back-console.vercel.app/api/submit \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "Artigos",
    "data": {
      "title": "Título do Artigo",
      "content": "Conteúdo do artigo",
      "category": "Categoria",
      "keywords": ["palavra1", "palavra2"]
    }
  }'
```

#### Health Check
```bash
curl https://back-console.vercel.app/health
```

## 🔒 Segurança

- **Rate Limiting**: 100 requisições por IP a cada 15 minutos
- **CORS**: Configurado apenas para o frontend
- **Helmet**: Headers de segurança
- **Validação**: Validação de entrada em todos os endpoints

## 📊 Monitoramento

- Health check endpoint para monitoramento
- Logs detalhados de todas as operações
- Métricas de performance
- Status da conexão MongoDB

## 🚀 Deploy

### Vercel
1. Conecte o repositório ao Vercel
2. Configure as variáveis de ambiente
3. Deploy automático

### Outros
- Pode ser deployado em qualquer plataforma Node.js
- Configure as variáveis de ambiente adequadamente

## 🔗 Integração com Frontend

O backend se comunica com o frontend através de:

- **CORS**: Configurado para aceitar requisições do frontend
- **JSON**: Todas as respostas são em formato JSON
- **HTTP Status Codes**: Códigos de status apropriados

## 📈 Performance

- Conexão persistente com MongoDB
- Pool de conexões configurado
- Timeout adequado para operações
- Rate limiting para proteção
