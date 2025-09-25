// VERSION: v3.3.6 | DATE: 2024-12-19 | AUTHOR: VeloHub Development Team
import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box, Menu, MenuItem, Avatar, Chip } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { Brightness4, Brightness7, Dashboard, AccountCircle, Logout, ArrowForward } from '@mui/icons-material';
import consoleLogo from '../../assets/console.png';
import { useAuth } from '../../contexts/AuthContext';

const Header = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    // Carregar tema salvo
    const savedTheme = localStorage.getItem('velohub-theme') || 'light';
    const isDark = savedTheme === 'dark';
    setIsDarkMode(isDark);
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('velohub-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('velohub-theme', 'light');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };



  return (
    <AppBar 
      position="static" 
      sx={{ 
        backgroundColor: isDarkMode ? 'var(--cor-header-escuro)' : 'var(--cor-container)',
        color: isDarkMode ? 'var(--texto-principal-escuro)' : 'var(--gray)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        borderBottom: `1px solid ${isDarkMode ? 'var(--divisoria-escura)' : 'var(--borda-escura)'}`
      }}
    >
      <Toolbar>
        <Box
          component="img"
          src={consoleLogo}
          alt="VeloHub Logo"
          onClick={() => navigate('/')}
          sx={{
            height: 40,
            width: 'auto',
            cursor: 'pointer',
            mr: 2,
            transition: 'opacity 0.3s ease',
            '&:hover': {
              opacity: 0.8
            }
          }}
        />
        
        <Box sx={{ 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Typography 
            variant="h5" 
            component="h1"
            sx={{ 
              fontFamily: 'Poppins',
              fontWeight: 700,
              color: isDarkMode ? 'var(--texto-principal-escuro)' : 'var(--blue-dark)',
              textAlign: 'center',
              whiteSpace: 'nowrap'
            }}
          >
            Console de Conteúdo VeloHub
          </Typography>
        </Box>
        
        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* Sistema de Usuário Logado - LAYOUT_GUIDELINES */}
        {user && (
          <Box 
            id="user-info"
            className="user-info"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #e0e0e0',
              position: 'relative',
              zIndex: 10,
              transition: 'all 0.3s ease',
              mr: 2,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: '#f5f5f5',
                border: '1px solid #d0d0d0'
              }
            }}
          >
            {/* Avatar do Usuário */}
            <Box
              component="img"
              id="user-avatar"
              className="user-avatar"
              src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome)}&background=1634FF&color=fff&size=32&bold=true`}
              alt="Avatar"
              sx={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />

            {/* Nome do Usuário */}
            <Typography
              id="user-name"
              className="user-name"
              sx={{
                color: 'var(--cor-texto)',
                fontWeight: 500,
                fontSize: '0.9rem',
                fontFamily: 'Poppins',
                maxWidth: '150px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {user.nome}
            </Typography>

            {/* Botão de Logout */}
            <Box
              component="button"
              id="logout-btn"
              className="logout-btn"
              title="Logout"
              onClick={handleLogout}
              sx={{
                background: 'none',
                border: 'none',
                color: 'var(--cor-texto-secundario)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                transition: 'color 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': {
                  color: 'var(--cor-accent)',
                  backgroundColor: 'rgba(22, 52, 255, 0.1)'
                }
              }}
            >
              <ArrowForward sx={{ fontSize: '1.1rem', color: '#1634FF' }} />
            </Box>
          </Box>
        )}

          <IconButton
            color="inherit"
            onClick={toggleTheme}
            aria-label="toggle theme"
          >
            {isDarkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Box>
      </Toolbar>

    </AppBar>
  );
};

export default Header;
