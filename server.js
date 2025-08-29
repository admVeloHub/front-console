require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3002;

// Configurações
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'console_conteudo';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://front-console.vercel.app';

// Middleware de segurança
app.use(helmet());

// CORS configurado para o frontend
app.use(cors({
    origin: [
        FRONTEND_URL,
        'https://front-console.vercel.app',
        'https://back-console.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limite por IP
    message: {
        error: 'Muitas requisições. Tente novamente em 15 minutos.'
    }
});
app.use('/api/', limiter);

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));

// Variáveis globais para conexão persistente
let mongoClient = null;
let mongoDb = null;

// Função para conectar ao MongoDB (conexão persistente)
async function connectDB() {
    try {
        if (!mongoClient) {
            console.log('🔗 Iniciando conexão MongoDB...');
            mongoClient = new MongoClient(MONGODB_URI, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            await mongoClient.connect();
            mongoDb = mongoClient.db(DB_NAME);
            console.log('✅ MongoDB conectado (conexão persistente)');
        }
        return { client: mongoClient, db: mongoDb };
    } catch (error) {
        console.error('❌ Erro MongoDB:', error);
        mongoClient = null;
        mongoDb = null;
        throw error;
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        mongodb: mongoClient ? 'connected' : 'disconnected'
    });
});

// Middleware para servir arquivos estáticos
app.use(express.static('public'));

// Rota raiz - servir página de status do backend
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/backend-status.html');
});

// API - Inserir dados
app.post('/api/submit', async (req, res) => {
    try {
        console.log('📥 Recebendo requisição POST /api/submit');
        console.log('📋 Body da requisição:', JSON.stringify(req.body, null, 2));
        
        const { collection, data } = req.body;
        
        if (!collection || !data) {
            console.log('❌ Dados obrigatórios não fornecidos');
            return res.status(400).json({ success: false, message: 'Dados obrigatórios não fornecidos' });
        }

        console.log('🔗 Usando conexão MongoDB persistente...');
        // Usar conexão persistente
        const { db } = await connectDB();

        console.log(`📊 Inserindo na coleção: ${collection}`);
        const collectionObj = db.collection(collection);
        const result = await collectionObj.insertOne({
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log('✅ Dados inseridos com sucesso. ID:', result.insertedId);
        stats.successfulRequests++;
        res.json({ success: true, id: result.insertedId });
    } catch (error) {
        console.error('❌ Erro ao inserir:', error);
        stats.errorRequests++;
        res.status(500).json({ success: false, message: 'Erro interno: ' + error.message });
    }
});

// API - Buscar dados
app.get('/api/data/:collection', async (req, res) => {
    try {
        const { collection } = req.params;
        
        // Usar conexão persistente
        const { db } = await connectDB();

        const collectionObj = db.collection(collection);
        const data = await collectionObj.find({}).toArray();
        stats.successfulRequests++;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Erro ao buscar:', error);
        stats.errorRequests++;
        res.status(500).json({ success: false, message: 'Erro interno: ' + error.message });
    }
});

// Rota de teste para verificar se a API está funcionando
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API funcionando!',
        timestamp: new Date().toISOString(),
        env: {
            hasMongoUri: !!MONGODB_URI,
            dbName: DB_NAME,
            nodeEnv: process.env.NODE_ENV
        }
    });
});

// Estatísticas em tempo real
let stats = {
    totalRequests: 0,
    successfulRequests: 0,
    errorRequests: 0,
    startTime: new Date()
};

// Middleware para contar requisições
app.use((req, res, next) => {
    stats.totalRequests++;
    next();
});

// Endpoint para estatísticas
app.get('/api/stats', (req, res) => {
    const uptime = Date.now() - stats.startTime.getTime();
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);
    
    res.json({
        totalRequests: stats.totalRequests,
        successfulRequests: stats.successfulRequests,
        errorRequests: stats.errorRequests,
        uptime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        mongodb: mongoClient ? 'connected' : 'disconnected'
    });
});

// Função para fechar conexão MongoDB
async function closeDB() {
    if (mongoClient) {
        console.log('🔌 Fechando conexão MongoDB...');
        await mongoClient.close();
        mongoClient = null;
        mongoDb = null;
    }
}

// Inicialização
if (process.env.NODE_ENV !== 'production') {
    // Apenas para desenvolvimento local
    connectDB().then(() => {
        const server = app.listen(PORT, () => {
            console.log(`🚀 Servidor rodando na porta ${PORT}`);
        });
        
        // Fechar conexão quando o servidor for encerrado
        process.on('SIGINT', async () => {
            console.log('\n🛑 Encerrando servidor...');
            await closeDB();
            server.close(() => {
                console.log('✅ Servidor encerrado');
                process.exit(0);
            });
        });
    });
} else {
    // Para produção (Vercel) - não usar app.listen()
    console.log('🚀 Servidor pronto para produção (Vercel)');
    
    // Fechar conexão quando o servidor for encerrado
    process.on('SIGINT', async () => {
        console.log('\n🛑 Encerrando servidor...');
        await closeDB();
        process.exit(0);
    });
}

// Exportar app para o Vercel
module.exports = app;
