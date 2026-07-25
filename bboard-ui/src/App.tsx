// This file is part of Midnight DICE DApp UI.
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useState } from 'react';
import { Box, Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { MainLayout, Board } from './components';
import { useDeployedBoardContext } from './hooks';
import { type BoardDeployment } from './contexts';
import { type Observable } from 'rxjs';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7c3aed',
      light: '#a78bfa',
      dark: '#5b21b6',
    },
    secondary: {
      main: '#06b6d4',
    },
    background: {
      default: '#090d16',
      paper: '#131b2e',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", sans-serif',
  },
  shape: {
    borderRadius: 16,
  },
});

const App: React.FC = () => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployments, setBoardDeployments] = useState<Array<Observable<BoardDeployment>>>([]);

  useEffect(() => {
    const subscription = boardApiProvider.boardDeployments$.subscribe(setBoardDeployments);
    return () => {
      subscription.unsubscribe();
    };
  }, [boardApiProvider]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ background: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #090d16 70%)', minHeight: '100vh', pb: 6 }}>
        <MainLayout>
          <Container maxWidth="lg">
            {boardDeployments.map((boardDeployment, idx) => (
              <div data-testid={`board-${idx}`} key={`board-${idx}`}>
                <Board boardDeployment$={boardDeployment} />
              </div>
            ))}
            {boardDeployments.length === 0 && (
              <div data-testid="board-start">
                <Board />
              </div>
            )}
          </Container>
        </MainLayout>
      </Box>
    </ThemeProvider>
  );
};

export default App;
