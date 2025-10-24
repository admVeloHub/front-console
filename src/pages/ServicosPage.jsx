// VERSION: v1.0.2 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Box,
  CircularProgress,
  Snackbar,
  Alert,
  Chip
} from '@mui/material';
import {
  CheckCircle as OnIcon,
  Warning as RevisaoIcon,
  Cancel as OffIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/common/BackButton';
import { servicesAPI } from '../services/api';

// VERSION: v1.5.2 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team

const ServicosPage = () => {
  const { user } = useAuth();
  const [moduleStatus, setModuleStatus] = useState({});
  const [localStatus, setLocalStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  // Configuração dos 6 serviços com mapeamento para o schema
  const services = [
    { key: 'credito-trabalhador', name: 'Crédito Trabalhador', description: 'Sistema de crédito para trabalhadores', schemaKey: '_trabalhador' },
    { key: 'credito-pessoal', name: 'Crédito Pessoal', description: 'Sistema de crédito pessoal', schemaKey: '_pessoal' },
    { key: 'antecipacao', name: 'Antecipação', description: 'Sistema de antecipação de valores', schemaKey: '_antecipacao' },
    { key: 'pagamento-antecipado', name: 'Pagamento Antecipado', description: 'Sistema de pagamentos antecipados', schemaKey: '_pgtoAntecip' },
    { key: 'modulo-irpf', name: 'Módulo IRPF', description: 'Sistema de declaração IRPF', schemaKey: '_irpf' },
    { key: 'modulo-seguro', name: 'Módulo Seguro', description: 'Sistema de seguros', schemaKey: '_seguro' }
  ];

  // Buscar status atual dos módulos
  const fetchModuleStatus = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fazendo requisição para /api/module-status');
      const response = await servicesAPI.getModuleStatus();
      console.log('✅ Dados recebidos:', response);
      
      // Extrair dados do objeto de resposta
      const data = response.data || response;
      console.log('📊 Dados extraídos:', data);
      
      setModuleStatus(data);
      setLocalStatus(data);
    } catch (error) {
      console.error('❌ Erro ao buscar status dos módulos:', error);
      showToast('Erro ao carregar status dos módulos', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Atualizar status local de um módulo (sem enviar para backend)
  const updateLocalStatus = (moduleKey, newStatus) => {
    setLocalStatus(prev => ({
      ...prev,
      [moduleKey]: newStatus
    }));
  };

  // Salvar todos os status para o backend
  const saveAllStatus = async () => {
    try {
      setSaving(true);
      
      // Mapear dados para o formato esperado pelo backend
      const modulesData = {
        'credito-trabalhador': localStatus['credito-trabalhador'] || 'off',
        'credito-pessoal': localStatus['credito-pessoal'] || 'off',
        'antecipacao': localStatus['antecipacao'] || 'off',
        'pagamento-antecipado': localStatus['pagamento-antecipado'] || 'off',
        'modulo-irpf': localStatus['modulo-irpf'] || 'off',
        'modulo-seguro': localStatus['modulo-seguro'] || 'off'
      };

      console.log('🔍 Enviando dados para o backend:', modulesData);
      await servicesAPI.updateMultipleModules(modulesData);
      
      // Atualizar estado principal
      setModuleStatus(localStatus);
      
      showToast('Status de todos os serviços atualizados com sucesso!', 'success');
    } catch (error) {
      console.error('❌ Erro ao salvar status dos módulos:', error);
      showToast('Erro ao salvar status dos módulos', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Função para mostrar toast
  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  // Função para fechar toast
  const handleCloseToast = () => {
    setToast({ open: false, message: '', severity: 'success' });
  };

  // Obter label do status
  const getStatusLabel = (status) => {
    switch (status) {
      case 'on': return 'Ativo';
      case 'revisao': return 'Revisão';
      case 'off': return 'Inativo';
      default: return 'Desconhecido';
    }
  };

  // Obter cor do status
  const getStatusColor = (status) => {
    switch (status) {
      case 'on': return 'success';
      case 'revisao': return 'warning';
      case 'off': return 'error';
      default: return 'default';
    }
  };

  // Obter ícone do status
  const getStatusIcon = (status) => {
    switch (status) {
      case 'on': return <OnIcon />;
      case 'revisao': return <RevisaoIcon />;
      case 'off': return <OffIcon />;
      default: return null;
    }
  };

  // Renderizar botões de status
  const renderStatusButtons = (moduleKey, currentStatus) => {
    const statuses = [
      { key: 'on', label: 'Ativo', color: 'success', icon: <OnIcon /> },
      { key: 'revisao', label: 'Revisão', color: 'warning', icon: <RevisaoIcon /> },
      { key: 'off', label: 'Inativo', color: 'error', icon: <OffIcon /> }
    ];

    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {statuses.map((status) => (
          <Button
            key={status.key}
            variant={currentStatus === status.key ? 'contained' : 'outlined'}
            color={status.color}
            size="small"
            startIcon={status.icon}
            onClick={() => updateLocalStatus(moduleKey, status.key)}
            sx={{
              minWidth: '100px',
              textTransform: 'none',
              fontWeight: currentStatus === status.key ? 600 : 400
            }}
          >
            {status.label}
          </Button>
        ))}
      </Box>
    );
  };

  // Carregar status inicial apenas uma vez
  useEffect(() => {
    fetchModuleStatus();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4, pb: 8 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', mb: 4 }}>
        <Box sx={{ position: 'absolute', left: 0 }}>
          <BackButton />
        </Box>
        <Typography 
          variant="h4" 
          component="h1"
          sx={{ 
            fontFamily: 'Poppins',
            fontWeight: 700,
            color: 'var(--blue-dark)'
          }}
        >
          Serviços
        </Typography>
      </Box>

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Grid de Serviços */}
      {!loading && (
        <>
          <Grid container spacing={3}>
            {services.map((service) => {
              const currentStatus = localStatus[service.key] || 'off';
              
              return (
                <Grid item xs={12} md={6} lg={4} key={service.key}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      {/* Header do Card */}
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography 
                          variant="h6" 
                          component="h3" 
                          sx={{ 
                            flexGrow: 1,
                            color: 'var(--blue-dark)',
                            fontWeight: 600,
                            fontFamily: 'Poppins, sans-serif'
                          }}
                        >
                          {service.name}
                        </Typography>
                        <Chip
                          icon={getStatusIcon(currentStatus)}
                          label={getStatusLabel(currentStatus)}
                          color={getStatusColor(currentStatus)}
                          size="small"
                          variant="outlined"
                        />
                      </Box>

                      {/* Descrição */}
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 3,
                          fontFamily: 'Poppins, sans-serif',
                          lineHeight: 1.6
                        }}
                      >
                        {service.description}
                      </Typography>

                      {/* Botões de Status */}
                      {renderStatusButtons(service.key, currentStatus)}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {/* Botão Salvar */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            mt: 4,
            pr: 2
          }}>
            <Button
              variant="contained"
              size="large"
              onClick={saveAllStatus}
              disabled={saving}
              sx={{
                backgroundColor: 'var(--green)',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                '&:hover': {
                  backgroundColor: 'var(--green)',
                  opacity: 0.9
                }
              }}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </Box>
        </>
      )}

      {/* Toast de Notificação */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseToast} 
          severity={toast.severity}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ServicosPage;

