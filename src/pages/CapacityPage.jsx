// VERSION: v1.6.3 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
import React, { useState, useCallback } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  Grid,
  Button,
  Alert,
  CircularProgress,
  TextField
} from '@mui/material';
import { 
  CloudUpload, 
  Calculate, 
  FileDownload,
  Info,
  Edit,
  Check,
  Refresh
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import BackButton from '../components/common/BackButton';
import { capacityService } from '../services/capacityService';

const CapacityPage = () => {
  // Estados para dados dos arquivos
  const [weekdaysData, setWeekdaysData] = useState(null);
  const [saturdayData, setSaturdayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  // Estados para feedback visual
  const [weekdaysFileInfo, setWeekdaysFileInfo] = useState('');
  const [saturdayFileInfo, setSaturdayFileInfo] = useState('');

  // Função para calcular horas efetivas
  const calcularHorasEfetivas = useCallback((horasTrabalho, horarioAlmoco, outrasPausas) => {
    return Math.max(0, horasTrabalho - horarioAlmoco - outrasPausas);
  }, []);

  // Estados para parâmetros editáveis
  const [parameters, setParameters] = useState(() => {
    // Tentar carregar do localStorage
    try {
      const saved = localStorage.getItem('capacityParameters');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Garantir que as horas efetivas sejam calculadas
        return {
          ...parsed,
          weekdays: {
            ...parsed.weekdays,
            horasEfetivas: calcularHorasEfetivas(
              parsed.weekdays.horasTrabalho || 8,
              parsed.weekdays.horarioAlmoco || 1,
              parsed.weekdays.outrasPausas || 0.5
            )
          },
          saturday: {
            ...parsed.saturday,
            horasEfetivas: calcularHorasEfetivas(
              parsed.saturday.horasTrabalho || 6,
              parsed.saturday.horarioAlmoco || 0.5,
              parsed.saturday.outrasPausas || 0
            )
          }
        };
      }
    } catch (error) {
      console.error('❌ Erro ao carregar parâmetros do localStorage:', error);
    }
    
    // Valores padrão
    const defaultParams = {
      weekdays: {
        horasTrabalho: 8,
        horarioAlmoco: 1,
        outrasPausas: 0.5,
        horasEfetivas: 6.5, // Calculado: 8 - 1 - 0.5
        capacidadePorHora: 15,
        capacidadeSegura: 11.25
      },
      saturday: {
        horasTrabalho: 6,
        horarioAlmoco: 0.5,
        outrasPausas: 0,
        horasEfetivas: 5.5, // Calculado: 6 - 0.5 - 0
        capacidadePorHora: 11,
        capacidadeSegura: 8.25
      },
      global: {
        tma: 5,
        nivelServico: 80,
        tempoEspera: 20,
        abandono: 5
      }
    };
    
    return defaultParams;
  });

  const [isEditingParams, setIsEditingParams] = useState(false);

  // Estados para drag & drop
  const [dragActive, setDragActive] = useState({ weekdays: false, saturday: false });

  // Funções para drag & drop
  const handleDrag = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(prev => ({ ...prev, [type]: true }));
    } else if (e.type === "dragleave") {
      setDragActive(prev => ({ ...prev, [type]: false }));
    }
  }, []);

  const handleDrop = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [type]: false }));
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Usar setTimeout para evitar problema de ordem de declaração
      setTimeout(() => {
        handleFileUpload(e.dataTransfer.files[0], type);
      }, 0);
    }
  }, []);

  // Função para atualizar parâmetro específico
  const handleParameterChange = useCallback((category, field, value) => {
    const numValue = Number(value);
    
    // Validação básica
    if (isNaN(numValue) || numValue < 0) {
      return; // Não atualizar se inválido
    }
    
    setParameters(prev => {
      const updated = {
        ...prev,
        [category]: {
          ...prev[category],
          [field]: numValue
        }
      };
      
      // Recalcular horas efetivas se for um campo que afeta o cálculo
      if ((category === 'weekdays' || category === 'saturday') && 
          (field === 'horasTrabalho' || field === 'horarioAlmoco' || field === 'outrasPausas')) {
        updated[category].horasEfetivas = calcularHorasEfetivas(
          updated[category].horasTrabalho,
          updated[category].horarioAlmoco,
          updated[category].outrasPausas
        );
      }
      
      // Salvar no localStorage
      localStorage.setItem('capacityParameters', JSON.stringify(updated));
      return updated;
    });
  }, [calcularHorasEfetivas]);

  // Função para resetar para valores padrão
  const handleResetParameters = useCallback(() => {
    const defaultParams = {
      weekdays: {
        horasTrabalho: 8,
        horarioAlmoco: 1,
        outrasPausas: 0.5,
        horasEfetivas: 6.5, // Calculado: 8 - 1 - 0.5
        capacidadePorHora: 15,
        capacidadeSegura: 11.25
      },
      saturday: {
        horasTrabalho: 6,
        horarioAlmoco: 0.5,
        outrasPausas: 0,
        horasEfetivas: 5.5, // Calculado: 6 - 0.5 - 0
        capacidadePorHora: 11,
        capacidadeSegura: 8.25
      },
      global: {
        tma: 5,
        nivelServico: 80,
        tempoEspera: 20,
        abandono: 5
      }
    };
    setParameters(defaultParams);
    localStorage.setItem('capacityParameters', JSON.stringify(defaultParams));
  }, []);

  // Função para processar upload de arquivos
  const handleFileUpload = useCallback(async (file, type) => {
    try {
      setLoading(true);
      setError(null);

      let processedData;
      
      if (file.name.toLowerCase().endsWith('.csv')) {
        processedData = await capacityService.readCSVFile(file);
      } else {
        processedData = await capacityService.readExcelFile(file);
      }

      // Validar dados
      const validation = capacityService.validateData(processedData);
      if (!validation.valid) {
        throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
      }

      // Atualizar estado baseado no tipo
      if (type === 'weekdays') {
        setWeekdaysData(processedData);
        setWeekdaysFileInfo(`✅ Arquivo carregado: ${file.name} (${processedData.length} registros)`);
      } else {
        setSaturdayData(processedData);
        setSaturdayFileInfo(`✅ Arquivo carregado: ${file.name} (${processedData.length} registros)`);
      }

    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      setError(`Erro ao processar arquivo: ${error.message}`);
      
      if (type === 'weekdays') {
        setWeekdaysFileInfo(`❌ Erro ao processar arquivo: ${error.message}`);
      } else {
        setSaturdayFileInfo(`❌ Erro ao processar arquivo: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Função para processar dimensionamento
  const handleCalculate = useCallback(async () => {
    if (!weekdaysData || !saturdayData) {
      setError('Por favor, faça upload de ambos os arquivos antes de processar.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Atualizar parâmetros no serviço
      capacityService.updateParameters(parameters);

      // Processar dimensionamento com parâmetros atualizados
      const weekdaysResults = capacityService.processCapacityData(weekdaysData, 'weekdays', parameters);
      const saturdayResults = capacityService.processCapacityData(saturdayData, 'saturday', parameters);

      setResults({
        weekdays: weekdaysResults,
        saturday: saturdayResults
      });

    } catch (error) {
      console.error('Erro ao calcular dimensionamento:', error);
      setError(`Erro ao calcular dimensionamento: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [weekdaysData, saturdayData, parameters]);

  // Função para exportar Excel
  const handleExport = useCallback(() => {
    if (!results) {
      setError('Nenhum resultado disponível para exportar.');
      return;
    }

    try {
      capacityService.exportToExcel(results.weekdays, results.saturday);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      setError(`Erro ao exportar: ${error.message}`);
    }
  }, [results]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', mb: 4 }}>
        <Box sx={{ position: 'absolute', left: 0 }}>
          <BackButton />
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography 
            variant="h4" 
            component="h1"
            sx={{ 
              fontFamily: 'Poppins',
              fontWeight: 700,
              color: 'var(--blue-dark)',
              mb: 1
            }}
          >
            Capacity
          </Typography>
        </Box>
      </Box>

      {/* Alertas */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Parâmetros do Sistema */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Info sx={{ color: 'var(--blue-medium)' }} />
              <Typography variant="h6" sx={{ 
                fontFamily: 'Poppins',
                fontWeight: 600,
                color: 'var(--blue-dark)'
              }}>
                Parâmetros do Sistema
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                startIcon={isEditingParams ? <Check /> : <Edit />}
                onClick={() => setIsEditingParams(!isEditingParams)}
                sx={{
                  color: 'var(--blue-medium)',
                  borderColor: 'var(--blue-medium)',
                  '&:hover': {
                    borderColor: 'var(--blue-dark)',
                    backgroundColor: 'rgba(22, 52, 255, 0.05)'
                  }
                }}
                variant="outlined"
              >
                {isEditingParams ? 'Salvar' : 'Editar'}
              </Button>
              {isEditingParams && (
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={handleResetParameters}
                  sx={{
                    color: 'var(--gray)',
                    borderColor: 'var(--gray)',
                    '&:hover': {
                      borderColor: 'var(--blue-dark)',
                      backgroundColor: 'rgba(22, 52, 255, 0.05)'
                    }
                  }}
                  variant="outlined"
                >
                  Resetar
                </Button>
              )}
            </Box>
          </Box>
          
          <Grid container spacing={3}>
            {/* Dias Úteis */}
            <Grid item xs={12} md={4}>
              <Card sx={{ 
                backgroundColor: 'transparent',
                border: '1.5px solid var(--blue-dark)',
                borderRadius: '8px',
                padding: '16px',
                margin: '8px'
              }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ 
                    fontFamily: 'Poppins',
                    fontWeight: 600,
                    color: 'var(--blue-dark)',
                    mb: 2,
                    fontSize: '1.1rem'
                  }}>
                    📅 Dias Úteis (Segunda à Sexta)
                  </Typography>
                  
                  {isEditingParams ? (
                    <Box>
                      {/* Card para Horas de Trabalho */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Horas de Trabalho"
                          type="number"
                          value={parameters.weekdays.horasTrabalho}
                          onChange={(e) => handleParameterChange('weekdays', 'horasTrabalho', e.target.value)}
                          inputProps={{ min: 0, step: 0.5 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                      
                      {/* Card para Horário de Almoço */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Horário de Almoço"
                          type="number"
                          value={parameters.weekdays.horarioAlmoco}
                          onChange={(e) => handleParameterChange('weekdays', 'horarioAlmoco', e.target.value)}
                          inputProps={{ min: 0, step: 0.25 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                      
                      {/* Card para Outras Pausas */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Outras Pausas"
                          type="number"
                          value={parameters.weekdays.outrasPausas}
                          onChange={(e) => handleParameterChange('weekdays', 'outrasPausas', e.target.value)}
                          inputProps={{ min: 0, step: 0.25 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                      
                      {/* Card para Horas Efetivas (Calculado) */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'rgba(22, 52, 255, 0.05)',
                        border: '1px solid var(--blue-medium)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--blue-dark)', fontWeight: 600 }}>
                          Horas Efetivas: {parameters.weekdays.horasEfetivas}h
                        </Typography>
                      </Card>
                      
                      {/* Card para Capacidade */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Capacidade (lig/hora)"
                          type="number"
                          value={parameters.weekdays.capacidadePorHora}
                          onChange={(e) => handleParameterChange('weekdays', 'capacidadePorHora', e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                      
                      {/* Card para Capacidade Segura */}
                      <Card sx={{ 
                        mb: 1, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Capacidade Segura (lig/hora)"
                          type="number"
                          value={parameters.weekdays.capacidadeSegura}
                          onChange={(e) => handleParameterChange('weekdays', 'capacidadeSegura', e.target.value)}
                          inputProps={{ min: 0, step: 0.25 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                    </Box>
                  ) : (
                    <Box>
                      {/* Card para Horas de Trabalho */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Horas de trabalho: {parameters.weekdays.horasTrabalho}h
                        </Typography>
                      </Card>
                      
                      {/* Card para Horário de Almoço */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Horário de almoço: {parameters.weekdays.horarioAlmoco}h
                        </Typography>
                      </Card>
                      
                      {/* Card para Outras Pausas */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Outras pausas: {parameters.weekdays.outrasPausas}h
                        </Typography>
                      </Card>
                      
                      {/* Card para Horas Efetivas (Calculado) */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'rgba(22, 52, 255, 0.05)',
                        border: '1px solid var(--blue-medium)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--blue-dark)', fontWeight: 600 }}>
                          Horas efetivas: {parameters.weekdays.horasEfetivas}h
                        </Typography>
                      </Card>
                      
                      {/* Card para Capacidade */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Capacidade: {parameters.weekdays.capacidadePorHora} ligações/hora
                        </Typography>
                      </Card>
                      
                      {/* Card para Capacidade Segura */}
                      <Card sx={{ 
                        mb: 1, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Capacidade segura: {parameters.weekdays.capacidadeSegura} ligações/hora
                        </Typography>
                      </Card>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
            
            {/* Sábado */}
            <Grid item xs={12} md={4}>
              <Card sx={{ 
                backgroundColor: 'transparent',
                border: '1.5px solid var(--blue-dark)',
                borderRadius: '8px',
                padding: '16px',
                margin: '8px'
              }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ 
                    fontFamily: 'Poppins',
                    fontWeight: 600,
                    color: 'var(--blue-dark)',
                    mb: 2,
                    fontSize: '1.1rem'
                  }}>
                    📅 Sábado
                  </Typography>
                  
                  {isEditingParams ? (
                    <Box>
                      {/* Card para Horas de Trabalho */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Horas de Trabalho"
                          type="number"
                          value={parameters.saturday.horasTrabalho}
                          onChange={(e) => handleParameterChange('saturday', 'horasTrabalho', e.target.value)}
                          inputProps={{ min: 0, step: 0.5 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                      
                      {/* Card para Horário de Almoço */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Horário de Almoço"
                          type="number"
                          value={parameters.saturday.horarioAlmoco}
                          onChange={(e) => handleParameterChange('saturday', 'horarioAlmoco', e.target.value)}
                          inputProps={{ min: 0, step: 0.25 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                      
                      {/* Card para Outras Pausas */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Outras Pausas"
                          type="number"
                          value={parameters.saturday.outrasPausas}
                          onChange={(e) => handleParameterChange('saturday', 'outrasPausas', e.target.value)}
                          inputProps={{ min: 0, step: 0.25 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                      
                      {/* Card para Horas Efetivas (Calculado) */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'rgba(22, 52, 255, 0.05)',
                        border: '1px solid var(--blue-medium)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--blue-dark)', fontWeight: 600 }}>
                          Horas Efetivas: {parameters.saturday.horasEfetivas}h
                        </Typography>
                      </Card>
                      
                      {/* Card para Capacidade */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Capacidade (lig/hora)"
                          type="number"
                          value={parameters.saturday.capacidadePorHora}
                          onChange={(e) => handleParameterChange('saturday', 'capacidadePorHora', e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                      
                      {/* Card para Capacidade Segura */}
                      <Card sx={{ 
                        mb: 1, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Capacidade Segura (lig/hora)"
                          type="number"
                          value={parameters.saturday.capacidadeSegura}
                          onChange={(e) => handleParameterChange('saturday', 'capacidadeSegura', e.target.value)}
                          inputProps={{ min: 0, step: 0.25 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                    </Box>
                  ) : (
                    <Box>
                      {/* Card para Horas de Trabalho */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Horas de trabalho: {parameters.saturday.horasTrabalho}h
                        </Typography>
                      </Card>
                      
                      {/* Card para Horário de Almoço */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Horário de almoço: {parameters.saturday.horarioAlmoco}h
                        </Typography>
                      </Card>
                      
                      {/* Card para Outras Pausas */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Outras pausas: {parameters.saturday.outrasPausas}h
                        </Typography>
                      </Card>
                      
                      {/* Card para Horas Efetivas (Calculado) */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'rgba(22, 52, 255, 0.05)',
                        border: '1px solid var(--blue-medium)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--blue-dark)', fontWeight: 600 }}>
                          Horas efetivas: {parameters.saturday.horasEfetivas}h
                        </Typography>
                      </Card>
                      
                      {/* Card para Capacidade */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Capacidade: {parameters.saturday.capacidadePorHora} ligações/hora
                        </Typography>
                      </Card>
                      
                      {/* Card para Capacidade Segura */}
                      <Card sx={{ 
                        mb: 1, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Capacidade segura: {parameters.saturday.capacidadeSegura} ligações/hora
                        </Typography>
                      </Card>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Parâmetros Globais */}
            <Grid item xs={12} md={4}>
              <Card sx={{ 
                backgroundColor: 'transparent',
                border: '1.5px solid var(--blue-dark)',
                borderRadius: '8px',
                padding: '16px',
                margin: '8px'
              }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ 
                    fontFamily: 'Poppins',
                    fontWeight: 600,
                    color: 'var(--blue-dark)',
                    mb: 2,
                    fontSize: '1.1rem'
                  }}>
                    🌐 Parâmetros Globais
                  </Typography>
                  
                  {isEditingParams ? (
                    <Box>
                      {/* Card para TMA */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="TMA (minutos)"
                          type="number"
                          value={parameters.global.tma}
                          onChange={(e) => handleParameterChange('global', 'tma', e.target.value)}
                          inputProps={{ min: 0, step: 0.5 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                      
                      {/* Card para Nível de Serviço */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Nível de Serviço (%)"
                          type="number"
                          value={parameters.global.nivelServico}
                          onChange={(e) => handleParameterChange('global', 'nivelServico', e.target.value)}
                          inputProps={{ min: 0, max: 100, step: 1 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                      
                      {/* Card para Tempo de Espera */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Tempo de Espera (segundos)"
                          type="number"
                          value={parameters.global.tempoEspera}
                          onChange={(e) => handleParameterChange('global', 'tempoEspera', e.target.value)}
                          inputProps={{ min: 0, step: 1 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                      
                      {/* Card para Abandono */}
                      <Card sx={{ 
                        mb: 1, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <TextField
                          label="Abandono (%)"
                          type="number"
                          value={parameters.global.abandono}
                          onChange={(e) => handleParameterChange('global', 'abandono', e.target.value)}
                          inputProps={{ min: 0, max: 100, step: 0.1 }}
                          size="small"
                          fullWidth
                          sx={{ fontSize: '1rem' }}
                        />
                      </Card>
                    </Box>
                  ) : (
                    <Box>
                      {/* Card para TMA */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          TMA: {parameters.global.tma} minutos
                        </Typography>
                      </Card>
                      
                      {/* Card para Nível de Serviço */}
                      <Card sx={{ 
                        mb: 2, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Nível de Serviço: {parameters.global.nivelServico}% em {parameters.global.tempoEspera}s
                        </Typography>
                      </Card>
                      
                      {/* Card para Abandono */}
                      <Card sx={{ 
                        mb: 1, 
                        p: 2, 
                        backgroundColor: 'var(--cor-card)',
                        border: '1px solid rgba(22, 52, 255, 0.1)',
                        borderRadius: '8px'
                      }}>
                        <Typography sx={{ fontSize: '1rem', fontFamily: 'Poppins', color: 'var(--gray)' }}>
                          Abandono: {parameters.global.abandono}%
                        </Typography>
                      </Card>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Upload de Arquivos */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ 
                fontFamily: 'Poppins',
                fontWeight: 600,
                color: 'var(--blue-dark)',
                mb: 2
              }}>
                📅 Dias Úteis (Segunda à Sexta)
              </Typography>
              
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) handleFileUpload(file, 'weekdays');
                }}
                style={{ display: 'none' }}
                id="weekdays-file-input"
              />
              
              <Box
                component="label"
                htmlFor="weekdays-file-input"
                onDragEnter={(e) => handleDrag(e, 'weekdays')}
                onDragLeave={(e) => handleDrag(e, 'weekdays')}
                onDragOver={(e) => handleDrag(e, 'weekdays')}
                onDrop={(e) => handleDrop(e, 'weekdays')}
                sx={{
                  border: `2px dashed ${dragActive.weekdays ? 'var(--blue-dark)' : 'var(--blue-medium)'}`,
                  borderRadius: 2,
                  p: 4,
                  minHeight: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: dragActive.weekdays ? 'rgba(22, 52, 255, 0.1)' : 'transparent',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(22, 52, 255, 0.05)',
                    borderColor: 'var(--blue-dark)'
                  }
                }}
              >
                <CloudUpload sx={{ fontSize: 48, color: 'var(--blue-medium)', mb: 2 }} />
                
                <Typography variant="h6" sx={{ fontFamily: 'Poppins', mb: 1 }}>
                  Arraste o arquivo aqui
                </Typography>
                
                <Typography variant="body2" sx={{ fontFamily: 'Poppins', color: 'var(--gray)', mb: 1 }}>
                  ou clique para selecionar
                </Typography>
                
                <Typography variant="caption" sx={{ mt: 2, color: 'var(--gray)' }}>
                  Formatos aceitos: XLS, XLSX, CSV
                </Typography>
                
                {weekdaysFileInfo && (
                  <Typography variant="body2" sx={{ 
                    fontFamily: 'Poppins',
                    mt: 2,
                    color: weekdaysFileInfo.includes('✅') ? 'var(--success)' : 'var(--error)'
                  }}>
                    {weekdaysFileInfo}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ 
                fontFamily: 'Poppins',
                fontWeight: 600,
                color: 'var(--blue-dark)',
                mb: 2
              }}>
                📅 Sábado
              </Typography>
              
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) handleFileUpload(file, 'saturday');
                }}
                style={{ display: 'none' }}
                id="saturday-file-input"
              />
              
              <Box
                component="label"
                htmlFor="saturday-file-input"
                onDragEnter={(e) => handleDrag(e, 'saturday')}
                onDragLeave={(e) => handleDrag(e, 'saturday')}
                onDragOver={(e) => handleDrag(e, 'saturday')}
                onDrop={(e) => handleDrop(e, 'saturday')}
                sx={{
                  border: `2px dashed ${dragActive.saturday ? 'var(--green)' : 'var(--blue-medium)'}`,
                  borderRadius: 2,
                  p: 4,
                  minHeight: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: dragActive.saturday ? 'rgba(21, 162, 55, 0.1)' : 'transparent',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(21, 162, 55, 0.05)',
                    borderColor: 'var(--green)'
                  }
                }}
              >
                <CloudUpload sx={{ fontSize: 48, color: 'var(--green)', mb: 2 }} />
                
                <Typography variant="h6" sx={{ fontFamily: 'Poppins', mb: 1 }}>
                  Arraste o arquivo aqui
                </Typography>
                
                <Typography variant="body2" sx={{ fontFamily: 'Poppins', color: 'var(--gray)', mb: 1 }}>
                  ou clique para selecionar
                </Typography>
                
                <Typography variant="caption" sx={{ mt: 2, color: 'var(--gray)' }}>
                  Formatos aceitos: XLS, XLSX, CSV
                </Typography>
                
                {saturdayFileInfo && (
                  <Typography variant="body2" sx={{ 
                    fontFamily: 'Poppins',
                    mt: 2,
                    color: saturdayFileInfo.includes('✅') ? 'var(--success)' : 'var(--error)'
                  }}>
                    {saturdayFileInfo}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Botões de Ação */}
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        mb: 4,
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <Calculate />}
          onClick={handleCalculate}
          disabled={!weekdaysData || !saturdayData || loading}
          sx={{
            backgroundColor: 'var(--blue-medium)',
            '&:hover': { backgroundColor: 'var(--blue-dark)' }
          }}
        >
          {loading ? 'Processando...' : 'Calcular Dimensionamento'}
        </Button>

        {results && (
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={handleExport}
            sx={{
              borderColor: 'var(--blue-medium)',
              color: 'var(--blue-medium)',
              '&:hover': {
                borderColor: 'var(--blue-dark)',
                backgroundColor: 'rgba(22, 52, 255, 0.05)'
              }
            }}
          >
            Exportar para Excel
          </Button>
        )}
      </Box>

      {/* Resultados do Dimensionamento */}
      {results && (
        <Grid container spacing={3}>
          {/* Resumo Geral */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ 
                  fontFamily: 'Poppins',
                  fontWeight: 600,
                  color: 'var(--blue-dark)',
                  mb: 3
                }}>
                  📊 Resumo do Dimensionamento
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, var(--blue-light) 0%, var(--blue-medium) 100%)',
                      color: 'white'
                    }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontFamily: 'Poppins', fontWeight: 600, mb: 1 }}>
                          📅 Dias Úteis
                        </Typography>
                        <Typography variant="h4" sx={{ fontFamily: 'Poppins', fontWeight: 700, mb: 1 }}>
                          {results.weekdays.summary.totalHCs} HCs
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'Poppins', opacity: 0.9 }}>
                          {results.weekdays.summary.totalVolume} ligações | {results.weekdays.summary.utilizacaoMedia}% utilização
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card sx={{ 
                      background: 'linear-gradient(135deg, var(--green) 0%, #0d7a2a 100%)',
                      color: 'white'
                    }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontFamily: 'Poppins', fontWeight: 600, mb: 1 }}>
                          📅 Sábado
                        </Typography>
                        <Typography variant="h4" sx={{ fontFamily: 'Poppins', fontWeight: 700, mb: 1 }}>
                          {results.saturday.summary.totalHCs} HCs
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'Poppins', opacity: 0.9 }}>
                          {results.saturday.summary.totalVolume} ligações | {results.saturday.summary.utilizacaoMedia}% utilização
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Tabela de Resultados - Dias Úteis */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ 
                  fontFamily: 'Poppins',
                  fontWeight: 600,
                  color: 'var(--blue-dark)',
                  mb: 2
                }}>
                  📅 Dias Úteis - Detalhamento
                </Typography>
                
                <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Poppins' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--blue-medium)', color: 'white' }}>
                        <th style={{ padding: '8px', textAlign: 'left', border: '1px solid var(--blue-dark)' }}>Horário</th>
                        <th style={{ padding: '8px', textAlign: 'center', border: '1px solid var(--blue-dark)' }}>Volume</th>
                        <th style={{ padding: '8px', textAlign: 'center', border: '1px solid var(--blue-dark)' }}>HCs</th>
                        <th style={{ padding: '8px', textAlign: 'center', border: '1px solid var(--blue-dark)' }}>Utilização</th>
                        <th style={{ padding: '8px', textAlign: 'center', border: '1px solid var(--blue-dark)' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.weekdays.results.map((item, index) => (
                        <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.intervalo}:00</td>
                          <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{item.volume}</td>
                          <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{item.hcs}</td>
                          <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{item.utilizacao}%</td>
                          <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: item.status === 'Saudável' ? '#d4edda' : 
                                            item.status === 'Atenção' ? '#fff3cd' : '#f8d7da',
                              color: item.status === 'Saudável' ? '#155724' : 
                                   item.status === 'Atenção' ? '#856404' : '#721c24'
                            }}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Tabela de Resultados - Sábado */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ 
                  fontFamily: 'Poppins',
                  fontWeight: 600,
                  color: 'var(--blue-dark)',
                  mb: 2
                }}>
                  📅 Sábado - Detalhamento
                </Typography>
                
                <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Poppins' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--green)', color: 'white' }}>
                        <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #0d7a2a' }}>Horário</th>
                        <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #0d7a2a' }}>Volume</th>
                        <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #0d7a2a' }}>HCs</th>
                        <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #0d7a2a' }}>Utilização</th>
                        <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #0d7a2a' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.saturday.results.map((item, index) => (
                        <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : 'white' }}>
                          <td style={{ padding: '8px', border: '1px solid #ddd' }}>{item.intervalo}:00</td>
                          <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{item.volume}</td>
                          <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{item.hcs}</td>
                          <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>{item.utilizacao}%</td>
                          <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: item.status === 'Saudável' ? '#d4edda' : 
                                            item.status === 'Atenção' ? '#fff3cd' : '#f8d7da',
                              color: item.status === 'Saudável' ? '#155724' : 
                                   item.status === 'Atenção' ? '#856404' : '#721c24'
                            }}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default CapacityPage;
