import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { Loader2 } from 'lucide-react'

const LabPage = lazy(() => import('@/pages/Lab'))
const LandingPage = lazy(() => import('@/pages/Landing/Landing'))
const DemoPage = lazy(() => import('@/pages/Demo/Demo'))
const PreviewIDPage = lazy(() => import('@/pages/Preview/PreviewID'))
const HomePage = lazy(() => import('@/pages/Home/Home'))
const Cronograma = lazy(() => import('../pages/Cronograma/Cronograma').then(m => ({ default: m.Cronograma })))
const ClientesPage = lazy(() => import('../pages/Clientes/Clientes'))
const NovoClientePage = lazy(() => import('../pages/Clientes/NovoCliente'))
const NovoPostPage = lazy(() => import('../pages/Post/NovoPost'))
const FeedbacksPage = lazy(() => import('../pages/Feedbacks/Feedbacks'))
const PostDetalhePage = lazy(() => import('../pages/Post/PostDetalhe'))
const PostImportPage = lazy(() => import('../pages/Post/PostImport'))
const HistoricoPage = lazy(() => import('../pages/Post/Historico'))
const ClientDetail = lazy(() => import('../pages/Clientes/ClientDetail'))
const PerfilPage = lazy(() => import('../pages/Perfil/Perfil'))
const ConfiguracoesPage = lazy(() => import('../pages/Configuracoes/Configuracoes'))
const ClienteFluxoPage = lazy(() => import('../pages/ClienteFluxo/ClienteFluxo'))
const GridInstagramPage = lazy(() => import('../pages/GridInstagram/GridInstagram'))
const LoginPage = lazy(() => import('@/pages/Login/Login'))
const CadastroPage = lazy(() => import('@/pages/Cadastro/Cadastro'))
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPassword/ForgotPassword'))
const ResetPasswordPage = lazy(() => import('@/pages/ResetPassword/ResetPassword'))
const LogsPage = lazy(() => import('@/pages/Logs/Logs'))
const ChatPage = lazy(() => import('@/pages/Chat/Chat'))
const NotFoundPage = lazy(() => import('@/pages/NotFound/NotFound'))
const DriveCallbackPage = lazy(() => import('@/pages/DriveCallback/DriveCallback'))

function PageFallback() {
  return (
    <div className="h-screen bg-background flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-muted-foreground" />
    </div>
  )
}

const router = createBrowserRouter([
  /* Rotas públicas — fora do AppShell */
  { path: '/', element: <LandingPage /> },
  { path: '/demo', element: <DemoPage /> },
  { path: '/preview', element: <PreviewIDPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/cadastro', element: <CadastroPage /> },
  { path: '/esqueci-senha', element: <ForgotPasswordPage /> },
  { path: '/redefinir-senha', element: <ResetPasswordPage /> },
  { path: '/review/:token', element: <ClienteFluxoPage /> },
  { path: '/drive/callback', element: <DriveCallbackPage /> },

  /* Rotas protegidas — dentro do AppShell */
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/home', element: <HomePage /> },
          { path: '/cronograma', element: <Cronograma /> },
          { path: '/lab', element: <LabPage /> },
          { path: '/posts/novo', element: <NovoPostPage /> },
          { path: '/posts/import', element: <PostImportPage /> },
          { path: '/posts/:id', element: <PostDetalhePage /> },
          { path: '/posts/:id/historico', element: <HistoricoPage /> },
          { path: '/grid/:clientId', element: <GridInstagramPage /> },
          { path: '/clientes/novo', element: <NovoClientePage /> },
          { path: '/clientes/:clientId/editar', element: <NovoClientePage /> },
          { path: '/clientes', element: <ClientesPage /> },
          { path: '/tarefas', element: <FeedbacksPage /> },
          { path: '/feedbacks', element: <Navigate to="/tarefas" replace /> },
          { path: '/clients/:clientId', element: <ClientDetail /> },
          { path: '/perfil', element: <PerfilPage /> },
          { path: '/configuracoes', element: <ConfiguracoesPage /> },
          { path: '/logs', element: <LogsPage /> },
          { path: '/chat', element: <ChatPage /> },
        ],
      },
    ],
  },

  /* 404 */
  { path: '*', element: <NotFoundPage /> },
])

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
