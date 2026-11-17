import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider } from 'antd';
import { useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from '@/auth/AuthContext';
import { useAuth } from '@/auth/useAuth';
import { FeedbackBridge } from '@/components/FeedbackBridge';
import { AuthPage } from '@/pages/AuthPage';
import { CategoryQuestionsPage } from '@/pages/CategoryQuestionsPage';
import { ExamDetailPage } from '@/pages/ExamDetailPage';
import { ExamsPage } from '@/pages/ExamsPage';
import { ImportPage } from '@/pages/ImportPage';
import { PracticePage } from '@/pages/PracticePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { WrongBookPage } from '@/pages/WrongBookPage';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <AuthPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ExamsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exams/:examId"
        element={
          <ProtectedRoute>
            <ExamDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exams/:examId/categories/:categoryId"
        element={
          <ProtectedRoute>
            <CategoryQuestionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/practice/:examId"
        element={
          <ProtectedRoute>
            <PracticePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/import/:examId"
        element={
          <ProtectedRoute>
            <ImportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wrong-book"
        element={
          <ProtectedRoute>
            <WrongBookPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#3d7eff',
          colorText: '#26292e',
          colorBgLayout: '#f5f6f8',
          borderRadius: 12,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
      }}
    >
      <AntdApp>
        <FeedbackBridge />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
