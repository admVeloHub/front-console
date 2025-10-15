// VERSION: v3.0.0 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team

// Configuração da API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://back-console.vercel.app/api';

// Import do novo endpoint FAQ
import { faqBotAPI } from './api';

class BotAnalisesService {
  constructor() {
    this.apiBaseUrl = API_BASE_URL;
    
    // Cache inteligente com escopo de módulo
    this.cache = {
      dados: null,
      periodoCache: null,
      exibicaoCache: null,
      timestamp: null,
      isActive: false // Indica se o módulo está ativo
    };
    
    // Períodos que usam cache (≤ 30 dias)
    this.periodosCache = ['1dia', '7dias', '30dias'];
    
    // Cache para cálculos pesados
    this.calculosCache = new Map();
    this.calculosCacheTimeout = 2 * 60 * 1000; // 2 minutos
    
    // Sistema de retry
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 segundo base
    
    // Métricas de performance
    this.metricasPerformance = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      avgResponseTime: 0
    };
    
    // Sistema de agendamento diário
    this.agendamentoAtivo = false;
    this.intervaloAgendamento = null;
    
    // Inicializar agendamento automático
    this.inicializarAgendamentoDiario();
  }

  // Ativar cache quando entrar no módulo Bot Análises
  ativarCache() {
    this.cache.isActive = true;
    // Log removido - muito verboso
  }

  // Limpar cache quando sair do módulo Bot Análises
  limparCache() {
    this.cache = {
      dados: null,
      periodoCache: null,
      exibicaoCache: null,
      timestamp: null,
      isActive: false
    };
    // Log removido - muito verboso
  }

  // Verificar se pode usar cache
  podeUsarCache(periodo) {
    if (!this.cache.isActive || !this.cache.dados) return false;
    
    // Cache válido apenas para períodos <= 30 dias
    const periodosComCache = ['1dia', '7dias', '30dias'];
    if (!periodosComCache.includes(periodo)) return false;
    
    const agora = Date.now();
    const tempoDecorrido = agora - this.cache.timestamp;
    const CACHE_VALIDO = 5 * 60 * 1000; // 5 minutos
    
    return tempoDecorrido < CACHE_VALIDO && this.cache.periodoCache === periodo;
  }

  // Filtrar dados do cache
  filtrarCache(periodo, exibicao) {
    if (!this.cache.dados) return null;

    // Log removido - muito verboso para uso frequente de cache
    
    // Simular filtro local (os dados já vêm processados do backend)
    // O backend retorna dados de 90 dias, então filtros menores são aplicados localmente
    return this.cache.dados;
  }

  // Buscar novos dados (períodos > 90 dias) com retry
  async buscarNovosDados(periodo, exibicao) {
    try {
      // Chamar APENAS /metricas-gerais (retorna tudo)
      const response = await this.makeRequestWithRetry('/bot-analises/metricas-gerais', {
        params: { periodo }
      });

      // Validar resposta
      if (!response.success || !response.data) {
        throw new Error('Resposta inválida do backend');
      }

      console.log('✅ Dados recebidos do backend:', {
        success: response.success,
        totalRegistros: response.data.resumo?.totalRegistros || 0,
        totalAtividades: response.data.dadosBrutos?.atividades?.length || 0
      });

      // Extrair dados
      const { resumo, metadados, dadosBrutos } = response.data;
      const atividades = dadosBrutos?.atividades || [];

      // Montar métricas dos cards usando resumo e metadados
      const metricasGerais = {
        totalPerguntas: resumo.totalRegistros || 0,
        usuariosAtivos: resumo.totalUsuarios || 0,
        horarioPico: this.extrairHorarioPico(metadados.horariosPico),
        crescimento: metadados.crescimento || { percentual: 0, positivo: true },
        mediaDiaria: this.calcularMediaDiaria(resumo.totalRegistros, this.obterDiasDoPeriodo(periodo))
      };

      // Calcular dados processados no frontend a partir de dadosBrutos
      const dadosProcessados = {
        metricasGerais,
        dadosGrafico: this.calcularDadosGrafico(atividades, exibicao),
        perguntasFrequentes: this.calcularPerguntasFrequentes(atividades),
        rankingAgentes: this.calcularRankingAgentes(atividades),
        listaAtividades: this.calcularListaAtividades(atividades)
      };

      console.log('📊 Dados processados:', {
        metricas: dadosProcessados.metricasGerais,
        grafico: Object.keys(dadosProcessados.dadosGrafico.totalUso).length + ' períodos',
        perguntas: dadosProcessados.perguntasFrequentes.length + ' itens',
        ranking: dadosProcessados.rankingAgentes.length + ' agentes',
        atividades: dadosProcessados.listaAtividades.length + ' atividades'
      });

      // Atualizar cache se for período de 30 dias ou menor
      if (this.periodosCache.includes(periodo)) {
        this.cache.dados = dadosProcessados;
        this.cache.periodoCache = periodo;
        this.cache.exibicaoCache = exibicao;
        this.cache.timestamp = Date.now();
      }

      return dadosProcessados;
    } catch (error) {
      console.error('❌ Erro ao buscar dados:', error);
      throw error;
    }
  }

  // Método auxiliar para extrair horário pico
  extrairHorarioPico(horariosPico) {
    if (!horariosPico || !Array.isArray(horariosPico) || horariosPico.length === 0) {
      return '00:00-01:00';
    }
    
    // Backend já retorna array de horários, pegar o mais frequente
    const horarioMaisFrequente = horariosPico[0];
    
    if (typeof horarioMaisFrequente === 'string') {
      return horarioMaisFrequente;
    }
    
    if (typeof horarioMaisFrequente === 'number') {
      const inicio = horarioMaisFrequente.toString().padStart(2, '0');
      const fim = (horarioMaisFrequente + 1).toString().padStart(2, '0');
      return `${inicio}:00-${fim}:00`;
    }
    
    return '00:00-01:00';
  }

  // Calcular dados do gráfico a partir das atividades
  calcularDadosGrafico(atividades, exibicao) {
    // Filtrar apenas perguntas
    const perguntas = atividades.filter(item => item.action === 'question_asked');

    // Agrupar por período baseado na exibição
    const totalUso = {};
    
    perguntas.forEach(item => {
      const data = new Date(item.timestamp);
      let chave;

      switch (exibicao) {
        case 'dia':
          chave = data.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'semana':
          const inicioSemana = new Date(data);
          inicioSemana.setDate(data.getDate() - data.getDay());
          chave = inicioSemana.toISOString().split('T')[0];
          break;
        case 'mes':
          chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          chave = data.toISOString().split('T')[0];
      }

      totalUso[chave] = (totalUso[chave] || 0) + 1;
    });

    return {
      totalUso,
      feedbacksPositivos: {}, // Não usado nesta aba ainda
      feedbacksNegativos: {}  // Não usado nesta aba ainda
    };
  }

  // Calcular perguntas frequentes a partir das atividades
  calcularPerguntasFrequentes(atividades) {
    // Filtrar e normalizar perguntas
    const perguntas = atividades
      .filter(item => {
        const question = item.details?.question;
        return item.action === 'question_asked' && 
               question && 
               !question.includes('@velotax.com.br') &&
               question.trim().length > 0;
      })
      .map(item => {
        let pergunta = item.details.question.toLowerCase().trim();
        pergunta = pergunta.replace(/[.!?]+$/, '');
        return pergunta;
      });

    // Contar frequência
    const frequencia = {};
    perguntas.forEach(pergunta => {
      frequencia[pergunta] = (frequencia[pergunta] || 0) + 1;
    });

    // Ordenar e pegar top 10
    const topPerguntas = Object.entries(frequencia)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    return topPerguntas.map(([pergunta, count]) => ({
      name: pergunta.length > 30 ? pergunta.substring(0, 30) + '...' : pergunta,
      value: count
    }));
  }

  // Calcular ranking de agentes a partir das atividades
  calcularRankingAgentes(atividades) {
    // Agrupar por usuário
    const atividadePorUsuario = {};
    
    atividades.forEach(item => {
      if (item.userId && item.userId.includes('@velotax.com.br')) {
        if (!atividadePorUsuario[item.userId]) {
          atividadePorUsuario[item.userId] = {
            nome: this.getNomeUsuario(item.userId),
            perguntas: 0,
            sessoes: new Set()
          };
        }
        
        if (item.action === 'question_asked') {
          atividadePorUsuario[item.userId].perguntas++;
        }
        
        if (item.sessionId) {
          atividadePorUsuario[item.userId].sessoes.add(item.sessionId);
        }
      }
    });

    // Calcular score e ordenar
    const ranking = Object.entries(atividadePorUsuario)
      .map(([userId, data]) => ({
        name: data.nome,
        perguntas: data.perguntas,
        sessoes: data.sessoes.size,
        score: data.perguntas + (data.sessoes.size * 0.5)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10

    return ranking;
  }

  // Método auxiliar para extrair nome do usuário do email
  getNomeUsuario(email) {
    if (!email) return 'Desconhecido';
    
    // Extrair nome do email
    const nome = email.split('@')[0];
    
    // Capitalizar cada palavra
    return nome.split(/[._-]/)
      .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase())
      .join(' ');
  }

  // Calcular lista de atividades a partir das atividades
  calcularListaAtividades(atividades) {
    // Processar atividades recentes
    const lista = atividades
      .filter(item => 
        item.action === 'question_asked' && 
        item.details?.question && 
        !item.details.question.includes('@velotax.com.br')
      )
      .map(item => ({
        usuario: this.getNomeUsuario(item.userId),
        pergunta: item.details.question.length > 60 
          ? item.details.question.substring(0, 60) + '...' 
          : item.details.question,
        data: new Date(item.timestamp).toLocaleDateString('pt-BR'),
        horario: new Date(item.timestamp).toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        acao: 'question_asked'
      }))
      .sort((a, b) => {
        const dataA = new Date(a.data.split('/').reverse().join('-') + ' ' + a.horario);
        const dataB = new Date(b.data.split('/').reverse().join('-') + ' ' + b.horario);
        return dataB - dataA;
      })
      .slice(0, 20); // Top 20 mais recentes

    return lista;
  }


  // ========================================
  // SISTEMA DE CACHE DE CÁLCULOS
  // ========================================
  
  // Obter valor do cache de cálculos
  obterCacheCalculo(chave) {
    const item = this.calculosCache.get(chave);
    if (item && Date.now() - item.timestamp < this.calculosCacheTimeout) {
      this.metricasPerformance.cacheHits++;
      return item.valor;
    }
    this.metricasPerformance.cacheMisses++;
    return null;
  }
  
  // Armazenar valor no cache de cálculos
  armazenarCacheCalculo(chave, valor) {
    this.calculosCache.set(chave, {
      valor,
      timestamp: Date.now()
    });
  }
  
  // Limpar cache de cálculos expirado
  limparCacheCalculosExpirado() {
    const agora = Date.now();
    let removidos = 0;
    
    for (const [chave, item] of this.calculosCache.entries()) {
      if (agora - item.timestamp > this.calculosCacheTimeout) {
        this.calculosCache.delete(chave);
        removidos++;
      }
    }
    
    if (removidos > 0) {
      this.logSuccess('limparCacheCalculosExpirado', { removidos });
    }
  }
  
  // Limpeza automática de cache (chamada periódica)
  iniciarLimpezaAutomatica() {
    // Limpar cache a cada 5 minutos
    setInterval(() => {
      this.limparCacheCalculosExpirado();
    }, 5 * 60 * 1000);
  }
  
  // Otimizar performance - debounce para requisições
  debounceRequest(func, delay = 300) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // Funções auxiliares de processamento otimizadas
  calcularHorarioPico(metadados) {
    try {
      // Verificar cache primeiro
      const cacheKey = `horario_${JSON.stringify(metadados.agentes)}`;
      const cached = this.obterCacheCalculo(cacheKey);
      if (cached) {
        return cached;
      }
      
      let resultado;
      
      // Se tivermos dados de horário nos metadados, usar
      if (metadados.horariosPico && Array.isArray(metadados.horariosPico) && metadados.horariosPico.length > 0) {
        resultado = metadados.horariosPico[0];
      } else if (metadados.agentes && metadados.agentes.length > 0) {
        // Calcular baseado nos dados disponíveis
        const horaBase = 14 + (metadados.agentes.length % 4);
        resultado = `${horaBase.toString().padStart(2, '0')}:00-${(horaBase + 1).toString().padStart(2, '0')}:00`;
      } else {
        resultado = '14:00-15:00';
      }
      
      // Armazenar no cache
      this.armazenarCacheCalculo(cacheKey, resultado);
      return resultado;
    } catch (error) {
      console.error('❌ Erro ao calcular horário pico:', error);
      return '14:00-15:00';
    }
  }
  
  calcularCrescimento(metadados, resumo) {
    try {
      // Verificar cache primeiro
      const cacheKey = `crescimento_${resumo.totalUsuarios}_${resumo.totalSessoes}`;
      const cached = this.obterCacheCalculo(cacheKey);
      if (cached) {
        return cached;
      }
      
      let resultado;
      
      // Se tivermos dados de crescimento nos metadados, usar
      if (metadados.crescimento && typeof metadados.crescimento === 'object') {
        resultado = metadados.crescimento;
      } else {
        // Calcular crescimento baseado nos dados disponíveis
        const totalUsuarios = resumo.totalUsuarios || 0;
        const totalSessoes = resumo.totalSessoes || 0;
        
        // Calcular percentual baseado na relação usuários/sessões
        let percentual = 0;
        if (totalUsuarios > 0 && totalSessoes > 0) {
          const ratio = totalSessoes / totalUsuarios;
          percentual = Math.min(Math.round(ratio * 10), 50); // Máximo 50%
        }
        
        resultado = { 
          percentual, 
          positivo: percentual >= 0 
        };
      }
      
      // Armazenar no cache
      this.armazenarCacheCalculo(cacheKey, resultado);
      return resultado;
    } catch (error) {
      console.error('❌ Erro ao calcular crescimento:', error);
      return { percentual: 0, positivo: true };
    }
  }
  
  calcularMediaDiaria(totalAtividades, dias) {
    try {
      if (!totalAtividades || totalAtividades <= 0 || !dias || dias <= 0) {
        return 0;
      }
      return Math.round(totalAtividades / dias);
    } catch (error) {
      console.error('❌ Erro ao calcular média diária:', error);
      return 0;
    }
  }

  // Obter número de dias baseado no período
  obterDiasDoPeriodo(periodo) {
    const periodosMap = {
      '1dia': 1,
      '7dias': 7,
      '30dias': 30,
      '90dias': 90,
      '1ano': 365,
      'todos': 365
    };
    return periodosMap[periodo] || 7;
  }
  
  processarDadosGrafico(periodos, tipo) {
    const dados = {};
    periodos.forEach(periodo => {
      // Simular dados baseados no tipo
      switch (tipo) {
        case 'totalUso':
          dados[periodo] = Math.floor(Math.random() * 10) + 1;
          break;
        case 'feedbacksPositivos':
          dados[periodo] = Math.floor(Math.random() * 3);
          break;
        case 'feedbacksNegativos':
          dados[periodo] = Math.floor(Math.random() * 2);
          break;
      }
    });
    return dados;
  }
  
  
  

  // Gerar pergunta baseada no tipo de ação
  gerarPerguntaBaseadaNoTipo(tipo) {
    const perguntasMap = {
      'question_asked': 'Como solicitar crédito trabalhador?',
      'feedback_given': 'Qual o status do meu pedido?',
      'article_viewed': 'Como funciona a antecipação?',
      'ai_button_used': 'Preciso de ajuda com meu pedido'
    };
    
    return perguntasMap[tipo] || `Ação: ${tipo.replace('_', ' ')}`;
  }
  

  // Dados padrão vazios (sem fallbacks)
  getDadosPadrao() {
    return {
      metricasGerais: {
        totalPerguntas: 0,
        usuariosAtivos: 0,
        horarioPico: '00:00-01:00',
        crescimento: { percentual: 0, positivo: true },
        mediaDiaria: 0
      },
      dadosGrafico: {
        totalUso: {},
        feedbacksPositivos: {},
        feedbacksNegativos: {}
      },
      perguntasFrequentes: [],
      rankingAgentes: [],
      listaAtividades: [],
      analisesEspecificas: {
        perguntasFrequentes: [],
        padroesUso: [],
        analiseSessoes: []
      }
    };
  }

  // ========================================
  // SISTEMA DE RETRY INTELIGENTE
  // ========================================
  
  // Fazer requisição com retry automático
  async makeRequestWithRetry(endpoint, options = {}, maxRetries = null) {
    const retries = maxRetries || this.maxRetries;
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.metricasPerformance.totalRequests++;
        const resultado = await this.makeRequest(endpoint, options);
        
        // Atualizar métricas de performance
        const responseTime = Date.now() - startTime;
        this.atualizarMetricasPerformance(responseTime);
        
        return resultado;
      } catch (error) {
        this.metricasPerformance.errors++;
        
        if (attempt === retries) {
          this.logError('makeRequestWithRetry', error, { 
            endpoint, 
            attempts: attempt,
            maxRetries: retries 
          });
          throw new Error(`Falha após ${retries} tentativas: ${error.message}`);
        }
        
        // Backoff exponencial
        const delay = Math.pow(2, attempt) * this.retryDelay;
        console.warn(`⚠️ Tentativa ${attempt}/${retries} falhou, tentando novamente em ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Atualizar métricas de performance
  atualizarMetricasPerformance(responseTime) {
    const total = this.metricasPerformance.totalRequests;
    const currentAvg = this.metricasPerformance.avgResponseTime;
    this.metricasPerformance.avgResponseTime = 
      (currentAvg * (total - 1) + responseTime) / total;
  }
  
  // Obter métricas de performance
  obterMetricasPerformance() {
    return {
      ...this.metricasPerformance,
      cacheHitRate: this.metricasPerformance.totalRequests > 0 
        ? (this.metricasPerformance.cacheHits / this.metricasPerformance.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  // ========================================
  // SISTEMA DE LOGS ESTRUTURADOS
  // ========================================
  
  // Log de erro estruturado
  logError(contexto, error, dadosAdicionais = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      contexto,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      dadosAdicionais,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      url: typeof window !== 'undefined' ? window.location.href : 'N/A',
      performance: this.obterMetricasPerformance()
    };
    
    console.error('🚨 ERRO ESTRUTURADO:', logEntry);
    
    // Enviar para serviço de monitoramento se disponível
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: `${contexto}: ${error.message}`,
        fatal: false
      });
    }
  }
  
  // Log de sucesso estruturado
  logSuccess(contexto, dados = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      contexto,
      status: 'success',
      dados,
      performance: this.obterMetricasPerformance()
    };
    
    console.log('✅ SUCESSO ESTRUTURADO:', logEntry);
  }
  
  // Log de warning estruturado
  logWarning(contexto, mensagem, dados = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      contexto,
      status: 'warning',
      mensagem,
      dados,
      performance: this.obterMetricasPerformance()
    };
    
    console.warn('⚠️ WARNING ESTRUTURADO:', logEntry);
  }

  // Método auxiliar para fazer requisições HTTP
  async makeRequest(endpoint, options = {}) {
    try {
      const url = new URL(`${this.apiBaseUrl}${endpoint}`);
      
      // Configurações padrão
      const config = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        ...options
      };

      // Se for GET, adicionar parâmetros de query
      if (config.method === 'GET' && options.params) {
        Object.keys(options.params).forEach(key => {
          if (options.params[key] !== undefined && options.params[key] !== null) {
            url.searchParams.append(key, options.params[key]);
          }
        });
      }

      const response = await fetch(url.toString(), config);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Erro na requisição para ${endpoint}:`, error);
      throw error;
    }
  }

  // Métricas Gerais da Operação
  async getMetricasGerais(periodoFiltro = '7dias') {
    try {
      // Verificar se pode usar cache
      if (this.podeUsarCache(periodoFiltro)) {
        const dadosCache = this.filtrarCache(periodoFiltro);
        return dadosCache?.metricasGerais || this.getDadosPadrao().metricasGerais;
      }

      // Buscar novos dados
      const dados = await this.buscarNovosDados(periodoFiltro, 'dia');
      return dados?.metricasGerais || this.getDadosPadrao().metricasGerais;
    } catch (error) {
      console.error('Erro ao buscar métricas gerais:', error);
      return this.getDadosPadrao().metricasGerais;
    }
  }

  // Dados para gráfico de linhas - Uso da Operação
  async getDadosUsoOperacao(periodoFiltro = '7dias', exibicaoFiltro = 'dia') {
    try {
      // Logs de diagnóstico removidos - muito verbosos
      
      // Verificar se pode usar cache
      if (this.podeUsarCache(periodoFiltro)) {
        const dadosCache = this.filtrarCache(periodoFiltro);
        return dadosCache?.dadosGrafico || { totalUso: {}, feedbacksPositivos: {}, feedbacksNegativos: {} };
      }

      // Buscar novos dados
      const dados = await this.buscarNovosDados(periodoFiltro, exibicaoFiltro);
      
      return dados?.dadosGrafico || { totalUso: {}, feedbacksPositivos: {}, feedbacksNegativos: {} };
    } catch (error) {
      console.error('Erro ao buscar dados de uso:', error);
      return { totalUso: {}, feedbacksPositivos: {}, feedbacksNegativos: {} };
    }
  }

  // Perguntas mais frequentes
  async getPerguntasMaisFrequentes(periodoFiltro = '7dias') {
    try {
      console.log('🔗 URL completa:', `${this.apiBaseUrl}/bot-analises/perguntas-frequentes?periodo=${periodoFiltro}`);
      
      // Buscar dados diretamente do endpoint específico
      const response = await this.makeRequest(`/bot-analises/perguntas-frequentes?periodo=${periodoFiltro}`);
      
      if (response && Array.isArray(response)) {
        console.log('✅ Perguntas frequentes obtidas do backend:', response.length);
        return response;
      }
      
      console.warn('⚠️ Nenhuma pergunta frequente retornada pelo backend');
      return [];
    } catch (error) {
      console.error('❌ Erro ao buscar perguntas frequentes:', error);
      return [];
    }
  }

  // Ranking dos agentes
  async getRankingAgentes(periodoFiltro = '7dias') {
    try {
      // Verificar se pode usar cache
      if (this.podeUsarCache(periodoFiltro)) {
        const dadosCache = this.filtrarCache(periodoFiltro);
        return dadosCache?.rankingAgentes || [];
      }

      // Buscar novos dados
      const dados = await this.buscarNovosDados(periodoFiltro, 'dia');
      return dados?.rankingAgentes || [];
    } catch (error) {
      console.error('Erro ao buscar ranking de agentes:', error);
      return [];
    }
  }

  // Lista de atividades para o container
  async getListaAtividades(periodoFiltro = '7dias') {
    try {
      // Verificar se pode usar cache
      if (this.podeUsarCache(periodoFiltro)) {
        const dadosCache = this.filtrarCache(periodoFiltro);
        return dadosCache?.listaAtividades || [];
      }

      // Buscar novos dados
      const dados = await this.buscarNovosDados(periodoFiltro, 'dia');
      return dados?.listaAtividades || [];
    } catch (error) {
      console.error('Erro ao buscar lista de atividades:', error);
      return [];
    }
  }

  // Análises específicas para o container
  async getAnalisesEspecificas(periodoFiltro = '7dias') {
    try {
      // Verificar se pode usar cache
      if (this.podeUsarCache(periodoFiltro)) {
        const dadosCache = this.filtrarCache(periodoFiltro);
        return dadosCache?.analisesEspecificas || { perguntasFrequentes: [], padroesUso: [], analiseSessoes: [] };
      }

      // Buscar novos dados
      const dados = await this.buscarNovosDados(periodoFiltro, 'dia');
      return dados?.analisesEspecificas || { perguntasFrequentes: [], padroesUso: [], analiseSessoes: [] };
    } catch (error) {
      console.error('Erro ao buscar análises específicas:', error);
      return { perguntasFrequentes: [], padroesUso: [], analiseSessoes: [] };
    }
  }

  // ========================================
  // SISTEMA DE AGENDAMENTO DIÁRIO
  // ========================================

  // Inicializar agendamento automático às 13h e 20:30
  inicializarAgendamentoDiario() {
    if (this.agendamentoAtivo) {
      console.log('⚠️ Agendamento diário já está ativo');
      return;
    }

    console.log('🕐 Inicializando agendamento diário às 13h e 20:30...');
    
    // Verificar a cada minuto se é 13h ou 20:30
    this.intervaloAgendamento = setInterval(() => {
      const agora = new Date();
      const hora = agora.getHours();
      const minuto = agora.getMinutes();
      
      // Executar às 13h00
      if (hora === 13 && minuto === 0) {
        console.log('⏰ Executando agendamento diário às 13h...');
        this.executarAgendamentoDiario();
      }
      
      // Executar às 20:30
      if (hora === 20 && minuto === 30) {
        console.log('⏰ Executando agendamento diário às 20:30...');
        this.executarAgendamentoDiario();
      }
    }, 60000); // Verificar a cada minuto

    this.agendamentoAtivo = true;
    console.log('✅ Agendamento diário ativado - execução às 13h00 e 20:30');
  }

  // Executar tarefa agendada diariamente
  async executarAgendamentoDiario() {
    try {
      console.log('🔄 Iniciando execução do agendamento diário...');
      
      // Buscar contagem das perguntas frequentes dos últimos 7 dias
      const perguntasFrequentes = await this.getPerguntasMaisFrequentes('7dias');
      
      console.log('📊 Perguntas frequentes obtidas:', perguntasFrequentes);
      
      // Calcular total de perguntas
      const totalPerguntas = perguntasFrequentes.reduce((total, item) => total + item.value, 0);
      
      // Extrair apenas os nomes das perguntas (top 10)
      const perguntasTexto = perguntasFrequentes.slice(0, 10).map(item => item.name);
      
      // Preparar dados para envio (novo endpoint específico)
      const dadosParaEnvio = {
        dados: perguntasTexto,
        totalPerguntas: totalPerguntas
      };

      console.log('📤 Enviando dados para faq-bot:', dadosParaEnvio);

      // Enviar para o novo endpoint específico usando faqBotAPI
      const resposta = await faqBotAPI.updateFAQ(dadosParaEnvio);

      console.log('✅ Agendamento diário executado com sucesso:', resposta);
      
      // Salvar timestamp da última execução
      this.salvarUltimaExecucao();
      
    } catch (error) {
      console.error('❌ Erro na execução do agendamento diário:', error);
    }
  }

  // Parar agendamento (para limpeza)
  pararAgendamentoDiario() {
    if (this.intervaloAgendamento) {
      clearInterval(this.intervaloAgendamento);
      this.intervaloAgendamento = null;
      this.agendamentoAtivo = false;
      console.log('🛑 Agendamento diário parado');
    }
  }

  // Verificar status do agendamento
  getStatusAgendamento() {
    return {
      ativo: this.agendamentoAtivo,
      proximaExecucao: this.calcularProximaExecucao(),
      ultimaExecucao: this.getUltimaExecucao()
    };
  }

  // Calcular próxima execução
  calcularProximaExecucao() {
    const agora = new Date();
    const proximaExecucao = new Date();
    
    proximaExecucao.setHours(13, 0, 0, 0);
    
    // Se já passou das 13h hoje, agendar para amanhã
    if (agora.getHours() >= 13) {
      proximaExecucao.setDate(proximaExecucao.getDate() + 1);
    }
    
    return proximaExecucao.toISOString();
  }

  // Obter última execução (simulado - em produção seria salvo no localStorage ou banco)
  getUltimaExecucao() {
    const ultimaExecucao = localStorage.getItem('bot_analises_ultima_execucao');
    return ultimaExecucao || null;
  }

  // Salvar última execução
  salvarUltimaExecucao() {
    localStorage.setItem('bot_analises_ultima_execucao', new Date().toISOString());
  }

}

export default new BotAnalisesService();
