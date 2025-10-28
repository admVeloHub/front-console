# 🚀 Setup para Desenvolvimento Local - Console de Conteúdo VeloHub

## 📋 Configuração Rápida

### 1. **Criar arquivo .env**
```bash
# Copiar o arquivo de exemplo
cp env.local.example .env
```

### 2. **Configuração do .env**
O arquivo `.env` será criado com as seguintes configurações:

```bash
# URL da API Backend (Produção)
REACT_APP_API_URL=https://back-console.vercel.app/api

# Modo de Desenvolvimento
REACT_APP_DEV_MODE=true

# Google OAuth (opcional)
# REACT_APP_GOOGLE_CLIENT_ID=seu_google_client_id_aqui
```

### 3. **Executar o projeto**
```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm start
```

## 🔧 Configurações Disponíveis

### **Frontend (React)**
- **REACT_APP_API_URL**: URL da API backend
- **REACT_APP_DEV_MODE**: Ativar logs de debug
- **REACT_APP_GOOGLE_CLIENT_ID**: Para login com Google (opcional)

### **Backend (se rodando localmente)**
- **PORT**: Porta do servidor (padrão: 3001)
- **NODE_ENV**: Ambiente (development/production)
- **MONGODB_URI**: String de conexão MongoDB
- **CORS_ORIGIN**: Origem permitida para CORS

## 🌐 URLs de Acesso

### **Desenvolvimento Local**
- **Frontend**: http://localhost:3000
- **API**: https://back-console.vercel.app/api (produção)

### **Produção**
- **Frontend**: https://front-console.vercel.app
- **API**: https://back-console.vercel.app/api

## ⚙️ Configurações Específicas

### **Para usar API de Produção (Recomendado)**
```bash
REACT_APP_API_URL=https://back-console.vercel.app/api
REACT_APP_DEV_MODE=true
```

### **Para usar Backend Local**
```bash
REACT_APP_API_URL=http://localhost:3001/api
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/database
CORS_ORIGIN=http://localhost:3000
```

## 🔒 Segurança

- ✅ Arquivo `.env` está no `.gitignore`
- ✅ Variáveis sensíveis não serão commitadas
- ✅ Template disponível em `env.local.example`
- ✅ Configurações de produção separadas

## 🐛 Debug e Troubleshooting

### **Logs de Debug**
Com `REACT_APP_DEV_MODE=true`, você verá:
- Logs detalhados da API
- Informações de carregamento
- Erros de validação
- Dados de resposta

### **Verificar Configuração**
```javascript
// No console do navegador
console.log('API URL:', process.env.REACT_APP_API_URL);
console.log('Dev Mode:', process.env.REACT_APP_DEV_MODE);
```

## 📝 Próximos Passos

1. **Copie** `env.local.example` para `.env`
2. **Configure** as variáveis conforme necessário
3. **Execute** `npm start`
4. **Acesse** http://localhost:3000
5. **Teste** a aba "Localizar Notícias" do VeloNews

---

**Versão:** 1.0.0  
**Data:** 2024-12-19  
**Autor:** VeloHub Development Team
