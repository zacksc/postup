import { Toaster } from '@/components/ui/sonner'
import { AppRoutes } from '@/routes'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/hooks/use-auth'
import { ProfileProvider } from '@/hooks/use-profile'
import { TeamProvider } from '@/hooks/use-teams'

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <ProfileProvider>
          <TeamProvider>
            <Toaster position="bottom-right" visibleToasts={3} duration={4000} richColors />
            <AppRoutes />
          </TeamProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
