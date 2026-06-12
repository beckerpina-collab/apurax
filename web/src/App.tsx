import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import { EmpresaProvider } from './lib/empresa-context';
import Apuracoes from './pages/Apuracoes';
import Bling from './pages/Bling';
import Cadastro from './pages/Cadastro';
import Captura from './pages/Captura';
import Configuracao from './pages/Configuracao';
import Dashboard from './pages/Dashboard';
import Documentos from './pages/Documentos';
import ImportarXml from './pages/ImportarXml';
import Login from './pages/Login';
import Reforma from './pages/Reforma';
import Validador from './pages/Validador';

function Protegido({ children }: { children: ReactNode }) {
  const { autenticado } = useAuth();
  return autenticado ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route
            element={
              <Protegido>
                <EmpresaProvider>
                  <Layout />
                </EmpresaProvider>
              </Protegido>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/captura" element={<Captura />} />
            <Route path="/documentos" element={<Documentos />} />
            <Route path="/importar" element={<ImportarXml />} />
            <Route path="/apuracoes" element={<Apuracoes />} />
            <Route path="/bling" element={<Bling />} />
            <Route path="/validador" element={<Validador />} />
            <Route path="/reforma" element={<Reforma />} />
            <Route path="/configuracao" element={<Configuracao />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
