/** Entry route — root navigator handles redirects. */
import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/auth-context';

export default function Index() {
  const { token, role, loading } = useAuth();
  if (loading) return null;
  if (!token) return <Redirect href="/(auth)/welcome" />;
  if (role === 'rider') return <Redirect href="/(rider)" />;
  return <Redirect href="/(auth)/login" />;
}
